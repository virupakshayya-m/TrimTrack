import { Router } from "express";
import User from "../models/User";
import { requireAuth, AuthRequest } from "../middlewares/auth";

const router = Router();

router.get("/users", requireAuth as any, async (req: AuthRequest, res: any) => {
  if (req.user?.role !== "admin") {
    return res.status(403).json({ error: "Forbidden" });
  }

  const roleParam = req.query.role as string | undefined;
  const filter: any = {};
  if (roleParam) filter.role = roleParam;

  const users = await User.find(filter).select('-passwordHash');
  res.json(users.map(u => ({ ...u.toObject(), id: u._id })));
});

router.get("/users/:userId", requireAuth as any, async (req: AuthRequest, res: any) => {
  const userId = req.params.userId;
  const currentUserId = (req.user?._id || req.user?.id)?.toString();

  if (req.user?.role !== "admin" && currentUserId !== userId) {
    return res.status(403).json({ error: "Forbidden" });
  }

  const user = await User.findById(userId).select('-passwordHash');
  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }
  res.json({ ...user.toObject(), id: user._id });
});

router.patch("/users/:userId", requireAuth as any, async (req: AuthRequest, res: any) => {
  const userId = req.params.userId;
  const currentUserId = (req.user?._id || req.user?.id)?.toString();

  if (req.user?.role !== "admin" && currentUserId !== userId) {
    return res.status(403).json({ error: "Forbidden" });
  }

  const { name, phone, role } = req.body;
  const updateData: any = {};
  if (name) updateData.name = name;
  if (phone !== undefined) updateData.phone = phone;
  if (role && req.user?.role === "admin") updateData.role = role;

  const updatedUser = await User.findByIdAndUpdate(userId, updateData, { new: true }).select('-passwordHash');
  if (!updatedUser) {
    return res.status(404).json({ error: "User not found" });
  }

  res.json({ ...updatedUser.toObject(), id: updatedUser._id });
});

export default router;
