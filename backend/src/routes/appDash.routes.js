import { Router } from "express";
import { createAppsController, listAppsController, updateAppsController } from "../controllers/appDash.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";
import { requireRole } from "../middleware/role.middleware.js";

const router = Router();

// GET /api/apps
router.get("/", requireAuth, listAppsController);

// POST /api/apps
router.post("/", requireAuth, requireRole("PROJECT_LEAD"), createAppsController);

// PATCH /api/apps/:id
router.patch("/:id", requireAuth, requireRole("PROJECT_LEAD"), updateAppsController);

export default router;
