import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

// Singleton socket connection, khởi tạo 1 lần khi user đăng nhập
export function getSocket(): Socket {
  if (!socket) {
    socket = io(process.env.NEXT_PUBLIC_WS_URL!, {
      withCredentials: true,
      autoConnect: false,
    });
  }
  return socket;
}

export function connectSocket() {
  getSocket().connect();
}

export function disconnectSocket() {
  if (socket?.connected) {
    socket.disconnect();
    socket = null;
  }
}
