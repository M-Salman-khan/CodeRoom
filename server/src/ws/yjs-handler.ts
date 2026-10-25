import { WebSocket } from "ws";
import * as Y from "yjs";
import * as syncProtocol from "y-protocols/sync";
import * as awarenessProtocol from "y-protocols/awareness";
import * as encoding from "lib0/encoding";
import * as decoding from "lib0/decoding";
import { File } from "../models/file";
import type { SessionUser } from "../lib/auth";
import { canUserEdit } from "../lib/permissions";

const MESSAGE_SYNC = 0;
const MESSAGE_AWARENESS = 1;
const MESSAGE_QUERY_AWARENESS = 3;

const DOC_TTL_MS = 5 * 60 * 1000;
const SAVE_DEBOUNCE_MS = 2000;

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
// Guards against two clients opening the same document at the same time: without
// this, both would load separate Y.Doc instances and never see each other's edits.
const pendingDocs = new Map<string, Promise<ManagedDoc | null>>();

function docKey(roomId: string, fileId: string): string {
  return `${roomId}__${fileId}`;
}

export async function getOrCreateDoc(
  roomId: string,
  fileId: string
): Promise<ManagedDoc | null> {
  const key = docKey(roomId, fileId);
  const existing = docs.get(key);
  if (existing) {
    if (existing.destroyTimeout) {
      clearTimeout(existing.destroyTimeout);
      existing.destroyTimeout = null;
    }
    return existing;
  }

  const pending = pendingDocs.get(key);
  if (pending) return pending;

  const loading = loadDoc(key, roomId, fileId).finally(() => {
    pendingDocs.delete(key);
  });
  pendingDocs.set(key, loading);
  return loading;
}

async function loadDoc(
  key: string,
  roomId: string,
  fileId: string
): Promise<ManagedDoc | null> {
  const fileRecord = await File.findOne({ _id: fileId, roomId })
    .select("content yjsState")
    .exec();
  if (!fileRecord) return null;

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

  try {
    if (fileRecord.yjsState && fileRecord.yjsState.length > 0) {
      // Restore the exact CRDT state (keeps client ids / history across restarts).
      Y.applyUpdate(doc, new Uint8Array(fileRecord.yjsState));
    } else if (fileRecord.content) {
      doc.getText("monaco").insert(0, fileRecord.content);
      await File.updateOne(
        { _id: fileId },
        { $set: { yjsState: Buffer.from(Y.encodeStateAsUpdate(doc)) } }
      );
    }
  } catch (err) {
    console.error(`Error loading Yjs state for file ${fileId}:`, err);
  }

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

    if (managed.saveTimeout) {
      clearTimeout(managed.saveTimeout);
    }
    managed.saveTimeout = setTimeout(() => {
      void saveDocToDb(managed);
    }, SAVE_DEBOUNCE_MS);
  });

  awareness.on(
    "update",
    (
      { added, updated, removed }: { added: number[]; updated: number[]; removed: number[] },
      origin: unknown
    ) => {
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
    }
  );

  docs.set(key, managed);
  return managed;
}

async function saveDocToDb(managed: ManagedDoc): Promise<void> {
  try {
    const exists = await File.exists({ _id: managed.fileId });
    if (!exists) return;

    const currentText = managed.doc.getText("monaco").toString();
    const yjsState = Buffer.from(Y.encodeStateAsUpdate(managed.doc));

    await File.updateOne(
      { _id: managed.fileId },
      { $set: { content: currentText, yjsState } }
    );
  } catch (err) {
    console.error(`Error autosaving file ${managed.fileId}:`, err);
  }
}

/** Flush every in-memory document to MongoDB. */
export async function flushAllDocs(): Promise<void> {
  const promises: Promise<void>[] = [];
  for (const managed of docs.values()) {
    if (managed.saveTimeout) {
      clearTimeout(managed.saveTimeout);
      managed.saveTimeout = null;
    }
    promises.push(saveDocToDb(managed));
  }
  await Promise.allSettled(promises);
}

