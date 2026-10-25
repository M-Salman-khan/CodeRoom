import mongoose, { Schema, model } from "mongoose";

export interface UserRecord {
  _id: string;
  username: string;
  passwordHash: string;
  createdAt: Date;
  updatedAt: Date;
}

export function newObjectId(): string {
  return new mongoose.Types.ObjectId().toString();
}

const userSchema = new Schema<UserRecord>(
  {
    _id: { type: String, default: newObjectId },
    username: { type: String, required: true, unique: true, index: true },
    passwordHash: { type: String, required: true },
  },
  { timestamps: true, versionKey: false, collection: "users" }
);

export const User = model<UserRecord>("User", userSchema);
