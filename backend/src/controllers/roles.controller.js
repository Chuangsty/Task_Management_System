import { pool } from "../config/db.js";

export async function getRoles(req, res) {
  try {
    const [rows] = await pool.query(
      `
        SELECT id, slug, role_name
        FROM roles
        WHERE slug <> 'ADMIN'
        ORDER BY id    
        `,
    );

    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch roles" });
  }
}
