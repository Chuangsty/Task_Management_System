import { pool } from "../config/db.js";

// START OF HELPER FUNCTION ==================================================================================
// app acronym cleaner helper
function requireCleanAppAcronym(app_acronym) {
  // clean acronym
  const cleanAcronym = String(app_acronym ?? "").trim();
  // validate acronym
  if (cleanAcronym === "") {
    const err = new Error("App acronym is required");
    err.status = 400;
    throw err;
  }
  return cleanAcronym;
}

// getting actor username
async function getUserRow(conn, actorUserId) {
  const [[actor]] = await conn.query(
    `
    SELECT id, username
    FROM users
    WHERE id = ?
    LIMIT 1
    `,
    [actorUserId],
  );
  if (!actor) {
    const err = new Error("User not found");
    err.status = 404;
    throw err;
  }
  return actor;
}

// get app informations
async function getAppByAcronymForUpdate(conn, cleanAcronym) {
  const [[app]] = await conn.query(
    `
    SELECT
      a.app_id,
      a.app_acronym,
      a.app_startDate,
      a.app_endDate,
      a.next_task_no,
      a.next_plan_no,
      s.slug AS app_state_slug
    FROM applications a
    JOIN states s ON s.id = a.state_id
    WHERE app_acronym = ?
    LIMIT 1
    FOR UPDATE
    `,
    [cleanAcronym],
  );
  if (!app) {
    const err = new Error("Application not found");
    err.status = 404;
    throw err;
  }
  return app;
}

// check for application completion
function ensureAppNotCompleted(app) {
  if (app.app_state_slug === "COMPLETED") {
    const err = new Error("Unable to modify completed application");
    err.status = 400;
    throw err;
  }
}

// check for task completion
function ensureTaskNotClosed(existingTask) {
  if (existingTask.task_state_slug === "CLOSED") {
    const err = new Error("Closed tasks cannot be updated");
    err.status = 400;
    throw err;
  }
}

// get task state
async function getTaskStateRow(conn, slug) {
  const [[state]] = await conn.query(
    `
    SELECT id, slug, task_state_name
    FROM task_states
    WHERE slug = ?
    LIMIT 1
    `,
    [slug],
  );
  if (!state) {
    const err = new Error(`Task state not found: ${slug}`);
    err.status = 500;
    throw err;
  }
  return state;
}
// END OF HELPER FUNCTION ====================================================================================

// Task Dashboard services ===================================================================================
// listing all tasks details
export async function listTasksService(app_acronym) {
  const cleanAcronym = requireCleanAppAcronym(app_acronym);

  const [rows] = await pool.query(
    `
    SELECT
      t.task_id,
      t.task_no,
      t.task_name,
      t.task_description,
      t.task_note,
      p.plan_name,
      t.task_created_at,
      t.task_taken_at,
      t.task_update_at,
      ts.task_state_name AS task_state,
      ts.id AS task_state_id,

      c.id AS creator_id,
      c.username AS creator_username,

      d.id AS developer_id,
      d.username AS developer_username

    FROM tasks t
    JOIN applications a ON a.app_id = t.app_id
    JOIN task_states ts ON ts.id = t.task_state_id
    JOIN users c ON c.id = t.creator
    LEFT JOIN users d ON d.id = t.developer
    LEFT JOIN plans p ON p.plan_id = t.plan_id
    WHERE a.app_acronym = ?
    ORDER BY t.task_no DESC
    `,
    [cleanAcronym],
  );
  return rows;
}

