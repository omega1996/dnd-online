import { io } from "socket.io-client";

// Always use relative paths for Socket.io - nginx will proxy to server
// This avoids CORS issues and works better with HTTPS
const socketUrl = window.location.origin;

export const socket = io(socketUrl, {
  autoConnect: false,
  path: "/socket.io/"
});
