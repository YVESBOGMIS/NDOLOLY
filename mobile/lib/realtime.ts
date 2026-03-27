import { io, Socket } from 'socket.io-client';

import { API_BASE_URL } from './config';

let socket: Socket | null = null;
let connectedUserId: string | null = null;
let activeMatchId: string | null = null;

export function connectSocket(userId: string) {
  if (!userId) return null;
  if (socket && connectedUserId === userId) return socket;
  if (socket) {
    socket.disconnect();
  }
  connectedUserId = userId;
  socket = io(API_BASE_URL, {
    transports: ['websocket'],
  });
  socket.on('connect', () => {
    socket?.emit('join', userId);
  });
  return socket;
}

export function resetSocket() {
  if (socket) {
    socket.disconnect();
  }
  socket = null;
  connectedUserId = null;
}

export function setActiveMatchId(matchId: string | null) {
  activeMatchId = matchId || null;
}

export function getActiveMatchId() {
  return activeMatchId;
}

