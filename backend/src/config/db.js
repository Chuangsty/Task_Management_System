import mysql from "mysql2/promise"; // for async-await
// import dotenv, { config } from "dotenv";

// dotenv.config();

export const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  timezone: "+08:00",
  dateStrings: ["DATE", "DATETIME", "TIMESTAMP"],
  waitForConnections: true,
  connectionLimit: 10,
});
