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

const list_get = defineEventHandler(() => {
  try {
    const rooms = db.getAllRooms();
    return { success: true, rooms };
  } catch (err) {
    throw createError({ statusCode: 500, message: err.message });
  }
});

export { list_get as default };
//# sourceMappingURL=list.get.mjs.map
