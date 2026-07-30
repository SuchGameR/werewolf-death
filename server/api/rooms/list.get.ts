import { db } from '../../utils/database'

export default defineEventHandler(() => {
  try {
    const rooms = db.getAllRooms()
    return { success: true, rooms }
  } catch (err: any) {
    throw createError({ statusCode: 500, message: err.message })
  }
})
