import React, { useEffect, useState } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import { AppBar, Toolbar, Typography, Avatar, Menu, MenuItem, IconButton, Box } from "@mui/material";
import { api } from "../api/client";
import "./HeaderBar.css";

export default function HeaderBar() {
  const nav = useNavigate();

  const [me, setMe] = useState(null);
  const [anchorEl, setAnchorEl] = useState(null);
  const open = Boolean(anchorEl);

  // Displaying username beside welcome
  useEffect(() => {
    let ignore = false;

    async function loadMe() {
      try {
        const res = await api.get("/api/auth/me");
        if (!ignore) setMe(res.data.user);
      } catch (err) {
        // If cookie invalid/expired, go back login
        const code = err?.response?.status;
        if (code === 401 || code === 403) nav("/login");
      }
    }
    loadMe();
    return () => {
      ignore = true;
    };
  }, [nav]);

  const userName = me?.username || "User";

  async function handleLogout() {
    try {
      await api.post("/api/auth/logout");
    } finally {
      nav("/login");
    }
  }

  return (
    <div className="headerBar">
      <AppBar position="static" className="headerBar__bar">
        <Toolbar className="headerBar__toolbar">
          <Typography className="headerBar__title">Task Management System</Typography>

          <Box className="headerBar__right">
            <Typography className="headerBar__welcome">Welcome back: {userName}</Typography>

            <IconButton onClick={(e) => setAnchorEl(e.currentTarget)} size="small">
              <Avatar className="headerBar__avatar">{userName?.[0]?.toUpperCase() || "U"}</Avatar>
            </IconButton>

            <Menu anchorEl={anchorEl} open={open} onClose={() => setAnchorEl(null)} anchorOrigin={{ vertical: "bottom", horizontal: "right" }} transformOrigin={{ vertical: "top", horizontal: "right" }}>
              <MenuItem
                onClick={async () => {
                  setAnchorEl(null);
                  await handleLogout();
                }}
              >
                Logout
              </MenuItem>
            </Menu>
          </Box>
        </Toolbar>
      </AppBar>

      <main className="headerBar__content">
        <Outlet />
      </main>
    </div>
  );
}
