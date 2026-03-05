import * as appService from "../services/application.service.js";

export async function getApps(req, res) {
  try {
    const apps = await appService.getApps();
    res.json(apps);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch applications" });
  }
}
