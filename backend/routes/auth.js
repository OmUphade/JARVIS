import express from "express";
import User from "../models/User.js";
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

// POST /register
router.post("/register", async (req, res) => {
  const { name, email, password } = req.body;

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
      isVerified: true, // Auto verify for now; we can add email verification later
    });

    await user.save();
    logger.info(`User registered successfully: ${user.email}`);

    // Standard Success Response
    return sendSuccess(res, {
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
      },
    }, 201);
  } catch (error) {
    logger.error(`Registration error: ${error.message}`);
    return sendError(res, "Registration failed", "REGISTRATION_FAILED", 500);
  }
});

// POST /login
router.post("/login", async (req, res) => {
  const { email, password } = req.body;

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

// POST /logout
router.post("/logout", (req, res) => {
  try {
    // Clear cookies
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

// POST /refresh
router.post("/refresh", async (req, res) => {
  try {
    const refreshToken = req.cookies?.refreshToken;
    if (!refreshToken) {
      return sendError(res, "Refresh token is missing", "REFRESH_TOKEN_MISSING", 401);
    }

    // Verify Refresh Token
    const decoded = verifyRefreshToken(refreshToken);
    const user = await User.findOne({ _id: decoded.id, isDeleted: false });
    if (!user) {
      return sendError(res, "User not found or suspended", "USER_NOT_FOUND", 401);
    }

    // Generate new Access and Refresh tokens (token rotation)
    const newAccessToken = generateAccessToken(user);
    const newRefreshToken = generateRefreshToken(user);

    const isProduction = process.env.NODE_ENV === "production";
    res.cookie("refreshToken", newRefreshToken, getCookieOptions(isProduction));

    return sendSuccess(res, {
      accessToken: newAccessToken,
    });
  } catch (error) {
    logger.error(`Token refresh error: ${error.message}`);
    return sendError(res, "Session expired or invalid refresh token. Please login again.", "REFRESH_FAILED", 401);
  }
});

export default router;
