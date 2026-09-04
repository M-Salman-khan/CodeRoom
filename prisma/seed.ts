import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding database...");

  // Clean existing demo user/room if present
  await prisma.user.deleteMany({
    where: { username: { in: ["demo", "collaborator"] } },
  });

  const passwordHash = await bcrypt.hash("password123", 10);

  const demoUser = await prisma.user.create({
    data: {
      username: "demo",
      passwordHash,
    },
  });

  const collaboratorUser = await prisma.user.create({
    data: {
      username: "collaborator",
      passwordHash,
    },
  });

  console.log(`Created users: ${demoUser.username}, ${collaboratorUser.username}`);

  const demoRoom = await prisma.room.create({
    data: {
      roomCode: "DEMO01",
      name: "Getting Started with CodeRoom",
      description: "A collaborative sandbox room to test real-time editing, chat, and files.",
      ownerId: demoUser.id,
      isPublic: true,
      members: {
        create: [
          { userId: demoUser.id, role: "OWNER" },
          { userId: collaboratorUser.id, role: "MEMBER" },
        ],
      },
    },
  });

  console.log(`Created room: ${demoRoom.name} (${demoRoom.roomCode})`);

  // Create folder 'src'
  const srcFolder = await prisma.file.create({
    data: {
      roomId: demoRoom.id,
      name: "src",
      type: "folder",
    },
  });

  // Create files
  await prisma.file.create({
    data: {
      roomId: demoRoom.id,
      parentId: srcFolder.id,
      name: "index.ts",
      type: "file",
      language: "typescript",
      content: `// Welcome to CodeRoom!
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
`,
    },
  });

  await prisma.file.create({
    data: {
      roomId: demoRoom.id,
      parentId: srcFolder.id,
      name: "utils.ts",
      type: "file",
      language: "typescript",
      content: `export function add(a: number, b: number): number {
  return a + b;
}

export function multiply(a: number, b: number): number {
  return a * b;
}
`,
    },
  });

  await prisma.file.create({
    data: {
      roomId: demoRoom.id,
      name: "README.md",
      type: "file",
      language: "markdown",
      content: `# 🚀 CodeRoom Project

Code together. Anywhere.

## Features
- **Real-Time Code Collaboration**: Powered by Yjs CRDT and Monaco Editor
- **Remote Cursors & Presence**: See active collaborators and their cursor locations
- **Built-in Room Chat**: Instant messaging with conversation history
- **File Explorer**: Create, rename, delete, and switch between multiple files
- **LAN + Internet Support**: Works on your local Wi-Fi or public servers
`,
    },
  });

  // Seed initial chat messages
  await prisma.message.create({
    data: {
      roomId: demoRoom.id,
      userId: demoUser.id,
      content: "Welcome to CodeRoom! Start editing code or chatting right here.",
    },
  });

  await prisma.message.create({
    data: {
      roomId: demoRoom.id,
      userId: collaboratorUser.id,
      content: "Hey! Excited to test real-time collaboration 🚀",
    },
  });

  console.log("✅ Database seeded successfully!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
