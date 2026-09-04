import { WebSocket } from "ws";
import * as Y from "yjs";
import * as syncProtocol from "y-protocols/sync";
import * as awarenessProtocol from "y-protocols/awareness";
import * as encoding from "lib0/encoding";
import * as decoding from "lib0/decoding";
import { db } from "../lib/db";
import { SessionUser } from "../lib/auth";

const MESSAGE_SYNC = 0;
const MESSAGE_AWARENESS = 1;
const MESSAGE_QUERY_AWARENESS = 3;

interface ManagedDoc {
  doc: Y.Doc;
  awareness: awarenessProtocol.Awareness;
  clients: Set<WebSocket>;
  fileId: string;
  roomId: string;
  saveTimeout: NodeJS.Timeout | null;
  destroyTimeout: NodeJS.Timeout | null;
}

const docs = new Map<string, ManagedDoc>();

async function getOrCreateDoc(docName: string): Promise<ManagedDoc> {
  const existing = docs.get(docName);
  if (existing) {
    if (existing.destroyTimeout) {
      clearTimeout(existing.destroyTimeout);
      existing.destroyTimeout = null;
    }
    return existing;
  }

  // docName format: `${roomId}__${fileId}`
  const parts = docName.split("__");
  const roomId = parts[0];
  const fileId = parts[1] || parts[0];

  const doc = new Y.Doc();
  const awareness = new awarenessProtocol.Awareness(doc);
  const clients = new Set<WebSocket>();

  const managed: ManagedDoc = {
    doc,
    awareness,
    clients,
    fileId,
    roomId,
    saveTimeout: null,
    destroyTimeout: null,
  };

  // Seed with existing database content if fileId is valid
  try {
    const fileRecord = await db.file.findUnique({
      where: { id: fileId },
      select: { content: true },
    });

    if (fileRecord && fileRecord.content) {
      const yText = doc.getText("monaco");
      yText.insert(0, fileRecord.content);
    }
  } catch (err) {
    console.error(`Error loading initial content for file ${fileId}:`, err);
  }

  // Listen to doc updates to broadcast to peers and debounce save
  doc.on("update", (update: Uint8Array, origin: unknown) => {
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, MESSAGE_SYNC);
    syncProtocol.writeUpdate(encoder, update);
    const message = encoding.toUint8Array(encoder);

    for (const client of clients) {
      if (client !== origin && client.readyState === WebSocket.OPEN) {
        sendBinary(client, message);
      }
    }

    // Debounce save to database
    if (managed.saveTimeout) {
      clearTimeout(managed.saveTimeout);
    }
    managed.saveTimeout = setTimeout(async () => {
      await saveDocToDb(managed);
    }, 2000);
  });

  // Listen to awareness updates to broadcast remote cursors
  awareness.on("update", ({ added, updated, removed }: { added: number[]; updated: number[]; removed: number[] }, origin: unknown) => {
    const changedClients = added.concat(updated, removed);
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, MESSAGE_AWARENESS);
    encoding.writeVarUint8Array(
      encoder,
      awarenessProtocol.encodeAwarenessUpdate(awareness, changedClients)
    );
    const message = encoding.toUint8Array(encoder);

    for (const client of clients) {
      if (client !== origin && client.readyState === WebSocket.OPEN) {
        sendBinary(client, message);
      }
    }
  });

  docs.set(docName, managed);
  return managed;
}

async function saveDocToDb(managed: ManagedDoc) {
  try {
    const exists = await db.file.findUnique({
      where: { id: managed.fileId },
      select: { id: true },
    });
    if (!exists) return;

    const yText = managed.doc.getText("monaco");
    const currentText = yText.toString();
    await db.file.update({
      where: { id: managed.fileId },
      data: { content: currentText },
    });
  } catch (err) {
    console.error(`Error autosaving file ${managed.fileId}:`, err);
  }
}

function sendBinary(conn: WebSocket, message: Uint8Array) {
  if (conn.readyState === WebSocket.OPEN) {
    conn.send(message, (err) => {
      if (err) {
        console.error("Error sending binary Yjs message:", err);
      }
    });
  }
}

