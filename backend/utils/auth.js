import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { config } from "../config/config.js";

const SALT_ROUNDS = 10;

/**
 * Hash password using bcrypt
 * @param {string} password Raw text password
 * @returns {Promise<string>} Hashed password
 */
export const hashPassword = async (password) => {
  return bcrypt.hash(password, SALT_ROUNDS);
};

/**
 * Compare password with hash
 * @param {string} password Raw text password
 * @param {string} hash Bcrypt hash
 * @returns {Promise<boolean>} Match boolean
 */
export const comparePassword = async (password, hash) => {
  return bcrypt.compare(password, hash);
};

/**
 * Generate Access Token (JWT)
 * @param {Object} user User document/details
 * @returns {string} Signed JWT Access Token
 */
export const generateAccessToken = (user) => {
  return jwt.sign(
    { id: user._id, email: user.email, role: user.role },
    config.jwtSecret,
    { expiresIn: "15m" }
  );
};

/**
 * Generate Refresh Token (JWT)
 * @param {Object} user User document/details
 * @returns {string} Signed JWT Refresh Token
 */
export const generateRefreshToken = (user) => {
  return jwt.sign(
    { id: user._id },
    config.jwtRefreshSecret,
    { expiresIn: "7d" }
  );
};

/**
 * Verify Access Token
 * @param {string} token Signed access token
 * @returns {Object} Decoded token payload
 */
export const verifyAccessToken = (token) => {
  return jwt.verify(token, config.jwtSecret);
};

/**
 * Verify Refresh Token
 * @param {string} token Signed refresh token
 * @returns {Object} Decoded token payload
 */
export const verifyRefreshToken = (token) => {
  return jwt.verify(token, config.jwtRefreshSecret);
};
