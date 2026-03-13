import { pool } from "../config/db.js";

// START helper functions ==============================
// validate cleaned string value of required task id
function requireTaskId(task_id) {
  const cleanTaskId = String(task_id ?? "").trim();
  if (cleanTaskId === "") {
    const err = new Error("Task id is required");
    err.status = 400;
    throw err;
  }
  return cleanTaskId;
}

// timestamp for task note append(upon action)
function makeTimestamp() {
  return new Date().toLocaleString("sv-SE", { timeZone: "Asia/Singapore" });
}

// task note append(upon action)
function appendNote(existingNote, line) {
  return existingNote ? `${existingNote}\n${line}` : line;
}

// retrieve task states
async function getTaskStateRow(conn, slug) {
  const [[taskState]] = await conn.query(
    `
        SELECT id, task_state_name
        FROM task_states
        WHERE slug = ?
        LIMIT 1
        `,
    [slug],
  );
  if (!taskState) {
    const err = new Error(`Task state ${slug} not found`);
    err.status = 500;
    throw err;
  }
  return taskState;
}

// retrieve app states
async function getAppStateRow(conn, slug) {
  const [[state]] = await conn.query(
    `
        SELECT id, state_name
        FROM states
        WHERE slug = ?
        LIMIT 1
        `,
    [slug],
  );
  if (!state) {
    const err = new Error(`Application state ${slug} not found`);
    err.status = 500;
    throw err;
  }
  return state;
}

// retrieve user
async function getUserRow(conn, userId) {
  const [[user]] = await conn.query(
    `
        SELECT id, username
        FROM users
        WHERE id = ?
        LIMIT 1
        `,
    [userId],
  );
  if (!user) {
    const err = new Error(`User not found`);
    err.status = 500;
    throw err;
  }
  return user;
}

// locks task row in db while transaction to prevent race condition
async function getLockedTask(conn, task_id) {
  const [[task]] = await conn.query(
    `
        SELECT
            t.task_id,
            t.app_id,
            t.plan_id,
            t.task_state_id,
            t.task_note,
            t.developer,
            t.creator,
            ts.slug AS task_state_slug
        FROM tasks t
        JOIN task_states ts ON ts.id = t.task_state_id
        WHERE t.task_id = ?
        LIMIT 1
        FOR UPDATE
        `,
    [task_id],
  );
  if (!task) {
    const err = new Error("Task not found");
    err.status = 404;
    throw err;
  }
  return task;
}

// retrieve task details
async function readTaskDetails(conn, task_id) {
  const [[task]] = await conn.query(
    `
    SELECT
      t.task_id,
      t.app_id,
      t.task_no,
      t.task_name,
      t.task_description,
      t.task_note,
      t.plan_id,
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
    JOIN task_states ts ON ts.id = t.task_state_id
    JOIN users c ON c.id = t.creator
    LEFT JOIN users d ON d.id = t.developer
    LEFT JOIN plans p ON p.plan_id = t.plan_id
    WHERE t.task_id = ?
    LIMIT 1
    `,
    [task_id],
  );
  return task;
}

// Update application state to complete upon all tasks complete
async function updateApplicationCompletionState(conn, app_id) {
  const [[openTaskCountRow]] = await conn.query(
    `
    SELECT COUNT(*) AS open_task_count
    FROM tasks t
    JOIN task_states ts ON ts.id = t.task_state_id
    WHERE t.app_id = ?
      AND ts.slug <> 'CLOSED'
    `,
    [app_id],
  );

  const [[app]] = await conn.query(
    `
    SELECT app_id, state_id
    FROM applications
    WHERE app_id = ?
    LIMIT 1
    FOR UPDATE
    `,
    [app_id],
  );

  if (!app) return;

  const completedState = await getAppStateRow(conn, "COMPLETED");
  const ongoingState = await getAppStateRow(conn, "ON_GOING");

  const nextStateId = Number(openTaskCountRow.open_task_count) === 0 ? completedState.id : ongoingState.id;

  if (app.state_id !== nextStateId) {
    await conn.query(
      `
      UPDATE applications
      SET state_id = ?
      WHERE app_id = ?
      `,
      [nextStateId, app_id],
    );
  }
}

