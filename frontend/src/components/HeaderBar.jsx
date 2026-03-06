import React, { useState } from "react";
/* useOutletContext is a React Router hook used to pass data from a 
parent route component to its child routes without using props manually. 
e.g. lets ProtectedRoute → HeaderBar → Pages share the logged-in 
user data (me, roles) without calling /api/auth/me again.
*/
import { Outlet, useNavigate, useOutletContext } from "react-router-dom";
import { AppBar, Toolbar, Typography, Avatar, Menu, MenuItem, IconButton, Box } from "@mui/material";
import { api } from "../api/client";
import "./HeaderBar.css";

export default function HeaderBar() {
  const nav = useNavigate();

  const { me, roles } = useOutletContext();

  const [anchorEl, setAnchorEl] = useState(null);
  const open = Boolean(anchorEl);

  const userName = me?.username || "User";
  const isAdmin = roles.includes("ADMIN");

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
              {/* IF ADMIN: Button to navigate to user management page */}
              {isAdmin && (
                <MenuItem
                  onClick={async () => {
                    setAnchorEl(null);
                    nav("/users");
                  }}
                >
                  User Management
                </MenuItem>
              )}

              {/* Button to navigate to application page */}
              <MenuItem
                onClick={async () => {
                  setAnchorEl(null);
                  nav("/applications");
                }}
              >
                Applications
              </MenuItem>

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
        <Outlet context={{ me, roles }} />
      </main>
    </div>
  );
}
