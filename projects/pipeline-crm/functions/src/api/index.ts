/**
 * Express API application.
 * Central router for all API endpoints.
 */

import express from "express";
import cors from "cors";
import { authMiddleware } from "./middleware/auth";
import { errorHandler } from "./middleware/error-handler";
import { leadsRoutes } from "./leads";

// Create Express app
const app = express();

// =============================================================================
// MIDDLEWARE
// =============================================================================

// CORS - allow requests from the frontend
app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "http://localhost:3000",
      "https://pipeline-crm-demo.web.app",
      "https://pipeline-crm-demo.firebaseapp.com",
    ],
    credentials: true,
  })
);

// Parse JSON bodies
app.use(express.json());

// Authentication - verify Firebase ID token
app.use(authMiddleware);

// =============================================================================
// ROUTES
// =============================================================================

// Health check (useful for monitoring)
app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// API routes
app.use("/leads", leadsRoutes);

// Future routes:
// app.use("/contacts", contactsRoutes);
// app.use("/pipelines", pipelinesRoutes);
// app.use("/activities", activitiesRoutes);

// =============================================================================
// ERROR HANDLING
// =============================================================================

// 404 handler
app.use((_req, res) => {
  res.status(404).json({
    success: false,
    error: {
      code: "NOT_FOUND",
      message: "Endpoint not found",
    },
  });
});

// Global error handler
app.use(errorHandler);

export default app;
