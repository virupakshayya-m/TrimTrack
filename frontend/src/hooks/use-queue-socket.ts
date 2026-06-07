import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getSocket } from "@/lib/socket";
import {
  getGetMyQueuePositionQueryKey,
  getListBarbersQueryKey,
  getListQueueQueryKey,
  getGetBarberDashboardQueryKey,
} from "@workspace/api-client-react";

/**
 * Subscribes to real-time "queueUpdated" events from the server.
 * When any queue changes (join, serve, complete, cancel), this hook
 * automatically invalidates the relevant queries to refresh the UI instantly.
 *
 * @param barberId - Optional: subscribe to a specific barber's room for targeted updates.
 */
export function useQueueSocket(barberId?: number): void {
  const queryClient = useQueryClient();

  useEffect(() => {
    const socket = getSocket();

    // Subscribe to a specific barber's room if barberId is provided
    if (barberId !== undefined) {
      socket.emit("subscribeToBarber", String(barberId));
    }

    const handleQueueUpdated = (_data: { barberId: number; event?: string }) => {
      // Invalidate all queue-related queries for an instant UI refresh
      queryClient.invalidateQueries({ queryKey: getListQueueQueryKey() });
      queryClient.invalidateQueries({ queryKey: getListBarbersQueryKey() });
      queryClient.invalidateQueries({ queryKey: getGetMyQueuePositionQueryKey() });
      // Also refresh barber dashboard if subscribed to a specific barber
      if (barberId !== undefined) {
        queryClient.invalidateQueries({ queryKey: getGetBarberDashboardQueryKey(barberId) });
      }
    };

    socket.on("queueUpdated", handleQueueUpdated);

    return () => {
      socket.off("queueUpdated", handleQueueUpdated);
      if (barberId !== undefined) {
        socket.emit("unsubscribeFromBarber", String(barberId));
      }
    };
  }, [queryClient, barberId]);
}
