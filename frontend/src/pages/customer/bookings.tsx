import { useListBookings, useCancelBooking } from "@workspace/api-client-react";
import { getListBookingsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";

const statusColors: Record<string, string> = {
  active: "bg-blue-100 text-blue-800",
  serving: "bg-green-100 text-green-800",
  pending: "bg-yellow-100 text-yellow-800",
  completed: "bg-gray-100 text-gray-700",
  cancelled: "bg-red-100 text-red-700",
  waitlisted: "bg-orange-100 text-orange-700",
};

export default function CustomerBookings() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: bookings, isLoading } = useListBookings(undefined, { query: { refetchInterval: 15000 } as any });

  const cancelBooking = useCancelBooking({
    mutation: {
      onSuccess: (data) => {
        queryClient.invalidateQueries({ queryKey: getListBookingsQueryKey() });
        toast({
          title: data.penaltyApplied ? "Cancelled with penalty" : "Cancelled",
          description: data.message,
          variant: data.penaltyApplied ? "destructive" : "default",
        });
      }
    }
  });

  if (isLoading) return (
    <div className="space-y-3">
      {[1,2,3].map(i => <Skeleton key={i} className="h-24 rounded-xl" />)}
    </div>
  );

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-gray-900">My Bookings</h1>
      {(bookings ?? []).length === 0 ? (
        <div className="text-center py-12 text-gray-400">No bookings yet.</div>
      ) : (
        <div className="space-y-3">
          {(bookings ?? []).map(b => (
            <Card key={b.id}>
              <CardContent className="py-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-gray-900">{b.barber?.name ?? "Barber"}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColors[b.status] ?? "bg-gray-100 text-gray-700"}`}>
                        {b.status}
                      </span>
                      <span className="text-xs text-gray-400">{b.bookingType === "appointment" ? "Appointment" : "Walk-in"}</span>
                    </div>
                    {b.service && (
                      <div className="text-sm text-gray-500">{b.service.name} — ${b.service.price}</div>
                    )}
                    {b.scheduledAt && (
                      <div className="text-sm text-gray-500">{new Date(b.scheduledAt).toLocaleString()}</div>
                    )}
                    <div className="text-xs text-gray-400 mt-1">{new Date(b.createdAt).toLocaleDateString()}</div>
                    {b.penaltyApplied && (
                      <div className="text-xs text-red-600 mt-1">Penalty applied</div>
                    )}
                  </div>
                  {(b.status === "active" || b.status === "pending") && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-red-200 text-red-600 hover:bg-red-50 shrink-0"
                      onClick={() => cancelBooking.mutate({ bookingId: b.id })}
                      disabled={cancelBooking.isPending}
                    >
                      Cancel
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