// task creation function
export async function createTaskService({ app_acronym, task_name, task_description, actorUserId }) {
  const cleanAcronym = requireCleanAppAcronym(app_acronym);

  // validate task name
  if (!task_name || String(task_name).trim() === "") {
    const err = new Error("Task name is required");
    err.status = 400;
    throw err;
  }

  const cleanTaskName = String(task_name).trim();
  const cleanTaskDescription = task_description == null ? null : String(task_description).trim();

  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    const app = await getAppByAcronymForUpdate(conn, cleanAcronym);

    // 1) check for application completion state
    ensureAppNotCompleted(app);

    // 2) Check task name unique per app
    const [[t]] = await conn.query("SELECT task_name FROM tasks WHERE app_id = ? AND task_name = ? LIMIT 1", [app.app_id, cleanTaskName]);
    if (t) {
      const err = new Error("Task name already exists in this application");
      err.status = 409;
      throw err;
    }

    // 3) get default OPEN task state
    const openState = await getTaskStateRow(conn, "OPEN");

    // 4) generate task number + task id
    const task_no = app.next_task_no; // running num
    const task_id = `${app.app_acronym}-${task_no}`; // app acronym with running num for primary unique key

    // 5) initial task note
    // get actor username
    const actor = await getUserRow(conn, actorUserId);

    // get task state
    const [[taskState]] = await conn.query(
      `
      SELECT task_state_name
      FROM task_states
      WHERE id = ?
      LIMIT 1
      `,
      [openState.id],
    );

    if (!taskState) {
      const err = new Error("Task state not found");
      err.status = 404;
      throw err;
    }

    const createAtTimestamp = new Date().toLocaleString("sv-SE", { timeZone: "Asia/Singapore" });
    const initialNote = `[ ${createAtTimestamp}, Task state: ${taskState.task_state_name} ] Project Lead ${actor.username} created task.`;

    // 6) insert task
    await conn.query(
      `
        INSERT INTO tasks (
            task_id,
            app_id,
            task_no,
            task_name,
            task_description,
            task_note,
            task_state_id,
            creator
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `,
      [task_id, app.app_id, task_no, cleanTaskName, cleanTaskDescription, initialNote, openState.id, actorUserId],
    );

    // 7) increment app next_task_no
    await conn.query(
      `
            UPDATE applications
            SET next_task_no = next_task_no + 1
            WHERE app_id = ?
            `,
      [app.app_id],
    );

    // 8) fetch created task
    const [[newTask]] = await conn.query(
      `
        SELECT
            t.task_id,
            t.app_id,
            t.task_no,
            t.task_name,
            t.task_description,
            t.task_note,
            t.task_created_at,
            t.task_update_at,
            ts.task_state_name AS task_state
        FROM tasks t
        JOIN task_states ts ON ts.id = t.task_state_id
        WHERE t.task_id = ?
        LIMIT 1
        `,
      [task_id],
    );

    await conn.commit();

    return {
      message: "Task created successfully",
      task: newTask,
    };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

// task update function
export async function updateTaskService({ task_id, task_description, actorUserId }) {
  // validate task id
  if (!task_id || String(task_id).trim() === "") {
    const err = new Error("Task id is required");
    err.status = 400;
    throw err;
  }

  const cleanTaskId = String(task_id).trim();

  // validate description presence
  if (task_description === undefined) {
    const err = new Error("No fields provided to update");
    err.status = 400;
    throw err;
  }

  const cleanTaskDescription = task_description == null ? null : String(task_description).trim();

  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    // 1) ensure task exists
    const [[existingTask]] = await conn.query(
      `
      SELECT
        t.task_id,
        t.task_description,
        t.task_note,
        ts.slug AS task_state_slug
      FROM tasks t
      JOIN task_states ts ON ts.id = t.task_state_id
      WHERE t.task_id = ?
      LIMIT 1
      FOR UPDATE
      `,
      [cleanTaskId],
    );
    // if no existing task
    if (!existingTask) {
      const err = new Error("Task not found");
      err.status = 404;
      throw err;
    }

    // check for task completion
    ensureTaskNotClosed(existingTask);

    // 2) build appended note
    // get actor username
    const actor = await getUserRow(conn, actorUserId);

    // get default OPEN task state
    const openState = await getTaskStateRow(conn, "OPEN");

    // get update time
    const updateAtTimestamp = new Date().toLocaleString("sv-SE", { timeZone: "Asia/Singapore" });
    const updateLine = `[ ${updateAtTimestamp}, Task state: ${openState.task_state_name} ] Project Lead ${actor.username} updated the description from <${existingTask.task_description}> to <${cleanTaskDescription}>.`;

    const nextNote = existingTask.task_note ? `${existingTask.task_note}\n${updateLine}` : updateLine;

    // 3) update task
    await conn.query(
      `
      UPDATE tasks
      SET
        task_description = ?,
        task_note = ?
      WHERE task_id = ?
      `,
      [cleanTaskDescription, nextNote, cleanTaskId],
    );

    // 4) fetch updated task
    const [[updatedTask]] = await conn.query(
      `
      SELECT
        t.task_id,
        t.app_id,
        t.task_no,
        t.task_name,
        t.task_description,
        t.task_note,
        t.plan_id,
        t.task_created_at,
        t.task_taken_at,
        t.task_update_at,
        ts.task_state_name AS task_state,
        ts.id AS task_state_id,

        c.id AS creator_id,
        c.username AS creator_username,

        d.id AS developer_id,
        d.username AS developer_username
      FROM tasks t
      JOIN task_states ts ON ts.id = t.task_state_id
      JOIN users c ON c.id = t.creator
      LEFT JOIN users d ON d.id = t.developer
      WHERE t.task_id = ?
      LIMIT 1
      `,
      [cleanTaskId],
    );

    await conn.commit();

    return {
      message: "Task updated successfully",
      task: updatedTask,
    };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

// plan creation function
export async function createPlanService({ app_acronym, plan_name, plan_startDate, plan_endDate, task_ids = [], actorUserId }) {
  const cleanAcronym = requireCleanAppAcronym(app_acronym);

  if (!plan_name || String(plan_name).trim() === "") {
    const err = new Error("Plan name is required");
    err.status = 400;
    throw err;
  }

  if (!plan_startDate || !plan_endDate) {
    const err = new Error("Plan start date and end date are required");
    err.status = 400;
    throw err;
  }
  if (plan_startDate > plan_endDate) {
    const err = new Error("Plan end date must be later than start date");
    err.status = 400;
    throw err;
  }

  if (!Array.isArray(task_ids) || task_ids.length === 0) {
    const err = new Error("At least one task must be selected");
    err.status = 400;
    throw err;
  }

  const cleanPlanName = String(plan_name).trim();

  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();
    // Start of validations ===========================================

    // 1) Lock application row
    const app = await getAppByAcronymForUpdate(conn, cleanAcronym);

    // check for application completion state
    ensureAppNotCompleted(app);

    const app_id = app.app_id;

    const cleanPlanStart = String(plan_startDate).slice(0, 10);
    const appStart = String(app.app_startDate).slice(0, 10);
    if (cleanPlanStart < appStart) {
      const err = new Error("Plan start date cannot be earlier than application start date");
      err.status = 400;
      throw err;
    }

    const cleanPlanEnd = String(plan_endDate).slice(0, 10);
    const appEnd = String(app.app_endDate).slice(0, 10);
    if (cleanPlanEnd > appEnd) {
      const err = new Error("Plan end date cannot be later than application end date");
      err.status = 400;
      throw err;
    }

    // 2) Prevent duplicate plan name within same app
    const [[existingPlan]] = await conn.query(
      `
      SELECT plan_id
      FROM plans
      WHERE app_id = ? AND plan_name = ?
      LIMIT 1
      `,
      [app_id, cleanPlanName],
    );

    if (existingPlan) {
      const err = new Error("Plan name already exists in this application");
      err.status = 409;
      throw err;
    }

    // 3) Get TODO task state
    const todoState = await getTaskStateRow(conn, "TODO");

    // 4) Get OPEN task state
    const openState = await getTaskStateRow(conn, "OPEN");

    // 5) Validate tasks
    // retrieves all tasks the user selected
    const [taskRows] = await conn.query(
      `
      SELECT
        task_id,
        app_id,
        plan_id,
        task_state_id,
        task_note
      FROM tasks
      WHERE task_id IN (?)
      FOR UPDATE
      `,
      // "FOR UPDATE" locks the rows until transaction finishes (to prevent race conditions)
      [task_ids],
    );

    if (taskRows.length !== task_ids.length) {
      // ensures all requested task exist in db
      const found = new Set(taskRows.map((t) => t.task_id));
      const missing = task_ids.filter((id) => !found.has(id));
      const err = new Error(`Task(s) not found: ${missing.join(", ")}`);
      err.status = 404;
      throw err;
    }

    for (const task of taskRows) {
      // ensures tasks belong to correct application
      if (task.app_id !== app_id) {
        const err = new Error(`Task ${task.task_id} does not belong to this application`);
        err.status = 400;
        throw err;
      }
      // ensures task not already assigned to another plan
      if (task.plan_id) {
        const err = new Error(`Task ${task.task_id} is already assigned to a plan`);
        err.status = 409;
        throw err;
      }
      // ensures task state is still OPEN
      if (task.task_state_id !== openState.id) {
        const err = new Error(`Only OPEN tasks can be added to a plan. Task ${task.task_id} is not OPEN`);
        err.status = 400;
        throw err;
      }
    }

    // End of validations =============================================

    // 1) Generate plan number and plan id
    const plan_no = app.next_plan_no;
    const plan_id = `${app.app_acronym}-${plan_no}`;

    await conn.query(
      `
      INSERT INTO plans (
        plan_id,
        app_id,
        plan_no,
        plan_name,
        plan_startDate,
        plan_endDate,
        creator
      )
      VALUES (?, ?, ?, ?, ?, ?, ?)
      `,
      [plan_id, app_id, plan_no, cleanPlanName, plan_startDate, plan_endDate, actorUserId],
    );

    // 2) Build appended note
    // get actor username
    const actor = await getUserRow(conn, actorUserId);

    // get task state name
    const [[taskState]] = await conn.query(
      `
      SELECT task_state_name
      FROM task_states
      WHERE id = ?
      LIMIT 1
      `,
      [todoState.id],
    );
    if (!taskState) {
      const err = new Error("Task state not found");
      err.status = 404;
      throw err;
    }

    // get update time
    const updateAtTimestamp = new Date().toLocaleString("sv-SE", { timeZone: "Asia/Singapore" });
    const updateLine = `[ ${updateAtTimestamp}, Task state: ${taskState.task_state_name} ] Project Manager ${actor.username} assigned task to plan "${cleanPlanName}".`;

    // 3) Assign task(s) into plan & update task(s) state OPEN -> TODO
    for (const task of taskRows) {
      const nextNote = task.task_note ? `${task.task_note}\n${updateLine}` : updateLine;

      await conn.query(
        `
        UPDATE tasks
        SET
          plan_id = ?,
          task_state_id = ?,
          task_note = ?
        WHERE task_id = ?
        `,
        [plan_id, todoState.id, nextNote, task.task_id],
      );
    }

    // 4) Increase next_plan_no
    await conn.query(
      `
      UPDATE applications
      SET next_plan_no = next_plan_no + 1
      WHERE app_id = ?
      `,
      [app_id],
    );

    // 5) Read created plan
    const [[createdPlan]] = await conn.query(
      `
      SELECT
        p.plan_id,
        p.app_id,
        p.plan_no,
        p.plan_name,
        p.plan_startDate,
        p.plan_endDate,
        p.creator,
        u.username AS creator_username
      FROM plans p
      JOIN users u ON u.id = p.creator
      WHERE p.plan_id = ?
      LIMIT 1
      `,
      [plan_id],
    );

    await conn.commit();

    return {
      message: "Plan created successfully",
      plan: createdPlan,
      assigned_task_ids: task_ids,
    };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}
// ===========================================================================================================
