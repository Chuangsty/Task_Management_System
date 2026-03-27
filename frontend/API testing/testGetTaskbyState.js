import axios from "axios";

const api = axios.create({
  baseURL: "http://localhost:3000",
  headers: { "Content-Type": "application/json" },
  validateStatus: () => true,
});

async function testGetTaskbyState() {
  try {
    // 1) Login first to get the JWT cookie
    const loginRes = await api.post("/api/auth/login", {
      email: "teochuangming3@gmail.com",
      password: "Qwer1234!",
    });
    // 2) Set cookie
    const setCookie = loginRes.headers["set-cookie"];
    if (!setCookie || !setCookie.length) {
      console.log("Login failed or no auth cookie returned:");
      console.log(loginRes.data);
      return;
    }
    // 3) Reuse that cookie for GetTaskbyState
    const cookieHeader = setCookie.map((c) => c.split(";")[0]).join("; ");
    // 4) Creating response with details
    const getRes = await api.get("/api/apps/BP/tasks/GetTaskbyState/DOING", {
      headers: {
        Cookie: cookieHeader,
      },
    });
    console.log("Status:", getRes.status);
    console.log("Response:", getRes.data);
  } catch (err) {
    console.error("Request failed:", err.message);
  }
}
testGetTaskbyState();
