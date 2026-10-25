import { Schema, model } from "mongoose";
import { newObjectId } from "./user";

export type PermissionStatus = "PENDING" | "APPROVED" | "DECLINED";

export interface PermissionRequestRecord {
  _id: string;
  roomId: string;
  userId: string;
  fileId: string | null;
  status: PermissionStatus;
  createdAt: Date;
  updatedAt: Date;
}

const permissionRequestSchema = new Schema<PermissionRequestRecord>(
  {
    _id: { type: String, default: newObjectId },
    roomId: { type: String, required: true, index: true, ref: "Room" },
    userId: { type: String, required: true, index: true, ref: "User" },
    fileId: { type: String, default: null, index: true },
    status: {
      type: String,
      enum: ["PENDING", "APPROVED", "DECLINED"],
      default: "PENDING",
    },
  },
  { timestamps: true, versionKey: false, collection: "permissionrequests" }
);

permissionRequestSchema.index({ roomId: 1, status: 1 });

export const PermissionRequest = model<PermissionRequestRecord>(
  "PermissionRequest",
  permissionRequestSchema
);
