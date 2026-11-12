import { useAuth } from "@/hooks/use-auth";
import { 
  useListBarbers, 
  useGetBarberDashboard, 
  useUpdateBarberStatus, 
  useStartServing, 
  useCompleteBooking,
  useAddWalkin,
  useListServices
} from "@workspace/api-client-react";
import { getGetBarberDashboardQueryKey, getListBarbersQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger,
  DialogFooter
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState, useEffect, useRef } from "react";
import { useQueueSocket } from "@/hooks/use-queue-socket";

export default function BarberDashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: barbers } = useListBarbers();
  const myBarber = (barbers ?? []).find(b => String(b.userId) === String(user?.id));
  const barberId = myBarber?.id;

  const { data: dashboard, isLoading } = useGetBarberDashboard(barberId ?? 0, {
    query: { enabled: !!barberId, refetchInterval: 10000 } as any
  });

  // Subscribe to real-time socket updates for this barber's queue room
  useQueueSocket(barberId);

  const updateStatus = useUpdateBarberStatus({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListBarbersQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetBarberDashboardQueryKey(barberId ?? 0) });
      }
    }
  });

  const startServing = useStartServing({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetBarberDashboardQueryKey(barberId ?? 0) });
        toast({ title: "Serving customer", description: "Customer moved to serving status." });
      }
    }
  });

  const completeBooking = useCompleteBooking({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetBarberDashboardQueryKey(barberId ?? 0) });
        toast({ title: "Service completed", description: "Customer has been served." });
      }
    }
  });

  const [guestName, setGuestName] = useState("");
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null);
  const [isWalkinOpen, setIsWalkinOpen] = useState(false);

  const { data: services } = useListServices();

  const addWalkin = useAddWalkin({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetBarberDashboardQueryKey(barberId ?? 0) });
        toast({ title: "Walk-in added", description: "Customer added to queue." });
        setGuestName("");
        setSelectedServiceId(null);
        setIsWalkinOpen(false);
      }
    }
  });

  const handleAddWalkin = () => {
    if (!barberId || !guestName) return;
    addWalkin.mutate({ 
      data: { 
        barberId: String(barberId), 
        guestName, 
        serviceId: selectedServiceId ? String(selectedServiceId) : null 
      } as any
    });
  };

  const handleToggleAccepting = () => {
    if (!barberId) return;
    updateStatus.mutate({ barberId, data: { isAccepting: !myBarber?.isAccepting } });
  };

  const handleTogglePause = () => {
    if (!barberId) return;
    updateStatus.mutate({ barberId, data: { isPaused: !myBarber?.isPaused } });
  };

  const queue = dashboard?.currentQueue ?? [];
  const prevQueueIds = useRef<string[]>([]);

  useEffect(() => {
    if (isLoading) return;
    const currentIds = queue.map(q => String(q.id));
    
    if (prevQueueIds.current.length > 0) {
      const newCustomers = currentIds.filter(id => !prevQueueIds.current.includes(id));
      if (newCustomers.length > 0) {
        const names = queue
          .filter(q => newCustomers.includes(String(q.id)))
          .map(q => q.guestName || q.customer?.name || "A customer");
        toast({ title: "New Customer", description: `${names.join(", ")} joined your queue.` });
      }
    }
    prevQueueIds.current = currentIds;
  }, [queue, isLoading, toast]);

  if (isLoading || !barberId) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 rounded-xl" />
        <Skeleton className="h-48 rounded-xl" />
      </div>
    );
  }

  const barber = dashboard?.barber ?? myBarber;
  const stats = dashboard?.todayStats;
  const upcoming = dashboard?.upcomingAppointments ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{barber?.name}</h1>
          <p className="text-gray-500 text-sm mt-1">Barber Dashboard</p>
        </div>
        <div className="flex gap-2">
          <Dialog open={isWalkinOpen} onOpenChange={setIsWalkinOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100">
                Add Walk-in
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Walk-in Customer</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Customer Name</Label>
                  <Input 
                    id="name" 
                    placeholder="Enter name" 
                    value={guestName}
                    onChange={(e) => setGuestName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="service">Service (Optional)</Label>
                  <Select onValueChange={setSelectedServiceId} value={selectedServiceId || undefined}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select service" />
                    </SelectTrigger>
                    <SelectContent>
                      {services?.map(s => (
                        <SelectItem key={s.id} value={s.id.toString()}>
                          {s.name} ({s.durationMinutes}m)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsWalkinOpen(false)}>Cancel</Button>
                <Button onClick={handleAddWalkin} disabled={addWalkin.isPending || !guestName}>Add to Queue</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <Button
            size="sm"
            variant={barber?.isPaused ? "default" : "outline"}
            onClick={handleTogglePause}
            disabled={updateStatus.isPending}
          >
            {barber?.isPaused ? "Resume Queue" : "Pause Queue"}
          </Button>
          <Button
            size="sm"
            className={barber?.isAccepting ? "bg-red-600 hover:bg-red-700 text-white" : "bg-green-600 hover:bg-green-700 text-white"}
            onClick={handleToggleAccepting}
            disabled={updateStatus.isPending}
          >
            {barber?.isAccepting ? "Stop Accepting" : "Start Accepting"}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="text-2xl font-bold text-gray-900">{stats?.served ?? 0}</div>
            <div className="text-xs text-gray-500 mt-1">Served today</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="text-2xl font-bold text-gray-900">{queue.length}</div>
            <div className="text-xs text-gray-500 mt-1">In queue</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="text-2xl font-bold text-gray-900">{stats?.avgServiceTime ?? barber?.avgServiceTime}m</div>
            <div className="text-xs text-gray-500 mt-1">Avg service time</div>
          </CardContent>
        </Card>
      </div>

      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-3">Current Queue</h2>
        {queue.length === 0 ? (
          <div className="text-center py-8 text-gray-400 border-2 border-dashed rounded-xl">Queue is empty</div>
        ) : (
          <div className="space-y-3">
            {queue.map((booking) => (
              <Card key={booking.id} className={booking.status === "serving" ? "border-green-300 bg-green-50" : ""}>
                <CardContent className="py-4">
                  <div className="flex items-center gap-4">
                    <div className="text-2xl font-black text-gray-300 w-8 shrink-0">#{booking.position > 0 ? booking.position : 0}</div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-gray-900">{booking.guestName || booking.customer?.name || "Customer"}</div>
                      <div className="text-sm text-gray-500">
                        {booking.service?.name ?? "No service selected"} 
                        {booking.bookingType === "appointment" && <span className="ml-2 text-xs text-amber-600">Appointment</span>}
                      </div>
                      <div className="text-xs text-gray-400 mt-0.5">Joined {new Date(booking.createdAt).toLocaleTimeString()}</div>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      {booking.status === "active" || booking.status === "pending" ? (
                        <Button
                          size="sm"
                          className="bg-amber-500 hover:bg-amber-600 text-white"
                          onClick={() => startServing.mutate({ bookingId: booking.id as any })}
                          disabled={startServing.isPending}
                        >
                          Start
                        </Button>
                      ) : booking.status === "serving" ? (
                        <Button
                          size="sm"
                          className="bg-green-600 hover:bg-green-700 text-white"
                          onClick={() => completeBooking.mutate({ bookingId: booking.id as any })}
                          disabled={completeBooking.isPending}
                        >
                          Complete
                        </Button>
                      ) : null}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-3">Upcoming Appointments</h2>
        {upcoming.length === 0 ? (
          <div className="text-center py-8 text-gray-400 border-2 border-dashed rounded-xl">No upcoming appointments</div>
        ) : (
          <div className="space-y-2">
            {upcoming.map(b => (
              <Card key={b.id}>
                <CardContent className="py-3">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-gray-900 truncate">{b.customer?.name}</div>
                      <div className="text-sm text-gray-500 truncate">{b.service?.name}</div>
                      <div className="text-xs font-semibold text-amber-600 mt-0.5">
                        {b.scheduledAt ? new Date(b.scheduledAt).toLocaleString() : ""}
                      </div>
                    </div>
                    <div className="shrink-0 flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="bg-amber-50 hover:bg-amber-100 text-amber-700 border-amber-200"
                        onClick={() => startServing.mutate({ bookingId: b.id as any })}
                        disabled={startServing.isPending}
                      >
                        Start Early
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
