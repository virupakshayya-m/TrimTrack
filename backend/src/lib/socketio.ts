import { Server } from "socket.io";

let io: Server | null = null;

export function initializeSocketIO(serverIo: Server) {
  io = serverIo;
  
  io.on("connection", (socket) => {
    socket.on("subscribeToBarber", (barberId: string) => {
      socket.join(`barber-${barberId}`);
    });

    socket.on("unsubscribeFromBarber", (barberId: string) => {
      socket.leave(`barber-${barberId}`);
    });

    // Legacy aliases in case they're used elsewhere
    socket.on("join-barber-room", (barberId: string) => {
      socket.join(`barber-${barberId}`);
    });

    socket.on("leave-barber-room", (barberId: string) => {
      socket.leave(`barber-${barberId}`);
    });
  });
}

/**
 * Emits an event to all clients listening to a specific barber's queue
 * as well as broadcasting to general dashboard listeners
 */
export function emitQueueUpdated(barberId: string, payload?: any) {
  if (!io) return;
  const data = { barberId, ...payload };
  io.to(`barber-${barberId}`).emit("queueUpdated", data);
  io.emit("queueUpdated", data);
}
