import { Router } from "express";
import Barber from "../models/Barber";
import Booking from "../models/Booking";
import {
  calculateWaitTime,
  calculateNextAvailableSlot,
  getActiveQueueCount,
  enrichBookingWithDetails,
  recalculatePositions,
  updatePriorityScores,
} from "../lib/queue";
import { emitQueueUpdated } from "../lib/socketio";

const router = Router();

router.get("/dashboard/summary", async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const allBarbers = await Barber.find();

    for (const barber of allBarbers) {
      await recalculatePositions(barber._id.toString());
    }

    const todayBookings = await Booking.find({
      $or: [
        { createdAt: { $gte: today, $lt: tomorrow } },
        { scheduledAt: { $gte: today, $lt: tomorrow } },
        { completedAt: { $gte: today, $lt: tomorrow } },
        { cancelledAt: { $gte: today, $lt: tomorrow } }
      ]
    });

    const totalCustomersToday = todayBookings.filter(b =>
      (b.bookingType === "walkin" && b.createdAt >= today && b.createdAt < tomorrow) ||
      (b.bookingType === "appointment" && b.scheduledAt && b.scheduledAt >= today && b.scheduledAt < tomorrow)
    ).length;
    const totalServedToday = await Booking.countDocuments({ completedAt: { $gte: today, $lt: tomorrow } });
    const cancellationsToday = await Booking.countDocuments({ cancelledAt: { $gte: today, $lt: tomorrow } });
    const activeBarbers = allBarbers.filter(b => b.isAccepting && !b.isPaused).length;
    const currentQueueSize = await Booking.countDocuments({ status: { $in: ["active", "serving"] } });

    let totalWait = 0;
    for (const barber of allBarbers) {
      totalWait += await calculateWaitTime(barber._id.toString());
    }
    const averageWaitTime = allBarbers.length > 0 ? Math.round(totalWait / allBarbers.length) : 0;

    const barberStatuses = await Promise.all(allBarbers.map(async (barber) => ({
      ...barber.toObject(),
      id: barber._id,
      activeQueueCount: await getActiveQueueCount(barber._id.toString()),
      estimatedWaitTime: await calculateWaitTime(barber._id.toString()),
      nextAvailableSlot: await calculateNextAvailableSlot(barber._id.toString()),
    })));

    res.json({
      totalCustomersToday,
      totalServedToday,
      activeBarbers,
      totalBarbers: allBarbers.length,
      averageWaitTime,
      currentQueueSize,
      cancellationsToday,
      barberStatuses,
    });
  } catch (error: any) {
    res.status(500).json({ error: "Server Error", message: error.message });
  }
});

router.get("/dashboard/barber/:barberId", async (req, res) => {
  try {
    const barberId = req.params.barberId;
    const barber = await Barber.findById(barberId);

    if (!barber) {
      return res.status(404).json({ error: "Barber not found" });
    }

    await recalculatePositions(barberId);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const served = await Booking.countDocuments({ barberId, completedAt: { $gte: today, $lt: tomorrow } });
    const cancelled = await Booking.countDocuments({ barberId, cancelledAt: { $gte: today, $lt: tomorrow } });

    const currentQueue = await Booking.find({
      barberId,
      status: { $in: ["active", "serving"] }
    }).sort({ position: 1 });

    const upcomingAppointments = await Booking.find({
      barberId,
      bookingType: "appointment",
      status: "pending",
    }).sort({ scheduledAt: 1 });

    const enrichedQueue = await Promise.all(currentQueue.map(enrichBookingWithDetails));
    const enrichedUpcoming = await Promise.all(upcomingAppointments.map(enrichBookingWithDetails));

    res.json({
      barber: { ...barber.toObject(), id: barber._id },
      todayStats: { served, cancelled, avgServiceTime: barber.avgServiceTime },
      currentQueue: enrichedQueue,
      upcomingAppointments: enrichedUpcoming,
    });
  } catch (error: any) {
    res.status(500).json({ error: "Server Error", message: error.message });
  }
});

export default router;
