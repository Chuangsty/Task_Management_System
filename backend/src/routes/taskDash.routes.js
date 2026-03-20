import { Router } from "express";
import { listTasksController, createTaskController, updateTaskController, createPlanController } from "../controllers/taskDash.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";
import { requireAppPermit } from "../middleware/permit.middleware.js";

const router = Router();

// TASK features ======================================================================================
// GET /api/apps/:appAcronym/tasks
router.get("/apps/:appAcronym/tasks", requireAuth, listTasksController);
// POST /api/apps/:appId/tasks
router.post("/apps/:appAcronym/tasks", requireAuth, requireAppPermit("permit_Open"), createTaskController);
// PATCH /api/:appAcronym/tasks/:taskId
router.patch("/apps/:appAcronym/tasks/:taskId", requireAuth, requireAppPermit("permit_Open"), updateTaskController);

// PLAN features ======================================================================================
// POST /api/apps/:appId/plan
router.post("/apps/:appAcronym/plan", requireAuth, requireAppPermit("permit_toDo"), createPlanController);

export default router;
