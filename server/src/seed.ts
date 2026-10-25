import { env } from "./config/env";
import { connectDatabase, disconnectDatabase } from "./config/database";
import { hashPassword } from "./lib/auth";
import { buildYjsState } from "./lib/yjs-state";
import { File } from "./models/file";
import { Message } from "./models/message";
import { PermissionRequest } from "./models/permission-request";
import { Room } from "./models/room";
import { RoomMember } from "./models/room-member";
import { User } from "./models/user";
import { deleteRoomCascade, deleteUserCascade } from "./services/cascade";

const INDEX_TS = `// Welcome to CodeRoom!
// Multiple users can edit this file simultaneously in real-time.

interface Collaborator {
  name: string;
  role: string;
  status: "online" | "offline";
}

const team: Collaborator[] = [
  { name: "Salman", role: "Fullstack Dev", status: "online" },
  { name: "Rahul", role: "Frontend Dev", status: "online" },
];

function greet(collaborators: Collaborator[]): void {
  console.log("🚀 Welcome to CodeRoom - Code together. Anywhere.");
  collaborators.forEach((member) => {
    console.log(\`🟢 \${member.name} (\${member.role}) is \${member.status}\`);
  });
}

greet(team);
`;

const UTILS_TS = `export function add(a: number, b: number): number {
  return a + b;
}

export function multiply(a: number, b: number): number {
  return a * b;
}
`;

const README_MD = `# 🚀 CodeRoom Project

Code together. Anywhere.

## Features
- **Real-Time Code Collaboration**: Powered by Yjs CRDT and Monaco Editor
- **Remote Cursors & Presence**: See active collaborators and their cursor locations
- **Built-in Room Chat**: Instant messaging with conversation history
- **File Explorer**: Create, rename, delete, and switch between multiple files
- **LAN + Internet Support**: Works on your local Wi-Fi or public servers
`;

async function createTextFile(
  roomId: string,
  parentId: string | null,
  name: string,
  language: string,
  content: string
): Promise<void> {
  await File.create({
    roomId,
    parentId,
    name,
    type: "file",
    language,
    content,
    yjsState: buildYjsState(content),
  });
}

async function seed(): Promise<void> {
  console.log("🌱 Seeding CodeRoom database...");
  await connectDatabase();

  // Reconcile indexes with the schema. Older databases using the same name may
  // carry unrelated unique indexes (e.g. users.email, rooms.roomId) that would
  // reject new documents, so drop anything the current models do not declare.
  await Promise.all([
    User.syncIndexes(),
    Room.syncIndexes(),
    RoomMember.syncIndexes(),
    File.syncIndexes(),
    Message.syncIndexes(),
    PermissionRequest.syncIndexes(),
  ]);

  // Idempotency: remove previous demo users (and everything they own) first.
  const existingUsers = await User.find({
    username: { $regex: /^(demo|collaborator)$/i },
  })
    .select("_id username")
    .exec();
  for (const user of existingUsers) {
    await deleteUserCascade(user._id);
  }

  // Replace the demo room even if it was created by another user.
  const existingDemoRoom = await Room.findOne({ roomCode: "DEMO01" }).select("_id").exec();
  if (existingDemoRoom) {
    await deleteRoomCascade(existingDemoRoom._id);
  }

  const passwordHash = await hashPassword("password123");

  const demoUser = await User.create({ username: "demo", passwordHash });
  const collaboratorUser = await User.create({ username: "collaborator", passwordHash });

  console.log(`Created users: ${demoUser.username}, ${collaboratorUser.username}`);

  const room = await Room.create({
    roomCode: "DEMO01",
    name: "Getting Started with CodeRoom",
    description: "A collaborative sandbox room to test real-time editing, chat, and files.",
    ownerId: demoUser._id,
    isPublic: true,
  });

  await RoomMember.insertMany([
    {
      roomId: room._id,
      userId: demoUser._id,
      role: "OWNER",
      canEdit: false,
      allowedFiles: [],
    },
    {
      roomId: room._id,
      userId: collaboratorUser._id,
      role: "MEMBER",
      canEdit: false,
      allowedFiles: [],
    },
  ]);

  console.log(`Created room: ${room.name} (${room.roomCode})`);

  const srcFolder = await File.create({
    roomId: room._id,
    parentId: null,
    name: "src",
    type: "folder",
    language: null,
    content: "",
  });

  await createTextFile(room._id, srcFolder._id, "index.ts", "typescript", INDEX_TS);
  await createTextFile(room._id, srcFolder._id, "utils.ts", "typescript", UTILS_TS);
  await createTextFile(room._id, null, "README.md", "markdown", README_MD);

  await Message.create({
    roomId: room._id,
    userId: demoUser._id,
    content: "Welcome to CodeRoom! Start editing code or chatting right here.",
  });
  await Message.create({
    roomId: room._id,
    userId: collaboratorUser._id,
    content: "Hey! Excited to test real-time collaboration 🚀",
  });

  console.log("✅ Database seeded successfully!");
  console.log("   demo / password123 (owner)");
  console.log("   collaborator / password123 (member)");
  console.log(`   room code: ${room.roomCode}`);
}

seed()
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      await disconnectDatabase();
    } catch {
      // ignore disconnect errors
    }
    console.log(`Done against ${env.MONGODB_URI}`);
  });
