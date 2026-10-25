import { File } from "../models/file";
import { Message } from "../models/message";
import { PermissionRequest } from "../models/permission-request";
import { Room } from "../models/room";
import { RoomMember } from "../models/room-member";
import { User } from "../models/user";
import { closeFileDoc } from "../ws/yjs-handler";

/** Collect a file/folder plus every descendant id (breadth-first). */
export async function collectFileTreeIds(roomId: string, rootId: string): Promise<string[]> {
  const ids: string[] = [rootId];
  let frontier: string[] = [rootId];

  while (frontier.length > 0) {
    const children = await File.find({ roomId, parentId: { $in: frontier } })
      .select("_id")
      .exec();
    frontier = children.map((child) => child._id).filter((id) => !ids.includes(id));
    ids.push(...frontier);
  }

  return ids;
}

/** Delete a file/folder tree and all of its permission requests. */
export async function deleteFileTree(roomId: string, rootId: string): Promise<string[]> {
  const ids = await collectFileTreeIds(roomId, rootId);

  for (const id of ids) {
    closeFileDoc(roomId, id);
  }

  await PermissionRequest.deleteMany({ fileId: { $in: ids } });
  await File.deleteMany({ _id: { $in: ids } });

  return ids;
}

/** Delete a room and every dependent document. */
export async function deleteRoomCascade(roomId: string): Promise<void> {
  const files = await File.find({ roomId }).select("_id").exec();
  for (const file of files) {
    closeFileDoc(roomId, file._id);
  }

  await Promise.all([
    File.deleteMany({ roomId }),
    RoomMember.deleteMany({ roomId }),
    Message.deleteMany({ roomId }),
    PermissionRequest.deleteMany({ roomId }),
  ]);

  await Room.deleteOne({ _id: roomId });
}

/** Delete a user, their owned rooms (cascading), memberships, messages and requests. */
export async function deleteUserCascade(userId: string): Promise<void> {
  const ownedRooms = await Room.find({ ownerId: userId }).select("_id").exec();
  for (const room of ownedRooms) {
    await deleteRoomCascade(room._id);
  }

  await Promise.all([
    RoomMember.deleteMany({ userId }),
    Message.deleteMany({ userId }),
    PermissionRequest.deleteMany({ userId }),
  ]);

  await User.deleteOne({ _id: userId });
}
