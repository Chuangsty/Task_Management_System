import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useOutletContext, useParams } from "react-router-dom";
import { Alert, Box, Button, CircularProgress, Container, Dialog, DialogActions, DialogContent, DialogTitle, FormControl, InputAdornment, InputLabel, MenuItem, Paper, Select, Snackbar, TextField, Typography } from "@mui/material";

import SearchIcon from "@mui/icons-material/Search";
import AddIcon from "@mui/icons-material/Add";

import { api } from "../api/client";
import "./TaskDashboardPage.css";

function TaskCard({ task, onClick }) {
  return (
    <div
      className="taskCard taskCard--clickable"
      onClick={() => onClick(task)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick(task);
        }
      }}
    >
      <div className="taskCard__id">{task.task_id}</div>

      <div className="taskCard__line">Task: {task.task_name || "-"}</div>
      <div className="taskCard__line">Dev: {task.developer_username || "-"}</div>
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

  // Task creation dialog
  const [openTaskDialog, setOpenTaskDialog] = useState(false);
  const [creatingTask, setCreatingTask] = useState(false);
  const [taskForm, setTaskForm] = useState({
    task_name: "",
    task_description: "",
  });

  // Task detail dialog
  const [openTaskDetailDialog, setOpenTaskDetailDialog] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  // Note input feature
  const [noteInput, setNoteInput] = useState("");
  const [savingNote, setSavingNote] = useState(false);
  // taking of task
  const [takingTask, setTakingTask] = useState(false);
  // forfeiting and submitting of task
  const [forfeitingTask, setForfeitingTask] = useState(false);
  const [submittingTask, setSubmittingTask] = useState(false);
  // rejecting and approving of task
  const [rejectingTask, setRejectingTask] = useState(false);
  const [approvingTask, setApprovingTask] = useState(false);

  // Plan creation dialog
  const [openPlanDialog, setOpenPlanDialog] = useState(false);
  const [creatingPlan, setCreatingPlan] = useState(false);
  const [planForm, setPlanForm] = useState({
    plan_name: "",
    plan_startDate: "",
    plan_endDate: "",
    task_ids: [], // task selection
  });
  const selectableTasks = useMemo(() => {
    return tasks.filter((task) => {
      const isOpen = String(task.task_state || "").toUpperCase() === "OPEN";
      const hasNoPlan = !task.plan_name;
      return isOpen && hasNoPlan;
    });
  }, [tasks]);

  const [toast, setToast] = useState({
    open: false,
    severity: "success",
    message: "",
  });

  const boardColumns = useMemo(() => {
    return taskStates.map((state) => ({
      key: state.task_state_name,
      title: String(state.task_state_name || "").toUpperCase(),
      slug: state.slug,
      id: state.id, // currently not in use as of "new task" button
    }));
  }, [taskStates]);

  // const isProjectManager = roles.includes("PROJECT_MANAGER");

  // ability to create task
  // if appInfo?.permit_Open is PROJECT_LEAD
  // if roles.includes(appInfo.permit_Open) is PROJECT_LEAD
  const canCreateTask = Boolean(appInfo?.permit_Open) && roles.includes(appInfo.permit_Open);
  // ability to create plan
  const canCreatePlan = Boolean(appInfo?.permit_toDo) && roles.includes(appInfo.permit_toDo);
  // ability to take task
  const canTakeTask = Boolean(appInfo?.permit_Doing) && roles.includes(appInfo.permit_Doing);
  // ability to submit task for review
  const canSubmitTask = Boolean(appInfo?.permit_Done) && roles.includes(appInfo.permit_Done);

  const isTaskClosed = String(selectedTask?.task_state_slug || "").toUpperCase() === "CLOSED";

  const noteLines = useMemo(() => {
    if (!selectedTask?.task_note) return [];

    return selectedTask.task_note
      .split("\n")
      .filter((line) => line.trim() !== "")
      .reverse();
  }, [selectedTask]);

  // Task Creation Helper Functions
  function handleOpenTaskDialog() {
    setTaskForm({
      task_name: "",
      task_description: "",
    });
    setOpenTaskDialog(true);
  }
  function handleCloseTaskDialog() {
    if (creatingTask) return;
    setOpenTaskDialog(false);
  }

  // Task Detail Viewer Helper Function
  function handleOpenTaskDetail(task) {
    setSelectedTask(task);
    setNoteInput("");
    setOpenTaskDetailDialog(true);
  }
  // Note input feature inside task detail viewer
  async function handleSaveNote() {
    const cleanNote = noteInput.trim();

    if (!selectedTask?.task_id) return;

    if (!cleanNote) {
      setToast({
        open: true,
        severity: "error",
        message: "Note cannot be empty",
      });
      return;
    }

    try {
      setSavingNote(true);

      // Change this endpoint to match your backend route
      const res = await api.patch(`/api/tasks/${selectedTask.task_id}/note`, {
        note: cleanNote,
      });

      const updatedTask = res.data?.task;

      if (updatedTask) {
        setSelectedTask(updatedTask);

        setTasks((prev) => prev.map((task) => (task.task_id === updatedTask.task_id ? updatedTask : task)));
      }

      setNoteInput("");

      setToast({
        open: true,
        severity: "success",
        message: "Note added successfully",
      });
    } catch (err) {
      setToast({
        open: true,
        severity: "error",
        message: err?.response?.data?.error || "Failed to save note",
      });
    } finally {
      setSavingNote(false);
    }
  }

  // task detail dialog closer
  function handleCloseTaskDetail() {
    setOpenTaskDetailDialog(false);
    setSelectedTask(null);
  }

  function formatDisplayDate(value) {
    if (!value) return "-";

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);

    return date.toLocaleDateString("en-GB", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  }

  // Plan Creation Helper Functions
  function handleOpenPlanDialog() {
    setPlanForm({
      plan_name: "",
      plan_startDate: "",
      plan_endDate: "",
      task_ids: [], // task selection
    });
    setOpenPlanDialog(true);
  }
  function handleClosePlanDialog() {
    if (creatingPlan) return;
    setOpenPlanDialog(false);
  }

  // Task Creation Function
  async function handleCreateTask() {
    const cleanTaskName = taskForm.task_name.trim();
    const cleanTaskDescription = taskForm.task_description.trim();

    if (!cleanTaskName) {
      setToast({
        open: true,
        severity: "error",
        message: "Task name is required",
      });
      return;
    }
    try {
      setCreatingTask(true);

      await api.post(`/api/apps/${appAcronym}/tasks`, {
        task_name: cleanTaskName,
        task_description: cleanTaskDescription,
      });

      setOpenTaskDialog(false);

      setToast({
        open: true,
        severity: "success",
        message: "Task created successfully",
      });

      await loadTasks();
    } catch (err) {
      setToast({
        open: true,
        severity: "error",
        message: err?.response?.data?.error || "Failed to create task",
      });
    } finally {
      setCreatingTask(false);
    }
  }
  // Plan Creation Function
  async function handleCreatePlan() {
    const trimPlanName = planForm.plan_name.trim();
    const cleanPlanName = trimPlanName.charAt(0).toUpperCase() + trimPlanName.slice(1);

    if (!cleanPlanName) {
      setToast({
        open: true,
        severity: "error",
        message: "Plan name is required",
      });
      return;
    }
    if (!planForm.plan_startDate || !planForm.plan_endDate) {
      setToast({
        open: true,
        severity: "error",
        message: "Plan start and end date are required",
      });
      return;
    }
    if (planForm.plan_startDate > planForm.plan_endDate) {
      setToast({
        open: true,
        severity: "error",
        message: "Plan end date must be later than start date",
      });
      return;
    }
    if (!Array.isArray(planForm.task_ids) || planForm.task_ids.length === 0) {
      setToast({
        open: true,
        severity: "error",
        message: "Select at least one task",
      });
      return;
    }
    try {
      setCreatingPlan(true);

      await api.post(`/api/apps/${appAcronym}/plan`, {
        plan_name: cleanPlanName,
        plan_startDate: planForm.plan_startDate,
        plan_endDate: planForm.plan_endDate,
        task_ids: planForm.task_ids,
      });

      setOpenPlanDialog(false);

      setToast({
        open: true,
        severity: "success",
        message: "Plan created successfully",
      });
      await loadTasks();
    } catch (err) {
      setToast({
        open: true,
        severity: "error",
        message: err?.response?.data?.error || "Failed to create plan",
      });
    } finally {
      setCreatingPlan(false);
    }
  }

  // refresh task whenever action made
  async function refreshTaskInDialog(taskId) {
    const res = await api.get(`/api/apps/${appAcronym}/tasks`);
    const latestTasks = Array.isArray(res.data?.tasks) ? res.data.tasks : [];
    const latestTask = latestTasks.find((task) => task.task_id === taskId) || null;

    setTasks(latestTasks);
    setTaskStates(Array.isArray(res.data?.taskStates) ? res.data.taskStates : []);
    setAppInfo(res.data?.app || null);
    setSelectedTask(latestTask);
  }

  // dev take task
  async function handleTakeTask() {
    if (!selectedTask?.task_id) return;

    try {
      setTakingTask(true);

      await api.post(`/api/tasks/${selectedTask.task_id}/take`);
      await refreshTaskInDialog(selectedTask.task_id);
      handleCloseTaskDetail(true);

      setToast({
        open: true,
        severity: "success",
        message: "Task taken successfully",
      });
    } catch (err) {
      setToast({
        open: true,
        severity: "error",
        message: err?.response?.data?.error || "Failed to take task",
      });
    } finally {
      setTakingTask(false);
    }
  }

  // dev forfeit task
  async function handleForfeitTask() {
    if (!selectedTask?.task_id) return;

    try {
      setForfeitingTask(true);

      await api.post(`/api/tasks/${selectedTask.task_id}/forfeit`);
      await refreshTaskInDialog(selectedTask.task_id);
      handleCloseTaskDetail(true);

      setToast({
        open: true,
        severity: "success",
        message: "Task forfeited successfully",
      });
    } catch (err) {
      setToast({
        open: true,
        severity: "error",
        message: err?.response?.data?.error || "Failed to forfeit task",
      });
    } finally {
      setForfeitingTask(false);
    }
  }

  // dev submit task
  async function handleSubmitTask() {
    if (!selectedTask?.task_id) return;

    try {
      setSubmittingTask(true);

      await api.post(`/api/tasks/${selectedTask.task_id}/submit`);
      await refreshTaskInDialog(selectedTask.task_id);
      handleCloseTaskDetail(true);

      setToast({
        open: true,
        severity: "success",
        message: "Task submitted successfully",
      });
    } catch (err) {
      setToast({
        open: true,
        severity: "error",
        message: err?.response?.data?.error || "Failed to submit task",
      });
    } finally {
      setSubmittingTask(false);
    }
  }

  // dev rejecting task
  async function handleRejectTask() {
    if (!selectedTask?.task_id) return;

    try {
      setRejectingTask(true);

      await api.post(`/api/tasks/${selectedTask.task_id}/reject`);
      await refreshTaskInDialog(selectedTask.task_id);
      handleCloseTaskDetail(true);

      setToast({
        open: true,
        severity: "success",
        message: "Task rejected successfully",
      });
    } catch (err) {
      setToast({
        open: true,
        severity: "error",
        message: err?.response?.data?.error || "Failed to reject task",
      });
    } finally {
      setRejectingTask(false);
    }
  }

  // dev appriving task
  async function handleApproveTask() {
    if (!selectedTask?.task_id) return;

    try {
      setApprovingTask(true);

      await api.post(`/api/tasks/${selectedTask.task_id}/approve`);
      await refreshTaskInDialog(selectedTask.task_id);
      handleCloseTaskDetail(true);

      setToast({
        open: true,
        severity: "success",
        message: "Task approved successfully",
      });
    } catch (err) {
      setToast({
        open: true,
        severity: "error",
        message: err?.response?.data?.error || "Failed to approve task",
      });
    } finally {
      setApprovingTask(false);
    }
  }

  async function loadTasks() {
    setErrMsg("");
    setLoading(true);

    try {
      const res = await api.get(`/api/apps/${appAcronym}/tasks`);
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
    const grouped = Object.fromEntries(taskStates.map((state) => [state.task_state_name, []]));

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
            placeholder="Search"
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

          {canCreatePlan ? (
            <Button variant="outlined" className="taskBoardPlanBtn" onClick={handleOpenPlanDialog}>
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
                    {canCreateTask && column.slug === "OPEN" ? (
                      <Button variant="outlined" startIcon={<AddIcon />} size="small" className="taskColumn__newTaskBtn" onClick={handleOpenTaskDialog}>
                        New Task
                      </Button>
                    ) : null}

                    {columnTasks.length === 0 ? <div className="taskColumn__empty">No task</div> : columnTasks.map((task) => <TaskCard key={task.task_id || `${task.task_name}-${task.task_no}`} task={task} onClick={handleOpenTaskDetail} />)}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Paper>

      {/* Plan creation dialog */}
      <Dialog open={openPlanDialog} onClose={handleClosePlanDialog} fullWidth maxWidth="sm">
        <DialogTitle>Create New PLan</DialogTitle>

        <DialogContent dividers>
          {/* Plan name */}
          <TextField
            fullWidth
            margin="normal"
            label="Plan Name *"
            value={planForm.plan_name}
            onChange={(e) =>
              setPlanForm((prev) => ({
                ...prev,
                plan_name: e.target.value,
              }))
            }
          />

          {/* Start & end dates */}
          <Box sx={{ display: "flex", gap: 2 }}>
            {/* Start date */}
            <TextField fullWidth margin="normal" label="Start Date *" type="date" value={planForm.plan_startDate} onChange={(e) => setPlanForm((p) => ({ ...p, plan_startDate: e.target.value }))} slotProps={{ inputLabel: { shrink: true } }} />
            {/* End date */}
            <TextField fullWidth margin="normal" label="End Date *" type="date" value={planForm.plan_endDate} onChange={(e) => setPlanForm((p) => ({ ...p, plan_endDate: e.target.value }))} slotProps={{ inputLabel: { shrink: true } }} />
          </Box>

          {/* Task(s) input/selection */}
          <FormControl fullWidth margin="normal">
            <InputLabel>Task(s) *</InputLabel>
            <Select
              multiple
              label="Task(s) *"
              value={planForm.task_ids}
              onChange={(e) => {
                const value = e.target.value;
                setPlanForm((p) => ({
                  ...p,
                  task_ids: typeof value === "string" ? value.split(",") : value,
                }));
              }}
            >
              {selectableTasks.map((task) => (
                <MenuItem key={task.task_id + task.task_name} value={task.task_id}>
                  {`${task.task_id}: ${task.task_name}`}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </DialogContent>

        <DialogActions>
          <Button onClick={handleClosePlanDialog} disabled={creatingPlan}>
            Cancel
          </Button>
          <Button onClick={handleCreatePlan} variant="contained" disabled={creatingPlan}>
            {creatingPlan ? "Creating..." : "Create Plan"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Task creation dialog */}
      <Dialog open={openTaskDialog} onClose={handleCloseTaskDialog} fullWidth maxWidth="sm">
        <DialogTitle>Create New Task</DialogTitle>

        <DialogContent dividers>
          <TextField
            fullWidth
            margin="normal"
            label="Task Name"
            value={taskForm.task_name}
            onChange={(e) =>
              setTaskForm((prev) => ({
                ...prev,
                task_name: e.target.value,
              }))
            }
          />

          <TextField
            fullWidth
            margin="normal"
            label="Task Description"
            multiline
            minRows={4}
            value={taskForm.task_description}
            onChange={(e) =>
              setTaskForm((prev) => ({
                ...prev,
                task_description: e.target.value,
              }))
            }
          />
        </DialogContent>

        <DialogActions>
          <Button onClick={handleCloseTaskDialog} disabled={creatingTask}>
            Cancel
          </Button>
          <Button onClick={handleCreateTask} variant="contained" disabled={creatingTask}>
            {creatingTask ? "Creating..." : "Create Task"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Task detail dialog */}
      <Dialog open={openTaskDetailDialog} onClose={handleCloseTaskDetail} fullWidth maxWidth="lg">
        <DialogTitle className="taskDetailDialog__title">
          <div className="taskDetailDialog__header">{selectedTask?.task_id || ""}</div>
        </DialogTitle>

        <DialogContent dividers className="taskDetailDialog__content">
          <div className="taskDetailDialog__layout">
            {/* Left panel */}
            <div className="taskDetailDialog__left">
              <div className="taskDetailDialog__fieldList">
                <div className="taskDetailDialog__fieldRow taskDetailDialog__fieldRow--text">
                  <Typography fontWeight="bold">Task Name</Typography>
                  <Typography>{selectedTask?.task_name || ""}</Typography>
                </div>

                <div className="taskDetailDialog__fieldRow">
                  <Typography fontWeight="bold">Task Description</Typography>
                  <Paper className="taskDetailDialog__descriptionBox" elevation={0}>
                    {selectedTask?.task_description || "-"}
                  </Paper>
                </div>

                <div className="taskDetailDialog__fieldRow taskDetailDialog__fieldRow--text">
                  <Typography fontWeight="bold">Plan Name</Typography>
                  <Typography>{selectedTask?.plan_name || "Unassigned"}</Typography>
                </div>

                <div className="taskDetailDialog__fieldRow taskDetailDialog__fieldRow--text">
                  <Typography fontWeight="bold">Task State</Typography>
                  <Typography>{selectedTask?.task_state || "-"}</Typography>
                </div>

                <div className="taskDetailDialog__fieldRow taskDetailDialog__fieldRow--text">
                  <Typography fontWeight="bold">Task Creator</Typography>
                  <Typography>{selectedTask?.creator_username || "-"}</Typography>
                </div>

                <div className="taskDetailDialog__fieldRow taskDetailDialog__fieldRow--text">
                  <Typography fontWeight="bold">Task Developer</Typography>
                  <Typography>{selectedTask?.developer_username || "Unassigned"}</Typography>
                </div>

                <div className="taskDetailDialog__fieldRow taskDetailDialog__fieldRow--text">
                  <Typography fontWeight="bold">Task Create Date</Typography>
                  <Typography>{formatDisplayDate(selectedTask?.created_at || selectedTask?.task_created_at)}</Typography>
                </div>
              </div>
            </div>

            {/* Right panel */}
            <div className="taskDetailDialog__right">
              <div>
                <Typography fontWeight="bold" className="taskDetailDialog__notesTitle">
                  Notes
                </Typography>

                <Paper variant="outlined" className="taskDetailDialog__notesBox">
                  {noteLines.length === 0
                    ? "No notes yet"
                    : noteLines.map((line, index) => (
                        <Typography key={index} className="taskDetailDialog__noteLine">
                          {line}
                        </Typography>
                      ))}
                </Paper>
              </div>

              {!isTaskClosed ? (
                <div className="taskDetailDialog__notesWrap">
                  <TextField fullWidth multiline minRows={4} label="Input Notes" value={noteInput} onChange={(e) => setNoteInput(e.target.value)} />
                </div>
              ) : null}
            </div>
          </div>
        </DialogContent>

        <DialogActions className="taskDetailDialog__actions">
          {canTakeTask && selectedTask?.task_state_slug === "TODO" ? (
            <Button variant="outlined" onClick={handleTakeTask} className="taketask_btn" disabled={takingTask || savingNote}>
              {takingTask ? "Taking..." : "Take Task"}
            </Button>
          ) : null}

          {canSubmitTask && selectedTask?.task_state_slug === "DOING" ? (
            <>
              <Button variant="outlined" onClick={handleForfeitTask} className="forfeit_btn" disabled={forfeitingTask || savingNote}>
                {forfeitingTask ? "Forfeiting..." : "Forfeit Task"}
              </Button>
              <Button variant="outlined" onClick={handleSubmitTask} className="submit_btn" disabled={submittingTask || savingNote}>
                {submittingTask ? "Submitting..." : "Submit Task"}
              </Button>
            </>
          ) : null}

          {canCreateTask && selectedTask?.task_state_slug === "DONE" ? (
            <>
              <Button variant="outlined" onClick={handleRejectTask} className="reject_btn" disabled={rejectingTask || savingNote}>
                {rejectingTask ? "Rejecting..." : "Reject Task"}
              </Button>
              <Button variant="outlined" onClick={handleApproveTask} className="approve_btn" disabled={approvingTask || savingNote}>
                {approvingTask ? "Approving..." : "Approve Task"}
              </Button>
            </>
          ) : null}

          {!isTaskClosed ? (
            <Button variant="contained" onClick={handleSaveNote} disabled={savingNote}>
              {savingNote ? "Saving..." : "Add Note"}
            </Button>
          ) : null}
          <Button variant="contained" onClick={handleCloseTaskDetail} className=" taskDetailDialog__closeBtn" disabled={savingNote}>
            Close
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={toast.open} autoHideDuration={3000} onClose={() => setToast((prev) => ({ ...prev, open: false }))} anchorOrigin={{ vertical: "bottom", horizontal: "center" }}>
        <Alert severity={toast.severity} variant="filled" onClose={() => setToast((prev) => ({ ...prev, open: false }))}>
          {toast.message}
        </Alert>
      </Snackbar>
    </Container>
  );
}
