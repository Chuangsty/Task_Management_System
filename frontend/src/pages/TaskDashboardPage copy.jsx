import React, { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate, useLocation, useOutletContext } from "react-router-dom";
import { Alert, Button, Container, InputAdornment, Paper, TextField, Typography, CircularProgress, Snackbar } from "@mui/material";

import SearchIcon from "@mui/icons-material/Search";

import { api } from "../api/client";
import "./TaskDashboardPage.css";

const COLUMN_ORDER = ["OPEN", "TODO", "DOING", "DONE", "CLOSED"];

const COLUMN_LABELS = {
  OPEN: "OPEN",
  TODO: "TO DO",
  DOING: "DOING",
  DONE: "DONE",
  CLOSED: "CLOSED",
};

function formatTakenOn(value) {
  if (!value) return "-";
  return String(value).slice(0, 10);
}

function getPlanDisplay(task) {
  if (task.plan_name && String(task.plan_name).trim() !== "") {
    return task.plan_name;
  }
  return "-";
}

function getDeveloperDisplay(task) {
  if (task.developer_username && String(task.developer_username).trim() !== "") {
    return task.developer_username;
  }
  return "-";
}

function TaskCard({ task }) {
  return (
    <div className="taskCard">
      <Typography className="taskCard__id">{task.task_id}</Typography>

      <Typography className="taskCard__name">{task.task_name || "-"}</Typography>

      <Typography className="taskCard__meta">Plan: {getPlanDisplay(task)}</Typography>

      <Typography className="taskCard__meta">Dev: {getDeveloperDisplay(task)}</Typography>

      <Typography className="taskCard__meta">Taken on: {formatTakenOn(task.task_taken_at)}</Typography>
    </div>
  );
}

function TaskColumn({ slug, tasks, canCreateTask, onCreateTask }) {
  return (
    <div className="taskColumn">
      <div className="taskColumn__header">
        {COLUMN_LABELS[slug]} [{tasks.length}]
      </div>

      <div className="taskColumn__body">
        {slug === "OPEN" && canCreateTask ? (
          <Button variant="outlined" size="small" className="taskColumn__newBtn" onClick={onCreateTask}>
            + New Task
          </Button>
        ) : null}

        {tasks.length === 0 ? <div className="taskColumn__empty" /> : tasks.map((task) => <TaskCard key={task.task_id} task={task} />)}
      </div>
    </div>
  );
}

export default function TaskDashboardPage() {
  const { appAcronym } = useParams();
  const nav = useNavigate();
  const location = useLocation();
  const { roles } = useOutletContext();

  const appName = location.state?.appName || appAcronym || "";

  const [tasks, setTasks] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [errMsg, setErrMsg] = useState("");
  const [toast, setToast] = useState({
    open: false,
    severity: "success",
    msg: "",
  });

  const canManagePlan = roles.includes("PROJECT_MANAGER") || roles.includes("PROJECT_LEAD");
  const canCreateTask = roles.includes("PROJECT_LEAD");

  async function loadTasks() {
    setErrMsg("");
    setLoading(true);

    try {
      const res = await api.get(`/api/apps/${appAcronym}/tasks`);
      setTasks(res.data ?? []);
    } catch (err) {
      const code = err?.response?.status;
      if (code === 401) {
        nav("/login", { replace: true });
      } else if (code === 403) {
        setErrMsg("You do not have permission to view this task dashboard");
      } else if (code === 404) {
        setErrMsg("Application not found");
      } else {
        setErrMsg(err?.response?.data?.error || "Failed to load tasks");
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadTasks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appAcronym]);

  const filteredTasks = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return tasks;

    return tasks.filter((task) => {
      const hay = `
        ${task.task_id || ""}
        ${task.task_name || ""}
        ${task.task_description || ""}
        ${task.task_note || ""}
        ${task.plan_name || ""}
        ${task.developer_username || ""}
        ${task.creator_username || ""}
        ${task.task_state || ""}
      `.toLowerCase();

      return hay.includes(s);
    });
  }, [tasks, search]);

  const groupedTasks = useMemo(() => {
    const grouped = {
      OPEN: [],
      TODO: [],
      DOING: [],
      DONE: [],
      CLOSED: [],
    };

    for (const task of filteredTasks) {
      const stateSlug = String(task.task_state || "")
        .trim()
        .toUpperCase()
        .replace(/\s+/g, "");

      if (grouped[stateSlug]) {
        grouped[stateSlug].push(task);
      }
    }

    return grouped;
  }, [filteredTasks]);

  function handleManagePlan() {
    setToast({
      open: true,
      severity: "info",
      msg: "Manage Plan page/dialog not connected yet",
    });
  }

  function handleCreateTask() {
    setToast({
      open: true,
      severity: "info",
      msg: "New Task dialog not connected yet",
    });
  }

  return (
    <Container maxWidth={false} disableGutters className="taskPageContainer">
      <Paper className="taskPageCard">
        <div className="taskPageHeader">
          <Typography variant="h4" className="taskPageTitle">
            Task Manager Dashboard: <span className="taskPageTitle__app">{appName}</span>
          </Typography>
        </div>

        {errMsg ? (
          <Alert severity="error" sx={{ mb: 2 }}>
            {errMsg}
          </Alert>
        ) : null}

        <div className="taskPageTopRow">
          <TextField
            size="small"
            placeholder="Task"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="taskPageSearch"
            slotProps={{
              input: {
                endAdornment: (
                  <InputAdornment position="end">
                    <SearchIcon fontSize="small" />
                  </InputAdornment>
                ),
              },
            }}
          />

          {canManagePlan ? (
            <Button variant="outlined" className="taskPageManagePlanBtn" onClick={handleManagePlan}>
              Manage Plan
            </Button>
          ) : (
            <div className="taskPageManagePlanPlaceholder" />
          )}
        </div>

        {loading ? (
          <div className="taskPageLoading">
            <CircularProgress size={22} />
            <Typography variant="body2">Loading tasks...</Typography>
          </div>
        ) : (
          <div className="taskBoard">
            {COLUMN_ORDER.map((slug) => (
              <TaskColumn key={slug} slug={slug} tasks={groupedTasks[slug] || []} canCreateTask={slug === "OPEN" && canCreateTask} onCreateTask={handleCreateTask} />
            ))}
          </div>
        )}
      </Paper>

      <Snackbar open={toast.open} autoHideDuration={2500} onClose={() => setToast((t) => ({ ...t, open: false }))} anchorOrigin={{ vertical: "bottom", horizontal: "center" }}>
        <Alert severity={toast.severity} variant="filled" onClose={() => setToast((t) => ({ ...t, open: false }))}>
          {toast.msg}
        </Alert>
      </Snackbar>
    </Container>
  );
}
