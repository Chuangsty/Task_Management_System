import { pool } from "../config/db";

export async function getApps() {
  const [rows] = await pool.query("SELECT * FROM applications");
  return rows;
}

export async function projectLeadcreateAppService(name, startDate, endDate, description) {
  
}