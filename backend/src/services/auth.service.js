/*
Main functionality: User Authentication (identity and account verification)
    - Identity verification: Validates that the provided email exists in the system database
    - Account status validation: Ensures that only accounts with ACTIVE status are permitted to log in
    - Password verification: Compares the provided password with the securely stored hashed password using bcrypt
Secondary functionality: Role information retrieval (not role authorization)
    - Retrieves role(s) associated with the authenticated user.
    - Prepares role information for later authorization checks
*/

import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { pool } from "../config/db.js";

// Login auth with email and password
export async function loginService({ email, password }) {
  // If no input
  if (!email || !password) {
    const err = new Error("Email and password are required");
    err.status = 400;
    throw err;
  }

  // If no valid email input
  if (!/^\S+@\S+\.\S+$/.test(email)) {
    const err = new Error("Email format is invalid");
    err.status = 400;
    throw err;
  }

  /*
  Query the database for user with matching email
  Join account_status to check for ACTIVE/DISABLED
  Get user + status from DB */
  const [rows] = await pool.query(
    `SELECT
        u.id,
        u.username,
        u.email,
        u.password_hash,
        s.slug AS status_slug
    FROM users u
    JOIN account_status s ON s.id = u.account_status_id 
    WHERE u.email = ?
    LIMIT 1`,
    [email],
  );

  // If no user is found
  if (rows.length === 0) {
    const err = new Error("Invalid credentials");
    err.status = 401;
    throw err;
  }
  // Extract user row
  const user = rows[0];

  //   If user account is not "ACTIVE"
  if (user.status_slug !== "ACTIVE") {
    const err = new Error("Account is disabled");
    err.status = 403;
    throw err;
  }

  //   Compare provided password with hased password in DB
  const ok = await bcrypt.compare(password, user.password_hash);
  //   If password doesn't match
  if (!ok) {
    const err = new Error("Invalid credentials");
    err.status = 401;
    throw err;
  }

  // Load user role(s) from user_roles table
  const [roleRows] = await pool.query(
    `SELECT r.slug
    FROM user_roles ur
    JOIN roles r ON r.id = ur.role_id
    WHERE ur.user_id = ?`,
    [user.id],
  );

  // Convert role id into simple array like "ADMIN" for better view
  const roles = roleRows.map((r) => r.slug);

  // Create JWT token
  // Payload contains only userId (minimal info = security-first)
  const token = jwt.sign(
    { userId: user.id }, // payload
    process.env.JWT_SECRET, // secret key
    { expiresIn: "1h" }, // jwt token expires in 1 hour
  );

  // Return token + safe user object (hashed password)
  return {
    token,
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      roles,
    },
  };
}
