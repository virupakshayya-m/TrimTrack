import { Router } from "express";
import { protect, admin } from "../middlewares/auth";
import Barber from "../models/Barber";
import Booking from "../models/Booking";
import User from "../models/User";
import Service from "../models/Service";
import bcrypt from "bcryptjs";
import { getActiveQueueCount, calculateWaitTime, calculateNextAvailableSlot } from "../lib/queue";

const router = Router();

router.get("/barbers", async (req, res) => {
  try {
    const available = req.query.available;
    let barbers = await Barber.find();

    if (available === "true") {
      barbers = barbers.filter(b => b.isAccepting && !b.isPaused);
    }

    const result = await Promise.all(barbers.map(async (barber) => {
      const activeQueueCount = await getActiveQueueCount(barber._id.toString());
      const estimatedWaitTime = await calculateWaitTime(barber._id.toString());
      return {
        ...barber.toObject(),
        id: barber._id,
        activeQueueCount,
        estimatedWaitTime,
        nextAvailableSlot: await calculateNextAvailableSlot(barber._id.toString()),
      };
    }));

    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: "Server Error", message: error.message });
  }
});

router.get("/barbers/:barberId", async (req, res) => {
  try {
    const barberId = req.params.barberId;
    const barber = await Barber.findById(barberId);

    if (!barber) {
      return res.status(404).json({ error: "Barber not found" });
    }

    const activeQueueCount = await getActiveQueueCount(barberId);
    const estimatedWaitTime = await calculateWaitTime(barberId);

    res.json({
      ...barber.toObject(),
      id: barber._id,
      activeQueueCount,
      estimatedWaitTime,
      nextAvailableSlot: await calculateNextAvailableSlot(barberId),
    });
  } catch (error: any) {
    res.status(500).json({ error: "Server Error", message: error.message });
  }
});

router.patch("/barbers/:barberId/status", protect, async (req: any, res: any) => {
  try {
    const barberId = req.params.barberId;
    const barber = await Barber.findById(barberId);

    if (!barber) {
      return res.status(404).json({ error: "Barber not found" });
    }

    if (req.user.role !== "admin" && barber.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: "Forbidden" });
    }

    if (req.body.isAccepting !== undefined) barber.isAccepting = req.body.isAccepting;
    if (req.body.isPaused !== undefined) barber.isPaused = req.body.isPaused;

    await barber.save();

    res.json({ ...barber.toObject(), id: barber._id });
  } catch (error: any) {
    res.status(500).json({ error: "Server Error", message: error.message });
  }
});

router.get("/barbers/:barberId/slots", async (req, res) => {
  try {
    const barberId = req.params.barberId;
    const dateParam = req.query.date as string | undefined;

    if (!dateParam) {
      return res.status(400).json({ error: "date query param required (YYYY-MM-DD)" });
    }

    const dayStart = new Date(dateParam);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dateParam);
    dayEnd.setHours(23, 59, 59, 999);

    const appointments = await Booking.find({
      barberId,
      bookingType: "appointment",
      status: { $in: ["pending", "active", "serving"] },
      scheduledAt: { $gte: dayStart, $lte: dayEnd },
    });

    const slots = await Promise.all(appointments.map(async (b) => {
      let durationMinutes = 30;
      if (b.serviceId) {
        const svc = await Service.findById(b.serviceId);
        if (svc && svc.durationMinutes !== undefined) durationMinutes = svc.durationMinutes as number;
      }
      return {
        scheduledAt: b.scheduledAt,
        durationMinutes,
      };
    }));

    res.json(slots);
  } catch (error: any) {
    res.status(500).json({ error: "Server Error", message: error.message });
  }
});

router.post("/admin/barbers", protect, admin, async (req: any, res: any) => {
  try {
    const { name, email, password, phone, specialties, maxQueueSize, avgServiceTime } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: "Validation error", message: "name, email, and password are required." });
    }

    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(400).json({ error: "Email already registered", message: "A user with this email already exists." });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const user = await User.create({
      name,
      email,
      passwordHash,
      phone: phone || null,
      role: "barber",
    });

    const barber = await Barber.create({
      userId: user._id,
      name: user.name,
      specialties: specialties || null,
      isAccepting: true,
      isPaused: false,
      maxQueueSize: maxQueueSize || 10,
      avgServiceTime: avgServiceTime || 20,
      totalServed: 0,
    });

    res.status(201).json({
      user: { id: user._id, name: user.name, email: user.email, role: user.role },
      barber: { ...barber.toObject(), id: barber._id },
    });
  } catch (error: any) {
    res.status(500).json({ error: "Server Error", message: error.message });
  }
});

export default router;
