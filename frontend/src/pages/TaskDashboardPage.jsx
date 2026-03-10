// import React, { useEffect, useState } from "react";
// import { useParams, useNavigate, useLocation } from "react-router-dom";
// // import { useParams, useNavigate, useOutletContext } from "react-router-dom";
// import { Container, Typography, Paper, Alert } from "@mui/material";

// import { api } from "../api/client";

// export default function TaskDashboardPage() {
//   const { appAcronym } = useParams(); // from URL
//   const nav = useNavigate();
//   //   const { roles } = useOutletContext();

//   const location = useLocation();
//   const appName = location.state?.appName || "";

//   const [tasks, setTasks] = useState([]);
//   const [loading, setLoading] = useState(true);
//   const [errMsg, setErrMsg] = useState("");
//   useEffect(() => {
//     loadTasks();
//     // eslint-disable-next-line react-hooks/exhaustive-deps
//   }, [appAcronym]);

//   async function loadTasks() {
//     setErrMsg("");
//     setLoading(true);

//     try {
//       // backend route you will create later
//       const res = await api.get(`/api/tasks/${appAcronym}`);
//       setTasks(res.data ?? []);
//     } catch (err) {
//       const code = err?.response?.status;

//       if (code === 401) nav("/login", { replace: true });
//       else setErrMsg(err?.response?.data?.error || "Failed to load tasks");
//     } finally {
//       setLoading(false);
//     }
//   }

//   return (
//     <Container maxWidth={false} disableGutters style={{ padding: "24px 40px" }}>
//       {/* Page Title */}
//       <Typography variant="h5" fontWeight="bold" sx={{ mb: 3 }}>
//         Task Management Dashboard: {appName || appAcronym}
//       </Typography>

//       <Paper sx={{ padding: 2, borderRadius: 3 }}>
//         {errMsg && (
//           <Alert severity="error" sx={{ mb: 2 }}>
//             {errMsg}
//           </Alert>
//         )}

//         {loading ? <Typography>Loading tasks...</Typography> : tasks.length === 0 ? <Typography>No tasks yet.</Typography> : <Typography>Tasks will appear here.</Typography>}
//       </Paper>
//     </Container>
//   );
// }
