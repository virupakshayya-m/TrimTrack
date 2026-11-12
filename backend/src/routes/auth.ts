import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../models/User";
import { protect, AuthRequest } from "../middlewares/auth";

const router = Router();

const generateToken = (id: string) => {
  return jwt.sign({ id }, process.env.JWT_SECRET || 'supersecret123', {
    expiresIn: '30d',
  });
};

// @desc    Register a new user
// @route   POST /api/auth/register
// @access  Public
router.post("/register", async (req: any, res: any) => {
  const { name, email, password, phone, role } = req.body;

  try {
    if (!name || !email || !password) {
      return res.status(400).json({ error: "Validation error", message: "Name, email, and password are required." });
    }

    if (typeof password !== "string" || password.length < 6) {
      return res.status(400).json({ error: "Validation error", message: "Password must be at least 6 characters." });
    }

    const normalizedEmail = email.toLowerCase().trim();

    const userExists = await User.findOne({ email: normalizedEmail });
    if (userExists) {
      return res.status(400).json({ error: "User already exists", message: "A user with this email already exists." });
    }

    // Security: Public registration can only create "customer" accounts
    // Admin or barber roles cannot be self-assigned through public registration
    const assignedRole = role === "admin" || role === "barber" ? "customer" : (role || "customer");

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const user = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      passwordHash,
      phone: phone ? phone.trim() : undefined,
      role: assignedRole,
      penaltyPoints: 0,
    });

    res.status(201).json({
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        penaltyPoints: user.penaltyPoints,
        createdAt: user.createdAt,
      },
      token: generateToken(user._id.toString()),
    });
  } catch (error: any) {
    console.error(error);
    res.status(500).json({ error: "Server error", message: error.message });
  }
});

// @desc    Auth user & get token
// @route   POST /api/auth/login
// @access  Public
router.post("/login", async (req: any, res: any) => {
  const { email, password } = req.body;

  try {
    if (!email || !password) {
      return res.status(400).json({ error: "Validation error", message: "Email and password are required." });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const user = await User.findOne({ email: normalizedEmail });

    if (user && (await bcrypt.compare(password, user.passwordHash))) {
      res.json({
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          phone: user.phone,
          role: user.role,
          penaltyPoints: user.penaltyPoints || 0,
          createdAt: user.createdAt,
        },
        token: generateToken(user._id.toString()),
      });
    } else {
      res.status(401).json({ error: "Invalid credentials", message: "Invalid email or password." });
    }
  } catch (error: any) {
    console.error(error);
    res.status(500).json({ error: "Server error", message: error.message });
  }
});

// @desc    Get current user profile
// @route   GET /api/auth/me
// @access  Private
router.get("/me", protect, async (req: any, res: any) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    res.json({
      id: req.user._id,
      name: req.user.name,
      email: req.user.email,
      phone: req.user.phone,
      role: req.user.role,
      penaltyPoints: req.user.penaltyPoints || 0,
      createdAt: req.user.createdAt,
    });
  } catch (error: any) {
    res.status(500).json({ error: "Server error", message: error.message });
  }
});

// @desc    Logout user
// @route   POST /api/auth/logout
// @access  Public
router.post("/logout", async (_req: any, res: any) => {
  res.json({ message: "Logged out successfully" });
});

export default router;
