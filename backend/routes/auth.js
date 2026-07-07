import express from "express";
import mongoose from "mongoose";
import User from "../models/User.js";
import Thread from "../models/Thread.js";
import {
  hashPassword,
  comparePassword,
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
} from "../utils/auth.js";
import { sendSuccess, sendError } from "../utils/response.js";
import logger from "../utils/logger.js";

const router = express.Router();

// Cookie options helper
const getCookieOptions = (isProduction) => ({
  httpOnly: true,
  secure: isProduction, // Secure in production
  sameSite: "strict",
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
});

/**
 * @openapi
 * /auth/guest:
 *   post:
 *     summary: Log in as a temporary guest user
 *     tags: [Authentication]
 *     responses:
 *       200:
 *         description: Guest access session created.
 */
router.post("/guest", (req, res) => {
  try {
    const guestId = new mongoose.Types.ObjectId().toString();
    const guestUser = {
      _id: guestId,
      email: `guest_${guestId}@jarvis.local`,
      role: "guest",
    };

    const accessToken = generateAccessToken(guestUser);
    const refreshToken = generateRefreshToken(guestUser);

    const isProduction = process.env.NODE_ENV === "production";
    res.cookie("refreshToken", refreshToken, getCookieOptions(isProduction));

    logger.info(`Guest session initiated: ${guestId}`);
    return sendSuccess(res, {
      accessToken,
      user: {
        id: guestId,
        name: "Guest",
        email: guestUser.email,
        role: "guest",
      },
    });
  } catch (error) {
    logger.error(`Guest session creation failed: ${error.message}`);
    return sendError(res, "Guest session failed", "GUEST_SESSION_FAILED", 500);
  }
});

/**
 * @openapi
 * /auth/register:
 *   post:
 *     summary: Register a new user profile
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - email
 *               - password
 *             properties:
 *               name:
 *                 type: string
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *               guestUserId:
 *                 type: string
 *     responses:
 *       201:
 *         description: User profile created successfully.
 */
router.post("/register", async (req, res) => {
  const { name, email, password, guestUserId } = req.body;

  if (!name || !email || !password) {
    return sendError(res, "Missing required fields (name, email, password)", "VALIDATION_ERROR", 400);
  }

  try {
    const existingUser = await User.findOne({ email, isDeleted: false });
    if (existingUser) {
      return sendError(res, "User with this email already exists", "EMAIL_EXISTS", 409);
    }

    const passwordHash = await hashPassword(password);
    const user = new User({
      name,
      email,
      passwordHash,
      isVerified: true,
    });

    await user.save();
    logger.info(`User registered successfully: ${user.email}`);

    // History Migration: Link guest threads to the new registered user account
    if (guestUserId) {
      try {
        const guestObjId = new mongoose.Types.ObjectId(guestUserId);
        const updateRes = await Thread.updateMany(
          { userId: guestObjId },
          { userId: user._id }
        );
        logger.info(`Migrated ${updateRes.modifiedCount} threads from guest ${guestUserId} to registered user ${user._id}`);
      } catch (err) {
        logger.error(`History migration failed for guest ${guestUserId}: ${err.message}`);
      }
    }

    // Auto log in user on registration
    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);
    const isProduction = process.env.NODE_ENV === "production";
    res.cookie("refreshToken", refreshToken, getCookieOptions(isProduction));

    return sendSuccess(res, {
      accessToken,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    }, 201);
  } catch (error) {
    logger.error(`Registration error: ${error.message}`);
    return sendError(res, "Registration failed", "REGISTRATION_FAILED", 500);
  }
});

/**
 * @openapi
 * /auth/login:
 *   post:
 *     summary: Login user and issue session token
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *               guestUserId:
 *                 type: string
 *     responses:
 *       200:
 *         description: Login successful.
 */
router.post("/login", async (req, res) => {
  const { email, password, guestUserId } = req.body;

  if (!email || !password) {
    return sendError(res, "Missing email or password", "VALIDATION_ERROR", 400);
  }

  try {
    const user = await User.findOne({ email, isDeleted: false });
    if (!user) {
      return sendError(res, "Invalid email or password", "INVALID_CREDENTIALS", 401);
    }

    const isMatch = await comparePassword(password, user.passwordHash);
    if (!isMatch) {
      return sendError(res, "Invalid email or password", "INVALID_CREDENTIALS", 401);
    }

    // History Migration: Link guest threads to the logged in user
    if (guestUserId) {
      try {
        const guestObjId = new mongoose.Types.ObjectId(guestUserId);
        const updateRes = await Thread.updateMany(
          { userId: guestObjId },
          { userId: user._id }
        );
        logger.info(`Migrated ${updateRes.modifiedCount} threads from guest ${guestUserId} to logged in user ${user._id}`);
      } catch (err) {
        logger.error(`History migration failed for guest ${guestUserId}: ${err.message}`);
      }
    }

    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    // Set Refresh Token in secure cookie
    const isProduction = process.env.NODE_ENV === "production";
    res.cookie("refreshToken", refreshToken, getCookieOptions(isProduction));

    logger.info(`User logged in successfully: ${user.email}`);

    return sendSuccess(res, {
      accessToken,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    logger.error(`Login error: ${error.message}`);
    return sendError(res, "Login failed", "LOGIN_FAILED", 500);
  }
});

/**
 * @openapi
 * /auth/logout:
 *   post:
 *     summary: Log out user and clear session cookie
 *     tags: [Authentication]
 *     responses:
 *       200:
 *         description: Logged out successfully.
 */
router.post("/logout", (req, res) => {
  try {
    res.clearCookie("refreshToken", {
      httpOnly: true,
      sameSite: "strict",
    });
    logger.info("User logged out successfully");
    return sendSuccess(res, { message: "Logged out successfully" });
  } catch (error) {
    logger.error(`Logout error: ${error.message}`);
    return sendError(res, "Logout failed", "LOGOUT_FAILED", 500);
  }
});

/**
 * @openapi
 * /auth/refresh:
 *   post:
 *     summary: Rotate tokens using session cookies
 *     tags: [Authentication]
 *     responses:
 *       200:
 *         description: Returns new access token.
 */
router.post("/refresh", async (req, res) => {
  try {
    const refreshToken = req.cookies?.refreshToken;
    if (!refreshToken) {
      return sendError(res, "Refresh token is missing", "REFRESH_TOKEN_MISSING", 401);
    }

    const decoded = verifyRefreshToken(refreshToken);
    let user = await User.findOne({ _id: decoded.id, isDeleted: false });

    // Fallback support for guest session token refreshes
    if (!user) {
      user = {
        _id: decoded.id,
        email: `guest_${decoded.id}@jarvis.local`,
        role: "guest",
      };
    }

    const newAccessToken = generateAccessToken(user);
    const newRefreshToken = generateRefreshToken(user);

    const isProduction = process.env.NODE_ENV === "production";
    res.cookie("refreshToken", newRefreshToken, getCookieOptions(isProduction));

    return sendSuccess(res, {
      accessToken: newAccessToken,
    });
  } catch (error) {
    logger.error(`Token refresh error: ${error.message}`);
    return sendError(res, "Session expired. Please login again.", "REFRESH_FAILED", 401);
  }
});

export default router;
