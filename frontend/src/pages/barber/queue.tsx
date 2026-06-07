import { useAuth } from "@/hooks/use-auth";
import { useListBarbers, useListQueue } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function BarberQueue() {
  const { user } = useAuth();
  const { data: barbers } = useListBarbers();
  const myBarber = (barbers ?? []).find(b => b.userId === user?.id);
  const { data: queues, isLoading } = useListQueue({ query: { refetchInterval: 10000 } as any });

  const myQueue = (queues ?? []).find(q => q.barberId === myBarber?.id);

  if (isLoading) return (
    <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-20 rounded-xl" />)}</div>
  );

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Full Queue View</h1>

      {myQueue ? (
        <>
          <div className="grid grid-cols-3 gap-4">
            <Card><CardContent className="pt-4"><div className="text-2xl font-bold">{myQueue.activeQueue.length}</div><div className="text-xs text-gray-500">Active</div></CardContent></Card>
            <Card><CardContent className="pt-4"><div className="text-2xl font-bold">{myQueue.waitlist.length}</div><div className="text-xs text-gray-500">Waitlisted</div></CardContent></Card>
            <Card><CardContent className="pt-4"><div className="text-2xl font-bold">{myQueue.upcomingAppointments.length}</div><div className="text-xs text-gray-500">Upcoming</div></CardContent></Card>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">Active Queue</h2>
            {myQueue.activeQueue.length === 0 ? (
              <div className="text-center py-8 text-gray-400 border-2 border-dashed rounded-xl">No active customers</div>
            ) : (
              <div className="space-y-2">
                {myQueue.activeQueue.map((b, i) => (
                  <Card key={b.id}>
                    <CardContent className="py-3">
                      <div className="flex items-center gap-3">
                        <span className="text-lg font-black text-gray-300 w-6">#{i+1}</span>
                        <div className="flex-1">
                          <div className="font-medium">{b.customer?.name}</div>
                          <div className="text-xs text-gray-500">{b.service?.name ?? "No service"} • {b.bookingType}</div>
                        </div>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${b.status === "serving" ? "bg-green-100 text-green-700" : "bg-blue-100 text-blue-700"}`}>
                          {b.status}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>

          {myQueue.waitlist.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-3">Waitlist</h2>
              <div className="space-y-2">
                {myQueue.waitlist.map(b => (
                  <Card key={b.id} className="bg-orange-50 border-orange-200">
                    <CardContent className="py-3">
                      <div className="font-medium">{b.customer?.name}</div>
                      <div className="text-xs text-gray-500">{b.service?.name ?? "No service"}</div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="text-center py-12 text-gray-400">No queue data available.</div>
      )}
    </div>
  );
}
