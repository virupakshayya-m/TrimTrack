import { useListQueue } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function AdminQueue() {
  const { data: queues, isLoading } = useListQueue({ query: { refetchInterval: 10000 } as any });

  if (isLoading) return (
    <div className="space-y-4">{[1,2,3].map(i => <Skeleton key={i} className="h-48 rounded-xl" />)}</div>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Live Queue Monitor</h1>
        <p className="text-sm text-gray-500 mt-1">Auto-refreshes every 10 seconds</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-5">
        {(queues ?? []).map(q => (
          <Card key={q.barberId}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">{q.barberName}</CardTitle>
                <span className={`text-xs px-2 py-1 rounded-full font-semibold ${
                  !q.isAccepting ? "bg-red-100 text-red-700" :
                  q.isPaused ? "bg-yellow-100 text-yellow-700" :
                  "bg-green-100 text-green-700"
                }`}>
                  {!q.isAccepting ? "Closed" : q.isPaused ? "Paused" : "Open"}
                </span>
              </div>
              <div className="text-sm text-gray-500">{q.activeQueue.length} active • ~{q.estimatedWaitMinutes}min wait</div>
            </CardHeader>
            <CardContent>
              {q.activeQueue.length === 0 ? (
                <div className="text-center py-6 text-gray-300 text-sm border-2 border-dashed rounded-lg">Empty queue</div>
              ) : (
                <div className="space-y-2">
                  {q.activeQueue.slice(0, 5).map((b) => (
                    <div key={b.id} className="flex items-center gap-3 py-1">
                      <span className="text-xs font-mono text-gray-300 w-4">#{b.position > 0 ? b.position : 0}</span>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-gray-900 truncate">{b.guestName || b.customer?.name}</div>
                        <div className="text-xs text-gray-400">{b.service?.name ?? "Walk-in"}</div>
                      </div>
                      <span className={`text-xs px-1.5 py-0.5 rounded ${b.status === "serving" ? "bg-green-100 text-green-700" : "bg-blue-100 text-blue-700"}`}>
                        {b.status}
                      </span>
                    </div>
                  ))}
                  {q.activeQueue.length > 5 && (
                    <div className="text-xs text-gray-400 text-center pt-1">+{q.activeQueue.length - 5} more</div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
