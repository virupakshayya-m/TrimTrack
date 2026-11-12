import { Router } from "express";
import { protect, staff, admin } from "../middlewares/auth";
import Barber from "../models/Barber";
import Booking from "../models/Booking";
import Service from "../models/Service";
import User from "../models/User";
import {
  calculateWaitTime,
  getActiveQueueCount,
  recalculatePositions,
  enrichBookingWithDetails,
  updatePriorityScores,
} from "../lib/queue";
import { emitQueueUpdated } from "../lib/socketio";
import { calculatePriorityScore } from "../lib/priority";

const router = Router();

// @desc    Get full queue state
// @route   GET /api/queue
// @access  Public
router.get("/queue", async (req, res) => {
  try {
    const barbers = await Barber.find();

    const result = await Promise.all(barbers.map(async (barber) => {
      await recalculatePositions(barber._id.toString());

      const allBookings = await Booking.find({
        barberId: barber._id,
        $or: [
          { status: { $in: ["active", "serving", "waitlisted"] } },
          { status: "pending", bookingType: "appointment", scheduledAt: { $gte: new Date() } }
        ]
      }).sort({ position: 1, createdAt: 1 });

      const activeQueue = allBookings.filter(b =>
        b.status === "active" || b.status === "serving"
      );
      const waitlist = allBookings.filter(b => b.status === "waitlisted");
      const upcoming = allBookings.filter(b =>
        b.status === "pending" && b.bookingType === "appointment" && b.scheduledAt && b.scheduledAt > new Date()
      );

      const enrichedActive = await Promise.all(activeQueue.map(enrichBookingWithDetails));
      const enrichedWaitlist = await Promise.all(waitlist.map(enrichBookingWithDetails));
      const enrichedUpcoming = await Promise.all(upcoming.map(enrichBookingWithDetails));
      const estimatedWaitMinutes = await calculateWaitTime(barber._id.toString());

      return {
        barberId: barber._id,
        barberName: barber.name,
        isAccepting: barber.isAccepting,
        isPaused: barber.isPaused,
        activeQueue: enrichedActive,
        waitlist: enrichedWaitlist,
        upcomingAppointments: enrichedUpcoming,
        estimatedWaitMinutes,
      };
    }));

    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: "Server Error", message: error.message });
  }
});

// @desc    Join the walk-in queue
// @route   POST /api/queue/join
// @access  Private
router.post("/queue/join", protect, async (req: any, res: any) => {
  try {
    let { barberId, serviceId, autoAssign } = req.body;

    if (autoAssign || !barberId) {
      const allBarbers = await Barber.find({ isAccepting: true, isPaused: false });
      if (allBarbers.length === 0) {
        return res.status(400).json({ error: "No barbers available", queueFull: false });
      }
      
      let minWait = Infinity;
      let bestBarber = allBarbers[0];
      for (const barber of allBarbers) {
        const queueCount = await getActiveQueueCount(barber._id.toString());
        if (queueCount >= barber.maxQueueSize) continue;
        const wait = await calculateWaitTime(barber._id.toString());
        if (wait < minWait) {
          minWait = wait;
          bestBarber = barber;
        }
      }
      barberId = bestBarber._id;
    }

    const barber = await Barber.findById(barberId);
    if (!barber) {
      return res.status(404).json({ error: "Barber not found" });
    }

    if (!barber.isAccepting) {
      return res.status(400).json({ error: "Barber is not accepting customers" });
    }

    const currentCount = await getActiveQueueCount(barberId);
    if (currentCount >= barber.maxQueueSize) {
      return res.status(400).json({ error: "Queue is full", queueFull: true });
    }

    const existingBooking = await Booking.findOne({
      customerId: req.user._id,
      status: { $in: ["active", "serving"] }
    });

    if (existingBooking) {
      return res.status(400).json({ 
        error: "Already in queue", 
        message: "You are already actively in a queue." 
      });
    }

    let profit = 0;
    let serviceTime = barber.avgServiceTime;
    if (serviceId) {
      const svc = await Service.findById(serviceId);
      if (svc) {
        profit = svc.price || 0;
        serviceTime = svc.durationMinutes || barber.avgServiceTime;
      }
    }

    const arrivalTime = new Date();
    const initialScore = Math.round(calculatePriorityScore({
      arrivalTime,
      serviceTime,
      profit,
      isAppointment: false,
    }));

    const booking = await Booking.create({
      customerId: req.user._id,
      barberId,
      serviceId: serviceId || null,
      status: "active",
      bookingType: "walkin",
      priority: initialScore,
      position: currentCount + 1,
      estimatedWaitMinutes: await calculateWaitTime(barberId),
      penaltyApplied: false,
    });

    await recalculatePositions(barberId);
    emitQueueUpdated(barberId, { event: "customerJoined", bookingId: booking._id });

    res.status(201).json({ ...booking.toObject(), id: booking._id });
  } catch (error: any) {
    res.status(500).json({ error: "Server Error", message: error.message });
  }
});

// @desc    Get current user's queue position
// @route   GET /api/queue/my-position
// @access  Private
router.get("/queue/my-position", protect, async (req: any, res: any) => {
  try {
    const bookings = await Booking.find({
      customerId: req.user._id,
      status: { $in: ["active", "serving"] }
    }).sort({ position: 1, createdAt: -1 });

    if (bookings.length === 0) {
      return res.status(404).json({ error: "Not in queue" });
    }

    // Return the best position (lowest number)
    res.json({ ...bookings[0].toObject(), id: bookings[0]._id });
  } catch (error: any) {
    res.status(500).json({ error: "Server Error", message: error.message });
  }
});