export async function handleYjsConnection(
  ws: WebSocket,
  docName: string,
  _user: SessionUser
) {
  ws.binaryType = "nodebuffer";

  // Buffer any messages arriving while loading doc from DB
  const earlyMessages: (ArrayBuffer | Buffer)[] = [];
  const bufferHandler = (data: ArrayBuffer | Buffer) => {
    earlyMessages.push(data);
  };
  ws.on("message", bufferHandler);

  const managed = await getOrCreateDoc(docName);
  ws.off("message", bufferHandler);

  if (ws.readyState !== WebSocket.OPEN) {
    return;
  }

  managed.clients.add(ws);
  const clientAwarenessIds = new Set<number>();

  // 1. Send sync step 1
  {
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, MESSAGE_SYNC);
    syncProtocol.writeSyncStep1(encoder, managed.doc);
    sendBinary(ws, encoding.toUint8Array(encoder));
  }

  // 2. Send current awareness states
  {
    const awarenessStates = managed.awareness.getStates();
    if (awarenessStates.size > 0) {
      const encoder = encoding.createEncoder();
      encoding.writeVarUint(encoder, MESSAGE_AWARENESS);
      encoding.writeVarUint8Array(
        encoder,
        awarenessProtocol.encodeAwarenessUpdate(
          managed.awareness,
          Array.from(awarenessStates.keys())
        )
      );
      sendBinary(ws, encoding.toUint8Array(encoder));
    }
  }

  // Handle incoming messages
  const handleMessage = (data: ArrayBuffer | Buffer) => {
    try {
      const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data);
      const decoder = decoding.createDecoder(new Uint8Array(buffer));
      const messageType = decoding.readVarUint(decoder);

      switch (messageType) {
        case MESSAGE_SYNC: {
          const encoder = encoding.createEncoder();
          encoding.writeVarUint(encoder, MESSAGE_SYNC);
          syncProtocol.readSyncMessage(decoder, encoder, managed.doc, ws);
          if (encoding.length(encoder) > 1) {
            sendBinary(ws, encoding.toUint8Array(encoder));
          }
          break;
        }
        case MESSAGE_AWARENESS: {
          const update = decoding.readVarUint8Array(decoder);
          try {
            const uDecoder = decoding.createDecoder(update);
            const len = decoding.readVarUint(uDecoder);
            for (let i = 0; i < len; i++) {
              const cId = decoding.readVarUint(uDecoder);
              clientAwarenessIds.add(cId);
              decoding.readVarUint(uDecoder); // clock
              decoding.readVarString(uDecoder); // state
            }
          } catch {
            // ignore decode error
          }
          awarenessProtocol.applyAwarenessUpdate(managed.awareness, update, ws);
          break;
        }
        case MESSAGE_QUERY_AWARENESS: {
          const encoder = encoding.createEncoder();
          encoding.writeVarUint(encoder, MESSAGE_AWARENESS);
          encoding.writeVarUint8Array(
            encoder,
            awarenessProtocol.encodeAwarenessUpdate(
              managed.awareness,
              Array.from(managed.awareness.getStates().keys())
            )
          );
          sendBinary(ws, encoding.toUint8Array(encoder));
          break;
        }
        default:
          break;
      }
    } catch (err) {
      console.error("Error processing Yjs message:", err);
    }
  };

  ws.on("message", handleMessage);

  // Process any early buffered messages
  for (const earlyMsg of earlyMessages) {
    handleMessage(earlyMsg);
  }

  // Handle disconnection
  ws.on("close", async () => {
    managed.clients.delete(ws);

    // Remove client's awareness states if known
    if (clientAwarenessIds.size > 0) {
      awarenessProtocol.removeAwarenessStates(
        managed.awareness,
        Array.from(clientAwarenessIds),
        null
      );
    }

    // If no more clients connected, flush save immediately
    if (managed.clients.size === 0) {
      if (managed.saveTimeout) {
        clearTimeout(managed.saveTimeout);
        managed.saveTimeout = null;
      }
      await saveDocToDb(managed);

      // Keep doc in memory for 5 minutes in case of quick reconnection or tab reload
      managed.destroyTimeout = setTimeout(() => {
        if (managed.clients.size === 0) {
          managed.awareness.destroy();
          managed.doc.destroy();
          docs.delete(docName);
        }
      }, 5 * 60 * 1000);
    }
  });
}
