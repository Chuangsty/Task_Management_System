import { pool } from "../config/db.js";

export function requireAppPermit(field) {
  return async (req, res, next) => {
    try {
      const appAcronym = String(req.params.appAcronym ?? "").trim();

      if (!appAcronym) {
        const err = new Error("App acronym required");
        err.status = 400;
        throw err;
      }

      const [[app]] = await pool.query(
        `
        SELECT ${field} AS permit
        FROM applications
        WHERE app_acronym = ?
        LIMIT 1
        `,
        [appAcronym],
      );

      if (!app) {
        const err = new Error("Application not found");
        err.status = 404;
        throw err;
      }

      const userRoles = req.user?.roles || [];

      if (!userRoles.includes(app.permit)) {
        const err = new Error("Forbidden");
        err.status = 403;
        throw err;
      }

      next();
    } catch (err) {
      next(err);
    }
  };
}

export function requireTaskPermit(field) {
  return async (req, res, next) => {
    try {
      const taskId = String(req.params.taskId ?? "").trim();

      if (!taskId) {
        const err = new Error("Task id required");
        err.status = 400;
        throw err;
      }

      const [[task]] = await pool.query(
        `
                SELECT ${field} AS permit
                FROM tasks t
                JOIN applications a on a.app_id = t.app_id
                WHERE t.task_id = ?
                LIMIT 1
                `,
        [taskId],
      );

      if (!task) {
        const err = new Error("Task not found");
        err.status = 404;
        throw err;
      }

      const userRoles = req.user?.roles || [];

      if (!userRoles.includes(task.permit)) {
        const err = new Error("Forbidden");
        err.status = 403;
        throw err;
      }

      next();
    } catch (err) {
      next(err);
    }
  };
}