// task developer check
async function taskDeveloper(task, actorUserId, actionText) {
  if (!task.developer || Number(task.developer) !== Number(actorUserId)) {
    const err = new Error(`You can only ${actionText} your own task`);
    err.status = 403;
    throw err;
  }
}

// task creator check
async function taskCreator(task, actorUserId, actionText) {
  if (!task.creator || Number(task.creator) !== Number(actorUserId)) {
    const err = new Error(`You can only ${actionText} tasks that you've created`);
    err.status = 403;
    throw err;
  }
}

// task update helper
async function updateTaskRow(conn, taskId, fields) {
  // Object.entries() covnerts object into array of [key, value] pairs
  const entries = Object.entries(fields);

  if (entries.length === 0) return;

  // convert fields into SQL assignments
  // entries    -> entries = [["developer", 3],["task_state_id", 2],["task_note", "hello"]]
  // map key    -> ["developer = ?","task_state_id = ?","task_note = ?"]
  // join       -> "developer = ?, task_state_id = ?, task_note = ?"
  // giving us  -> SET developer = ?, task_state_id = ?, task_note = ?
  const setClause = entries.map(([key]) => `${key} = ?`).join(", ");
  // entries    -> [["developer", 3],["task_state_id", 2],["task_note", "hello"]]
  // map        -> values = [3, 2, "hello"]    -> replace ? placeholders in SQL
  const values = entries.map(([, value]) => value);

  await conn.query(
    `
    UPDATE tasks
    SET ${setClause}
    WHERE task_id = ?
    `,
    [...values, taskId],
  );
}
// END helper functions ================================

