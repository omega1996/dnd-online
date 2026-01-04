import { io } from "socket.io-client";

// In development, use direct backend URL to avoid proxy
// In production, use window.location.origin so nginx will proxy to server
// This avoids CORS issues and works better with HTTPS
const socketUrl = import.meta.env.DEV ? "http://localhost:3001" : window.location.origin;

export const socket = io(socketUrl, {
  autoConnect: false,
  path: "/socket.io/"
});
