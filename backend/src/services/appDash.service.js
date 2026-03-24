import { pool } from "../config/db.js";

function toTitleCase(str) {
  const special = ["API", "AI", "UI"];

  return str
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => {
      const upper = word.toUpperCase();
      if (special.includes(upper)) return upper;
      return word[0].toUpperCase() + word.slice(1);
    })
    .join(" ");
}

export async function listAppsService() {
  const [rows] = await pool.query(
    `SELECT
      a.app_id,
      a.app_name,
      a.app_acronym,
      a.created_at,
      a.app_startDate,
      a.app_endDate,
      a.app_description,
      a.permit_Open,
      a.permit_toDo,
      a.permit_Doing,
      a.permit_Done,
      s.state_name AS state_name,
      u.username AS project_lead
    FROM applications a
    JOIN states s ON s.id = a.state_id
    JOIN users u ON u.id = a.project_lead
    ORDER BY a.app_id DESC`,
  );
  return rows;
}

export async function createAppsService({ app_name, app_startDate, app_endDate, app_description, actorUserId, permit_Open, permit_toDo, permit_Doing, permit_Done }) {
  // validate app name
  if (!app_name || String(app_name).trim() === "") {
    const err = new Error("Application name is required");
    err.status = 400;
    throw err;
  }

  // validate app dates
  if (!app_startDate || !app_endDate) {
    const err = new Error("Start and end dates are required");
    err.status = 400;
    throw err;
  }
  // get today's date in YYYY-MM-DD
  const today = new Date().toISOString().split("T")[0];
  // end date cannot be before start date
  if (app_startDate && app_endDate && app_startDate > app_endDate) {
    const err = new Error("End date must be later than start date");
    err.status = 400;
    throw err;
  }

  // normalize permits
  const cleanPermitOpen = String(permit_Open).trim();
  const cleanPermitToDo = String(permit_toDo).trim();
  const cleanPermitDoing = String(permit_Doing).trim();
  const cleanPermitDone = String(permit_Done).trim();
  // validate permits
  if (!cleanPermitOpen || !cleanPermitToDo || !cleanPermitDoing || !cleanPermitDone) {
    const err = new Error("Permits are required");
    err.status = 400;
    throw err;
  }
  const permitRoles = [cleanPermitOpen, cleanPermitToDo, cleanPermitDoing, cleanPermitDone];

  // normalize application name and description
  const cleanName = toTitleCase(String(app_name).trim());
  // == null -> IS condition, null -> FOR WHEN value if true, String... -> FOR WHEN value if false
  const cleanDescription = app_description == null ? null : String(app_description).trim();

  // default create the acronym of application name
  const appAcronym = cleanName
    .split(/\s+/) // split name word by word
    .filter(Boolean) // remove any empty values after split
    .map((w) => w[0]?.toUpperCase() || "") // uppercase the first letter of each word
    .join("") // join the uppercased letter with no space
    .slice(0, 20); //start at index 0, end at index 20 (max 20 characters)

  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    const [[stateRow]] = await conn.query(`SELECT id FROM states WHERE slug = 'ON_GOING' limit 1`);

    if (!stateRow) {
      const err = new Error("Default application state not found");
      err.status = 500;
      throw err;
    }

    // Check application name unique
    const [[a]] = await conn.query("SELECT app_name FROM applications WHERE app_name = ? LIMIT 1", [cleanName]);
    if (a) {
      const err = new Error("Application name already exists");
      err.status = 409;
      throw err;
    }

    // Start of application acronym generation ======================================
    /* 
    Detetcting if application acronym exist in db
    If detected, add counter number to the back of acronym to create a new unique acronym
      and increase counter by 1 for the same acronym usage.
    If not detected, insert the acronym into db straight
    */
    let finalAcronym = appAcronym;
    let counter = 1;
    // Ensure acronym is unique
    while (true) {
      const [[existing]] = await conn.query(`SELECT app_id FROM applications WHERE app_acronym = ? LIMIT 1`, [finalAcronym]);

      if (!existing) break;

      finalAcronym = `${appAcronym}${counter}`;
      counter += 1;
    }
    // Application acronym generation can be tweaked if desired in the future
    // End of application acronym generation ========================================

    // validate against roles table
    const [dbRoles] = await conn.query(
      `
      SELECT slug
      FROM roles
      `,
    );
    // turn DB rows into a Set of valid role slugs
    const validRoleSlugs = new Set(dbRoles.map((r) => r.slug));
    // find which submitted permits are invalid
    const invalidPermits = permitRoles.filter((role) => !validRoleSlugs.has(role));
    if (invalidPermits.length > 0) {
      const err = new Error(`Invalid permit role(s): ${invalidPermits.join(", ")}`);
      err.status = 400;
      throw err;
    }

    const [result] = await conn.query(
      `
      INSERT INTO applications
      (app_name, app_acronym, state_id, project_lead, app_startDate, app_endDate, app_description, permit_Open, permit_toDo, permit_Doing, permit_Done)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [cleanName, finalAcronym, stateRow.id, actorUserId, app_startDate, app_endDate, cleanDescription, cleanPermitOpen, cleanPermitToDo, cleanPermitDoing, cleanPermitDone],
    );

    const [[newApp]] = await conn.query(
      `
      SELECT
        a.app_id,
        a.app_name,
        a.app_acronym,
        a.created_at,
        a.app_startDate,
        a.app_endDate,
        a.app_description,
        a.permit_Open,
        a.permit_toDo,
        a.permit_Doing,
        a.permit_Done,
        s.state_name AS state_name,
        u.username AS project_lead
      FROM applications a
      JOIN states s ON s.id = a.state_id
      JOIN users u ON u.id = a.project_lead
      WHERE a.app_id = ?
      LIMIT 1
      `,
      [result.insertId],
    );

    await conn.commit();

    return {
      message: "Application created",
      app: newApp,
    };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

export async function updateAppsService({ app_acronym, app_id, app_startDate, app_endDate, app_description, actorUserId, permit_Open, permit_toDo, permit_Doing, permit_Done }) {
  const cleanAcronym = String(app_acronym ?? "")
    .trim()
    .toUpperCase();
  // validate acronym
  if (cleanAcronym === "") {
    const err = new Error("App acronym is required");
    err.status = 400;
    throw err;
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [[app]] = await conn.query(
      `SELECT app_id, project_lead
       FROM applications
       WHERE app_acronym = ?
       LIMIT 1`,
      [cleanAcronym],
    );

    if (!app) {
      const err = new Error("Application not found");
      err.status = 404;
      throw err;
    }

    if (Number(app.project_lead) !== Number(actorUserId)) {
      const err = new Error("You can only update applications that you created");
      err.status = 403;
      throw err;
    }

    const updates = [];
    const values = [];

    if (app_startDate !== undefined) {
      updates.push("app_startDate = ?");
      values.push(app_startDate);
    }

    if (app_endDate !== undefined) {
      updates.push("app_endDate = ?");
      values.push(app_endDate);
    }

    if (app_startDate && app_endDate && app_startDate > app_endDate) {
      const err = new Error("Application end date must be later than start date");
      err.status = 400;
      throw err;
    }

    if (app_description !== undefined) {
      const cleanDescription = app_description == null ? null : String(app_description).trim();

      updates.push("app_description = ?");
      values.push(cleanDescription);
    }

    // Permits update
    if (permit_Open !== undefined) {
      updates.push("permit_Open = ?");
      values.push(permit_Open);
    }
    if (permit_toDo !== undefined) {
      updates.push("permit_toDo = ?");
      values.push(permit_toDo);
    }
    if (permit_Doing !== undefined) {
      updates.push("permit_Doing = ?");
      values.push(permit_Doing);
    }
    if (permit_Done !== undefined) {
      updates.push("permit_Done = ?");
      values.push(permit_Done);
    }

    // CAN IMPLEMENT CONTRAINTS TO INCLUDE PLANS START END DATE TO CONTAIN AND NOT BE CONTAINED.

    if (updates.length === 0) {
      const err = new Error("No fields provided to update");
      err.status = 400;
      throw err;
    }

    values.push(app.app_id);

    await conn.query(
      `
      UPDATE applications
      SET ${updates.join(", ")}
      WHERE app_id = ?
      `,
      values,
    );

    const [[updatedApp]] = await conn.query(`SELECT * FROM applications WHERE app_id = ? LIMIT 1`, [app.app_id]);

    await conn.commit();

    return {
      message: "Application updated successfully",
      app: updatedApp,
    };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}
