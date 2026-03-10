import { pool } from "../config/db.js";

export async function listTasksService(app_id) {
  // validate id
  if (!Number.isInteger(app_id) || app_id <= 0) {
    const err = new Error("Invalid app_id");
    err.status = 400;
    throw err;
  }

  const [rows] = await pool.query(
    `
    SELECT
      t.task_id,
      t.task_no,
      t.task_name,
      t.task_description,
      t.task_note,
      t.plan_id,
      t.task_created_at,
      t.task_taken_at,
      t.task_update_at,
      ts.slug AS task_state,
      ts.id AS task_state_id,

      c.id AS creator_id,
      c.username AS creator_username,

      d.id AS developer_id,
      d.username AS developer_username

    FROM tasks t
    JOIN task_states ts ON ts.id = t.task_state_id
    JOIN users c ON c.id = t.creator
    LEFT JOIN users d ON d.id = t.developer
    WHERE t.app_id = ?
    ORDER BY t.task_no ASC
    `,
    [app_id],
  );
  return rows;
}

export async function createTaskService({ app_id, task_name, task_description, actorUserId }) {
  // validate id
  if (!Number.isInteger(app_id) || app_id <= 0) {
    const err = new Error("Invalid app_id");
    err.status = 400;
    throw err;
  }

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

    // 1) Get app info
    const [[app]] = await conn.query(
      `
            SELECT app_id, app_acronym, next_task_no
            FROM applications
            WHERE app_id = ?
            LIMIT 1
            FOR UPDATE
            `,
      [app_id],
    );
    if (!app) {
      const err = new Error("Application not found");
      err.status = 404;
      throw err;
    }

    // 2) Check task name unique per app
    const [[t]] = await conn.query("SELECT task_name FROM tasks WHERE app_id = ? AND task_name = ? LIMIT 1", [app_id, cleanTaskName]);
    if (t) {
      const err = new Error("Task name already exists in this application");
      err.status = 409;
      throw err;
    }

    // 3) get default OPEN state
    const [[openState]] = await conn.query(
      `
        SELECT id
        FROM task_states
        WHERE slug = 'OPEN'
        LIMIT 1
        `,
    );
    if (!openState) {
      const err = new Error("Default task state not found");
      err.status = 500;
      throw err;
    }

    // 4) generate task number + task id
    const task_no = app.next_task_no; // running num
    const task_id = `${app.app_acronym}-${task_no}`; // app acronym with running num for primary unique key

    // 5) initial task note
    // get actor username
    const [[actor]] = await conn.query(
      `
      SELECT username
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
    const createAtTimestamp = new Date().toISOString().slice(0, 19).replace("T", " ");
    const initialNote = `[${createAtTimestamp}] Task created by user ${actor.username}`;

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
            t.plan_id,
            t.task_created_at,
            t.task_taken_at,
            t.task_update_at,
            ts.slug AS task_state,
            ts.id AS task_state_id
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
        t.task_note
      FROM tasks t
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

    // 2) build appended note
    const updateAtTimestamp = new Date().toISOString().slice(0, 19).replace("T", " ");
    const updateLine = `[${updateAtTimestamp}] Description updated by ${actor.username}`;

    const nextNote = existingTask.task_note ? `${existingTask.task_note}\n${updateLine}` : updateLine;

    // 3) update task
    await conn.query(
      `
      UPDATE tasks
      SET
        task_description = ?,
        task_note = ?,
        task_update_at = CURRENT_TIMESTAMP
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
        ts.slug AS task_state,
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
