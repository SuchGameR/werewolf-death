import { db } from '../../utils/database'

export default defineEventHandler(async (event) => {
  const { roomCode, password, userName } = await readBody(event)
  try {
    const room = db.getRoom(roomCode)
    if (!room) throw createError({ statusCode: 404, message: '部屋が見つかりません' })
    if (room.password && room.password !== password)
      throw createError({ statusCode: 403, message: 'パスワードが違います' })
    return { success: true, room }
  } catch (err: any) {
    if (err.statusCode) throw err
    throw createError({ statusCode: 500, message: err.message })
  }
})
