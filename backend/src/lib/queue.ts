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

  // Only currently serving and active queue customers count towards live queue wait time
  const activeBookings = await Booking.find({
    barberId,
    status: { $in: ["active", "serving"] },
  });

  const avgTime = barber.avgServiceTime || 20;
  const servingCount = activeBookings.filter(b => b.status === "serving").length;
  const waitingCount = activeBookings.filter(b => b.status === "active").length;

  const servingRemainingTime = servingCount > 0 ? Math.ceil(avgTime / 2) : 0;
  return servingRemainingTime + waitingCount * avgTime;
}

export async function calculateNextAvailableSlot(barberId: string): Promise<Date> {
  const waitMinutes = await calculateWaitTime(barberId);
  const now = new Date();
  return new Date(now.getTime() + waitMinutes * 60000);
}

export async function getActiveQueueCount(barberId: string): Promise<number> {
  const count = await Booking.countDocuments({
    barberId,
    status: { $in: ["active", "serving"] },
  });
  return count;
}

// ---- Appointment Activation ----
export async function activateDueAppointments(barberId: string): Promise<void> {
  const now = new Date();
  const windowStart = new Date(now.getTime() - 60 * 60000);
  const windowEnd = new Date(now.getTime() + 15 * 60000);

  // 1. Activate pending appointments that are within 15 minutes of scheduled time or up to 60 minutes past
  const dueAppointments = await Booking.find({
    barberId,
    bookingType: "appointment",
    status: "pending",
    scheduledAt: { $gte: windowStart, $lte: windowEnd },
  });

  for (const appt of dueAppointments) {
    appt.status = "active";
    await appt.save();
  }

  // 2. Automatically mark unserved appointments older than 60 minutes as 'no-show'
  await Booking.updateMany(
    {
      barberId,
      bookingType: "appointment",
      status: "pending",
      scheduledAt: { $lt: windowStart },
    },
    { status: "no-show" }
  );
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

  const rawArrival = booking.scheduledAt || booking.createdAt || new Date();
  const arrivalTime = rawArrival instanceof Date ? rawArrival : new Date(rawArrival);

  return {
    id: booking._id.toString(),
    arrivalTime,
    serviceTime,
    profit,
    isAppointment: booking.bookingType === "appointment",
    status: booking.status,
    priorityScore: booking.priority || 0,
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
    status: "active",
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

  // Only active customers in queue get positions 1, 2, 3...
  const activeBookings = await Booking.find({
    barberId,
    status: "active",
  });

  const barber = await Barber.findById(barberId);
  const avgTime = barber?.avgServiceTime ?? 20;

  const queueCustomers: QueueCustomer[] = await Promise.all(
    activeBookings.map(toQueueCustomer)
  );

  const sorted = rebalanceQueue(queueCustomers);

  const servingCount = await Booking.countDocuments({ barberId, status: "serving" });
  const baseWait = servingCount > 0 ? Math.ceil(avgTime / 2) : 0;

  for (let i = 0; i < sorted.length; i++) {
    const entry = sorted[i];
    const position = i + 1;
    const estimatedWait = baseWait + i * avgTime;

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

  // Keep pending appointments at position 0
  await Booking.updateMany(
    { barberId, status: "pending" },
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
