import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Alert,
  Button,
  Card,
  CardContent,
  Container,
  IconButton,
  InputAdornment,
  Paper,
  TextField,
  Typography,
} from "@mui/material";

import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import SearchIcon from "@mui/icons-material/Search";

import { api } from "../api/client";
import "./ApplicationDashboardPage.css";

export default function ApplicationsDashboardPage() {
  const nav = useNavigate();

  const [apps, setApps] = useState([]);
  const [search, setSearch] = useState("");
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errMsg, setErrMsg] = useState("");

  useEffect(() => {
    let ignore = false;

    async function loadData() {
      setErrMsg("");
      setLoading(true);

      try {
        const me = await api.get("/api/auth/me");
        if (!ignore) setRoles(me.data?.user?.roles ?? []);

        const appsRes = await api.get("/api/apps");
        if (!ignore) setApps(appsRes.data ?? []);
      } catch (err) {
        const code = err?.response?.status;
        if (code === 401 || code === 403) nav("/login");
        else setErrMsg(err?.response?.data?.error || "Failed to load applications");
      } finally {
        if (!ignore) setLoading(false);
      }
    }

    loadData();

    return () => {
      ignore = true;
    };
  }, [nav]);

  const isProjectLead = roles.includes("PROJECT_LEAD");

  const filteredApps = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return apps;
    return apps.filter((a) => {
      const hay = `${a.app_name || ""} ${a.app_acronym || ""} ${a.app_description || ""}`.toLowerCase();
      return hay.includes(s);
    });
  }, [apps, search]);

  function formatDate(d) {
    if (!d) return "N/A";
    // If backend returns "YYYY-MM-DD", keep it. If it's a date string, also ok.
    return String(d).slice(0, 10);
  }

  return (
    <Container maxWidth={false} disableGutters className="appsPageContainer">
      {/* Page Title */}
      <Typography variant="h5" fontWeight="bold" sx={{ mb: 3 }}>
        Applications Dashboard
      </Typography>

      <Paper className="appsCard">
        {/* Top row: Search (left) + New App (right) */}
        <div className="appsTopRow">
          <TextField
            size="small"
            placeholder="Application"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="appsSearch"
            slotProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              ),
            }}
          />

          {isProjectLead ? (
            <Button variant="outlined" startIcon={<AddIcon />} className="appsNewAppBtn">
              New App
            </Button>
          ) : (
            // keeps alignment consistent when button is hidden
            <div className="appsNewAppBtnPlaceholder" />
          )}
        </div>

        {/* List */}
        <div className="appsList">
          {loading ? (
            <div className="appsEmpty">Loading…</div>
          ) : filteredApps.length === 0 ? (
            <div className="appsEmpty">No applications found</div>
          ) : (
            filteredApps.map((app) => (
              <Card key={app.app_acronym || app.app_id} className="appItem" elevation={0}>
                <CardContent>
                  {/* Title row + edit icon */}
                  <div className="appItemTop">
                    <Typography className="appTitle">{app.app_name || "Untitled Application"}</Typography>

                    {isProjectLead ? (
                      <IconButton className="appEditBtn" size="small">
                        <EditIcon fontSize="small" />
                      </IconButton>
                    ) : null}
                  </div>

                  {/* Meta row */}
                  <div className="appMetaRow">
                    <span className="appMetaItem">Status: {app.state_name || "N/A"}</span>
                    <span className="appMetaSep">|</span>
                    <span className="appMetaItem">Project Lead: {app.project_lead_name || "N/A"}</span>
                    <span className="appMetaSep">|</span>
                    <span className="appMetaItem">Start date: {formatDate(app.app_startDate)}</span>
                    <span className="appMetaSep">|</span>
                    <span className="appMetaItem">End date: {formatDate(app.app_endDate)}</span>
                  </div>

                  {/* Description box */}
                  <div className="appDescBox">{app.app_description || "—"}</div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </Paper>
    </Container>
  );
}