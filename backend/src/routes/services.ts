import { Router } from "express";
import { protect, admin } from "../middlewares/auth";
import Service from "../models/Service";

const router = Router();

// @desc    Get all services
// @route   GET /api/services
// @access  Public
router.get("/services", async (req, res) => {
  try {
    const services = await Service.find();
    // Map _id to id for frontend compatibility
    res.json(services.map(s => ({ ...s.toObject(), id: s._id })));
  } catch (error: any) {
    res.status(500).json({ error: "Server Error", message: error.message });
  }
});

// @desc    Create a service
// @route   POST /api/services
// @access  Private/Admin
router.post("/services", protect, admin, async (req: any, res: any) => {
  try {
    const { name, description, durationMinutes, price, isActive } = req.body;

    if (!name || durationMinutes === undefined || price === undefined) {
      return res.status(400).json({ error: "Validation error", message: "Missing required fields" });
    }

    const service = await Service.create({
      name,
      description: description || null,
      durationMinutes,
      price,
      isActive: isActive !== undefined ? isActive : true,
    });

    res.status(201).json({ ...service.toObject(), id: service._id });
  } catch (error: any) {
    res.status(500).json({ error: "Server Error", message: error.message });
  }
});

// @desc    Update a service
// @route   PUT /api/services/:serviceId
// @access  Private/Admin
router.put("/services/:serviceId", protect, admin, async (req: any, res: any) => {
  try {
    const { name, description, durationMinutes, price, isActive } = req.body;
    
    const serviceId = req.params.serviceId;
    const service = await Service.findById(serviceId);

    if (!service) {
      return res.status(404).json({ error: "Service not found" });
    }

    if (name) service.name = name;
    if (description !== undefined) service.description = description;
    if (durationMinutes !== undefined) service.durationMinutes = durationMinutes;
    if (price !== undefined) service.price = price;
    if (isActive !== undefined) service.isActive = isActive;

    const updatedService = await service.save();

    res.json({ ...updatedService.toObject(), id: updatedService._id });
  } catch (error: any) {
    res.status(500).json({ error: "Server Error", message: error.message });
  }
});

// @desc    Delete a service
// @route   DELETE /api/services/:serviceId
// @access  Private/Admin
router.delete("/services/:serviceId", protect, admin, async (req: any, res: any) => {
  try {
    const serviceId = req.params.serviceId;
    const service = await Service.findById(serviceId);

    if (!service) {
      return res.status(404).json({ error: "Service not found" });
    }

    await Service.findByIdAndDelete(serviceId);

    res.json({ message: "Service deleted successfully" });
  } catch (error: any) {
    res.status(500).json({ error: "Server Error", message: error.message });
  }
});

export default router;
