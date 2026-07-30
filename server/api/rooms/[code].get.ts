import { db } from '../../utils/database'

export default defineEventHandler((event) => {
  const { code } = event.context.params || {}
  try {
    const room = db.getRoom(code)
    if (!room) throw createError({ statusCode: 404, message: '部屋が見つかりません' })
    return { success: true, room }
  } catch (err: any) {
    if (err.statusCode) throw err
    throw createError({ statusCode: 500, message: err.message })
  }
})
