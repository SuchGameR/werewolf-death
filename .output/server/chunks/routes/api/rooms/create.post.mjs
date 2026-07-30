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

const create_post = defineEventHandler(async (event) => {
  const { roomName, password, creatorName } = await readBody(event);
  try {
    const room = db.createRoom(roomName, password, creatorName);
    return { success: true, room };
  } catch (err) {
    throw createError({ statusCode: 500, message: err.message });
  }
});

export { create_post as default };
//# sourceMappingURL=create.post.mjs.map
