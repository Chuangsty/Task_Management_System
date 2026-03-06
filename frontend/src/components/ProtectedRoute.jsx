// useState -> store component state
// useEffect -> run logic after component loads
import React, { useEffect, useState } from "react";
// Navigate -> used to redirect users
// Outlet -> tells React Router to render the child route here
// useLocation -> gets the current URL location
import { Navigate, Outlet, useLocation, useNavigate } from "react-router-dom";
// Used to show a loading spinner while authentication is being checked
import { Box, CircularProgress } from "@mui/material";
// Axios instance to call GET /api/auth/me to return logged in user
import { api } from "../api/client";

export default function ProtectedRoute({ roles = [] }) {
  // receive required roles
  const location = useLocation(); // Store page url visited while logged out, redirect back when logged in
  const nav = useNavigate();

  const [loading, setLoading] = useState(true); // true -> checking auth, false -> done
  const [me, setMe] = useState(null); // stores logged in user, null -> not logged in

  // run once when component loads
  useEffect(() => {
    let ignore = false; // prevent React err if component unmounts before API finishes
    let intervalId;

    // auth check if user logged in
    async function checkAuth(showLoader = false) {
      if (showLoader && !ignore) setLoading(true);

      try {
        const res = await api.get("/api/auth/me");
        if (!ignore) setMe(res.data?.user ?? null); // save user to state
      } catch {
        if (!ignore) setMe(null); // set user to null
        nav("/login", { replace: true, state: { from: location } });
      } finally {
        if (!ignore) setLoading(false); // auth check finished
      }
    }
    // first check on mount
    checkAuth(true);

    // re-check every 30 seconds
    intervalId = window.setInterval(() => {
      checkAuth(false);
    }, 30000);

    // re-check when user comes back to this tab
    function handleFocus() {
      checkAuth(false);
    }

    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") {
        checkAuth(false);
      }
    });

    // ignore result if component unmounts before API returns
    // effectively "kill" any pending updates from the checkAuth function.
    return () => {
      ignore = true;
      if (intervalId) clearInterval(intervalId);
      window.removeEventListener("focus", handleFocus);
    };
  }, [nav, location]);

  // loading spinner -> prevents the protected page from rendering early
  if (loading) {
    return (
      <Box sx={{ minHeight: "100vh", display: "grid", placeItems: "center" }}>
        <CircularProgress />
      </Box>
    );
  }

  // redirect to login if user not logged in
  if (!me) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  const userRoles = me.roles || []; // extract user roles
  const roleAllowed = roles.length === 0 || roles.some((role) => userRoles.includes(role));

  // redirect if role not allowed
  if (!roleAllowed) {
    return <Navigate to="/applications" replace />;
  }

  // outlet -> renders the nested page
  // context -> lets child components access the user
  return <Outlet context={{ me, roles: userRoles }} />;
}
