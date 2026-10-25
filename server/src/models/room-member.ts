import { Schema, model } from "mongoose";
import { newObjectId } from "./user";

export type RoomRole = "OWNER" | "EDITOR" | "MEMBER";

export interface RoomMemberRecord {
  _id: string;
  roomId: string;
  userId: string;
  role: RoomRole;
  canEdit: boolean;
  allowedFiles: string[];
  joinedAt: Date;
}

const roomMemberSchema = new Schema<RoomMemberRecord>(
  {
    _id: { type: String, default: newObjectId },
    roomId: { type: String, required: true, index: true, ref: "Room" },
    userId: { type: String, required: true, index: true, ref: "User" },
    role: { type: String, enum: ["OWNER", "EDITOR", "MEMBER"], default: "MEMBER" },
    canEdit: { type: Boolean, default: false },
    allowedFiles: { type: [String], default: [] },
    joinedAt: { type: Date, default: Date.now },
  },
  { versionKey: false, collection: "roommembers" }
);

roomMemberSchema.index({ roomId: 1, userId: 1 }, { unique: true });

export const RoomMember = model<RoomMemberRecord>("RoomMember", roomMemberSchema);
