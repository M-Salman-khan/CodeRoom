import http from "http";
import { WebSocket } from "ws";
import * as Y from "yjs";
import * as syncProtocol from "y-protocols/sync";
import * as awarenessProtocol from "y-protocols/awareness";
import * as encoding from "lib0/encoding";
import * as decoding from "lib0/decoding";

const BASE_URL = "http://localhost:3000";
const WS_BASE_URL = "ws://localhost:3000";

interface ApiResponse {
  status: number;
  data: any;
  headers: http.IncomingHttpHeaders;
  cookies: string[];
}

function request(
  method: string,
  path: string,
  body?: any,
  cookies: string[] = []
): Promise<ApiResponse> {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const postData = body ? JSON.stringify(body) : "";

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (cookies.length > 0) {
      headers["Cookie"] = cookies.join("; ");
    }

    if (postData) {
      headers["Content-Length"] = Buffer.byteLength(postData).toString();
    }

    const req = http.request(
      url,
      {
        method,
        headers,
      },
      (res) => {
        let rawData = "";
        res.on("data", (chunk) => {
          rawData += chunk;
        });
        res.on("end", () => {
          let data: any = rawData;
          try {
            data = JSON.parse(rawData);
          } catch {}

          const setCookieHeaders = res.headers["set-cookie"] || [];
          resolve({
            status: res.statusCode || 0,
            data,
            headers: res.headers,
            cookies: Array.isArray(setCookieHeaders) ? setCookieHeaders : [setCookieHeaders],
          });
        });
      }
    );

    req.on("error", (err) => reject(err));

    if (postData) {
      req.write(postData);
    }
    req.end();
  });
}

function getCookieValue(cookies: string[], name: string): string | null {
  for (const c of cookies) {
    const parts = c.split(";")[0].split("=");
    if (parts[0].trim() === name) {
      return parts.slice(1).join("=");
    }
  }
  return null;
}

