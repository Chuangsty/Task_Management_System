import { listTasksService, createTaskService, updateTaskService, createPlanService } from "../services/taskDash.service.js";

// START of task controller ==========================================
export async function listTasksController(req, res, next) {
  try {
    const app_acronym = req.params.appAcronym;
    const result = await listTasksService(app_acronym);

    res.json(result);
  } catch (err) {
    next(err);
  }
}
export async function createTaskController(req, res, next) {
  try {
    const app_acronym = req.params.appAcronym;
    const { task_name, task_description, plan_name } = req.body;

    const result = await createTaskService({
      app_acronym,
      task_name,
      task_description,
      plan_name,
      actorUserId: req.user.id,
    });

    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
}
export async function updateTaskController(req, res, next) {
  try {
    const app_acronym = req.params.appAcronym;
    const task_id = req.params.taskId;
    const { plan_name } = req.body;

    const result = await updateTaskService({
      app_acronym,
      task_id,
      plan_name,
      actorUserId: req.user.id,
    });

    res.json(result);
  } catch (err) {
    next(err);
  }
}
// END of task controller ============================================

// START of plan controller ==========================================
export async function createPlanController(req, res, next) {
  try {
    const app_acronym = req.params.appAcronym;
    const { plan_name, plan_startDate, plan_endDate, task_ids } = req.body;

    const result = await createPlanService({
      app_acronym,
      plan_name,
      plan_startDate,
      plan_endDate,
      task_ids,
      actorUserId: req.user.id,
    });

    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
}
// END of plan controller ============================================
