import { Router } from "express";
import { login, logout, meController } from "../controllers/auth.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";

const router = Router();

// POST /api/auth/login
router.post("/login", login);

// GET /api/auth/me
router.get("/me", requireAuth, meController);

// POST /api/auth/logout
router.post("/logout", logout);

export default router;