async function runTests() {
  console.log("=================================================");
  console.log("🧪 Starting CodeRoom Full-Stack Verification Suite");
  console.log("=================================================\n");

  let testPassed = 0;
  let testFailed = 0;

  function assert(condition: boolean, testName: string) {
    if (condition) {
      console.log(`✅ PASS: ${testName}`);
      testPassed++;
    } else {
      console.error(`❌ FAIL: ${testName}`);
      testFailed++;
    }
  }

  // Generate unique test usernames
  const timestamp = Date.now();
  const user1Name = `salman_${timestamp}`;
  const user2Name = `rahul_${timestamp}`;
  const password = "password123!";

  console.log("--- 1. Testing Authentication Endpoints ---");

  // Test 1.1: Register User 1
  const regRes1 = await request("POST", "/api/auth/register", {
    username: user1Name,
    password,
    confirmPassword: password,
  });
  assert(regRes1.status === 201, "User 1 registration returns 201 Created");
  assert(regRes1.data.user.username === user1Name, "User 1 data returned correctly");
  assert(Boolean(regRes1.data.token), "Auth token returned in response");

  const user1Cookies = regRes1.cookies;
  const user1Token = regRes1.data.token;

  // Test 1.2: Register User 2
  const regRes2 = await request("POST", "/api/auth/register", {
    username: user2Name,
    password,
    confirmPassword: password,
  });
  assert(regRes2.status === 201, "User 2 registration returns 201 Created");
  const user2Cookies = regRes2.cookies;
  const user2Token = regRes2.data.token;

  // Test 1.3: Reject Invalid Password Registration
  const badRegRes = await request("POST", "/api/auth/register", {
    username: `short_${timestamp}`,
    password: "123", // too short
    confirmPassword: "123",
  });
  assert(badRegRes.status === 400, "Reject password under 8 characters (400)");

  // Test 1.4: Login with Valid Credentials
  const loginRes = await request("POST", "/api/auth/login", {
    username: user1Name,
    password,
    rememberMe: true,
  });
  assert(loginRes.status === 200, "Valid login returns 200 OK");

  // Test 1.5: Login with Invalid Credentials
  const badLoginRes = await request("POST", "/api/auth/login", {
    username: user1Name,
    password: "wrongpassword",
  });
  assert(badLoginRes.status === 401, "Invalid login returns 401 Unauthorized");

  // Test 1.6: Check /api/auth/me
  const meRes = await request("GET", "/api/auth/me", undefined, user1Cookies);
  assert(meRes.status === 200, "Protected /api/auth/me returns 200 OK");
  assert(meRes.data.user.username === user1Name, "Current user identity verified");

  console.log("\n--- 2. Testing Room Management ---");

  // Test 2.1: Create a Collaborative Room
  const roomRes = await request(
    "POST",
    "/api/rooms",
    {
      name: "Distributed Systems Lab",
      description: "Collaborative sandbox for distributed coding",
      isPublic: true,
    },
    user1Cookies
  );
  assert(roomRes.status === 201, "Room creation returns 201 Created");
  const room = roomRes.data.room;
  assert(Boolean(room.roomCode) && room.roomCode.length >= 6, "Unique 6-character room code generated");
  assert(room.name === "Distributed Systems Lab", "Room name preserved correctly");

  // Test 2.2: List User's Rooms
  const listRoomsRes = await request("GET", "/api/rooms", undefined, user1Cookies);
  assert(listRoomsRes.status === 200, "List rooms returns 200 OK");
  assert(listRoomsRes.data.rooms.some((r: any) => r.id === room.id), "Created room present in user's room list");

  // Test 2.3: User 2 Joins Room
  const joinRes = await request(
    "POST",
    `/api/rooms/${room.roomCode}/join`,
    {},
    user2Cookies
  );
  assert(joinRes.status === 200, "User 2 joins room via room code returns 200 OK");

  // Test 2.4: Fetch Room Details
  const getRoomRes = await request("GET", `/api/rooms/${room.roomCode}`, undefined, user2Cookies);
  assert(getRoomRes.status === 200, "Fetch room details returns 200 OK");
  assert(getRoomRes.data.room.members.length >= 2, "Both User 1 and User 2 registered as members");

  console.log("\n--- 3. Testing File Management ---");

  // Test 3.1: Get initial default files
  const getFilesRes = await request("GET", `/api/rooms/${room.id}/files`, undefined, user1Cookies);
  assert(getFilesRes.status === 200, "Get room files returns 200 OK");
  assert(getFilesRes.data.files.length > 0, "Initial project template files exist");
  const mainFile = getFilesRes.data.files.find((f: any) => f.name === "main.ts");
  assert(Boolean(mainFile), "Default main.ts exists in room files");

  // Test 3.2: Create new file
  const createFileRes = await request(
    "POST",
    `/api/rooms/${room.id}/files`,
    {
      name: "server.py",
      type: "file",
      content: "# Python collaboration test\nprint('Hello CodeRoom')\n",
    },
    user1Cookies
  );
  assert(createFileRes.status === 201, "Create server.py returns 201 Created");
  const pyFile = createFileRes.data.file;
  assert(pyFile.language === "python", "File language auto-detected as python");

  // Test 3.3: Rename file
  const renameRes = await request(
    "PATCH",
    `/api/rooms/${room.id}/files/${pyFile.id}`,
    { name: "app.py" },
    user1Cookies
  );
  assert(renameRes.status === 200, "Rename file returns 200 OK");
  assert(renameRes.data.file.name === "app.py", "Filename updated to app.py");

  console.log("\n--- 4. Testing Real-Time WebSockets (Chat & Presence) ---");

  // Test 4.1: Establish Room WebSocket for User 1 and User 2
  const wsUser1 = new WebSocket(`${WS_BASE_URL}/ws?roomId=${room.id}&token=${user1Token}`);
  const wsUser2 = new WebSocket(`${WS_BASE_URL}/ws?roomId=${room.id}&token=${user2Token}`);

  await new Promise<void>((resolve) => {
    let connected = 0;
    const check = () => {
      connected++;
      if (connected === 2) resolve();
    };
    wsUser1.on("open", check);
    wsUser2.on("open", check);
  });
  assert(true, "Both users connected to Room WebSocket");

  // Test 4.2: Real-time Chat message exchange
  const chatReceivedPromise = new Promise<boolean>((resolve) => {
    const timeout = setTimeout(() => resolve(false), 5000);
    wsUser2.on("message", (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        if (msg.type === "chat:message" && msg.message.content === "Hello from User 1 over WebSocket!") {
          clearTimeout(timeout);
          resolve(true);
        }
      } catch {}
    });
  });

  // User 1 sends chat message via WebSocket
  wsUser1.send(
    JSON.stringify({
      type: "chat:send",
      payload: { content: "Hello from User 1 over WebSocket!" },
    })
  );

  const chatReceived = await chatReceivedPromise;
  assert(chatReceived, "User 2 received instant chat message sent by User 1 via WebSocket");

  // Test 4.3: Verify chat message persisted in database
  const getMsgsRes = await request("GET", `/api/rooms/${room.id}/messages`, undefined, user1Cookies);
  assert(
    getMsgsRes.data.messages.some((m: any) => m.content === "Hello from User 1 over WebSocket!"),
    "Chat message successfully persisted to SQLite database"
  );

  console.log("\n--- 5. Testing Yjs Real-Time CRDT Collaborative Code Sync ---");

  // Test 5.1: Connect Yjs WebSocket for User 1 on main.ts
  const ydoc1 = new Y.Doc();
  const yws1 = new WebSocket(`${WS_BASE_URL}/yjs/${room.id}__${mainFile.id}?token=${user1Token}`);

  // Setup binary sync protocol for User 1
  yws1.binaryType = "nodebuffer";
  yws1.on("open", () => {
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, 0); // sync
    syncProtocol.writeSyncStep1(encoder, ydoc1);
    yws1.send(encoding.toUint8Array(encoder));
  });

  yws1.on("message", (data: any) => {
    const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data);
    const decoder = decoding.createDecoder(new Uint8Array(buffer));
    const messageType = decoding.readVarUint(decoder);
    if (messageType === 0) {
      const encoder = encoding.createEncoder();
      encoding.writeVarUint(encoder, 0);
      syncProtocol.readSyncMessage(decoder, encoder, ydoc1, null);
      if (encoding.length(encoder) > 1) {
        yws1.send(encoding.toUint8Array(encoder));
      }
    }
  });

  // Wait for initial sync
  await new Promise((r) => setTimeout(r, 600));

  const ytext1 = ydoc1.getText("monaco");
  const initialText = ytext1.toString();
  assert(initialText.length > 0, `Initial file content retrieved via Yjs CRDT: "${initialText.slice(0, 30)}..."`);

  // Test 5.2: Connect User 2 on the same document
  const ydoc2 = new Y.Doc();
  const yws2 = new WebSocket(`${WS_BASE_URL}/yjs/${room.id}__${mainFile.id}?token=${user2Token}`);
  yws2.binaryType = "nodebuffer";

  yws2.on("open", () => {
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, 0);
    syncProtocol.writeSyncStep1(encoder, ydoc2);
    yws2.send(encoding.toUint8Array(encoder));
  });

  yws2.on("message", (data: any) => {
    const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data);
    const decoder = decoding.createDecoder(new Uint8Array(buffer));
    const messageType = decoding.readVarUint(decoder);
    if (messageType === 0) {
      const encoder = encoding.createEncoder();
      encoding.writeVarUint(encoder, 0);
      syncProtocol.readSyncMessage(decoder, encoder, ydoc2, null);
      if (encoding.length(encoder) > 1) {
        yws2.send(encoding.toUint8Array(encoder));
      }
    }
  });

  await new Promise((r) => setTimeout(r, 600));

  const ytext2 = ydoc2.getText("monaco");
  assert(ytext2.toString() === ytext1.toString(), "User 2 document content matches User 1 document");

  // Test 5.3: User 1 types code in real-time, User 2 receives update instantly
  ydoc1.on("update", (update: Uint8Array) => {
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, 0);
    syncProtocol.writeUpdate(encoder, update);
    yws1.send(encoding.toUint8Array(encoder));
  });

  ydoc2.on("update", (update: Uint8Array) => {
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, 0);
    syncProtocol.writeUpdate(encoder, update);
    yws2.send(encoding.toUint8Array(encoder));
  });

  const collaborativeSnippet = `// Collaborative edit by ${user1Name} at ${new Date().toISOString()}\n`;
  ytext1.insert(0, collaborativeSnippet);

  // Wait for CRDT message propagation
  await new Promise((r) => setTimeout(r, 800));

  assert(
    ytext2.toString().startsWith(collaborativeSnippet),
    "User 2 received real-time CRDT edit from User 1 without document replacement"
  );

  // Test 5.4: Simultaneous concurrent edits merge correctly
  ytext1.insert(collaborativeSnippet.length, "const a = 100;\n");
  ytext2.insert(collaborativeSnippet.length, "const b = 200;\n");

  await new Promise((r) => setTimeout(r, 1000));

  assert(
    ydoc1.getText("monaco").toString() === ydoc2.getText("monaco").toString(),
    "Simultaneous concurrent edits converged to identical state across both users"
  );

  // Cleanup WebSockets
  wsUser1.close();
  wsUser2.close();
  yws1.close();
  yws2.close();

  // Wait for server autosave debounce (2000ms)
  console.log("Waiting for debounced autosave to SQLite database...");
  await new Promise((r) => setTimeout(r, 2600));

  // Verify file in DB has the autosaved content
  const dbFileRes = await request(
    "GET",
    `/api/rooms/${room.id}/files/${mainFile.id}`,
    undefined,
    user1Cookies
  );
  assert(
    dbFileRes.data.file.content.includes("const a = 100;") &&
      dbFileRes.data.file.content.includes("const b = 200;"),
    "Collaborative edits autosaved to SQLite database"
  );

  console.log("\n=================================================");
  console.log(`📊 Test Summary: ${testPassed} Passed, ${testFailed} Failed`);
  console.log("=================================================");

  if (testFailed > 0) {
    process.exit(1);
  } else {
    console.log("🎉 ALL TESTS PASSED SUCCESSFULLY!");
    process.exit(0);
  }
}

runTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
