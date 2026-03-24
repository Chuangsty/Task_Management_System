import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useOutletContext } from "react-router-dom";
import { Alert, Box, Button, Card, CardContent, Container, Dialog, DialogActions, DialogContent, DialogTitle, FormControl, IconButton, InputAdornment, InputLabel, MenuItem, Paper, Select, Snackbar, TextField, Typography } from "@mui/material";

import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import SearchIcon from "@mui/icons-material/Search";

import { api } from "../api/client";
import "./ApplicationDashboardPage.css";

export default function ApplicationsDashboardPage() {
  const nav = useNavigate();

  // using parent context, in this case, the roles
  const { roles } = useOutletContext();

  const [apps, setApps] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [errMsg, setErrMsg] = useState("");

  // dialog pop ups for creating and editing app
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState("create"); // "create" | "edit"
  const [selectedApp, setSelectedApp] = useState(null);

  // dialog for permission roles selection
  const [roleOptions, setRoleOptions] = useState([]);

  const [draft, setDraft] = useState({
    app_name: "",
    app_startDate: "",
    app_endDate: "",
    app_description: "",
    permit_Open: "",
    permit_toDo: "",
    permit_Doing: "",
    permit_Done: "",
  });

  const [submitting, setSubmitting] = useState(false);

  const [toast, setToast] = useState({
    open: false,
    severity: "success",
    msg: "",
  });

  useEffect(() => {
    loadApps();
    loadRoles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isProjectLead = roles.includes("PROJECT_LEAD");

  // Fucntion for add and edit app dialog popup
  function openCreateDialog() {
    setDialogMode("create");
    setSelectedApp(null);
    setDraft({
      app_name: "",
      app_startDate: "",
      app_endDate: "",
      app_description: "",
      permit_Open: "",
      permit_toDo: "",
      permit_Doing: "",
      permit_Done: "",
    });
    setDialogOpen(true);
  }

  function openEditDialog(app) {
    setDialogMode("edit");
    setSelectedApp(app);
    setDraft({
      app_name: app.app_name || "",
      app_startDate: app.app_startDate ? String(app.app_startDate).slice(0, 10) : "",
      app_endDate: app.app_endDate ? String(app.app_endDate).slice(0, 10) : "",
      app_description: app.app_description || "",
      permit_Open: app.permit_Open || "",
      permit_toDo: app.permit_toDo || "",
      permit_Doing: app.permit_Doing || "",
      permit_Done: app.permit_Done || "",
    });
    setDialogOpen(true);
  }

  function closeDialog() {
    if (submitting) return;
    setDialogOpen(false);
    setSelectedApp(null);
  }

  async function loadApps() {
    setErrMsg("");
    setLoading(true);

    try {
      const appsRes = await api.get("/api/apps");
      setApps(appsRes.data ?? []);
    } catch (err) {
      const code = err?.response?.status;
      if (code === 401) {
        nav("/login", { replace: true });
      } else {
        setErrMsg(err?.response?.data?.error || "Failed to load applications");
      }
    } finally {
      setLoading(false);
    }
  }

  async function loadRoles() {
    try {
      const res = await api.get("/api/roles");
      console.log("roles response:", res.data);
      setRoleOptions(res.data ?? []);
    } catch {
      console.error("Failed to load roles:");
      setRoleOptions([]);
    }
  }

  async function handleSubmitDialog() {
    try {
      setSubmitting(true);

      const payload =
        dialogMode === "create"
          ? {
              app_name: draft.app_name.trim(),
              app_startDate: draft.app_startDate,
              app_endDate: draft.app_endDate,
              app_description: draft.app_description.trim(),
              permit_Open: draft.permit_Open.trim(),
              permit_toDo: draft.permit_toDo.trim(),
              permit_Doing: draft.permit_Doing.trim(),
              permit_Done: draft.permit_Done.trim(),
            }
          : {
              app_startDate: draft.app_startDate,
              app_endDate: draft.app_endDate,
              app_description: draft.app_description.trim(),
              permit_Open: draft.permit_Open.trim(),
              permit_toDo: draft.permit_toDo.trim(),
              permit_Doing: draft.permit_Doing.trim(),
              permit_Done: draft.permit_Done.trim(),
            };

      if (dialogMode === "create") {
        await api.post("/api/apps", payload);
        setToast({ open: true, severity: "success", msg: "Application created" });
      } else {
        await api.patch(`/api/apps/${selectedApp.app_acronym}`, payload);
        setToast({ open: true, severity: "success", msg: "Application updated" });
      }

      closeDialog();
      await loadApps();
    } catch (err) {
      console.log(err?.response?.status, err?.response?.data);
      setToast({
        open: true,
        severity: "error",
        msg: err?.response?.data?.error || (dialogMode === "create" ? "Create failed" : "Update failed"),
      });
    } finally {
      setSubmitting(false);
    }
  }

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
        {/* mui error alert */}
        {/* {errMsg && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {errMsg}
          </Alert>
        )} */}

        {/* Top row: Search (left) + New App (right) */}
        <div className="appsTopRow">
          <TextField
            size="small"
            placeholder="Search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="appsSearch"
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon />
                  </InputAdornment>
                ),
              },
            }}
          />

          {isProjectLead ? (
            // On click add new application
            <Button variant="outlined" startIcon={<AddIcon />} onClick={openCreateDialog} className="appsNewAppBtn">
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
                    <Typography
                      className="appTitle"
                      // style={{ cursor: "pointer" }}
                      sx={{ cursor: "pointer" }}
                      onClick={() => nav(`/applications/${app.app_acronym}`, { state: { appName: app.app_name } })}
                    >
                      {app.app_name || "Untitled Application"}
                    </Typography>

                    {isProjectLead ? (
                      <IconButton className="appEditBtn" size="small" onClick={() => openEditDialog(app)}>
                        <EditIcon fontSize="small" />
                      </IconButton>
                    ) : null}
                  </div>

                  {/* Meta row */}
                  <div className="appMetaRow">
                    <span className="appMetaItem">Status: {app.state_name || "N/A"}</span>
                    <span className="appMetaSep">|</span>
                    <span className="appMetaItem">Project Lead: {app.project_lead || "N/A"}</span>
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

      <Dialog open={dialogOpen} onClose={closeDialog} fullWidth maxWidth="sm">
        <DialogTitle>{dialogMode === "create" ? "Create Application" : "Edit Application"}</DialogTitle>

        <DialogContent dividers>
          <TextField fullWidth margin="normal" label="Application Name *" value={draft.app_name} onChange={(e) => setDraft((p) => ({ ...p, app_name: e.target.value }))} disabled={dialogMode === "edit"} />

          <Box sx={{ display: "flex", gap: 2 }}>
            <TextField fullWidth margin="normal" label="Start Date *" type="date" value={draft.app_startDate} onChange={(e) => setDraft((p) => ({ ...p, app_startDate: e.target.value }))} slotProps={{ inputLabel: { shrink: true } }} />
            <TextField fullWidth margin="normal" label="End Date *" type="date" value={draft.app_endDate} onChange={(e) => setDraft((p) => ({ ...p, app_endDate: e.target.value }))} slotProps={{ inputLabel: { shrink: true } }} />
          </Box>

          <TextField fullWidth margin="normal" label="Description" multiline minRows={4} value={draft.app_description} onChange={(e) => setDraft((p) => ({ ...p, app_description: e.target.value }))} />

          <FormControl fullWidth margin="normal">
            <InputLabel>Permit Open *</InputLabel>
            <Select label="Permit Open" value={draft.permit_Open} onChange={(e) => setDraft((p) => ({ ...p, permit_Open: e.target.value }))}>
              {roleOptions.map((roles) => (
                <MenuItem key={roles.id || roles.slug} value={roles.slug}>
                  {roles.role_name || roles.slug}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl fullWidth margin="normal">
            <InputLabel>Permit To Do *</InputLabel>
            <Select label="Permit To Do" value={draft.permit_toDo} onChange={(e) => setDraft((p) => ({ ...p, permit_toDo: e.target.value }))}>
              {roleOptions.map((roles) => (
                <MenuItem key={roles.id || roles.slug} value={roles.slug}>
                  {roles.role_name || roles.slug}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl fullWidth margin="normal">
            <InputLabel>Permit Doing *</InputLabel>
            <Select label="Permit Doing" value={draft.permit_Doing} onChange={(e) => setDraft((p) => ({ ...p, permit_Doing: e.target.value }))}>
              {roleOptions.map((roles) => (
                <MenuItem key={roles.id || roles.slug} value={roles.slug}>
                  {roles.role_name || roles.slug}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl fullWidth margin="normal">
            <InputLabel>Permit Done *</InputLabel>
            <Select label="Permit Done" value={draft.permit_Done} onChange={(e) => setDraft((p) => ({ ...p, permit_Done: e.target.value }))}>
              {roleOptions.map((roles) => (
                <MenuItem key={roles.id || roles.slug} value={roles.slug}>
                  {roles.role_name || roles.slug}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </DialogContent>

        <DialogActions>
          <Button onClick={closeDialog} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmitDialog} variant="contained" disabled={submitting}>
            {dialogMode === "create" ? "Create" : "Update"}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={toast.open} autoHideDuration={3000} onClose={() => setToast((t) => ({ ...t, open: false }))} anchorOrigin={{ vertical: "bottom", horizontal: "center" }}>
        <Alert severity={toast.severity} variant="filled" onClose={() => setToast((t) => ({ ...t, open: false }))}>
          {toast.msg}
        </Alert>
      </Snackbar>
    </Container>
  );
}
