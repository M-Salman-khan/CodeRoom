#!/usr/bin/env node
/**
 * Migrate the legacy Next.js/Prisma SQLite database (prisma/dev.db) into MongoDB.
 *
 * Usage:
 *   node scripts/migrate-sqlite-to-mongo.mjs            # upsert (safe to re-run)
 *   node scripts/migrate-sqlite-to-mongo.mjs --fresh    # wipe target collections first
 *   node scripts/migrate-sqlite-to-mongo.mjs --dry-run  # report only
 *
 * Runs with Node's built-in `node:sqlite` (Node 22.5+/24). Existing ids, bcrypt
 * password hashes, timestamps, Yjs state and permissions are preserved.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { DatabaseSync } from "node:sqlite";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const explicitDb = process.argv.find((arg) => arg.endsWith(".db"));
const sqliteCandidates = [
  explicitDb,
  path.join(repoRoot, "prisma", "dev.db"),
  path.join(repoRoot, "legacy-next", "prisma", "dev.db"),
].filter(Boolean);
const sqlitePath = sqliteCandidates.find((candidate) => fs.existsSync(candidate)) ||
  sqliteCandidates[0];
const fresh = process.argv.includes("--fresh");
const dryRun = process.argv.includes("--dry-run");

if (!fs.existsSync(sqlitePath)) {
  console.error(`✖ Legacy database not found: ${sqlitePath}`);
  console.error("  Nothing to migrate. Use `npm run seed` for demo data instead.");
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Environment (root .env, then server/.env, then process.env)
// ---------------------------------------------------------------------------
function readEnvFile(file) {
  if (!fs.existsSync(file)) return {};
  const out = {};
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!match) continue;
    out[match[1]] = match[2].replace(/^["']|["']$/g, "");
  }
  return out;
}

const env = {
  ...readEnvFile(path.join(repoRoot, ".env")),
  ...readEnvFile(path.join(repoRoot, "server", ".env")),
  ...process.env,
};
const mongoUri = env.MONGODB_URI || "mongodb://127.0.0.1:27017/coderoom";

const requireFromServer = createRequire(path.join(repoRoot, "server", "package.json"));
const mongoose = requireFromServer("mongoose");

// ---------------------------------------------------------------------------
// Read SQLite
// ---------------------------------------------------------------------------
const sqlite = new DatabaseSync(sqlitePath);
const read = (table) => {
  try {
    return sqlite.prepare(`SELECT * FROM "${table}"`).all();
  } catch {
    return [];
  }
};

const toDate = (value) => {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value;
  if (typeof value === "number") return new Date(value);
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const toBuffer = (value) => {
  if (value === null || value === undefined) return null;
  return Buffer.isBuffer(value) ? value : Buffer.from(value);
};

const parseAllowedFiles = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const users = read("User").map((row) => ({
  _id: row.id,
  username: row.username,
  passwordHash: row.passwordHash,
  createdAt: toDate(row.createdAt),
  updatedAt: toDate(row.updatedAt),
}));

const rooms = read("Room").map((row) => ({
  _id: row.id,
  roomCode: row.roomCode,
  name: row.name,
  description: row.description ?? null,
  passwordHash: row.passwordHash ?? null,
  isPublic: Boolean(row.isPublic),
  ownerId: row.ownerId,
  createdAt: toDate(row.createdAt),
  updatedAt: toDate(row.updatedAt),
}));

const roommembers = read("RoomMember").map((row) => ({
  _id: row.id,
  roomId: row.roomId,
  userId: row.userId,
  role: row.role,
  canEdit: Boolean(row.canEdit),
  allowedFiles: parseAllowedFiles(row.allowedFiles),
  joinedAt: toDate(row.joinedAt),
}));

const files = read("File").map((row) => ({
  _id: row.id,
  roomId: row.roomId,
  parentId: row.parentId ?? null,
  name: row.name,
  type: row.type,
  language: row.language ?? "plaintext",
  content: row.content ?? "",
  yjsState: toBuffer(row.yjsState),
  createdAt: toDate(row.createdAt),
  updatedAt: toDate(row.updatedAt),
}));

const messages = read("Message").map((row) => ({
  _id: row.id,
  roomId: row.roomId,
  userId: row.userId,
  content: row.content,
  createdAt: toDate(row.createdAt),
}));

const permissionrequests = read("PermissionRequest").map((row) => ({
  _id: row.id,
  roomId: row.roomId,
  userId: row.userId,
  fileId: row.fileId ?? null,
  status: row.status,
  createdAt: toDate(row.createdAt),
  updatedAt: toDate(row.updatedAt),
}));

const collections = [
  ["users", users],
  ["rooms", rooms],
  ["roommembers", roommembers],
  ["files", files],
  ["messages", messages],
  ["permissionrequests", permissionrequests],
];

console.log("CodeRoom — legacy SQLite → MongoDB migration");
console.log(`  source:  ${sqlitePath}`);
console.log(`  target:  ${mongoUri.replace(/\/\/[^@]*@/, "//***@")}`);
console.log("  rows:   " + collections.map(([name, rows]) => `${name}=${rows.length}`).join(", "));

if (dryRun) {
  console.log("Dry run complete — no data written.");
  process.exit(0);
}

await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 10000 });
const db = mongoose.connection.db;

// Safety: merging legacy data into an already-populated database can create
// duplicate usernames/room codes. Allow idempotent re-runs when every legacy
// user id already exists, otherwise ask for an explicit --fresh.
if (!fresh) {
  const existingUsers = await db.collection("users").countDocuments();
  const existingRooms = await db.collection("rooms").countDocuments();
  const legacyUserIds = users.map((user) => user._id);
  const alreadyImported = existingUsers > 0
    ? await db.collection("users").countDocuments({ _id: { $in: legacyUserIds } })
    : 0;

  if ((existingUsers > 0 || existingRooms > 0) && alreadyImported === 0) {
    console.error("\n✖ The target MongoDB already contains data (users/rooms).");
    console.error("  To replace it with the legacy SQLite data, run:");
    console.error("    node scripts/migrate-sqlite-to-mongo.mjs --fresh");
    console.error("  If you only want demo data, run `npm run seed` instead.");
    await mongoose.disconnect();
    sqlite.close();
    process.exit(1);
  }
}

for (const [name, rows] of collections) {
  const collection = db.collection(name);
  if (fresh) {
    await collection.deleteMany({});
  }
  if (rows.length === 0) continue;

  const operations = rows.map((row) => ({
    updateOne: {
      filter: { _id: row._id },
      update: { $set: row },
      upsert: true,
    },
  }));

  const result = await collection.bulkWrite(operations, { ordered: false });
  console.log(
    `  ✓ ${name}: ${result.upsertedCount} inserted, ${result.modifiedCount} updated, ` +
      `${result.matchedCount} matched`
  );
}

// Keep the unique/compound indexes in sync with the Mongoose models.
await db.collection("users").createIndex({ username: 1 }, { unique: true });
await db.collection("rooms").createIndex({ roomCode: 1 }, { unique: true });
await db.collection("roommembers").createIndex({ roomId: 1, userId: 1 }, { unique: true });
await db.collection("files").createIndex({ roomId: 1 });
await db.collection("messages").createIndex({ roomId: 1, createdAt: 1 });
await db.collection("permissionrequests").createIndex({ roomId: 1, status: 1 });

await mongoose.disconnect();
sqlite.close();
console.log("\n✅ Migration complete. Existing passwords and sessions data are preserved.");
console.log("   Start the app with `npm run dev` and log in with your old credentials.");
