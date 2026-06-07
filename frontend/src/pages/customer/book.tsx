import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useListBarbers, useListServices, useCreateBooking } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Clock } from "lucide-react";

interface BookedSlot {
  scheduledAt: string;
  durationMinutes: number;
}

function isSlotConflict(selectedDate: string, selectedTime: string, slots: BookedSlot[]): boolean {
  if (!selectedDate || !selectedTime) return false;
  const newStart = new Date(`${selectedDate}T${selectedTime}`);
  const newEnd = new Date(newStart.getTime() + 30 * 60000);

  return slots.some(slot => {
    const existStart = new Date(slot.scheduledAt);
    const existEnd = new Date(existStart.getTime() + slot.durationMinutes * 60000);
    return newStart < existEnd && newEnd > existStart;
  });
}

export default function CustomerBook() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [barberId, setBarberId] = useState<string>("");
  const [serviceId, setServiceId] = useState<string>("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [bookedSlots, setBookedSlots] = useState<BookedSlot[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);

  const { data: barbers } = useListBarbers();
  const { data: services } = useListServices();
  const activeServices = (services ?? []).filter(s => s.isActive);

  useEffect(() => {
    if (!barberId || !date) {
      setBookedSlots([]);
      return;
    }
    setSlotsLoading(true);
    const token = localStorage.getItem("salon_token");
    fetch(`/api/barbers/${barberId}/slots?date=${date}`, token ? { headers: { Authorization: `Bearer ${token}` } } : undefined)
      .then(r => r.json())
      .then(data => { setBookedSlots(Array.isArray(data) ? data : []); })
      .catch(() => setBookedSlots([]))
      .finally(() => setSlotsLoading(false));
  }, [barberId, date]);

  const createBooking = useCreateBooking({
    mutation: {
      onSuccess: () => {
        toast({ title: "Appointment booked!", description: "Your appointment has been scheduled." });
        setLocation("/customer/bookings");
      },
      onError: (err: any) => {
        toast({
          title: "Booking failed",
          description: err?.data?.message ?? err?.data?.error ?? "Please try again.",
          variant: "destructive"
        });
      }
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!barberId || !date || !time) {
      toast({ title: "Missing fields", description: "Please select a barber, date, and time.", variant: "destructive" });
      return;
    }
    if (isSlotConflict(date, time, bookedSlots)) {
      toast({ title: "Time slot taken", description: "This time is already booked. Please choose a different slot.", variant: "destructive" });
      return;
    }
    const scheduledDateObj = new Date(`${date}T${time}`);
    if (scheduledDateObj < new Date()) {
      toast({ title: "Invalid time", description: "Cannot book appointments in the past.", variant: "destructive" });
      return;
    }

    const scheduledAt = scheduledDateObj.toISOString();
    createBooking.mutate({
      data: {
        barberId: barberId as any,
        serviceId: serviceId ? serviceId as any : undefined,
        scheduledAt,
      }
    });
  };

  const hasConflict = isSlotConflict(date, time, bookedSlots);

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Book Appointment</h1>

      <Card>
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <Label className="mb-1.5 block">Select Barber</Label>
              <Select value={barberId} onValueChange={v => { setBarberId(v); setTime(""); }}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a barber" />
                </SelectTrigger>
                <SelectContent>
                  {(barbers ?? []).map(b => (
                    <SelectItem key={b.id} value={String(b.id)}>
                      {b.name} — ~{b.estimatedWaitTime}min wait
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="mb-1.5 block">Service (Optional)</Label>
              <Select value={serviceId} onValueChange={setServiceId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a service" />
                </SelectTrigger>
                <SelectContent>
                  {activeServices.map(s => (
                    <SelectItem key={s.id} value={String(s.id)}>
                      {s.name} — {s.durationMinutes}min — ₹{s.price}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="mb-1.5 block">Date</Label>
                <input
                  type="date"
                  value={date}
                  onChange={e => { setDate(e.target.value); setTime(""); }}
                  min={new Date().toISOString().split("T")[0]}
                  className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
              <div>
                <Label className="mb-1.5 block">Time</Label>
                <input
                  type="time"
                  value={time}
                  onChange={e => setTime(e.target.value)}
                  min={date === new Date().toISOString().split("T")[0] ? new Date().toTimeString().slice(0, 5) : undefined}
                  className={`w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 ${hasConflict ? "border-red-400 bg-red-50" : "border-gray-200"}`}
                />
                {hasConflict && (
                  <p className="text-xs text-red-600 mt-1">This time slot is already booked.</p>
                )}
              </div>
            </div>

            <Button
              type="submit"
              className="w-full bg-gray-900 text-white hover:bg-gray-800"
              disabled={createBooking.isPending || hasConflict}
            >
              {createBooking.isPending ? "Booking..." : "Confirm Appointment"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {barberId && date && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">
              Booked Slots — {(barbers ?? []).find(b => String(b.id) === barberId)?.name ?? "Selected Barber"}
              {" "}on {date ? new Date(date + "T00:00").toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" }) : ""}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {slotsLoading ? (
              <div className="text-sm text-gray-400">Loading booked slots...</div>
            ) : bookedSlots.length === 0 ? (
              <div className="text-sm text-gray-400 text-center py-4">No appointments booked on this day — all slots are available.</div>
            ) : (
              <div className="space-y-2">
                {bookedSlots
                  .slice()
                  .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime())
                  .map((slot, i) => {
                    const start = new Date(slot.scheduledAt);
                    const end = new Date(start.getTime() + slot.durationMinutes * 60000);
                    return (
                      <div key={i} className="flex items-center gap-3 p-2 rounded-lg bg-red-50 border border-red-100">
                        <div className="w-2 h-2 rounded-full bg-red-400 shrink-0" />
                        <Clock className="w-3.5 h-3.5 text-red-400 shrink-0" />
                        <span className="text-sm text-red-700 font-medium">
                          {start.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} — {end.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </span>
                        <span className="text-xs text-red-400 ml-auto">Booked ({slot.durationMinutes}min)</span>
                      </div>
                    );
                  })}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
