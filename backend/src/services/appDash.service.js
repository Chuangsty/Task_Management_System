import { pool } from "../config/db.js";

export async function listAppsService() {
  const [rows] = await pool.query("SELECT * FROM applications");
  return rows;
}

export async function createAppsService({ app_name, app_startDate, app_endDate, app_description, actorUserId }) {
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
  // start date cannot be before current date
  if (app_startDate < today) {
    const err = new Error("Start date cannot be before current date");
    err.status = 400;
    throw err;
  }
  // end date cannot be before start date
  if (app_startDate && app_endDate && app_startDate > app_endDate) {
    const err = new Error("End date must be later than start date");
    err.status = 400;
    throw err;
  }

  // normalize application name and description
  const cleanName = String(app_name).trim();
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

    const [result] = await conn.query(
      `
      INSERT INTO applications
      (app_name, app_acronym, state_id, project_lead, app_startDate, app_endDate, app_description)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      `,
      [cleanName, finalAcronym, stateRow.id, actorUserId, app_startDate, app_endDate, app_description],
    );

    await conn.commit();

    return {
      message: "Application created",
      app: {
        app_id: result.insertId,
        app_name: cleanName,
        app_acronym: finalAcronym,
        state_name: "On-going",
        project_lead: actorUserId,
        app_startDate: app_startDate,
        app_endDate: app_endDate,
        app_description: cleanDescription,
      },
    };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

export async function updateAppsService({ app_id, app_startDate, app_endDate, app_description }) {
  // validate targetted app id
  if (!Number.isInteger(app_id) || app_id <= 0) {
    const err = new Error("Invalid app_id");
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
  // start date cannot be before current date
  if (app_startDate < today) {
    const err = new Error("Start date cannot be before current date");
    err.status = 400;
    throw err;
  }
  // end date cannot be before start date
  if (app_startDate && app_endDate && app_startDate > app_endDate) {
    const err = new Error("End date must be later than start date");
    err.status = 400;
    throw err;
  }

  // DEscription
  const cleanDescription = app_description == null ? null : String(app_description).trim();
  // == null -> IS condition, null -> FOR WHEN value if true, String... -> FOR WHEN value if false

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [[existing]] = await conn.query(
      `SELECT app_id
       FROM applications
       WHERE app_id = ?
       LIMIT 1`,
      [app_id],
    );

    if (!existing) {
      const err = new Error("Application not found");
      err.status = 404;
      throw err;
    }

    await conn.query(
      `
      UPDATE applications
      SET app_startDate = ?, app_endDate = ?, app_description = ?
      WHERE app_id = ?
      `,
      [app_startDate, app_endDate, cleanDescription, app_id],
    );

    const [[updatedApp]] = await conn.query(
      `
      SELECT *
      FROM applications
      WHERE app_id =?
      LIMIT 1`,
      [app_id],
    );

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
