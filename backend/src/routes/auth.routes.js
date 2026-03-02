import { Router } from "express";
import { login, logout, meController } from "../controllers/auth.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";

const router = Router();

// POST /api/auth/login
router.post("/login", login);
router.post("/logout", logout);

// GET /api/auth/me
router.get("/me", requireAuth, meController);

export default router;
