import { pool } from "../config/db.js";
import { appError } from "../utils/appError.js";
import { sendTaskForReviewEmail } from "../utils/mailer.js";

// START helper functions ==============================
// validate cleaned string value of required task id
function requireTaskId(task_id) {
  const cleanTaskId = String(task_id ?? "").trim();
  if (cleanTaskId === "") throw appError(400, "MISSING_TASK_ID");
  // if (cleanTaskId === "") {
  //   const err = new Error("Task id is required");
  //   err.status = 400;
  //   err.code = "MISSING_TASK_ID";
  //   err.details = `No task_id parameter was found in the request.`;
  //   throw err;
  // }

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
  if (!taskState) throw appError(404, "TASK_STATE_NOT_FOUND");
  // if (!taskState) {
  //   const err = new Error("Task state not found");
  //   err.status = 404;
  //   err.code = "TASK_STATE_NOT_FOUND";
  //   err.details = `Task state with slug "${slug}" does not exist.`;
  //   throw err;
  // }

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
  if (!state) throw appError(404, "APPLICATION_STATE_NOT_FOUND");
  // if (!state) {
  //   const err = new Error("Application state not found");
  //   err.status = 404;
  //   err.code = "APPLICATION_STATE_NOT_FOUND";
  //   err.details = `Application state with slug "${slug}" does not exist.`;
  //   throw err;
  // }

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
  if (!user) throw appError(404, "USER_NOT_FOUND");
  // if (!user) {
  //   const err = new Error("User not found");
  //   err.status = 404;
  //   err.code = "USER_NOT_FOUND";
  //   err.details = `User with id "${userId}" does not exist.`;
  //   throw err;
  // }

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
  if (!task) throw appError(404, "TASK_NOT_FOUND");
  // if (!task) {
  //   const err = new Error("Task not found");
  //   err.status = 404;
  //   err.code = "TASK_NOT_FOUND";
  //   err.details = `Task with id "${task_id}" does not exist.`;
  //   throw err;
  // }

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

// task developer check
function taskDeveloper(task, actorUserId, actionText) {
  if (!task.developer || Number(task.developer) !== Number(actorUserId)) throw appError(403, "TASK_DEV_OWNERSHIP_REQUIRED");
}

// task creator check
function taskCreator(task, actorUserId, actionText) {
  if (!task.creator || Number(task.creator) !== Number(actorUserId)) throw appError(403, "TASK_OWNERSHIP_REQUIRED");
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

// project lead email helper
async function getProjectLeadNotificationInfo(task_id) {
  const [[row]] = await pool.query(
    `
    SELECT 
      u.email AS project_lead_email,
      u.username AS project_lead_username,
      t.task_id,
      t.task_name,
      p.plan_name
    FROM tasks t
    JOIN applications a ON a.app_id = t.app_id
    JOIN users u ON u.id = a.project_lead
    LEFT JOIN plans p ON p.plan_id = t.plan_id
    WHERE t.task_id = ?
    LIMIT 1
    `,
    [task_id],
  );
  if (!row) throw appError(404, "EMAIL_NOT_FOUND");
  // if (!row) {
  //   const err = new Error("User's email info not found");
  //   err.status = 404;
  //   err.code = `USER'S_EMAIL_NOT_FOUND`;
  //   err.details = "Email for task submission not found.";
  //   throw err;
  // }
  return row;
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
  afterCommit,
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
      throw appError(409, "TASK_INVALID_STATE_TRANSITION");
    }
    // if (task.task_state_slug !== allowedCurrentState) {
    //   const err = new Error(wrongStateMessage);
    //   err.status = 409;
    //   err.code = "TASK_INVALID_STATE_TRANSITION";
    //   err.details = `Current task state is not ${allowedCurrentState}.`;
    //   throw err;
    // }

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

    // // re-check application completion state
    // await updateApplicationCompletionState(conn, task.app_id);

    // fetch updated task
    const updatedTask = await readTaskDetails(conn, cleanTaskId);

    await conn.commit();

    if (afterCommit) {
      try {
        await afterCommit({
          task,
          actor,
          actorUserId,
          cleanTaskId,
          targetState,
          updatedTask,
        });
      } catch (emailErr) {
        console.error("Post-commit action failed:", emailErr.message);
      }
    }

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
    wrongStateMessage: "Only tasks in TODO state can be taken",

    validateTask: async ({ task }) => {
      // task developer check
      if (task.developer) throw appError(409, "UNABLE_TO_TAKE_TASK");
      // if (task.developer) {
      //   const err = new Error("Task is not available to be taken");
      //   err.status = 409;
      //   err.code = "UNABLE_TO_TAKE_TASK";
      //   err.details = `Task is already taken.`;
      //   throw err;
      // }

      // task plan check
      if (!task.plan_id) throw appError(409, "TASK_NOT_PLANNED");
      // if (!task.plan_id) {
      //   const err = new Error("Only planned tasks can be taken");
      //   err.status = 409;
      //   err.code = "TASK_NOT_PLANNED";
      //   err.details = "Task must be assigned to a plan before it can be taken.";
      //   throw err;
      // }
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
    wrongStateMessage: "Only tasks in DOING state can be forfeited",

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
export async function promoteTask2DoneService({ task_id, actorUserId }) {
  return runTaskTransition({
    task_id,
    actorUserId,
    targetStateSlug: "DONE",
    allowedCurrentState: "DOING",
    wrongStateMessage: "Only tasks in DOING state can be submitted",

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

    successMessage: "Task submitted successfully. Email notification sent.",

    // node mailer
    afterCommit: async ({ cleanTaskId, actor, updatedTask }) => {
      const info = await getProjectLeadNotificationInfo(cleanTaskId);

      if (!info.project_lead_email) return;

      await sendTaskForReviewEmail({
        to: info.project_lead_email,
        projectLeadName: info.project_lead_username,
        developerName: actor.username,
        taskId: info.task_id,
        taskName: info.task_name || updatedTask.task_name,
        planName: info.plan_name,
      });
    },
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
    wrongStateMessage: "Only tasks in DONE state can be rejected",

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
    wrongStateMessage: "Only tasks in DONE state can be approved",

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

// Note input feature
function ensureTaskNoteEditable(existingTask, actorRoles = [], permitOpenRole = null) {
  const taskStateSlug = String(existingTask.task_state_slug || "").toUpperCase();

  if (taskStateSlug === "CLOSED") throw appError(403, "TASK_CLOSED");
  // if (taskStateSlug === "CLOSED") {
  //   const err = new Error("Notes cannot be updated once task is CLOSED");
  //   err.status = 403;
  //   err.code = "TASK_CLOSED";
  //   err.details = "Note cannot be updated for tasks in CLOSED state.";
  //   throw err;
  // }

  if (taskStateSlug === "DONE") {
    const canEditDoneNote = permitOpenRole && actorRoles.includes(String(permitOpenRole).trim());

    if (!canEditDoneNote) throw appError(403, "DONE_TASK_NOTE_UPDATE_FORBIDDEN");
    // if (!canEditDoneNote) {
    //   const err = new Error("Only users with the permit_Open role can update notes when the task is DONE");
    //   err.status = 403;
    //   err.code = "DONE_TASK_NOTE_UPDATE_FORBIDDEN";
    //   err.details = "Notes for DONE tasks can only be updated by users in the permit_Open role.";
    //   throw err;
    // }
  }
}

export async function updateTaskNoteService({ task_id, note, actorUserId }) {
  if (!task_id || String(task_id).trim() === "") throw appError(400, "MISSING_TASK");
  // if (!task_id || String(task_id).trim() === "") {
  //   const err = new Error("Task id is required");
  //   err.status = 400;
  //   err.code = "MISSING_TASK";
  //   err.details = "Task missing for update.";
  //   throw err;
  // }

  const cleanTaskId = String(task_id).trim();
  const cleanNote = String(note ?? "").trim();

  if (!cleanNote) throw appError(400, "MISSING_UPDATE_NOTE_INPUT");
  // if (!cleanNote) {
  //   const err = new Error("Note is required");
  //   err.status = 400;
  //   err.code = "MISSING_UPDATE_NOTE_INPUT";
  //   err.details = "Note input missing for update.";
  //   throw err;
  // }

  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    const [[existingTask]] = await conn.query(
      `
      SELECT
        t.task_id,
        t.task_note,
        ts.task_state_name AS task_state_name,
        ts.slug AS task_state_slug,
        a.permit_Open
      FROM tasks t
      JOIN task_states ts ON ts.id = t.task_state_id
      JOIN applications a ON a.app_id = t.app_id
      WHERE t.task_id = ?
      LIMIT 1
      FOR UPDATE
      `,
      [cleanTaskId],
    );

    if (!existingTask) throw appError(404, "TASK_NOT_FOUND");
    // if (!existingTask) {
    //   const err = new Error("Task not found");
    //   err.status = 404;
    //   err.code = "TASK_NOT_FOUND";
    //   err.details = "Task is missing from application.";
    //   throw err;
    // }

    const actor = await getUserRow(conn, actorUserId);

    const [actorRoleRows] = await conn.query(
      `
      SELECT r.slug
      FROM user_roles ur
      JOIN roles r ON r.id = ur.role_id
      WHERE ur.user_id = ?
      `,
      [actorUserId],
    );

    const actorRoles = actorRoleRows.map((row) => row.slug);

    ensureTaskNoteEditable(existingTask, actorRoles, existingTask.permit_Open);

    const timestamp = new Date().toLocaleString("sv-SE", {
      timeZone: "Asia/Singapore",
    });

    const noteLine = `[ ${timestamp}, Task state: ${existingTask.task_state_name} ] User ${actor.username}: ${cleanNote}`;

    const nextNote = existingTask.task_note ? `${existingTask.task_note}\n${noteLine}` : noteLine;

    await conn.query(
      `
      UPDATE tasks
      SET task_note = ?
      WHERE task_id = ?
      `,
      [nextNote, cleanTaskId],
    );

    const [[updatedTask]] = await conn.query(
      `
      SELECT
        t.task_id,
        t.task_no,
        t.task_name,
        t.task_description,
        t.task_note,
        t.plan_id,
        p.plan_name,
        t.task_created_at,
        t.task_taken_at,
        t.task_update_at,
        ts.id AS task_state_id,
        ts.slug AS task_state_slug,
        ts.task_state_name AS task_state,
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
      [cleanTaskId],
    );

    await conn.commit();

    return {
      message: "Note added successfully",
      task: updatedTask,
    };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

// release task function
export async function releaseTaskService({ task_id, actorUserId }) {
  if (!task_id || String(task_id).trim() === "") throw appError(400, "TASK_ID_REQUIRED");
  // if (!task_id || String(task_id).trim() === "") {
  //   const err = new Error("Task id is required");
  //   err.status = 400;
  //   err.code = "TASK_ID_REQUIRED";
  //   err.details = "Task id is missing.";
  //   throw err;
  // }

  const cleanTaskId = String(task_id).trim();
  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    const [[existingTask]] = await conn.query(
      `
      SELECT
        t.task_id,
        t.app_id,
        t.task_note,
        t.plan_id,
        t.creator,
        ts.id AS task_state_id,
        ts.slug AS task_state_slug,
        ts.task_state_name
      FROM tasks t
      JOIN task_states ts ON ts.id = t.task_state_id
      WHERE t.task_id = ?
      LIMIT 1
      FOR UPDATE
      `,
      [cleanTaskId],
    );

    if (!existingTask) throw appError(404, "TASK_NOT_FOUND");
    // if (!existingTask) {
    //   const err = new Error("Task not found");
    //   err.status = 404;
    //   err.code = "TASK_NOT_FOUND";
    //   err.details = "Task is missing from application.";
    //   throw err;
    // }

    if (!existingTask.plan_id) throw appError(400, "UNASSIGNED_TASK");
    // if (!existingTask.plan_id) {
    //   const err = new Error("Task must be assigned to a plan before release");
    //   err.status = 400;
    //   err.code = "UNASSIGNED_TASK";
    //   err.details = "Unassigned task cannot be release.";
    //   throw err;
    // }

    if (existingTask.task_state_slug !== "OPEN") throw appError(400, "UNOPEN_TASK_CANNOT_BE_RELEASE");
    // if (existingTask.task_state_slug !== "OPEN") {
    //   const err = new Error("Only OPEN tasks can be released");
    //   err.status = 400;
    //   err.code = "UNOPEN_TASK_CANNOT_BE_RELEASE";
    //   err.details = "Only tasks that are in the OPEN state can be released.";
    //   throw err;
    // }

    const [[app]] = await conn.query(
      `
      SELECT
        a.app_id,
        a.app_acronym,
        a.project_lead,
        s.slug AS app_state_slug
      FROM applications a
      JOIN states s ON s.id = a.state_id
      WHERE a.app_id = ?
      LIMIT 1
      FOR UPDATE
      `,
      [existingTask.app_id],
    );

    if (!app) throw appError(404, "APPLICATION_NOT_FOUND");
    // if (!app) {
    //   const err = new Error("Application not found");
    //   err.status = 404;
    //   err.code = "APPLICATION_NOT_FOUND";
    //   err.details = "Application is missing.";
    //   throw err;
    // }

    const actor = await getUserRow(conn, actorUserId);
    const todoState = await getTaskStateRow(conn, "TODO");

    const updateAtTimestamp = new Date().toLocaleString("sv-SE", { timeZone: "Asia/Singapore" });

    const releaseLine = `[ ${updateAtTimestamp}, Task state: ${todoState.task_state_name} ] Project Lead ${actor.username} released task.`;

    const nextNote = existingTask.task_note ? `${existingTask.task_note}\n${releaseLine}` : releaseLine;

    await conn.query(
      `
      UPDATE tasks
      SET
        task_state_id = ?,
        task_note = ?,
        task_update_at = CURRENT_TIMESTAMP
      WHERE task_id = ?
      `,
      [todoState.id, nextNote, cleanTaskId],
    );

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
        p.plan_name,
        t.task_created_at,
        t.task_taken_at,
        t.task_update_at,
        ts.task_state_name AS task_state,
        ts.slug AS task_state_slug,
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
      [cleanTaskId],
    );

    await conn.commit();

    return {
      message: "Task released successfully",
      task: updatedTask,
    };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}
