import { Router } from "express";
import { pingDatabase } from "../config/database";

const router = Router();

router.get("/", async (_req, res) => {
  try {
    const connected = await pingDatabase();
    if (!connected) {
      res.status(503).json({
        status: "unhealthy",
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        database: "disconnected",
        error: "MongoDB is not connected",
      });
      return;
    }

    res.json({
      status: "healthy",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      database: "connected",
    });
  } catch (error) {
    res.status(503).json({
      status: "unhealthy",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      database: "disconnected",
      error: error instanceof Error ? error.message : "Database check failed",
    });
  }
});

export default router;
