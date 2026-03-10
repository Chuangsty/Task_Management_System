import bcrypt from "bcryptjs";
import dotenv from "dotenv";
import { pool } from "../src/config/db.js"; // MySQL connection pool

dotenv.config();

// Creating default admin credentials
const ADMIN_USERNAME = process.env.SEED_ADMIN_USERNAME || "Me";
const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL || "teochuangming3@gmail.com";
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD || "Qwer1234!";

// Defines an async function to seed the admin account
async function seedAdmin() {
  let conn;

  try {
    // Gets a single dedicated connection from the connection pool
    conn = await pool.getConnection();
    await conn.beginTransaction();

    // 1) Get 'ACTIVE' status ==============
    const [activeStatus] = await conn.query("SELECT id FROM account_status WHERE slug = 'ACTIVE' LIMIT 1");
    // 1.1) Throw error if no 'ACTIVE' status
    if (activeStatus.length === 0) {
      const err = new Error("ACTIVE status not found. Run db:seed first.");
      err.status = 500;
      throw err;
    }
    const activeStatusId = activeStatus[0].id;

    // 2) Get 'ADMIN' role =================
    const [adminRole] = await conn.query("SELECT id FROM roles WHERE slug = 'ADMIN' LIMIT 1");
    // 2.1) Throw error if no 'ADMIN' role
    if (adminRole.length === 0) {
      const err = new Error("ADMIN role not found. Run db:seed first.");
      err.status = 500;
      throw err;
    }
    const adminRoleId = adminRole[0].id;

    // 3) Check if admin user exists ==============
    const [existingUsers] = await conn.query("SELECT id FROM users WHERE username = ? LIMIT 1", [ADMIN_USERNAME]);

    const password_hash = await bcrypt.hash(ADMIN_PASSWORD, 10); // hash the ADMIN_PASSWORD with bcrypt
    // 10: salt rounds (or cost factor) -> Controls how computationally expensive the hashing process is

    let adminUserId;
    // 3.1) If ADMIN user doesnt exist =============
    if (existingUsers.length === 0) {
      const [adminUserInfo] = await conn.query(
        // The [] SELECT many rows of data
        "INSERT INTO users (username, email, password_hash, account_status_id) VALUES (?, ?, ?, ?)",
        [ADMIN_USERNAME, ADMIN_EMAIL, password_hash, activeStatusId],
      );

      adminUserId = adminUserInfo.insertId;
      // insertId is a default property return by MySQL (via mysql2) when run an INSERT on a table that has an AUTO_INCREMENT column
    }
    // 3.2) If ADMIN already exist =================
    else {
      adminUserId = existingUsers[0].id; // use existing

      // UPDATE existing admin: email + password + set ACTIVE
      await conn.query(
        `UPDATE users
        SET username = ?, email = ?, password_hash = ?, account_status_id = ?
        WHERE id = ?`,
        [ADMIN_USERNAME, ADMIN_EMAIL, password_hash, activeStatusId, adminUserId],
      );
    }

    // 4) Assign ADMIN role (if not already) =======
    await conn.query("INSERT IGNORE INTO user_roles (user_id, role_id) VALUES (?, ?)", [adminUserId, adminRoleId]);

    await conn.commit();

    console.log("Seeded admin account (if not already present).");
    console.log("Username: " + ADMIN_USERNAME);
    console.log("Email: " + ADMIN_EMAIL);
    console.log("Password: " + ADMIN_PASSWORD);
  } catch (err) {
    // Catch the error throw by anything inside try
    if (conn) await conn.rollback(); // Undo all queries in this transaction
    console.error("seedAdmin failed: ", err.message);
    process.exitCode = 1; // Tells Node: The script failed (0 = success, 1 = error)
  } finally {
    // This runs no matter what
    if (conn) conn.release(); // Returns the connection back to the pool
    await pool.end();
  }
}

seedAdmin();
