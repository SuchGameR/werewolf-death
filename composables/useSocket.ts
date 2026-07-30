import { io } from 'socket.io-client'

let socket: ReturnType<typeof io> | null = null

export function useSocket() {
  if (!socket) {
    socket = io({
      transports: ['websocket', 'polling'],
    })
  }
  return socket
}
