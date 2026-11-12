import { Router } from "express";
import { protect, admin } from "../middlewares/auth";
import Booking from "../models/Booking";
import Barber from "../models/Barber";
import User from "../models/User";
import { calculateWaitTime, recalculatePositions, enrichBookingWithDetails } from "../lib/queue";
import { calculatePriorityScore } from "../lib/priority";
import Service from "../models/Service";

import { emitQueueUpdated } from "../lib/socketio";

const router = Router();

// @desc    Get all bookings
// @route   GET /api/bookings
// @access  Private
router.get("/bookings", protect, async (req: any, res: any) => {
  try {
    const { status, barberId, date } = req.query;
    const query: any = {};

    if (status) query.status = status;
    if (barberId) query.barberId = barberId;
    if (date) {
      const start = new Date(date as string);
      start.setHours(0,0,0,0);
      const end = new Date(date as string);
      end.setHours(23,59,59,999);
      query.scheduledAt = { $gte: start, $lte: end };
    }

    // Admins see all, others see their own (or barbers see assigned)
    if (req.user.role === "customer") {
      query.customerId = req.user._id;
    } else if (req.user.role === "barber") {
      const barber = await Barber.findOne({ userId: req.user._id });
      if (barber) {
        query.barberId = barber._id;
      } else {
        return res.json([]);
      }
    }

    const bookings = await Booking.find(query).sort({ createdAt: -1 });
    const enriched = await Promise.all(bookings.map(enrichBookingWithDetails));

    res.json(enriched);
  } catch (error: any) {
    res.status(500).json({ error: "Server Error", message: error.message });
  }
});

