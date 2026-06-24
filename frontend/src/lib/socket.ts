import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8006';
const WS_URL = API_URL.replace(/\/countdown\/api$/, '');

export function getSocket(): Socket {
  if (!socket) {
    socket = io(WS_URL, {
      path: '/countdown/socket.io',
      transports: ['websocket', 'polling'],
      withCredentials: true,
    });
  }
  return socket;
}
