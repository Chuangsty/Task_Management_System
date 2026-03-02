import express from "express";
import cors from "cors"; // Cross-Origin Resource Sharing (allows frontend (different origin) to access your API)
import dotenv from "dotenv";
import cookieParser from "cookie-parser";

import authRoutes from "./routes/auth.routes.js";
import adminRoutes from "./routes/admin.routes.js";
import { notFoundHandler, errorHandler } from "./middleware/error.middleware.js";

dotenv.config();

// This creates your server instance: start building my backend application
const app = express();

// Basic middleware
// app.use(cors()); // Enables cross-origin requests
app.use(
  // Must allow credentials since cookies are involved
  cors({
    origin: process.env.FRONTEND_ORIGIN, // e.g. http://localhost:5173
    credentials: true,
  }),
);
app.use(express.json()); // Parses JSON body
app.use(cookieParser()); // Enable cookie parser

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);

// Quick health endpoint (useful to check server running on Postman)
app.get("/api/health", (req, res) => {
  res.json({ "API working": true });
});

// Error handling
app.use(notFoundHandler);
app.use(errorHandler);

const port = process.env.PORT || 3000;
// app.listen(port, () => {
// console.log(`Backend running at http://localhost:${port}`);});
app.listen(port, () => console.log(`Backend running at http://localhost:${port}`));
