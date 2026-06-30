import { verifyAccessToken } from "../utils/auth.js";
import { sendError } from "../utils/response.js";
import logger from "../utils/logger.js";

/**
 * Middleware to require Authentication on API routes
 */
export const requireAuth = (req, res, next) => {
  try {
    let token = null;

    // 1. Check Authorization Header (Bearer Token)
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      token = authHeader.split(" ")[1];
    }

    // 2. Check Cookie fallback
    if (!token && req.cookies) {
      token = req.cookies.accessToken;
    }

    if (!token) {
      return sendError(res, "Access denied. No authentication token provided.", "UNAUTHORIZED", 401);
    }

    // Verify Token
    const decoded = verifyAccessToken(token);
    req.user = decoded; // Contains id, email, role
    next();
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      logger.warn(`JWT Access Token expired`);
      return sendError(res, "Access token has expired. Please refresh your token.", "TOKEN_EXPIRED", 401);
    }
    logger.error(`Authentication verification failed: ${error.message}`);
    return sendError(res, "Authentication failed. Invalid token.", "INVALID_TOKEN", 401);
  }
};

/**
 * Middleware to restrict route access based on Roles
 * @param {Array<string>} roles Allowed roles (e.g. ['user', 'admin'])
 */
export const restrictTo = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return sendError(res, "Forbidden. You do not have permissions to access this resource.", "FORBIDDEN", 403);
    }
    next();
  };
};
