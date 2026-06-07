import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../models/User";

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
    const userExists = await User.findOne({ email });

    if (userExists) {
      return res.status(400).json({ error: "User already exists", message: "User already exists" });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const user = await User.create({
      name,
      email,
      passwordHash,
      phone,
      role: role || 'customer',
    });

    if (user) {
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
    } else {
      res.status(400).json({ error: "Invalid user data", message: "Invalid user data" });
    }
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
    const user = await User.findOne({ email });

    if (user && (await bcrypt.compare(password, user.passwordHash))) {
      res.json({
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
    } else {
      res.status(401).json({ error: "Invalid email or password", message: "Invalid credentials" });
    }
  } catch (error: any) {
    console.error(error);
    res.status(500).json({ error: "Server error", message: error.message });
  }
});

// @desc    Get current user profile
// @route   GET /api/auth/me
// @access  Private
// (Requires middleware, but simply implemented if needed)

export default router;
