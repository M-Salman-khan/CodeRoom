import mongoose from "mongoose";
import { env } from "./env";

export async function connectDatabase(uri: string = env.MONGODB_URI): Promise<void> {
  mongoose.set("strictQuery", true);
  await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 8000,
  });
  console.log(`🍃 Connected to MongoDB (${mongoose.connection.name})`);
}

export function getDatabaseState(): "connected" | "connecting" | "disconnecting" | "disconnected" {
  switch (mongoose.connection.readyState) {
    case 1:
      return "connected";
    case 2:
      return "connecting";
    case 3:
      return "disconnecting";
    default:
      return "disconnected";
  }
}

export async function pingDatabase(): Promise<boolean> {
  if (mongoose.connection.readyState !== 1 || !mongoose.connection.db) {
    return false;
  }
  try {
    await mongoose.connection.db.admin().ping();
    return true;
  } catch {
    return false;
  }
}

export async function disconnectDatabase(): Promise<void> {
  await mongoose.disconnect();
}