function destroyManagedDoc(managed: ManagedDoc): void {
  if (managed.saveTimeout) {
    clearTimeout(managed.saveTimeout);
    managed.saveTimeout = null;
  }
  if (managed.destroyTimeout) {
    clearTimeout(managed.destroyTimeout);
    managed.destroyTimeout = null;
  }
  managed.awareness.destroy();
  managed.doc.destroy();
}

/** Drop a single in-memory document (used when a file is deleted). */
export function closeFileDoc(roomId: string, fileId: string): void {
  const key = docKey(roomId, fileId);
  const managed = docs.get(key);
  if (!managed) return;
  docs.delete(key);
  destroyManagedDoc(managed);
}

export function closeRoomDocs(roomId: string): void {
  for (const [key, managed] of docs.entries()) {
    if (managed.roomId === roomId) {
      docs.delete(key);
      destroyManagedDoc(managed);
    }
  }
}

/** Flush and tear down all Yjs state during graceful shutdown. */
export async function shutdownYjs(): Promise<void> {
  await flushAllDocs();
  for (const managed of docs.values()) {
    destroyManagedDoc(managed);
  }
  docs.clear();
}

function sendBinary(conn: WebSocket, message: Uint8Array): void {
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
  user: SessionUser
): Promise<void> {
  const separator = docName.indexOf("__");
  const roomId = separator >= 0 ? docName.slice(0, separator) : docName;
  const fileId = separator >= 0 ? docName.slice(separator + 2) : docName;

  ws.binaryType = "nodebuffer";

  // Buffer messages while the document loads from MongoDB.
  const earlyMessages: Array<ArrayBuffer | Buffer> = [];
  const bufferHandler = (data: ArrayBuffer | Buffer) => {
    earlyMessages.push(data);
  };
  ws.on("message", bufferHandler);

  const managed = await getOrCreateDoc(roomId, fileId);
  ws.off("message", bufferHandler);

  if (!managed) {
    ws.close(1008, "File not found");
    return;
  }

  if (ws.readyState !== WebSocket.OPEN) {
    return;
  }

  managed.clients.add(ws);
  const clientAwarenessIds = new Set<number>();

  // 1. Sync step 1
  {
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, MESSAGE_SYNC);
    syncProtocol.writeSyncStep1(encoder, managed.doc);
    sendBinary(ws, encoding.toUint8Array(encoder));
  }

  // 2. Current awareness states
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

  const handleMessage = async (data: ArrayBuffer | Buffer) => {
    try {
      const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data);
      const decoder = decoding.createDecoder(new Uint8Array(buffer));
      const messageType = decoding.readVarUint(decoder);

      switch (messageType) {
        case MESSAGE_SYNC: {
          const syncMessageType = decoding.peekVarUint(decoder);
          if (syncMessageType === syncProtocol.messageYjsUpdate) {
            const allowed = await canUserEdit(user.id, managed.roomId, managed.fileId);
            if (!allowed) {
              // Read-only collaborator: ignore any attempted document update.
              break;
            }
          }
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
              const clientId = decoding.readVarUint(uDecoder);
              clientAwarenessIds.add(clientId);
              decoding.readVarUint(uDecoder); // clock
              decoding.readVarString(uDecoder); // state
            }
          } catch {
            // ignore malformed awareness payload
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

  for (const earlyMessage of earlyMessages) {
    void handleMessage(earlyMessage);
  }

  ws.on("close", () => {
    managed.clients.delete(ws);

    if (clientAwarenessIds.size > 0) {
      awarenessProtocol.removeAwarenessStates(
        managed.awareness,
        Array.from(clientAwarenessIds),
        null
      );
    }

    if (managed.clients.size === 0) {
      if (managed.saveTimeout) {
        clearTimeout(managed.saveTimeout);
        managed.saveTimeout = null;
      }
      void saveDocToDb(managed);

      managed.destroyTimeout = setTimeout(() => {
        if (managed.clients.size === 0) {
          const key = docKey(managed.roomId, managed.fileId);
          docs.delete(key);
          destroyManagedDoc(managed);
        }
      }, DOC_TTL_MS);
      managed.destroyTimeout.unref?.();
    }
  });
}
