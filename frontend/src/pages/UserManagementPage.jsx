import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Alert, Button, Checkbox, Chip, CircularProgress, Container, IconButton, InputAdornment, ListItemText, MenuItem, Paper, Select, Snackbar, Table, TableBody, TableCell, TableContainer, TableHead, TablePagination, TableRow, TextField, Typography } from "@mui/material";

import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import CheckRoundedIcon from "@mui/icons-material/CheckRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import PersonAddAltRoundedIcon from "@mui/icons-material/PersonAddAltRounded";

import { api } from "../api/client";
import "./UserManagementPage.css";

const ROLE_OPTIONS = [
  { slug: "ADMIN", name: "Admin" },
  { slug: "PROJECT_LEAD", name: "Project Lead" },
  { slug: "PROJECT_MANAGER", name: "Project Manager" },
  { slug: "DEVELOPER", name: "Developer" },
];
const roleNameBySlug = new Map(ROLE_OPTIONS.map((r) => [r.slug, r.name]));

const STATUS_OPTIONS = ["ACTIVE", "DISABLED"];

function StatusChip({ status }) {
  const isActive = String(status).toUpperCase() === "ACTIVE";
  return <Chip size="small" label={isActive ? "Active" : "Disabled"} className={isActive ? "statusChip statusChip--active" : "statusChip statusChip--disabled"} />;
}

