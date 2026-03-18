import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useOutletContext, useParams } from "react-router-dom";
import { Alert, Button, CircularProgress, Container, InputAdornment, Paper, TextField, Typography } from "@mui/material";

import SearchIcon from "@mui/icons-material/Search";

import { api } from "../api/client";
import "./TaskDashboardPage.css";

// function formatTakenDate(value) {
//   if (!value) return "-";
//   return String(value).slice(0, 10);
// }

function TaskCard({ task }) {
  return (
    <div className="taskCard">
      <div className="taskCard__id">{task.task_id}</div>

      <div className="taskCard__line">Task: {task.task_name || "-"}</div>
      {/* <div className="taskCard__line">Plan: {task.plan_name || "-"}</div> */}
      <div className="taskCard__line">Dev: {task.developer_username || "-"}</div>
      {/* <div className="taskCard__line">Taken on: {formatTakenDate(task.task_taken_at)}</div> */}
    </div>
  );
}

export default function TaskDashboardPage() {
  const { appAcronym } = useParams();
  const nav = useNavigate();
  const location = useLocation();

  const { roles } = useOutletContext();

  const [tasks, setTasks] = useState([]);
  const [taskStates, setTaskStates] = useState([]);
  const [appInfo, setAppInfo] = useState(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [errMsg, setErrMsg] = useState("");

  const boardColumns = useMemo(() => {
    return taskStates.map((state) => ({
      key: state.task_state_name,
      title: String(state.task_state_name || "").toUpperCase(),
      slug: state.slug,
      id: state.id,
    }));
  }, [taskStates]);

  const isProjectManager = roles.includes("PROJECT_MANAGER");

  async function loadTasks() {
    setErrMsg("");
    setLoading(true);

    try {
      const res = await api.get(`/api/apps/${appAcronym}/tasks`);
      console.log("res.data =", res.data);
      console.log("res.data.taskStates =", res.data?.taskStates);

      setTasks(Array.isArray(res.data?.tasks) ? res.data.tasks : []);
      setTaskStates(Array.isArray(res.data?.taskStates) ? res.data.taskStates : []);
      setAppInfo(res.data?.app || null);
    } catch (err) {
      const code = err?.response?.status;

      if (code === 401) {
        nav("/login", { replace: true });
      } else if (code === 403) {
        nav("/applications", { replace: true });
      } else {
        setErrMsg(err?.response?.data?.error || "Failed to load tasks");
      }
    } finally {
      setLoading(false);
    }
  }

  const displayAppName = location.state?.appName || appInfo?.app_name || appAcronym || "Application";

  useEffect(() => {
    if (!appAcronym) return;
    loadTasks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appAcronym]);

  const filteredTasks = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return tasks;

    return tasks.filter((task) => {
      const hay = `${task.task_id || ""} ${task.task_name || ""} ${task.plan_name || ""} ${task.developer_username || ""} ${task.creator_username || ""} ${task.task_description || ""}`.toLowerCase();

      return hay.includes(s);
    });
  }, [tasks, search]);

  const groupedTasks = useMemo(() => {
    const grouped = {};

    for (const state of taskStates) {
      grouped[state.task_state_name] = [];
    }

    for (const task of filteredTasks) {
      const key = task.task_state;
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(task);
    }

    return grouped;
  }, [filteredTasks, taskStates]);

  // console.log("boardColumns", boardColumns);
  // console.log("tasks", tasks);

  return (
    <Container maxWidth={false} disableGutters className="taskPageContainer">
      <Typography variant="h5" fontWeight="bold" sx={{ mb: 2 }}>
        Task Manager Dashboard: {displayAppName}
      </Typography>

      <Paper className="taskBoardCard">
        {errMsg ? (
          <Alert severity="error" sx={{ mb: 2 }}>
            {errMsg}
          </Alert>
        ) : null}

        <div className="taskBoardTopRow">
          <TextField
            size="small"
            placeholder="Task"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="taskBoardSearch"
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

          {isProjectManager ? (
            <Button
              variant="outlined"
              className="taskBoardPlanBtn"
              onClick={() => {
                // skeleton button for now
              }}
            >
              Manage Plan
            </Button>
          ) : (
            <div className="taskBoardPlanBtnPlaceholder" />
          )}
        </div>

        {loading ? (
          <div className="taskBoardLoading">
            <CircularProgress size={22} />
            <Typography variant="body2">Loading…</Typography>
          </div>
        ) : (
          <div className="taskBoardColumns">
            {boardColumns.map((column) => {
              const columnTasks = groupedTasks[column.key] || [];

              return (
                <div key={column.slug} className="taskColumn">
                  <div className="taskColumn__header">
                    {column.title} [{columnTasks.length}]
                  </div>

                  <div className="taskColumn__body">
                    {column.slug === "OPEN" ? (
                      <Button
                        variant="outlined"
                        size="small"
                        className="taskColumn__newTaskBtn"
                        onClick={() => {
                          // skeleton button for now
                        }}
                      >
                        + New Task
                      </Button>
                    ) : null}

                    {columnTasks.length === 0 ? <div className="taskColumn__empty">No tasks</div> : columnTasks.map((task) => <TaskCard key={task.task_id || `${task.task_name}-${task.task_no}`} task={task} />)}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Paper>
    </Container>
  );
}
