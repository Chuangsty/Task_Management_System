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
      a.Rnumber_task,
      a.Rnumber_plan,
      a.project_lead,
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

// check for task state for plan changes
function ensureTaskPlanEditable(existingTask) {
  const blockedStates = new Set(["DOING", "DONE", "CLOSED"]);

  if (blockedStates.has(String(existingTask.task_state_slug || "").toUpperCase())) {
    const err = new Error("Plan cannot be changed once task is DOING, DONE, or CLOSED");
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

  // app info + permits
  const [[app]] = await pool.query(
    `
    SELECT
      a.app_id,
      a.app_name,
      a.app_acronym,
      a.permit_Open,
      a.permit_toDo,
      a.permit_Doing,
      a.permit_Done,
      s.slug AS app_state_slug
    FROM applications a
    JOIN states s ON s.id = a.state_id
    WHERE a.app_acronym = ?
    LIMIT 1
    `,
    [cleanAcronym],
  );

  if (!app) {
    const err = new Error("Application not found");
    err.status = 404;
    throw err;
  }

  // all task states from DB
  const [taskStates] = await pool.query(
    `
    SELECT
      id,
      slug,
      task_state_name
    FROM task_states
    ORDER BY id ASC
    `,
  );

  // all tasks for that app
  const [tasks] = await pool.query(
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

  return {
    app,
    taskStates,
    tasks,
  };
}

// get plan name from application for task plan assignment
async function getPlanByNameForTask(conn, app_id, plan_name) {
  const cleanPlanName = String(plan_name ?? "").trim();

  if (!cleanPlanName) return null;

  const [[plan]] = await conn.query(
    `
    SELECT
      plan_id,
      app_id,
      plan_name,
      plan_startDate,
      plan_endDate
    FROM plans
    WHERE app_id = ? AND plan_name = ?
    LIMIT 1
    `,
    [app_id, cleanPlanName],
  );

  if (!plan) {
    const err = new Error(`Plan not found: ${cleanPlanName}`);
    err.status = 404;
    throw err;
  }

  return plan;
}

// task creation function
export async function createTaskService({ app_acronym, task_name, task_description, plan_name, actorUserId }) {
  const cleanAcronym = requireCleanAppAcronym(app_acronym);

  // validate task name
  if (!task_name || String(task_name).trim() === "") {
    const err = new Error("Task name is required");
    err.status = 400;
    throw err;
  }

  const cleanTaskName = String(task_name).trim();
  const cleanTaskDescription = task_description == null ? null : String(task_description).trim();
  const cleanPlanName = plan_name == null ? null : String(plan_name).trim();

  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    const app = await getAppByAcronymForUpdate(conn, cleanAcronym);

    // 1) check for application completion state
    ensureAppNotCompleted(app);

    // check for application owndership
    if (Number(app.project_lead) !== Number(actorUserId)) {
      const err = new Error("You can only create task in applications that you created");
      err.status = 403;
      throw err;
    }

    // 2) Check task name unique per app
    const [[t]] = await conn.query("SELECT task_name FROM tasks WHERE app_id = ? AND task_name = ? LIMIT 1", [app.app_id, cleanTaskName]);
    if (t) {
      const err = new Error("Task name already exists in this application");
      err.status = 409;
      throw err;
    }

    // 3) get default empty plan assignment
    let selectedPlan = null;
    // 3.1) get default OPEN task state
    const openState = await getTaskStateRow(conn, "OPEN");

    // 4) generate task number + task id
    const task_no = app.Rnumber_task + 1; // running num
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

    let initialNote = "";
    // if plan selected, task state -> to do
    if (cleanPlanName) {
      selectedPlan = await getPlanByNameForTask(conn, app.app_id, cleanPlanName);
      const withPlanNote = `[ ${createAtTimestamp}, Task state: ${taskState.task_state_name} ] Project Lead ${actor.username} created task and assigned task to plan <${selectedPlan.plan_name}>.`;
      initialNote = withPlanNote;
    } else {
      const withoutPlanNote = `[ ${createAtTimestamp}, Task state: ${taskState.task_state_name} ] Project Lead ${actor.username} created task.`;
      initialNote = withoutPlanNote;
    }

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
            plan_id,
            task_state_id,
            creator
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
      [task_id, app.app_id, task_no, cleanTaskName, cleanTaskDescription, initialNote, selectedPlan?.plan_id ?? null, openState.id, actorUserId],
    );

    // 7) increment app Rnumber_task
    await conn.query(
      `
            UPDATE applications
            SET Rnumber_task = Rnumber_task + 1
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
            p.plan_name,
            t.task_created_at,
            t.task_update_at,
            ts.task_state_name AS task_state,
            ts.slug AS task_state_slug
        FROM tasks t
        JOIN task_states ts ON ts.id = t.task_state_id
        LEFT JOIN plans p ON p.plan_id = t.plan_id
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
export async function updateTaskService({ app_acronym, task_id, plan_name, actorUserId }) {
  const cleanAcronym = requireCleanAppAcronym(app_acronym);

  // validate task id
  if (!task_id || String(task_id).trim() === "") {
    const err = new Error("Task id is required");
    err.status = 400;
    throw err;
  }

  const cleanTaskId = String(task_id).trim();

  const cleanPlanName = plan_name == null ? null : String(plan_name).trim();

  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    const app = await getAppByAcronymForUpdate(conn, cleanAcronym);
    // check for application completion state
    ensureAppNotCompleted(app);

    // 1) ensure task exists
    const [[existingTask]] = await conn.query(
      `
      SELECT
        t.task_id,
        t.app_id,
        t.task_description,
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
    // if no existing task
    if (!existingTask) {
      const err = new Error("Task not found");
      err.status = 404;
      throw err;
    }
    if (Number(existingTask.creator) !== Number(actorUserId)) {
      const err = new Error("You can only update tasks that you created");
      err.status = 403;
      throw err;
    }

    // check for task plan change ability
    ensureTaskPlanEditable(existingTask);

    // 2) build appended note
    // get actor username
    const actor = await getUserRow(conn, actorUserId);

    // get plan id
    let nextPlanId = existingTask.plan_id;

    // get default OPEN task state
    const openState = await getTaskStateRow(conn, "OPEN");

    // get update time
    const updateAtTimestamp = new Date().toLocaleString("sv-SE", { timeZone: "Asia/Singapore" });

    // set note based on plan assigned or not
    let updateLine = "";
    // if plan selected, task state -> to do
    if (cleanPlanName) {
      const selectedPlan = await getPlanByNameForTask(conn, existingTask.app_id, cleanPlanName);
      nextPlanId = selectedPlan.plan_id;
      const withPlanNote = `[ ${updateAtTimestamp}, Task state: ${openState.task_state_name} ] Project Lead ${actor.username} assigned task to plan <${selectedPlan.plan_name}>.`;
      updateLine = withPlanNote;
    } else {
      nextPlanId = null;
    }

    const nextNote = existingTask.task_note ? `${existingTask.task_note}\n${updateLine}` : updateLine;

    // 3) update task
    await conn.query(
      `
      UPDATE tasks
      SET
        plan_id = ?,
        task_note = ?
      WHERE task_id = ?
      `,
      [nextPlanId, nextNote, cleanTaskId],
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
export async function createPlanService({ app_acronym, plan_name, plan_startDate, plan_endDate, actorUserId }) {
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
      const err = new Error(`Plan start date cannot be earlier than application start date: (${appStart})`);
      err.status = 400;
      throw err;
    }

    const cleanPlanEnd = String(plan_endDate).slice(0, 10);
    const appEnd = String(app.app_endDate).slice(0, 10);
    if (cleanPlanEnd > appEnd) {
      const err = new Error(`Plan end date cannot be later than application end date: (${appEnd})`);
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

    // End of validations =============================================

    // 1) Generate plan number and plan id
    const plan_no = app.Rnumber_plan + 1;
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

    // 2) Increase Rnumber_plan
    await conn.query(
      `
      UPDATE applications
      SET Rnumber_plan = Rnumber_plan + 1
      WHERE app_id = ?
      `,
      [app_id],
    );

    // 3) Read created plan
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
    };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

export async function listPlansService(app_acronym) {
  const cleanAcronym = requireCleanAppAcronym(app_acronym);

  const [plans] = await pool.query(
    `
    SELECT
      p.plan_id,
      p.plan_no,
      p.plan_name,
      p.plan_startDate,
      p.plan_endDate,
      p.creator,
      u.username AS creator_username
    FROM plans p
    JOIN applications a ON a.app_id = p.app_id
    JOIN users u ON u.id = p.creator
    WHERE a.app_acronym = ?
    ORDER BY p.plan_no ASC
    `,
    [cleanAcronym],
  );

  return { plans };
}
// ===========================================================================================================