export default function UserManagementPage() {
  const nav = useNavigate();

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errMsg, setErrMsg] = useState("");

  const [q, setQ] = useState("");
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  // onboarding row
  const [newUser, setNewUser] = useState({
    username: "",
    email: "",
    password: "",
    status: "ACTIVE",
    roles: [],
  });

  // edit row
  const [editingId, setEditingId] = useState(null);
  const [editDraft, setEditDraft] = useState({
    username: "",
    email: "",
    status: "ACTIVE",
    roles: [],
    newPassword: "",
  });

  const [toast, setToast] = useState({ open: false, severity: "success", msg: "" });

  // Allow admin to edit self data without touching status
  const [myId, setMyId] = useState(null);
  useEffect(() => {
    (async () => {
      try {
        const res = await api.get("/api/auth/me");
        setMyId(res.data?.user?.id ?? null);
      } catch {
        setMyId(null);
      }
    })();
  }, []);

  async function loadUsers() {
    setErrMsg("");
    setLoading(true);
    try {
      const res = await api.get("/api/admin");
      setUsers(res.data.users || []);
    } catch (err) {
      const code = err?.response?.status;
      if (code === 401 || code === 403) nav("/login");
      else setErrMsg(err?.response?.data?.error || "Failed to load users");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return users;
    return users.filter((u) => {
      const hay = `${u.username} ${u.email} ${u.status || ""} ${(u.roles || []).join(" ")}`.toLowerCase();
      return hay.includes(s);
    });
  }, [users, q]);

  const paged = useMemo(() => {
    const start = page * rowsPerPage;
    return filtered.slice(start, start + rowsPerPage);
  }, [filtered, page, rowsPerPage]);

  // Add user function
  async function addUser() {
    try {
      await api.post("/api/admin/new_user", {
        username: newUser.username,
        email: newUser.email,
        password: newUser.password,
        roles: newUser.roles,
      });
      setToast({ open: true, severity: "success", msg: "User created" });
      setNewUser({ username: "", email: "", password: "", status: "ACTIVE", roles: ["ADMIN"] });
      await loadUsers();
    } catch (err) {
      setToast({ open: true, severity: "error", msg: err?.response?.data?.error || "Create failed" });
    }
  }

  function startEdit(u) {
    setEditingId(u.id);
    setEditDraft({
      username: u.username || "",
      email: u.email || "",
      status: (u.status || "ACTIVE").toUpperCase(),
      roles: u.roles || [],
      newPassword: "",
    });
  }

  function cancelEdit() {
    setEditingId(null);
    setEditDraft({ username: "", email: "", status: "ACTIVE", roles: [], newPassword: "" });
  }

  async function saveEdit(id) {
    try {
      const isSelf = Number(id) === Number(myId);

      const payload = {
        username: editDraft.username,
        email: editDraft.email,
        ...(isSelf ? {} : { status: editDraft.status }), // Don't send status if self
        roles: editDraft.roles,
        newPassword: editDraft.newPassword ? editDraft.newPassword : undefined,
      };
      await api.patch(`/api/admin/user/${id}`, payload);

      setToast({ open: true, severity: "success", msg: "User updated" });
      cancelEdit();
      await loadUsers();
    } catch (err) {
      setToast({ open: true, severity: "error", msg: err?.response?.data?.error || "Update failed" });
    }
  }

  return (
    <Container maxWidth={false} disableGutters className="usersPageContainer">
      
      {/* Page Title */}
      <Typography variant="h5" fontWeight="bold" sx={{ mb: 3 }}>
        User Management Dashboard
      </Typography>

      <Paper className="usersCard">
        <div className="usersTopRow">
          <TextField
            size="small"
            placeholder="Search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="usersSearch"
            slotProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchRoundedIcon />
                </InputAdornment>
              ),
            }}
          />

          {loading ? (
            <div className="usersLoading">
              <CircularProgress size={18} />
              <Typography variant="body2">Loading…</Typography>
            </div>
          ) : null}
        </div>

        <TableContainer className="usersTableContainer">
          <Table size="small" className="usersTable">
            <TableHead>
              <TableRow className="usersHeaderRow">
                {["Name", "Email", "Password", "Status", "Role", "Actions", "Joined Date"].map((h) => (
                  <TableCell key={h} className="usersHeaderCell usersCell">
                    {h}
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>

            <TableBody>
              {/* Onboarding row */}
              <TableRow className="usersOnboardRow">
                <TableCell>
                  <TextField size="small" placeholder="Username" value={newUser.username} onChange={(e) => setNewUser((p) => ({ ...p, username: e.target.value }))} />
                </TableCell>
                <TableCell>
                  <TextField size="small" placeholder="Email" value={newUser.email} onChange={(e) => setNewUser((p) => ({ ...p, email: e.target.value }))} />
                </TableCell>
                <TableCell>
                  <TextField size="small" placeholder="Password" type="password" value={newUser.password} onChange={(e) => setNewUser((p) => ({ ...p, password: e.target.value }))} />
                </TableCell>
                <TableCell>
                  <StatusChip status="ACTIVE" />
                </TableCell>
                <TableCell className="usersCell">
                  <Select
                    size="small"
                    multiple
                    value={newUser.roles} // array of slugs
                    onChange={(e) => setNewUser((p) => ({ ...p, roles: e.target.value }))}
                    displayEmpty
                    renderValue={(selected) => (selected.length === 0 ? "Select role(s)" : selected.map((slug) => roleNameBySlug.get(slug) || slug).join(", "))}
                    className="usersSelect usersSelect--wide"
                  >
                    {ROLE_OPTIONS.map((r) => (
                      <MenuItem key={r.slug} value={r.slug}>
                        <Checkbox checked={newUser.roles.indexOf(r.slug) > -1} />
                        <ListItemText primary={r.name} />
                      </MenuItem>
                    ))}
                  </Select>
                </TableCell>
                <TableCell>
                  {/* Add user button */}
                  <Button variant="contained" size="small" startIcon={<PersonAddAltRoundedIcon />} onClick={addUser} className="usersAddBtn">
                    Add User
                  </Button>
                </TableCell>
                <TableCell />
              </TableRow>

              {/* Existing users */}
              {paged.map((u) => {
                const isEditing = editingId === u.id;

                return (
                  <TableRow key={u.id} hover>
                    <TableCell>{isEditing ? <TextField size="small" value={editDraft.username} onChange={(e) => setEditDraft((p) => ({ ...p, username: e.target.value }))} /> : u.username}</TableCell>

                    <TableCell>{isEditing ? <TextField size="small" value={editDraft.email} onChange={(e) => setEditDraft((p) => ({ ...p, email: e.target.value }))} /> : u.email}</TableCell>

                    <TableCell>{isEditing ? <TextField size="small" type="password" placeholder="New password (optional)" value={editDraft.newPassword} onChange={(e) => setEditDraft((p) => ({ ...p, newPassword: e.target.value }))} /> : "********"}</TableCell>

                    <TableCell>
                      {isEditing ? (
                        <Select
                          size="small"
                          value={editDraft.status}
                          disabled={Number(u.id) === Number(myId)} // ✅ can't change self
                          onChange={(e) => setEditDraft((p) => ({ ...p, status: e.target.value }))}
                          className="usersSelect"
                        >
                          {STATUS_OPTIONS.map((s) => (
                            <MenuItem key={s} value={s}>
                              {s === "ACTIVE" ? "Active" : "Disable"}
                            </MenuItem>
                          ))}
                        </Select>
                      ) : (
                        <StatusChip status={u.status} />
                      )}
                    </TableCell>

                    <TableCell className="usersCell">
                      {isEditing ? (
                        <Select
                          size="small"
                          multiple
                          value={editDraft.roles} // array of slugs
                          onChange={(e) => setEditDraft((p) => ({ ...p, roles: e.target.value }))}
                          renderValue={(selected) => selected.map((slug) => roleNameBySlug.get(slug) || slug).join(", ")}
                          className="usersSelect usersSelect--wide"
                        >
                          {ROLE_OPTIONS.map((r) => (
                            <MenuItem key={r.slug} value={r.slug}>
                              <Checkbox checked={editDraft.roles.includes(r.slug)} />
                              <ListItemText primary={r.name} />
                            </MenuItem>
                          ))}
                        </Select>
                      ) : (
                        (u.roles || []).map((slug) => ROLE_OPTIONS.find((r) => r.slug === slug)?.name).join(", ")
                      )}
                    </TableCell>

                    <TableCell>
                      {isEditing ? (
                        <>
                          <IconButton onClick={() => saveEdit(u.id)} size="small">
                            <CheckRoundedIcon />
                          </IconButton>
                          <IconButton onClick={cancelEdit} size="small">
                            <CloseRoundedIcon />
                          </IconButton>
                        </>
                      ) : (
                        <IconButton onClick={() => startEdit(u)} size="small">
                          <EditOutlinedIcon />
                        </IconButton>
                      )}
                    </TableCell>

                    <TableCell>{u.created_at ? new Date(u.created_at).toLocaleDateString() : ""}</TableCell>
                  </TableRow>
                );
              })}

              {!loading && filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} align="center" style={{ padding: "28px" }}>
                    No users found
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </TableContainer>

        <TablePagination
          component="div"
          count={filtered.length}
          page={page}
          onPageChange={(_, p) => setPage(p)}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={(e) => {
            setRowsPerPage(parseInt(e.target.value, 10));
            setPage(0);
          }}
          rowsPerPageOptions={[5, 10, 25]}
        />
      </Paper>

      <Snackbar open={toast.open} autoHideDuration={3000} onClose={() => setToast((t) => ({ ...t, open: false }))} anchorOrigin={{ vertical: "bottom", horizontal: "center" }}>
        <Alert severity={toast.severity} variant="filled" onClose={() => setToast((t) => ({ ...t, open: false }))}>
          {toast.msg}
        </Alert>
      </Snackbar>
    </Container>
  );
}
