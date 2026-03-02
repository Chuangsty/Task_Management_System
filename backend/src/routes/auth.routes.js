import { Router } from "express";
import { login } from "../controllers/auth.controller.js";
import { logout } from "../controllers/auth.controller.js";

const router = Router();

// POST /api/auth/login
router.post("/login", login);
router.post("/logout", logout);

export default router;
