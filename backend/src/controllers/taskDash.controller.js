import { listTasksService, createTaskService, updateTaskService } from "../services/taskDash.service.js";

export async function listTasksController(req, res, next) {
  try {
    const app_Id = Number(req.params.appId);
    const tasks = await listTasksService(app_Id);

    res.json(tasks);
  } catch (err) {
    next(err);
  }
}

export async function createTaskController(req, res, next) {
  try {
    const app_id = Number(req.params.appId);
    const { task_name, task_description } = req.body;

    const result = await createTaskService({
      app_id,
      task_name,
      task_description,
      actorUserId: req.user.id,
    });

    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
}

export async function updateTaskController(req, res, next) {
  try {
    const task_id = req.params.taskId;
    const { task_description } = req.body;

    const result = await updateTaskService({
      task_id,
      task_description,
      actorUserId: req.user.id,
    });

    res.json(result);
  } catch (err) {
    next(err);
  }
}
