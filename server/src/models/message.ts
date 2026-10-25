import { Schema, model } from "mongoose";
import { newObjectId } from "./user";

export interface MessageRecord {
  _id: string;
  roomId: string;
  userId: string;
  content: string;
  createdAt: Date;
}

const messageSchema = new Schema<MessageRecord>(
  {
    _id: { type: String, default: newObjectId },
    roomId: { type: String, required: true, index: true, ref: "Room" },
    userId: { type: String, required: true, index: true, ref: "User" },
    content: { type: String, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false }, versionKey: false, collection: "messages" }
);

messageSchema.index({ roomId: 1, createdAt: 1 });

export const Message = model<MessageRecord>("Message", messageSchema);
