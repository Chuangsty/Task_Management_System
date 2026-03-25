import { Router } from "express";
import { listTasksController, getTaskbyStateController, createTaskController, updateTaskController, createPlanController, listPlansController } from "../controllers/taskDash.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";
import { requireAppPermit } from "../middleware/permit.middleware.js";

const router = Router();

// TASK features ======================================================================================
// GET /api/apps/:appAcronym/tasks
router.get("/apps/:appAcronym/tasks", requireAuth, listTasksController);
// GET /api/apps/:appAcronym/tasks/GetTaskbyState/:taskState
router.get("/apps/:appAcronym/tasks/GetTaskbyState/:taskState", requireAuth, getTaskbyStateController);
// POST /api/apps/:appAcronym/CreateTask
router.post("/apps/:appAcronym/CreateTask", requireAuth, requireAppPermit("permit_Open"), createTaskController);
// PATCH /api/:appAcronym/tasks/:taskId
router.patch("/apps/:appAcronym/tasks/:taskId", requireAuth, requireAppPermit("permit_Open"), updateTaskController);

// PLAN features ======================================================================================
// POST /api/apps/:appAcronym/plans
router.post("/apps/:appAcronym/plans", requireAuth, requireAppPermit("permit_toDo"), createPlanController);
// GET /api/apps/:appAcronym/plans
router.get("/apps/:appAcronym/plans", requireAuth, listPlansController);

export default router;
