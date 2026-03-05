import express from "express";
import { getApps } from "../services/application.service";
import { requireAuth } from "../middleware/auth.middleware";

const router = express.Router();

router.get("/apps", requireAuth, getApps);

export default router;
