import { useEffect, useState, useRef } from "react";
import { Link } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useQueueSocket } from "@/hooks/use-queue-socket";
import {
  useGetMyQueuePosition,
  useListBarbers,
  useListServices,
  useListQueue,
  useJoinQueue,
  useCancelBooking,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  getGetMyQueuePositionQueryKey,
  getListBarbersQueryKey,
  getListQueueQueryKey,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Users, Clock, AlertCircle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

function WaitTimer({ estimatedMinutes }: { estimatedMinutes: number }) {
  const [remaining, setRemaining] = useState(estimatedMinutes * 60);

  useEffect(() => {
    setRemaining(estimatedMinutes * 60);
  }, [estimatedMinutes]);

  useEffect(() => {
    if (remaining <= 0) return;
    const timer = setInterval(() => setRemaining(r => Math.max(0, r - 1)), 1000);
    return () => clearInterval(timer);
  }, [remaining]);

  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;
  return (
    <span className="font-mono text-3xl font-bold text-amber-500">
      {mins}:{secs.toString().padStart(2, "0")}
    </span>
  );
}

export default function CustomerDashboard() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Subscribe to real-time queue events via Socket.IO
  useQueueSocket();

  const [joinModalOpen, setJoinModalOpen] = useState(false);
  const [selectedBarber, setSelectedBarber] = useState<string>("auto");
  const [selectedService, setSelectedService] = useState<string>("");

  const { data: position, isLoading: posLoading, isError: posError } = useGetMyQueuePosition({
    query: {
      refetchInterval: 15000,
      retry: (failureCount: number, error: any) => {
        if (error?.status === 404) return false;
        return failureCount < 2;
      },
    } as any
  });

  const prevStatus = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (!position) {
      if (prevStatus.current === "serving") {
        toast({ title: "Service Complete", description: "Thank you for visiting!" });
      } else if (prevStatus.current === "pending" || prevStatus.current === "waitlisted") {
        // We can't know for sure if it was cancelled by admin or served, but if it disappears from pending...
        // Let's assume cancelled if it didn't reach serving, unless we don't want to over-toast.
        // The mutation will handle self-cancellations.
      }
      prevStatus.current = undefined;
      return;
    }

    if (position.status !== prevStatus.current) {
      if (prevStatus.current === "pending" && position.status === "serving") {
        toast({ 
          title: "It's your turn!", 
          description: "Your service has started. Please proceed to the barber chair.",
          duration: 10000,
        });
      } else if (position.status === "cancelled" && prevStatus.current !== undefined) {
        toast({ 
          title: "Booking Cancelled", 
          description: "Your booking was cancelled.",
          variant: "destructive"
        });
      }
      prevStatus.current = position.status;
    }
  }, [position, toast]);

  const inQueue = !posError && !!position;

  const { data: barbers, isLoading: barbersLoading } = useListBarbers(undefined, {
    query: { refetchInterval: 15000 } as any
  });

  const { data: services } = useListServices();

  const { data: queues } = useListQueue({ query: { refetchInterval: 15000 } as any });

  const activeServices = (services ?? []).filter(s => s.isActive);

  const joinQueue = useJoinQueue({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetMyQueuePositionQueryKey() });
        queryClient.invalidateQueries({ queryKey: getListBarbersQueryKey() });
        queryClient.invalidateQueries({ queryKey: getListQueueQueryKey() });
        setJoinModalOpen(false);
        toast({ title: "Joined queue", description: "You have been added to the queue." });
      },
      onError: (err: any) => {
        toast({
          title: "Could not join queue",
          description: err?.data?.message ?? err?.data?.error ?? "Please try again.",
          variant: "destructive"
        });
      }
    }
  });

  const cancelBooking = useCancelBooking({
    mutation: {
      onSuccess: (data) => {
        queryClient.invalidateQueries({ queryKey: getGetMyQueuePositionQueryKey() });
        queryClient.invalidateQueries({ queryKey: getListBarbersQueryKey() });
        queryClient.invalidateQueries({ queryKey: getListQueueQueryKey() });
        toast({
          title: data.penaltyApplied ? "Cancelled with penalty" : "Booking cancelled",
          description: data.message,
          variant: data.penaltyApplied ? "destructive" : "default",
        });
      }
    }
  });

  const handleJoinConfirm = () => {
    if (!selectedService) {
      toast({ title: "Service required", description: "Please select a service to continue.", variant: "destructive" });
      return;
    }
    const serviceId = selectedService as any;
    if (selectedBarber === "auto") {
      joinQueue.mutate({ data: { autoAssign: true, serviceId } });
    } else {
      joinQueue.mutate({ data: { barberId: selectedBarber as any, serviceId } });
    }
  };

  const handleCancel = () => {
    if (position) {
      cancelBooking.mutate({ bookingId: position.id });
    }
  };

  const statusColor: Record<string, string> = {
    active: "bg-blue-100 text-blue-800",
    serving: "bg-green-100 text-green-800",
    pending: "bg-yellow-100 text-yellow-800",
    waitlisted: "bg-orange-100 text-orange-800",
    completed: "bg-gray-100 text-gray-800",
    cancelled: "bg-red-100 text-red-800",
  };

  const availableBarbers = (barbers ?? []).filter(b => b.isAccepting && !b.isPaused);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Welcome, {user?.name}</h1>
        <p className="text-gray-500 text-sm mt-1">Manage your queue position and bookings</p>
      </div>

      {user?.penaltyPoints && user.penaltyPoints > 0 ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          You have {user.penaltyPoints} penalty point{user.penaltyPoints > 1 ? "s" : ""} due to late cancellations.
          Cancel before 20 minutes to avoid penalties.
        </div>
      ) : null}

      {posLoading ? (
        <Skeleton className="h-48 w-full rounded-xl" />
      ) : inQueue && position ? (
        <>
          {position.wasTransferred && (
            <Alert className="mb-4 border-blue-200 bg-blue-50">
              <AlertCircle className="h-4 w-4 text-blue-600" />
              <AlertTitle className="text-blue-800">Notice: Barber Transfer</AlertTitle>
              <AlertDescription className="text-blue-700">
                {position.transferNote || "You have been transferred to a new barber due to an emergency. Your position has been preserved."}
              </AlertDescription>
            </Alert>
          )}
          <Card className="border-2 border-amber-200 bg-amber-50">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Your Queue Status</CardTitle>
              <span className={`text-xs px-2 py-1 rounded-full font-semibold ${statusColor[position.status] ?? "bg-gray-100 text-gray-700"}`}>
                {position.status.charAt(0).toUpperCase() + position.status.slice(1)}
              </span>
            </div>
          </CardHeader>
          <CardContent>
            {position.status === "serving" ? (
              <div className="text-center py-4">
                <div className="text-4xl font-bold text-green-600 mb-2">It&apos;s your turn!</div>
                <p className="text-gray-600">Please proceed to the barber chair.</p>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm text-gray-500 mb-1">Position in queue</div>
                  <div className="text-5xl font-black text-gray-900">#{position.position}</div>
                </div>
                <div className="text-center">
                  <div className="text-sm text-gray-500 mb-1">Estimated wait</div>
                  <WaitTimer estimatedMinutes={position.estimatedWaitMinutes} />
                </div>
              </div>
            )}
            <div className="mt-4 flex gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={handleCancel}
                disabled={cancelBooking.isPending}
                className="border-red-200 text-red-600 hover:bg-red-50"
              >
                {cancelBooking.isPending ? "Cancelling..." : "Leave Queue"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </>
      ) : (
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-gray-500 mb-4">You are not currently in any queue.</p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button
                onClick={() => {
                  setSelectedBarber("auto");
                  setSelectedService("");
                  setJoinModalOpen(true);
                }}
                className="bg-gray-900 text-white hover:bg-gray-800"
              >
                Join Queue
              </Button>
              <Link href="/customer/book">
                <Button variant="outline">Book Appointment</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      )}

      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-3">Live Queue — All Barbers</h2>
        {barbersLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-48 rounded-xl" />)}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {(barbers ?? []).map((barber) => {
              const barberQueue = (queues ?? []).find(q => q.barberId === barber.id);
              const queueEntries = barberQueue?.activeQueue ?? [];

              return (
                <Card key={barber.id} className={!barber.isAccepting ? "opacity-60" : ""}>
                  <CardContent className="pt-5">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <div className="font-semibold text-gray-900">{barber.name}</div>
                        {barber.specialties && (
                          <div className="text-xs text-gray-500 mt-0.5">{barber.specialties}</div>
                        )}
                      </div>
                      <span className={`text-xs px-2 py-1 rounded-full font-semibold ${
                        !barber.isAccepting ? "bg-red-100 text-red-700" :
                        barber.isPaused ? "bg-yellow-100 text-yellow-700" :
                        "bg-green-100 text-green-700"
                      }`}>
                        {!barber.isAccepting ? "Closed" : barber.isPaused ? "Paused" : "Open"}
                      </span>
                    </div>

                    <div className="flex justify-between text-sm text-gray-500 mb-2">
                      <span className="flex items-center gap-1"><Users className="w-3 h-3" /> {barber.activeQueueCount} in queue</span>
                      <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> ~{barber.estimatedWaitTime} min</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-1.5 mb-3">
                      <div
                        className="bg-amber-500 h-1.5 rounded-full transition-all"
                        style={{ width: `${Math.min(100, ((barber.activeQueueCount ?? 0) / barber.maxQueueSize) * 100)}%` }}
                      />
                    </div>

                    {queueEntries.length > 0 ? (
                      <div className="space-y-1 mb-3">
                        {queueEntries.slice(0, 4).map((entry) => (
                          <div key={entry.id} className="flex items-center gap-2 text-xs">
                            <span className="text-gray-300 font-mono w-4">#{entry.position > 0 ? entry.position : 0}</span>
                            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${entry.status === "serving" ? "bg-green-500" : "bg-blue-400"}`} />
                            <span className="text-gray-700 font-medium truncate">{entry.guestName || entry.customer?.name || "Customer"}</span>
                            <span className="text-gray-400 ml-auto shrink-0">{entry.service?.name ?? "—"}</span>
                          </div>
                        ))}
                        {queueEntries.length > 4 && (
                          <div className="text-xs text-gray-400 text-center">+{queueEntries.length - 4} more</div>
                        )}
                      </div>
                    ) : barber.isAccepting ? (
                      <div className="text-xs text-gray-400 text-center py-2 mb-2">Queue is empty</div>
                    ) : null}

                    {barber.isAccepting && !barber.isPaused && (
                      <Button
                        size="sm"
                        className="w-full bg-gray-900 text-white hover:bg-gray-800"
                        onClick={() => {
                          setSelectedBarber(String(barber.id));
                          setSelectedService("");
                          setJoinModalOpen(true);
                        }}
                        disabled={joinQueue.isPending || inQueue}
                      >
                        {inQueue ? "Already in Queue" : "Join Queue"}
                      </Button>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      <Dialog open={joinModalOpen} onOpenChange={setJoinModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Join Queue</DialogTitle>
            <DialogDescription>
              Choose your barber and select a service to get started.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <Label className="mb-1.5 block">Select Barber</Label>
              <Select value={selectedBarber} onValueChange={setSelectedBarber}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a barber" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">
                    Any Barber (Shortest Wait)
                  </SelectItem>
                  {availableBarbers.map(b => (
                    <SelectItem key={b.id} value={String(b.id)}>
                      {b.name} — ~{b.estimatedWaitTime} min ({b.activeQueueCount}/{b.maxQueueSize})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="mb-1.5 block">
                Service <span className="text-red-500">*</span>
              </Label>
              <Select value={selectedService} onValueChange={setSelectedService}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a service" />
                </SelectTrigger>
                <SelectContent>
                  {activeServices.map(s => (
                    <SelectItem key={s.id} value={String(s.id)}>
                      {s.name} — {s.durationMinutes}min — ${s.price}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {!selectedService && (
                <p className="text-xs text-red-500 mt-1">A service is required to join the queue.</p>
              )}
            </div>

            {availableBarbers.length === 0 && (
              <p className="text-sm text-red-600">No barbers are currently accepting customers.</p>
            )}

            <div className="flex gap-3 pt-2">
              <Button
                className="flex-1 bg-gray-900 text-white hover:bg-gray-800"
                onClick={handleJoinConfirm}
                disabled={joinQueue.isPending || availableBarbers.length === 0 || !selectedService}
              >
                {joinQueue.isPending ? "Joining..." : "Confirm"}
              </Button>
              <Button variant="outline" className="flex-1" onClick={() => setJoinModalOpen(false)}>
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
