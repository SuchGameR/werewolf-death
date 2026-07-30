import { c as defineEventHandler, r as readBody, e as createError } from '../../../_/nitro.mjs';
import { d as db } from '../../../_/database.mjs';
import 'node:http';
import 'node:https';
import 'node:events';
import 'node:buffer';
import 'node:fs';
import 'node:path';
import 'node:crypto';
import 'node:url';
import 'fs';
import 'path';

const join_post = defineEventHandler(async (event) => {
  const { roomCode, password, userName } = await readBody(event);
  try {
    const room = db.getRoom(roomCode);
    if (!room) throw createError({ statusCode: 404, message: "\u90E8\u5C4B\u304C\u898B\u3064\u304B\u308A\u307E\u305B\u3093" });
    if (room.password && room.password !== password)
      throw createError({ statusCode: 403, message: "\u30D1\u30B9\u30EF\u30FC\u30C9\u304C\u9055\u3044\u307E\u3059" });
    return { success: true, room };
  } catch (err) {
    if (err.statusCode) throw err;
    throw createError({ statusCode: 500, message: err.message });
  }
});

export { join_post as default };
//# sourceMappingURL=join.post.mjs.map
