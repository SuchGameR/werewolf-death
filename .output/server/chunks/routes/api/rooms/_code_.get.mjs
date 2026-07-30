import { c as defineEventHandler, e as createError } from '../../../_/nitro.mjs';
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

const _code__get = defineEventHandler((event) => {
  const { code } = event.context.params || {};
  try {
    const room = db.getRoom(code);
    if (!room) throw createError({ statusCode: 404, message: "\u90E8\u5C4B\u304C\u898B\u3064\u304B\u308A\u307E\u305B\u3093" });
    return { success: true, room };
  } catch (err) {
    if (err.statusCode) throw err;
    throw createError({ statusCode: 500, message: err.message });
  }
});

export { _code__get as default };
//# sourceMappingURL=_code_.get.mjs.map
