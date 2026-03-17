import express, { Router } from "express";
import { getRoles } from "../controllers/roles.controller.js";

const router = express.Router();

router.get("/", getRoles);

export default router;
