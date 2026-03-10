import { Router } from "express";
import { listTasksController, createTaskController, updateTaskController } from "../controllers/taskDash.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";
import { requireRole } from "../middleware/role.middleware.js";

const router = Router();

// GET /api/apps/:appId/tasks
router.get("/apps/:appId/tasks", requireAuth, listTasksController);
// POST /api/apps/:appId/tasks
router.post("/apps/:appId/tasks", requireAuth, requireRole("PROJECT_LEAD"), createTaskController);
// PATCH /api/tasks/:taskId
router.patch("/tasks/:taskId", requireAuth, requireRole("PROJECT_LEAD"), updateTaskController);

export default router;
