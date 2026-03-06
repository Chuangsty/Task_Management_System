// useState -> store component state
// useEffect -> run logic after component loads
import React, { useEffect, useState } from "react";
// Navigate -> used to redirect users
// Outlet -> tells React Router to render the child route here
// useLocation -> gets the current URL location
import { Navigate, Outlet, useLocation } from "react-router-dom";
// Used to show a loading spinner while authentication is being checked
import { Box, CircularProgress } from "@mui/material";
// Axios instance to call GET /api/auth/me to return logged in user
import { api } from "../api/client";

export default function ProtectedRoute({ roles = [] }) {
  // receive required roles
  const location = useLocation(); // Store page url visited while logged out, redirect back when logged in
  const [loading, setLoading] = useState(true); // true -> checking auth, false -> done
  const [me, setMe] = useState(null); // stores logged in user, null -> not logged in

  // run once when component loads
  useEffect(() => {
    let ignore = false; // prevent React err if component unmounts before API finishes

    // auth check if user logged in
    async function checkAuth() {
      try {
        const res = await api.get("/api/auth/me");
        if (!ignore) setMe(res.data?.user ?? null); // save user to state
      } catch {
        if (!ignore) setMe(null); // set user to null
      } finally {
        if (!ignore) setLoading(false); // auth check finished
      }
    }
    checkAuth();

    // ignore result if component unmounts before API returns
    // effectively "kill" any pending updates from the checkAuth function.
    return () => {
      ignore = true;
    };
  }, []);

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