// reusable workflow transition helper (IMPORTANT!! WHERE EVERYTHING WORKS)
async function runTaskTransition({
  task_id,
  actorUserId,
  targetStateSlug, // e.g. "DONE"
  allowedCurrentState, // e.g. "DOING"
  wrongStateMessage, // e.g. "Only TODO tasks can be taken"
  validateTask,
  buildUpdateFields,
  buildNoteLine,
  successMessage, // e.g. "a success message"
}) {
  const cleanTaskId = requireTaskId(task_id);
  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    const task = await getLockedTask(conn, cleanTaskId);
    const actor = await getUserRow(conn, actorUserId);
    const targetState = await getTaskStateRow(conn, targetStateSlug);

    // state check
    if (task.task_state_slug !== allowedCurrentState) {
      const err = new Error(wrongStateMessage);
      err.status = 400;
      throw err;
    }

    // extra custom validation
    if (validateTask) {
      await validateTask({ conn, task, actor, actorUserId, cleanTaskId });
    }

    // append task note
    const line = buildNoteLine({ task, actor, actorUserId, targetState });
    const nextNote = appendNote(task.task_note, line);

    // build update payload
    const updateFields = buildUpdateFields({
      task,
      actor,
      actorUserId,
      targetState,
      nextNote,
    });

    // update task fields
    await updateTaskRow(conn, cleanTaskId, updateFields);

    // re-check application completion state
    await updateApplicationCompletionState(conn, task.app_id);

    // fetch updated task
    const updatedTask = await readTaskDetails(conn, cleanTaskId);

    await conn.commit();

    return {
      message: successMessage,
      task: updatedTask,
    };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

// Developer actions =================================================
// Take on task
export async function takeTaskService({ task_id, actorUserId }) {
  return runTaskTransition({
    task_id,
    actorUserId,
    targetStateSlug: "DOING",
    allowedCurrentState: "TODO",
    wrongStateMessage: "Only TODO tasks can be taken",

    validateTask: async ({ task }) => {
      // task plan check
      if (!task.plan_id) {
        const err = new Error("Only planned tasks can be taken");
        err.status = 400;
        throw err;
      }

      // task developer check
      if (task.developer) {
        const err = new Error("Task is already taken by a developer");
        err.status = 409;
        throw err;
      }
    },

    buildUpdateFields: ({ actor, targetState, nextNote }) => ({
      developer: actor.id,
      task_state_id: targetState.id,
      task_taken_at: makeTimestamp(),
      task_note: nextNote,
    }),

    buildNoteLine: ({ actor, targetState }) => `[ ${makeTimestamp()}, Task state: ${targetState.task_state_name} ] Developer ${actor.username} took on the task.`,

    successMessage: "Task taken successfully",
  });
}

// Forfeit on task
export async function forfeitTaskService({ task_id, actorUserId }) {
  return runTaskTransition({
    task_id,
    actorUserId,
    targetStateSlug: "TODO",
    allowedCurrentState: "DOING",
    wrongStateMessage: "Only DOING tasks can be forfeited",

    validateTask: async ({ task, actorUserId }) => {
      // task developer ownership validation
      taskDeveloper(task, actorUserId, "forfeit");
    },

    buildUpdateFields: ({ targetState, nextNote }) => ({
      developer: null,
      task_state_id: targetState.id,
      task_taken_at: null,
      task_note: nextNote,
    }),

    buildNoteLine: ({ actor, targetState }) => `[ ${makeTimestamp()}, Task state: ${targetState.task_state_name} ] Developer ${actor.username} forfeited the task.`,

    successMessage: "Task forfeited successfully",
  });
}

// Submit task
export async function submitTaskService({ task_id, actorUserId }) {
  return runTaskTransition({
    task_id,
    actorUserId,
    targetStateSlug: "DONE",
    allowedCurrentState: "DOING",
    wrongStateMessage: "Only DOING tasks can be submitted",

    validateTask: async ({ task, actorUserId }) => {
      // task developer ownership validation
      taskDeveloper(task, actorUserId, "submit");
    },

    buildUpdateFields: ({ actor, targetState, nextNote }) => ({
      developer: actor.id,
      task_state_id: targetState.id,
      task_note: nextNote,
    }),

    buildNoteLine: ({ actor, targetState }) => `[ ${makeTimestamp()}, Task state: ${targetState.task_state_name} ] Developer ${actor.username} submitted the task for review.`,

    successMessage: "Task submitted successfully",
  });
}
// Developer actions end =============================================

// Project Lead actions ==============================================
// Reject task
export async function rejectTaskService({ task_id, actorUserId }) {
  return runTaskTransition({
    task_id,
    actorUserId,
    targetStateSlug: "DOING",
    allowedCurrentState: "DONE",
    wrongStateMessage: "Only DONE tasks can be rejected",

    validateTask: async ({ task, actorUserId }) => {
      // task developer ownership validation
      taskCreator(task, actorUserId, "reject");
    },

    buildUpdateFields: ({ targetState, nextNote }) => ({
      task_state_id: targetState.id,
      task_note: nextNote,
    }),

    buildNoteLine: ({ actor, targetState }) => `[ ${makeTimestamp()}, Task state: ${targetState.task_state_name} ] Project Lead ${actor.username} reviewed task and rejected it.`,

    successMessage: "Task has been rejected",
  });
}

// Approve task
export async function approveTaskService({ task_id, actorUserId }) {
  return runTaskTransition({
    task_id,
    actorUserId,
    targetStateSlug: "CLOSED",
    allowedCurrentState: "DONE",
    wrongStateMessage: "Only DONE tasks can be approved",

    validateTask: async ({ task, actorUserId }) => {
      // task developer ownership validation
      taskCreator(task, actorUserId, "approve");
    },

    buildUpdateFields: ({ targetState, nextNote }) => ({
      task_state_id: targetState.id,
      task_note: nextNote,
    }),

    buildNoteLine: ({ actor, targetState }) => `[ ${makeTimestamp()}, Task state: ${targetState.task_state_name} ] Project Lead ${actor.username} reviewed task and approved it.`,

    successMessage: "Task has been approved",
  });
}
// Project Lead actions end ==========================================