// @desc    Create an appointment booking
// @route   POST /api/bookings
// @access  Private
router.post("/bookings", protect, async (req: any, res: any) => {
  try {
    const { barberId, serviceId, scheduledAt, notes } = req.body;

    if (!barberId || !scheduledAt) {
      return res.status(400).json({ error: "Barber and scheduled time are required" });
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

    const arrivalTime = new Date(scheduledAt);

    if (isNaN(arrivalTime.getTime())) {
      return res.status(400).json({ error: "Invalid date format", message: "Invalid scheduled time format" });
    }

    if (arrivalTime < new Date()) {
      return res.status(400).json({ error: "Cannot book appointments in the past" });
    }

    // Backend Slot Conflict Prevention: ensure no overlapping appointments for this barber
    const newStart = arrivalTime;
    const newEnd = new Date(newStart.getTime() + serviceTime * 60000);

    const dayStart = new Date(newStart);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(newStart);
    dayEnd.setHours(23, 59, 59, 999);

    // Check existing appointments on the same day for overlap
    const existingAppointments = await Booking.find({
      barberId,
      bookingType: "appointment",
      status: { $in: ["pending", "active", "serving"] },
      scheduledAt: {
        $gte: dayStart,
        $lte: dayEnd,
      },
    });

    for (const exist of existingAppointments) {
      if (!exist.scheduledAt) continue;
      let existDuration = barber.avgServiceTime || 30;
      if (exist.serviceId) {
        const existSvc = await Service.findById(exist.serviceId);
        if (existSvc && existSvc.durationMinutes) existDuration = existSvc.durationMinutes;
      }
      const existStart = new Date(exist.scheduledAt);
      const existEnd = new Date(existStart.getTime() + existDuration * 60000);

      if (newStart < existEnd && newEnd > existStart) {
        return res.status(400).json({
          error: "Time slot conflict",
          message: "This time slot is already booked for this barber. Please choose a different slot.",
        });
      }
    }

    const initialScore = Math.round(calculatePriorityScore({

      arrivalTime,
      serviceTime,
      profit,
      isAppointment: true,
    }));

    const booking = await Booking.create({
      customerId: req.user._id,
      barberId,
      serviceId: serviceId || null,
      status: "pending",
      bookingType: "appointment",
      priority: initialScore,
      position: 0, // Pending appointments don't have a position until they are active
      estimatedWaitMinutes: 0,
      scheduledAt: arrivalTime,
      penaltyApplied: false,
    });

    emitQueueUpdated(barberId, { event: "appointmentCreated", bookingId: booking._id });

    // Since it's pending, it might not affect active queue position immediately,
    // but calculating wait time is safe.
    await recalculatePositions(barberId);

    const enriched = await enrichBookingWithDetails(booking.toObject());
    
    res.status(201).json({ ...enriched, id: booking._id });
  } catch (error: any) {
    res.status(500).json({ error: "Server Error", message: error.message });
  }
});

// @desc    Update booking status (serve, complete, cancel, status)
// @route   PATCH /api/bookings/:bookingId/:action
// @access  Private
router.patch("/bookings/:bookingId/:action", protect, async (req: any, res: any) => {
  try {
    const action = req.params.action;
    let status = req.body?.status;

    if (action === "serve") status = "serving";
    else if (action === "complete") status = "completed";
    else if (action === "cancel") status = "cancelled";
    else if (action !== "status") {
      return res.status(404).json({ error: "Invalid route" });
    }

    const booking = await Booking.findById(req.params.bookingId);
    if (!booking) {
      return res.status(404).json({ error: "Booking not found" });
    }

    // Permissions check
    const isOwner = booking.customerId ? booking.customerId.toString() === req.user._id.toString() : false;
    const isAdmin = req.user.role === "admin";
    let isAssignedBarber = false;

    if (req.user.role === "barber") {
      const barber = await Barber.findOne({ userId: req.user._id });
      if (barber && barber._id.toString() === booking.barberId.toString()) {
        isAssignedBarber = true;
      }
    }

    const isStaff = isAdmin || isAssignedBarber;

    if (!isOwner && !isStaff) {
      return res.status(403).json({ error: "Forbidden: Not authorized to modify this booking" });
    }

    // Customers can only cancel
    if (isOwner && !isStaff && status !== "cancelled") {
      return res.status(403).json({ error: "Forbidden: Customers can only cancel their booking" });
    }

    // Business Logic: Only barber/admin can serve/complete
    if (["serving", "completed"].includes(status)) {
      if (!isStaff) {
        return res.status(403).json({ error: "Only staff can serve or complete bookings" });
      }
    }

    let penaltyApplied = false;
    let message = "Booking updated successfully";

    if (status === "cancelled") {
      // Penalty Logic for appointments
      if (booking.bookingType === "appointment" && booking.scheduledAt) {
        const now = new Date();
        const diffMs = booking.scheduledAt.getTime() - now.getTime();
        const diffMins = diffMs / (1000 * 60);

        if (diffMins < 20) { // 20 minute rule
          penaltyApplied = true;
          if (booking.customerId) {
            const user = await User.findById(booking.customerId);
            if (user) {
              user.penaltyPoints = (user.penaltyPoints || 0) + 1;
              await user.save();
            }
          }
          message = "Cancelled with penalty (late cancellation).";
        } else {
          message = "Booking cancelled successfully.";
        }
      } else {
        message = "Booking cancelled successfully.";
      }
    }

    booking.status = status;
    booking.penaltyApplied = penaltyApplied;
    if (status === "serving") booking.servedAt = new Date();
    if (status === "completed") {
      booking.completedAt = new Date();
      // Increment barber's totalServed metric
      await Barber.findByIdAndUpdate(booking.barberId, { $inc: { totalServed: 1 } });
    }
    if (status === "cancelled") booking.cancelledAt = new Date();

    await booking.save();

    if (["serving", "completed", "cancelled"].includes(status)) {
      await recalculatePositions(booking.barberId.toString());
      emitQueueUpdated(booking.barberId.toString(), { event: "statusChanged", bookingId: booking._id, status });
    }

    res.json({ 
      ...booking.toObject(), 
      id: booking._id,
      penaltyApplied,
      message
    });
  } catch (error: any) {
    res.status(500).json({ error: "Server Error", message: error.message });
  }
});

// @desc    Cancel a booking
// @route   DELETE /api/bookings/:bookingId
// @access  Private
router.delete("/bookings/:bookingId", protect, async (req: any, res: any) => {
  try {
    const booking = await Booking.findById(req.params.bookingId);
    if (!booking) {
      return res.status(404).json({ error: "Booking not found" });
    }

    // Permissions check
    const isOwner = booking.customerId ? booking.customerId.toString() === req.user._id.toString() : false;
    const isAdmin = req.user.role === "admin";
    let isAssignedBarber = false;

    if (req.user.role === "barber") {
      const barber = await Barber.findOne({ userId: req.user._id });
      if (barber && barber._id.toString() === booking.barberId.toString()) {
        isAssignedBarber = true;
      }
    }

    const isStaff = isAdmin || isAssignedBarber;

    if (!isOwner && !isStaff) {
      return res.status(403).json({ error: "Forbidden: Not authorized to cancel this booking" });
    }

    let penaltyApplied = false;
    let message = "Booking cancelled successfully.";

    // Penalty Logic for appointments
    if (booking.bookingType === "appointment" && booking.scheduledAt) {
      const now = new Date();
      const diffMs = booking.scheduledAt.getTime() - now.getTime();
      const diffMins = diffMs / (1000 * 60);

      if (diffMins < 20) { // 20 minute rule
        penaltyApplied = true;
        if (booking.customerId) {
          const user = await User.findById(booking.customerId);
          if (user) {
            user.penaltyPoints = (user.penaltyPoints || 0) + 1;
            await user.save();
          }
        }
        message = "Cancelled with penalty (late cancellation).";
      }
    }

    booking.status = "cancelled";
    booking.penaltyApplied = penaltyApplied;
    booking.cancelledAt = new Date();
    await booking.save();

    await recalculatePositions(booking.barberId.toString());
    emitQueueUpdated(booking.barberId.toString(), { 
      event: "statusChanged", 
      bookingId: booking._id, 
      status: "cancelled" 
    });

    res.json({ 
      ...booking.toObject(), 
      id: booking._id,
      penaltyApplied,
      message
    });
  } catch (error: any) {
    res.status(500).json({ error: "Server Error", message: error.message });
  }
});

export default router;
