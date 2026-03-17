import { listAppsService, createAppsService, updateAppsService } from "../services/appDash.service.js";

export async function listAppsController(req, res) {
  try {
    const apps = await listAppsService();
    res.json(apps);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch applications" });
  }
}

export async function createAppsController(req, res, next) {
  try {
    const { app_name, app_startDate, app_endDate, app_description, permit_Open, permit_toDo, permit_Doing, permit_Done } = req.body;
    const apps = await createAppsService({ app_name, app_startDate, app_endDate, app_description, actorUserId: req.user.id, permit_Open, permit_toDo, permit_Doing, permit_Done });

    res.json(apps);
  } catch (err) {
    next(err);
  }
}

export async function updateAppsController(req, res, next) {
  try {
    const app_acronym = req.params.appAcronym;
    const { app_startDate, app_endDate, app_description, permit_Open, permit_toDo, permit_Doing, permit_Done } = req.body;
    const result = await updateAppsService({ app_acronym, app_startDate, app_endDate, app_description, actorUserId: req.user.id, permit_Open, permit_toDo, permit_Doing, permit_Done });

    res.json(result);
  } catch (err) {
    next(err);
  }
}
