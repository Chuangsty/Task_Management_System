import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { CssBaseline, ThemeProvider, createTheme } from "@mui/material";

import LoginPage from "./pages/LoginPage.jsx";
import HeaderBar from "./components/HeaderBar";
import ProtectedRoute from "./components/ProtectedRoute.jsx";
import UserManagementPage from "./pages/UserManagementPage.jsx";
import ApplicationsDashboardPage from "./pages/ApplicationDashboardPage.jsx";
import TaskDashboardPage from "./pages/TaskDashboardPage.jsx";

const theme = createTheme({
  typography: { fontFamily: "Inter, system-ui, Arial, sans-serif" },
});

export default function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<LoginPage />} />

        {/* Admin's view page of project management */}
        <Route element={<ProtectedRoute roles={["ADMIN"]} />}>
          <Route element={<HeaderBar />}>
            <Route path="/users" index element={<UserManagementPage />} />
          </Route>
        </Route>

        {/* Non-Admin's view page of user management */}
        <Route element={<ProtectedRoute />}>
          <Route element={<HeaderBar />}>
            <Route path="/applications" index element={<ApplicationsDashboardPage />} />
            <Route path="/applications/:appAcronym" index element={<TaskDashboardPage />} />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </ThemeProvider>
  );
}
