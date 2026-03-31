import jwt from "jsonwebtoken";
import { pool } from "../config/db.js";
import { appError } from "../utils/appError.js";

// Protect routes: requires valid bearer(whoever bears(carries) the token) & token
export async function requireAuth(req, res, next) {
  try {
    // Backend stores JWT in cookie -----------------
    const cookieName = process.env.JWT_COOKIE_NAME || "token";
    const token = req.cookies?.[cookieName];

    if (!token) throw appError(401, "UNAUTHORIZED");
    // if (!token) {
    //   const err = new Error("Authentication required");
    //   err.status = 401;
    //   err.code = "UNAUTHORIZED";
    //   err.details = "No valid authentication token provided.";
    //   throw err;
    // }

    let jwtData;
    try {
      // For cookies
      jwtData = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      if (err.name === "TokenExpiredError") throw appError(401, "TOKEN_EXPIRED");
      // if (err.name === "TokenExpiredError") {
      //   const e = new Error("Session expired"); // Setting a custom message instead of having a default message "jwt expired"
      //   e.status = 401;
      //   e.code = "TOKEN_EXPIRED";
      //   throw e;
      // }

      if (err.name === "JsonWebTokenError") throw appError(401, "INVALID_TOKEN");
      // if (err.name === "JsonWebTokenError") {
      //   const e = new Error("Invalid token");
      //   e.status = 401;
      //   e.code = "INVALID_TOKEN";
      //   throw e;
      // }

      throw err;
    }

    // Load latest user status from DB (role updates/disabled users take effect immediately)
    const [rows] = await pool.query(
      `SELECT 
                u.id,
                u.username,
                u.email,
                s.slug AS status_slug
            FROM users u
            JOIN account_status s ON s.id = u.account_status_id
            WHERE u.id = ?
            LIMIT 1`,
      [jwtData.userId], // Passing the decoded value into your SQL query as a parameter (use the userId stored inside the verified token)
    );
    // Return something like rows = [{ id: 1, username: "chuang", email: "chuang@email.com", status_slug: "ACTIVE"}];

    // If rows contains nothing
    if (rows.length === 0) throw appError(401, "INVALID_TOKEN_USER");
    // if (rows.length === 0) {
    //   const err = new Error("Invalid token user");
    //   err.status = 401;
    //   err.code = "INVALID_TOKEN_USER";
    //   throw err;
    // }

    const user = rows[0];

    // Prevents disabled account from using still-valid tokens
    if (user.status_slug !== "ACTIVE") throw appError(403, "ACCOUNT_DISABLED");
    // if (user.status_slug !== "ACTIVE") {
    //   const err = new Error("Account is disabled");
    //   err.status = 403;
    //   err.code = "ACCOUNT_DISABLED";
    //   throw err;
    // }

    // Load roles
    const [roleRows] = await pool.query(
      `SELECT r.slug
            FROM user_roles ur
            JOIN roles r ON r.id = ur.role_id
            WHERE ur.user_id = ?`,
      [user.id],
    );

    // Attach to request for downstream use
    req.user = {
      id: user.id,
      username: user.username,
      email: user.email,
      roles: roleRows.map((r) => r.slug),
    };

    next();
  } catch (err) {
    // err.code || null,
    // err.status = err.status || 401,
    // err.details || null;
    // next(err);
    err.status = err.status || 401;
    next(err);
  }
}
