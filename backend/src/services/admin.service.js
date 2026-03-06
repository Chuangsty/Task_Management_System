import bcrypt from "bcryptjs";
import { pool } from "../config/db.js";

/*
Pasword policy:
    1) Minimum 8 characters and maximum 10 characters
    2) Comprise of alphabets , numbers, and special character */
function validatePassword(pw) {
  if (typeof pw !== "string") return "Password must be a string";
  if (pw.length < 8 || pw.length > 10) return "Password must be 8-10 characters long";
  if (!/[A-Za-z0-9]/.test(pw) || !/[0-9]/.test(pw) || !/[^A-Za-z0-9]/.test(pw)) return "Password must include a letter, number & special character";
  return null; // Return null as no error in pw
}

// Email policy: Proper email format
function validateEmail(email) {
  if (typeof email !== "string" || email.trim() === "") return "Email is required";
  // trim() removes whitespace from the beginning and end of a string. e.g. (spaces " ", tabs \t, new lines \n)
  if (!/^\S+@\S+\.\S+$/.test(email)) return "Email format is invalid"; // !regex.test(email)
  return null;
}

// ADMIN: list users (no password hash returned) for admin onboarding dashboard
export async function listUsersService() {
  // Displaying users base on date created
  const [rows] = await pool.query(
    `SELECT u.id, u.username, u.email, s.slug AS status, u.created_at
        FROM users u
        JOIN account_status s ON s.id = u.account_status_id
        ORDER BY u.created_at DESC`,
  );

  // Role(s) assignment
  const [roleRows] = await pool.query(
    `SELECT ur.user_id, r.slug
        FROM user_roles ur
        JOIN roles r ON r.id = ur.role_id`,
  );

  const roleMap = new Map(); /* Map is a special JS obj used to store key -> value.
                                e.g. roleMap.set(1, ["ADMIN", "USER"]);   ===>   User 1 → ["ADMIN", "USER"] */
  // Loop through each row of DB
  for (const rr of roleRows) {
    if (!roleMap.has(rr.user_id)) roleMap.set(rr.user_id, []); // Check if user exist in map (if roleMap do not have user, create an empty array for them e.g. (1, []))
    roleMap.get(rr.user_id).push(rr.slug); // Push role(array stored for the user) into the created array
  }

  return {
    users: rows.map((u) => ({
      /*
    rows will show the users as query at the start e.g. { id: 1, username: "alice", email: "a@email.com" }
    .map() loops through each u user in rows and returns a new transformed array */

      ...u, // Copies all properties from u into the new object into { ...u }
      roles: roleMap.get(u.id) || [], // Look up this user's roles from roleMap and use them if found || else use empty array
    })),
  };
}

