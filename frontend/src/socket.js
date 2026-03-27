import { io } from "socket.io-client";

const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:4000";

let socket;

export const connectSocket = (userId) => {
  if (!socket) {
    socket = io(apiUrl, { transports: ["websocket"] });
    socket.on("connect", () => {
      socket.emit("join", userId);
    });
  }
  return socket;
};

export const getSocket = () => socket;
