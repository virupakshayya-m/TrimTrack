import { 
  useGetDashboardSummary, 
  useListQueue, 
  useListBarbers,
  useTransferBulk,
  useCancelBulk,
  getListQueueQueryKey,
  getGetDashboardSummaryQueryKey
} from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter,
  DialogDescription
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle, ArrowRightLeft, XCircle } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

export default function AdminDashboard() {
  const { data: summary, isLoading } = useGetDashboardSummary({
    query: { refetchInterval: 15000 } as any
  });

  const [resolvingBarber, setResolvingBarber] = useState<any>(null);
  const [targetBarberId, setTargetBarberId] = useState<string>("auto");
  const { data: queues } = useListQueue();
  const { data: allBarbers } = useListBarbers();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const transferMutation = useTransferBulk({
    onSuccess: (data: any) => {
      toast({ title: "Transfer Successful", description: `Customers moved to ${data.targetBarberName || 'new barber'}.` });
      setResolvingBarber(null);
      queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
      queryClient.invalidateQueries({ queryKey: getListQueueQueryKey() });
    },
    onError: (err: any) => {
      toast({ title: "Transfer Failed", variant: "destructive", description: err.message });
    }
  });

  const cancelMutation = useCancelBulk({
    onSuccess: () => {
      toast({ title: "Cancellations Successful", description: "All remaining bookings cancelled." });
      setResolvingBarber(null);
      queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
      queryClient.invalidateQueries({ queryKey: getListQueueQueryKey() });
    }
  });

  const handleResolve = (barber: any) => {
    const barberQueue = queues?.find(q => String(q.barberId) === String(barber.id));
    if (!barberQueue) return;
    
    const bookingIds = [
      ...barberQueue.activeQueue.map(b => String(b.id)),
      ...barberQueue.upcomingAppointments.map(b => String(b.id))
    ];

    if (bookingIds.length === 0) {
      toast({ title: "Nothing to resolve", description: "Queue is already empty." });
      return;
    }

    setResolvingBarber({ ...barber, bookingIds });
  };

  const prevStatuses = useRef<{id: number, isPaused: boolean, isAccepting: boolean}[]>([]);

  useEffect(() => {
    if (isLoading || !summary?.barberStatuses) return;

    if (prevStatuses.current.length > 0) {
      summary.barberStatuses.forEach(b => {
        const prev = prevStatuses.current.find(p => p.id === b.id);
        if (prev) {
          if (!prev.isPaused && b.isPaused) {
            toast({ title: "Queue Paused", description: `Barber ${b.name} paused their queue.` });
          }
          if (prev.isAccepting && !b.isAccepting) {
            toast({ title: "Queue Stopped", description: `Barber ${b.name} stopped accepting customers.`, variant: "destructive" });
          } else if (!prev.isAccepting && b.isAccepting) {
            toast({ title: "Queue Resumed", description: `Barber ${b.name} is accepting customers again.` });
          }
        }
      });
    }

    prevStatuses.current = summary.barberStatuses.map(b => ({
      id: b.id,
      isPaused: b.isPaused,
      isAccepting: b.isAccepting
    }));
  }, [summary?.barberStatuses, isLoading, toast]);

  if (isLoading) return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[1,2,3,4].map(i => <Skeleton key={i} className="h-28 rounded-xl" />)}
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Salon Overview</h1>
          <p className="text-gray-500 text-sm mt-1">Live operations dashboard</p>
        </div>
        <div className="flex gap-2">
          <Link href="/admin/queue"><Button variant="outline" size="sm">View All Queues</Button></Link>
          <Link href="/admin/services"><Button variant="outline" size="sm">Manage Services</Button></Link>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-5 pb-4">
            <div className="text-3xl font-black text-gray-900">{summary?.totalCustomersToday ?? 0}</div>
            <div className="text-sm text-gray-500 mt-1">Customers today</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 pb-4">
            <div className="text-3xl font-black text-green-600">{summary?.totalServedToday ?? 0}</div>
            <div className="text-sm text-gray-500 mt-1">Served today</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 pb-4">
            <div className="text-3xl font-black text-amber-500">{summary?.currentQueueSize ?? 0}</div>
            <div className="text-sm text-gray-500 mt-1">In queue now</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 pb-4">
            <div className="text-3xl font-black text-blue-600">{summary?.averageWaitTime ?? 0}m</div>
            <div className="text-sm text-gray-500 mt-1">Avg wait time</div>
          </CardContent>
        </Card>
      </div>

      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-gray-900">Barber Status</h2>
          <span className="text-sm text-gray-500">{summary?.activeBarbers}/{summary?.totalBarbers} active</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {(summary?.barberStatuses ?? []).map(barber => (
            <Card key={barber.id}>
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="font-semibold text-gray-900">{barber.name}</div>
                  <span className={`text-xs px-2 py-1 rounded-full font-semibold ${
                    !barber.isAccepting ? "bg-red-100 text-red-700" :
                    barber.isPaused ? "bg-yellow-100 text-yellow-700" :
                    "bg-green-100 text-green-700"
                  }`}>
                    {!barber.isAccepting ? "Closed" : barber.isPaused ? "Paused" : "Open"}
                  </span>
                </div>
                <div className="flex justify-between text-sm text-gray-500 mb-2">
                  <span>{barber.activeQueueCount} in queue</span>
                  <span>~{barber.estimatedWaitTime}min</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-1.5">
                  <div
                    className="bg-amber-500 h-1.5 rounded-full"
                    style={{ width: `${Math.min(100, ((barber.activeQueueCount ?? 0) / barber.maxQueueSize) * 100)}%` }}
                  />
                </div>
                <div className="text-xs text-gray-400 mt-1">{barber.activeQueueCount}/{barber.maxQueueSize} capacity</div>
                
                {(barber.activeQueueCount ?? 0) > 0 && !barber.isAccepting && (
                  <Button 
                    size="sm" 
                    variant="destructive" 
                    className="w-full mt-3 h-8 text-xs font-bold gap-2"
                    onClick={() => handleResolve(barber)}
                  >
                    <AlertCircle className="w-3.5 h-3.5" />
                    Resolve Emergency
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Emergency Resolution Modal */}
      <Dialog open={!!resolvingBarber} onOpenChange={(open) => !open && setResolvingBarber(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertCircle className="w-5 h-5" />
              Emergency Resolution
            </DialogTitle>
            <DialogDescription>
              {resolvingBarber?.name} has {resolvingBarber?.bookingIds?.length} customers waiting but is no longer accepting entries.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <Alert variant="destructive" className="bg-red-50 border-red-100">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Action Required</AlertTitle>
              <AlertDescription>
                Choose how to handle the remaining customers in this barber's queue.
              </AlertDescription>
            </Alert>

            <div className="space-y-2">
              <label className="text-sm font-medium">Transfer to Barber:</label>
              <Select value={targetBarberId} onValueChange={setTargetBarberId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select target barber" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">Shortest Wait Time (Auto)</SelectItem>
                  {allBarbers?.filter(b => b.id !== resolvingBarber?.id && b.isAccepting && !b.isPaused).map(b => (
                    <SelectItem key={b.id} value={String(b.id)}>{b.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button 
              variant="outline" 
              className="w-full sm:w-auto gap-2"
              onClick={() => cancelMutation.mutate({ bookingIds: resolvingBarber.bookingIds })}
              disabled={cancelMutation.isPending || transferMutation.isPending}
            >
              <XCircle className="w-4 h-4" />
              Cancel All
            </Button>
            <Button 
              className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 gap-2"
              onClick={() => transferMutation.mutate({ 
                bookingIds: resolvingBarber.bookingIds, 
                targetBarberId: targetBarberId 
              })}
              disabled={transferMutation.isPending || cancelMutation.isPending}
            >
              <ArrowRightLeft className="w-4 h-4" />
              Transfer Customers
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="grid grid-cols-2 gap-4">
        <Card className="border-red-100">
          <CardContent className="pt-4 pb-4">
            <div className="text-2xl font-bold text-red-600">{summary?.cancellationsToday ?? 0}</div>
            <div className="text-sm text-gray-500 mt-1">Cancellations today</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <Link href="/admin/users">
              <Button variant="outline" size="sm" className="w-full">Manage Users</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
