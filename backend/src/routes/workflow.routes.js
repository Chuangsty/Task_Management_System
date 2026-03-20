import { Router } from "express";
import { requireAuth } from "../middleware/auth.middleware.js";
import { takeTaskController, forfeitTaskController, submitTaskController, rejectTaskController, approveTaskController, updateTaskNoteController, releaseTaskController } from "../controllers/workflow.controller.js";
import { requireTaskPermit } from "../middleware/permit.middleware.js";

const router = Router();

// Developer workflow
// POST api/tasks/:taskId/take
router.post("/tasks/:taskId/take", requireAuth, requireTaskPermit("permit_Doing"), takeTaskController);
// POST api/tasks/:taskId/forfeit
router.post("/tasks/:taskId/forfeit", requireAuth, forfeitTaskController);
// POST api/tasks/:taskId/submit
router.post("/tasks/:taskId/submit", requireAuth, requireTaskPermit("permit_Done"), submitTaskController);

// Project Lead workflow
// POST api/tasks/:taskId/reject
router.post("/tasks/:taskId/reject", requireAuth, rejectTaskController);
// POST api/tasks/:taskId/approve
router.post("/tasks/:taskId/approve", requireAuth, approveTaskController);

// Project Manager workflow
// POST /api/tasks/:taskId/release
router.post("/tasks/:taskId/release", requireAuth, requireTaskPermit("permit_toDo"), releaseTaskController);

// PATCH /api/tasks/:taskId/note
router.patch("/tasks/:taskId/note", requireAuth, updateTaskNoteController);

export default router;
