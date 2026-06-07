import { io, Socket } from "socket.io-client";

let socket: Socket | null = null;

/**
 * Returns the shared Socket.IO client instance.
 * Connects once and reuses the connection for the app's lifetime.
 */
export function getSocket(): Socket {
  if (!socket) {
    const backendUrl = import.meta.env.VITE_API_URL || "";
    socket = io(backendUrl, {
      path: "/socket.io",
      transports: ["websocket", "polling"],
      autoConnect: true,
    });
  }
  return socket;
}

export function disconnectSocket(): void {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