// @desc    Add a walk-in customer (Barber action)
// @route   POST /api/queue/walkin
// @access  Private/Staff
router.post("/queue/walkin", protect, staff, async (req: any, res: any) => {
  try {
    const { barberId, serviceId, guestName } = req.body;

    if (!barberId || !guestName) {
      return res.status(400).json({ error: "Barber ID and Guest Name are required" });
    }

    const barber = await Barber.findById(barberId);
    if (!barber) {
      return res.status(404).json({ error: "Barber not found" });
    }

    let profit = 0;
    let serviceTime = barber.avgServiceTime;
    if (serviceId) {
      const svc = await Service.findById(serviceId);
      if (svc) {
        profit = svc.price || 0;
        serviceTime = svc.durationMinutes || barber.avgServiceTime;
      }
    }

    const currentCount = await getActiveQueueCount(barberId);
    const arrivalTime = new Date();
    const initialScore = Math.round(calculatePriorityScore({
      arrivalTime,
      serviceTime,
      profit,
      isAppointment: false,
    }));

    const booking = await Booking.create({
      guestName,
      barberId,
      serviceId: serviceId || null,
      status: "active",
      bookingType: "walkin",
      priority: initialScore,
      position: currentCount + 1,
      estimatedWaitMinutes: await calculateWaitTime(barberId),
      penaltyApplied: false,
    });

    await recalculatePositions(barberId);
    emitQueueUpdated(barberId, { event: "customerJoined", bookingId: booking._id });

    res.status(201).json({ ...booking.toObject(), id: booking._id });
  } catch (error: any) {
    res.status(500).json({ error: "Server Error", message: error.message });
  }
});

// @desc    Transfer multiple bookings to a new barber (Admin action)
// @route   POST /api/queue/transfer-bulk
// @access  Private/Admin
router.post("/queue/transfer-bulk", protect, admin, async (req: any, res: any) => {
  try {
    const { bookingIds, targetBarberId, reason } = req.body;

    if (!bookingIds || !Array.isArray(bookingIds) || bookingIds.length === 0) {
      return res.status(400).json({ error: "Booking IDs are required" });
    }

    let finalTargetBarberId = targetBarberId;
    let sourceBarberId: string | null = null;

    // Get the first booking to find source barber
    const firstBooking = await Booking.findById(bookingIds[0]);
    if (firstBooking) {
      sourceBarberId = firstBooking.barberId.toString();
    }

    if (targetBarberId === "auto") {
      const allBarbers = await Barber.find({ isAccepting: true, isPaused: false });
      // Filter out the source barber
      const availableBarbers = allBarbers.filter(b => b._id.toString() !== sourceBarberId);
      
      if (availableBarbers.length === 0) {
        return res.status(400).json({ error: "No other barbers available for transfer" });
      }

      let minWait = Infinity;
      let bestBarber = availableBarbers[0];
      for (const barber of availableBarbers) {
        const wait = await calculateWaitTime(barber._id.toString());
        if (wait < minWait) {
          minWait = wait;
          bestBarber = barber;
        }
      }
      finalTargetBarberId = bestBarber._id.toString();
    }

    const targetBarber = await Barber.findById(finalTargetBarberId);
    if (!targetBarber) {
      return res.status(404).json({ error: "Target barber not found" });
    }

    const transferNote = reason || `Transferred to ${targetBarber.name} due to emergency.`;

    const now = new Date();
    const bookingsToTransfer = await Booking.find({ _id: { $in: bookingIds } });

    for (const b of bookingsToTransfer) {
      b.barberId = finalTargetBarberId;
      b.wasTransferred = true;
      b.transferNote = transferNote;
      // Keep future pending appointments pending; make immediate customers active
      if (b.bookingType === "appointment" && b.scheduledAt && b.scheduledAt > now && b.status === "pending") {
        b.status = "pending";
      } else {
        b.status = "active";
      }
      await b.save();
    }

    // Recalculate for both source and target
    if (sourceBarberId) {
      await recalculatePositions(sourceBarberId);
      emitQueueUpdated(sourceBarberId, { event: "customersTransferredOut" });
    }
    await recalculatePositions(finalTargetBarberId);
    emitQueueUpdated(finalTargetBarberId, { event: "customersTransferredIn" });

    res.json({ 
      message: "Bookings transferred successfully", 
      targetBarberId: finalTargetBarberId,
      targetBarberName: targetBarber.name 
    });
  } catch (error: any) {
    res.status(500).json({ error: "Server Error", message: error.message });
  }
});

// @desc    Cancel multiple bookings (Admin action)
// @route   POST /api/queue/cancel-bulk
// @access  Private/Admin
router.post("/queue/cancel-bulk", protect, admin, async (req: any, res: any) => {
  try {
    const { bookingIds, reason } = req.body;

    if (!bookingIds || !Array.isArray(bookingIds) || bookingIds.length === 0) {
      return res.status(400).json({ error: "Booking IDs are required" });
    }

    const firstBooking = await Booking.findById(bookingIds[0]);
    let sourceBarberId: string | null = null;
    if (firstBooking) {
      sourceBarberId = firstBooking.barberId.toString();
    }

    const cancellationNote = reason || "Cancelled due to shop emergency.";

    await Booking.updateMany(
      { _id: { $in: bookingIds } },
      { 
        status: "cancelled",
        cancelledAt: new Date(),
        notes: cancellationNote
      }
    );

    if (sourceBarberId) {
      await recalculatePositions(sourceBarberId);
      emitQueueUpdated(sourceBarberId, { event: "customersCancelledBulk" });
    }

    res.json({ message: "Bookings cancelled successfully" });
  } catch (error: any) {
    res.status(500).json({ error: "Server Error", message: error.message });
  }
});

export default router;
