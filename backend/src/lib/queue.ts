import Barber from '../models/Barber';
import Booking from '../models/Booking';
import Service from '../models/Service';
import User from '../models/User';
import {
  calculatePriorityScore,
  rebalanceQueue,
  type QueueCustomer,
  FAIRNESS_THRESHOLD_MINUTES,
} from './priority';

export type BookingStatus = "pending" | "active" | "serving" | "completed" | "cancelled" | "waitlisted";

export const PRIORITY_APPOINTMENT = 4;
export const PRIORITY_WALKIN = 0;
export const CANCELLATION_PENALTY_MINUTES = 20;
export const MAX_PENALTY_POINTS = 3;

export { FAIRNESS_THRESHOLD_MINUTES };

// ---- Wait Time ----
export async function calculateWaitTime(barberId: string): Promise<number> {
  const barber = await Barber.findById(barberId);
  if (!barber) return 0;

  const activeBookings = await Booking.find({
    barberId,
    status: { $in: ["active", "serving", "pending"] },
  });

  const avgTime = barber.avgServiceTime;
  const servingCount = activeBookings.filter(b => b.status === "serving").length;
  const pendingCount = activeBookings.filter(b => b.status === "active" || b.status === "pending").length;

  const servingRemainingTime = servingCount > 0 ? Math.ceil(avgTime / 2) : 0;
  return servingRemainingTime + pendingCount * avgTime;
}

export async function calculateNextAvailableSlot(barberId: string): Promise<Date> {
  const waitMinutes = await calculateWaitTime(barberId);
  const now = new Date();
  return new Date(now.getTime() + waitMinutes * 60000);
}

export async function getActiveQueueCount(barberId: string): Promise<number> {
  const count = await Booking.countDocuments({
    barberId,
    status: { $in: ["active", "serving", "pending"] },
  });
  return count;
}

// ---- Appointment Activation ----
export async function activateDueAppointments(barberId: string): Promise<void> {
  const activationWindow = new Date();
  const dueAppointments = await Booking.find({
    barberId,
    bookingType: "appointment",
    status: "pending",
    scheduledAt: { $lte: activationWindow },
  });

  if (dueAppointments.length === 0) return;

  for (const appt of dueAppointments) {
    appt.status = "active";
    await appt.save();
  }
}

// ---- Priority Score Helpers ----
async function toQueueCustomer(booking: any): Promise<QueueCustomer> {
  let profit = 0;
  let serviceTime = 20;

  if (booking.serviceId) {
    const svc = await Service.findById(booking.serviceId);
    if (svc) {
      profit = svc.price ?? 0;
      serviceTime = svc.durationMinutes ?? 20;
    }
  }

  return {
    id: booking._id.toString(),
    arrivalTime: booking.scheduledAt || booking.createdAt,
    serviceTime,
    profit,
    isAppointment: booking.bookingType === "appointment",
    status: booking.status,
    priorityScore: booking.priority,
  };
}

export async function updateBookingPriorityScore(bookingId: string): Promise<number> {
  const booking = await Booking.findById(bookingId);
  if (!booking) return 0;

  const customer = await toQueueCustomer(booking);
  const score = Math.round(calculatePriorityScore(customer));

  await Booking.findByIdAndUpdate(bookingId, { priority: score });
  return score;
}

export async function updatePriorityScores(barberId: string): Promise<void> {
  const activeBookings = await Booking.find({
    barberId,
    status: { $in: ["active", "pending"] },
  });

  for (const booking of activeBookings) {
    const customer = await toQueueCustomer(booking);
    const score = Math.round(calculatePriorityScore(customer));
    await Booking.findByIdAndUpdate(booking._id, { priority: score });
  }
}

// ---- Queue Rebalancing ----
export async function recalculatePositions(barberId: string): Promise<void> {
  await activateDueAppointments(barberId);
  await updatePriorityScores(barberId);

  const activeBookings = await Booking.find({
    barberId,
    status: { $in: ["active", "pending"] },
  });

  const barber = await Barber.findById(barberId);
  const avgTime = barber?.avgServiceTime ?? 20;

  const queueCustomers: QueueCustomer[] = await Promise.all(
    activeBookings.map(toQueueCustomer)
  );

  const sorted = rebalanceQueue(queueCustomers);

  for (let i = 0; i < sorted.length; i++) {
    const entry = sorted[i];
    const position = i + 1;
    const estimatedWait = i * avgTime;

    await Booking.findByIdAndUpdate(entry.id, {
      position,
      estimatedWaitMinutes: estimatedWait,
    });
  }

  // Set serving to position 0
  await Booking.updateMany(
    { barberId, status: "serving" },
    { position: 0, estimatedWaitMinutes: 0 }
  );
}

export async function applyStarvationPrevention(_barberId: string): Promise<void> {
  // No-op
}

// ---- Enrichment ----
export async function enrichBookingWithDetails(booking: any) {
  const customer = booking.customerId ? await User.findById(booking.customerId).select('-passwordHash') : null;
  const barber = await Barber.findById(booking.barberId);
  let service = null;

  if (booking.serviceId) {
    service = await Service.findById(booking.serviceId);
  }

  // Convert mongoose doc to plain object if necessary
  const bookingObj = booking.toObject ? booking.toObject() : booking;

  return {
    ...bookingObj,
    id: bookingObj._id, // map _id to id
    customer: customer ? { ...customer.toObject(), id: customer._id } : null,
    barber: barber ? { 
      ...barber.toObject(), 
      id: barber._id,
      nextAvailableSlot: await calculateNextAvailableSlot(booking.barberId.toString())
    } : null,
    service: service ? { ...service.toObject(), id: service._id } : null,
  };
}
