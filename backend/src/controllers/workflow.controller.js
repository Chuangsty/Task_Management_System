import { takeTaskService, forfeitTaskService, promoteTask2DoneService, rejectTaskService, approveTaskService, updateTaskNoteService, releaseTaskService } from "../services/workflow.service.js";

export async function takeTaskController(req, res, next) {
  try {
    const task_id = req.params.taskId;
    const tasks = await takeTaskService({ task_id, actorUserId: req.user.id });

    res.json(tasks);
  } catch (err) {
    next(err);
  }
}

export async function forfeitTaskController(req, res, next) {
  try {
    const task_id = req.params.taskId;
    const tasks = await forfeitTaskService({ task_id, actorUserId: req.user.id });

    res.json(tasks);
  } catch (err) {
    next(err);
  }
}

export async function promoteTask2DoneController(req, res, next) {
  console.log("running 1");
  try {
    const task_id = req.params.taskId;
    const tasks = await promoteTask2DoneService({ task_id, actorUserId: req.user.id });
    console.log("running 2");

    res.json(tasks);
    console.log("running 3");
  } catch (err) {
    next(err);
  }
}

export async function rejectTaskController(req, res, next) {
  try {
    const task_id = req.params.taskId;
    const tasks = await rejectTaskService({ task_id, actorUserId: req.user.id });

    res.json(tasks);
  } catch (err) {
    next(err);
  }
}

export async function approveTaskController(req, res, next) {
  try {
    const task_id = req.params.taskId;
    const tasks = await approveTaskService({ task_id, actorUserId: req.user.id });

    res.json(tasks);
  } catch (err) {
    next(err);
  }
}

export async function updateTaskNoteController(req, res, next) {
  try {
    const task_id = req.params.taskId;
    const { note } = req.body;

    const result = await updateTaskNoteService({
      task_id,
      note,
      actorUserId: req.user.id,
    });

    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function releaseTaskController(req, res, next) {
  try {
    const task_id = req.params.taskId;
    const tasks = await releaseTaskService({ task_id, actorUserId: req.user.id });

    res.json(tasks);
  } catch (err) {
    next(err);
  }
}
