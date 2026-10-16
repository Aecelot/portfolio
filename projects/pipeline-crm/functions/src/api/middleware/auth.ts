/**
 * Firebase Auth middleware for Express.
 * Verifies Firebase ID tokens and attaches user info to request.
 */

import { Request, Response, NextFunction } from "express";
import * as admin from "firebase-admin";

// Extend Express Request to include user info
declare global {
  namespace Express {
    interface Request {
      user?: {
        uid: string;
        email?: string;
        name?: string;
      };
    }
  }
}

/**
 * Middleware to verify Firebase ID token.
 * Extracts token from Authorization header (Bearer scheme).
 * On success, attaches user info to req.user.
 */
export async function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  // Skip auth for CORS preflight requests
  if (req.method === "OPTIONS") {
    next();
    return;
  }

  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({
      success: false,
      error: {
        code: "UNAUTHORIZED",
        message: "Missing or invalid authorization header",
      },
    });
    return;
  }

  const token = authHeader.split("Bearer ")[1];

  try {
    const decodedToken = await admin.auth().verifyIdToken(token);

    req.user = {
      uid: decodedToken.uid,
      email: decodedToken.email,
      name: decodedToken.name,
    };

    next();
  } catch (error) {
    console.error("[Auth] Token verification failed:", error);

    res.status(401).json({
      success: false,
      error: {
        code: "INVALID_TOKEN",
        message: "Invalid or expired authentication token",
      },
    });
  }
}

/**
 * Optional auth middleware - continues even if no token provided.
 * Useful for endpoints that work differently for authenticated vs anonymous users.
 */
export async function optionalAuthMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    // No token provided, continue without user
    next();
    return;
  }

  const token = authHeader.split("Bearer ")[1];

  try {
    const decodedToken = await admin.auth().verifyIdToken(token);

    req.user = {
      uid: decodedToken.uid,
      email: decodedToken.email,
      name: decodedToken.name,
    };
  } catch (error) {
    // Token invalid, continue without user
    console.warn("[Auth] Optional token verification failed");
  }

  next();
}
