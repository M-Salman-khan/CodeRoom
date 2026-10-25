import { Schema, model } from "mongoose";
import { newObjectId } from "./user";

export interface RoomRecord {
  _id: string;
  roomCode: string;
  name: string;
  description: string | null;
  passwordHash: string | null;
  isPublic: boolean;
  ownerId: string;
  createdAt: Date;
  updatedAt: Date;
}

const roomSchema = new Schema<RoomRecord>(
  {
    _id: { type: String, default: newObjectId },
    roomCode: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true },
    description: { type: String, default: null },
    passwordHash: { type: String, default: null },
    isPublic: { type: Boolean, default: true },
    ownerId: { type: String, required: true, index: true, ref: "User" },
  },
  { timestamps: true, versionKey: false, collection: "rooms" }
);

export const Room = model<RoomRecord>("Room", roomSchema);
