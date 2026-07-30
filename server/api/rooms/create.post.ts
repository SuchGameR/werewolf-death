import { db } from '../../utils/database'

export default defineEventHandler(async (event) => {
  const { roomName, password, creatorName } = await readBody(event)
  try {
    const room = db.createRoom(roomName, password, creatorName)
    return { success: true, room }
  } catch (err: any) {
    throw createError({ statusCode: 500, message: err.message })
  }
})
