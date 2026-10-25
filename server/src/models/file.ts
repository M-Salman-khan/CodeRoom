import { Schema, model } from "mongoose";
import { newObjectId } from "./user";

export type FileType = "file" | "folder";

export interface FileRecord {
  _id: string;
  roomId: string;
  parentId: string | null;
  name: string;
  type: FileType;
  language: string | null;
  content: string;
  yjsState: Buffer | null;
  createdAt: Date;
  updatedAt: Date;
}

const fileSchema = new Schema<FileRecord>(
  {
    _id: { type: String, default: newObjectId },
    roomId: { type: String, required: true, index: true, ref: "Room" },
    parentId: { type: String, default: null, index: true },
    name: { type: String, required: true },
    type: { type: String, enum: ["file", "folder"], default: "file" },
    language: { type: String, default: "plaintext" },
    content: { type: String, default: "" },
    yjsState: { type: Buffer, default: null },
  },
  { timestamps: true, versionKey: false, collection: "files" }
);

export const File = model<FileRecord>("File", fileSchema);
