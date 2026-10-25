import * as Y from "yjs";

/** Build an initial CRDT update for a plain text file (Monaco text key). */
export function buildYjsState(content: string): Buffer {
  const doc = new Y.Doc();
  if (content) {
    doc.getText("monaco").insert(0, content);
  }
  const update = Y.encodeStateAsUpdate(doc);
  doc.destroy();
  return Buffer.from(update);
}
