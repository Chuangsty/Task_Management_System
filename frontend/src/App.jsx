import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { CssBaseline, ThemeProvider, createTheme } from "@mui/material";

import LoginPage from "./pages/LoginPage.jsx";
// import AppShell from "./components/AppShell";
// import MainMenuPage from "./pages/MainMenuPage";
// import UserManagementPage from "./pages/UserManagementPage";

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

        {/* <Route path="/app" element={<AppShell />}>
          <Route index element={<MainMenuPage />} />
          <Route path="users" element={<UserManagementPage />} />
        </Route>

        <Route path="*" element={<Navigate to="/login" replace />} /> */}
      </Routes>
    </ThemeProvider>
  );
}