// ADMIN: onboarding of users + role assignment: e.g. { username, email, password, roles }
export async function adminCreateUserService({ username, email, password, roles = [] }) {
  const conn = await pool.getConnection();

  // Basic validation (keep it simple but safe)
  if (!username || !email || !password || !Array.isArray(roles) || roles.length === 0) {
    const err = new Error("Name, email, password and role(s) are required");
    err.status = 400;
    throw err;
  }

  try {
    await conn.beginTransaction();

    // Normalize username and email
    const cleanUsername = String(username).trim();
    const cleanEmail = String(email).trim().toLowerCase();

    // Set DEFAULT ACTIVE status ID
    const [[activeStatus]] = await conn.query(`SELECT id FROM account_status WHERE slug = 'ACTIVE' LIMIT 1`);

    // Throw err if "ACTIVE" status not found in seed
    if (!activeStatus) {
      const err = new Error("ACTIVE status not found in DB");
      err.status = 500;
      throw err;
    }

    const emailErr = validateEmail(cleanEmail);
    if (emailErr) {
      const err = new Error(emailErr);
      err.status = 400;
      throw err;
    }

    const pwErr = validatePassword(password);
    if (pwErr) {
      const err = new Error(pwErr);
      err.status = 400;
      throw err;
    }

    // Check username unique
    const [[u]] = await conn.query("SELECT id FROM users WHERE username = ? LIMIT 1", [cleanUsername]);
    if (u) {
      const err = new Error("Username already exists");
      err.status = 409;
      throw err;
    }
    // Check email unique
    const [[e]] = await conn.query("SELECT id FROM users WHERE email = ? LIMIT 1", [cleanEmail]);
    if (e) {
      const err = new Error("Email already exists");
      err.status = 409;
      throw err;
    }

    // Hash password
    const password_hash = await bcrypt.hash(password, 10);

    // Create user
    const [insertRes] = await conn.query(
      `INSERT INTO users (username, email, password_hash, account_status_id)
       VALUES (?, ?, ?, ?)`,
      [cleanUsername, cleanEmail, password_hash, activeStatus.id],
    );
    // Auto generate a user ID from inserting result from onboarding
    const newUserId = insertRes.insertId;

    // Normalizing roles to prevent bugs
    const normalizedRoles = [...new Set(roles.map((r) => String(r).trim().toUpperCase()))];

    // Fetch selected roles in one query
    const [dbRoles] = await conn.query(`SELECT id, slug FROM roles WHERE slug IN (?)`, [normalizedRoles]);
    // Validate role slugs exist
    if (dbRoles.length !== normalizedRoles.length) {
      const found = new Set(dbRoles.map((r) => r.slug));
      const unknown = normalizedRoles.filter((r) => !found.has(r));
      const err = new Error(`Unknown role(s): ${unknown.join(", ")}`);
      err.status = 400;
      throw err;
    }
    // Insert role links
    for (const r of dbRoles) {
      await conn.query(`INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)`, [newUserId, r.id]);
    }

    await conn.commit();

    return {
      message: "User created",
      user: {
        id: newUserId,
        username: cleanUsername,
        email: cleanEmail,
        roles: normalizedRoles,
        status: "ACTIVE",
      },
    };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

// ADMIN: update users details
export async function adminUpdateUserService({ targetUserId, actorUserId, patch }) {
  // Valid ID (prevent invalid or malicious input from reaching your database logic)
  if (!Number.isInteger(targetUserId) || targetUserId <= 0) {
    // Make sure targetUserId is a number and its not negative: proper default id number
    const err = new Error("Invalid user id");
    err.status = 400;
    throw err;
  }

  // Check: if userID is admin himself
  const isSelf = actorUserId === targetUserId;

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // Ensure target user exists
    const [[user]] = await conn.query("SELECT id FROM users WHERE id = ? LIMIT 1", [targetUserId]);
    if (!user) {
      const err = new Error("User not found");
      err.status = 404;
      throw err;
    }

    // 1) Update username/email if provided
    if (patch.username != null || patch.email != null) {
      if (patch.username != null) {
        patch.username = String(patch.username).trim();

        const [[u]] = await conn.query("SELECT id FROM users WHERE username = ? AND id <> ? LIMIT 1", [patch.username, targetUserId]);

        if (u) {
          const err = new Error("Username already exists");
          err.status = 409;
          throw err;
        }
      }

      if (patch.email != null) {
        patch.email = String(patch.email).trim().toLowerCase();

        // Validate format first
        const emailErr = validateEmail(patch.email);
        if (emailErr) {
          const err = new Error(emailErr);
          err.status = 400;
          throw err;
        }

        // Then check uniqueness
        const [[e]] = await conn.query("SELECT id FROM users WHERE email = ? AND id <> ? LIMIT 1", [patch.email, targetUserId]);

        if (e) {
          const err = new Error("Email already exists");
          err.status = 409;
          throw err;
        }
      }

      await conn.query(`UPDATE users SET username = COALESCE(?, username), email = COALESCE(?, email) WHERE id = ?`, [patch.username ?? null, patch.email ?? null, targetUserId]);
    }

    // 2) Update status if provided (ACTIVE/DISABLED)
    if (patch.status != null) {
      // Prevent ADMIN from changing their own status
      if (isSelf) {
        const err = new Error("You cannot change your own account status");
        err.status = 400;
        throw err;
      }

      const status = String(patch.status).toUpperCase();
      const allowed = new Set(["ACTIVE", "DISABLED"]);

      if (!allowed.has(status)) {
        const err = new Error("Invalid status (allowed: ACTIVE, DISABLED)");
        err.status = 400;
        throw err;
      }

      const [[statusRow]] = await conn.query("SELECT id FROM account_status WHERE slug = ? LIMIT 1", [status]);

      if (!statusRow) {
        const err = new Error(`Status ${status} not found`);
        err.status = 500;
        throw err;
      }

      await conn.query("UPDATE users SET account_status_id = ? WHERE id = ?", [statusRow.id, targetUserId]);
    }

    // 3) Replace roles if provided
    if (patch.roles != null) {
      if (!Array.isArray(patch.roles) || patch.roles.length === 0) {
        const err = new Error("At least one role is required");
        err.status = 400;
        throw err;
      }

      // Normalize role names
      const uniqueRoles = [...new Set(patch.roles.map((r) => String(r).trim().toUpperCase()))];
      const [dbRoles] = await conn.query("SELECT id, slug FROM roles WHERE slug IN (?)", [uniqueRoles]);

      if (dbRoles.length !== uniqueRoles.length) {
        const found = new Set(dbRoles.map((r) => r.slug));
        const unknown = uniqueRoles.filter((r) => !found.has(r));
        const err = new Error(`Unknown role(s): ${unknown.join(", ")}`);
        err.status = 400;
        throw err;
      }

      // Prevent ADMIN from removing their own ADMIN role
      if (isSelf) {
        const hasAdmin = dbRoles.some((r) => r.slug === "ADMIN");
        if (!hasAdmin) {
          const err = new Error("You cannot remove your own ADMIN role");
          err.status = 400;
          throw err;
        }
      }

      await conn.query("DELETE FROM user_roles WHERE user_id = ?", [targetUserId]);

      for (const r of dbRoles) {
        await conn.query("INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)", [targetUserId, r.id]);
      }
    }

    // 4) Update password
    if (patch.newPassword != null) {
      const newPassword = String(patch.newPassword);

      // Reuse your existing validatePassword(newPassword)
      const pwErr = validatePassword(newPassword);
      if (pwErr) {
        const err = new Error(pwErr);
        err.status = 400;
        throw err;
      }

      // Fetch current password hash
      const [[currentUser]] = await conn.query("SELECT password_hash FROM users WHERE id = ? LIMIT 1", [targetUserId]);

      if (!currentUser) {
        const err = new Error("User not found");
        err.status = 404;
        throw err;
      }

      // Compare new password with existing hash
      const isSamePassword = await bcrypt.compare(newPassword, currentUser.password_hash);

      if (isSamePassword) {
        const err = new Error("New password cannot be the same as the current password");
        err.status = 400;
        throw err;
      }

      // Hash and update new password if different
      const password_hash = await bcrypt.hash(newPassword, 10);

      await conn.query("UPDATE users SET password_hash = ? WHERE id = ?", [password_hash, targetUserId]);
    }

    await conn.commit();
    return { message: "User updated" };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}
