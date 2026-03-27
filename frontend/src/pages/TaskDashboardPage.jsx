import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useOutletContext, useParams } from "react-router-dom";
import { Alert, Box, Button, CircularProgress, Container, Dialog, DialogActions, DialogContent, DialogTitle, FormControl, InputAdornment, InputLabel, MenuItem, Paper, Select, Snackbar, TextField, Typography } from "@mui/material";

import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded";
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

      <div className="taskCard__line">Task Name: {task.task_name || "-"}</div>
      <div className="taskCard__line">Plan Name: {task.plan_name || "-"}</div>
      <div className="taskCard__line">Dev Name: {task.developer_username || "-"}</div>
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

  // Task creation dialog
  const [openTaskDialog, setOpenTaskDialog] = useState(false);
  const [creatingTask, setCreatingTask] = useState(false);
  const [taskForm, setTaskForm] = useState({
    task_name: "",
    task_description: "",
    plan_name: "",
  });

  // Task detail dialog
  const [openTaskDetailDialog, setOpenTaskDetailDialog] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  // plan assignment feature
  const [plans, setPlans] = useState([]);
  const [selectedPlanName, setSelectedPlanName] = useState("");
  const [updatingTask, setUpdatingTask] = useState(false);
  // Note input feature
  const [noteInput, setNoteInput] = useState("");
  // releasing of task
  const [releasingTask, setReleasingTask] = useState(false);
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
  });

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

  // ability to create task
  // if appInfo?.permit_Open is PROJECT_LEAD
  // if roles.includes(appInfo.permit_Open) is PROJECT_LEAD
  const canCreateTask = Boolean(appInfo?.permit_Open) && roles.includes(appInfo.permit_Open);
  // ability to create plan
  const canCreatePlan = Boolean(appInfo?.permit_toDo) && roles.includes(appInfo.permit_toDo);
  // ability to release task for taking
  const canReleaseTask = Boolean(appInfo?.permit_toDo) && roles.includes(appInfo.permit_toDo);
  // ability to take task
  const canTakeTask = Boolean(appInfo?.permit_Doing) && roles.includes(appInfo.permit_Doing);
  // ability to submit task for review
  const canSubmitTask = Boolean(appInfo?.permit_Done) && roles.includes(appInfo.permit_Done);

  const selectedTaskStateSlug = String(selectedTask?.task_state_slug || "").toUpperCase();

  const canEditPlan = !["DOING", "DONE", "CLOSED"].includes(selectedTaskStateSlug);
  const canEditNote = selectedTaskStateSlug !== "CLOSED" && (selectedTaskStateSlug !== "DONE" || canCreateTask);

  // for plan selection
  const planOptions = useMemo(() => {
    return plans
      .map((plan) => String(plan.plan_name || "").trim())
      .filter((name) => name !== "")
      .sort((a, b) => a.localeCompare(b));
  }, [plans]);

  // for note input
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
      plan_name: "",
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
    setSelectedPlanName(task?.plan_name || "");
    setOpenTaskDetailDialog(true);
  }
  // Note input feature inside task detail viewer
  async function handleUpdateTask() {
    if (!selectedTask?.task_id) return;

    const cleanNote = noteInput.trim();

    const originalPlanName = selectedTask?.plan_name || "";
    const cleanPlanName = selectedPlanName.trim();

    const hasNoteChange = cleanNote !== "";
    const hasPlanChange = cleanPlanName !== originalPlanName;

    if (!hasNoteChange && !hasPlanChange) {
      setToast({
        open: true,
        severity: "error",
        message: "No changes to update",
      });
      return;
    }

    try {
      setUpdatingTask(true);

      // let latestTask = selectedTask;

      // 1) update task plan
      if (hasPlanChange) {
        await api.patch(`/api/apps/${appAcronym}/tasks/${selectedTask.task_id}`, {
          plan_name: cleanPlanName || null,
        });
      }

      // 2) update note
      if (hasNoteChange) {
        await api.patch(`/api/tasks/${selectedTask.task_id}/note`, {
          note: cleanNote,
        });
      }

      await refreshTaskInDialog(selectedTask.task_id);

      setNoteInput("");

      setToast({
        open: true,
        severity: "success",
        message: "Update successful",
      });
    } catch (err) {
      setToast({
        open: true,
        severity: "error",
        message: err?.response?.data?.error?.message || "Failed to save note",
      });
    } finally {
      setUpdatingTask(false);
    }
  }

  // task detail dialog closer
  function handleCloseTaskDetail() {
    setOpenTaskDetailDialog(false);
    setSelectedTask(null);
    setNoteInput("");
    setSelectedPlanName("");
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
    });
    setOpenPlanDialog(true);
  }
  function handleClosePlanDialog() {
    if (creatingPlan) return;
    setOpenPlanDialog(false);
  }

  // Task Creation Function
  async function handleCreateTask() {
    const trimTaskName = taskForm.task_name.trim();
    const cleanTaskName = trimTaskName.charAt(0).toUpperCase() + trimTaskName.slice(1);

    const cleanTaskDescription = taskForm.task_description.trim();

    const cleanPlanName = taskForm.plan_name.trim();

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

      await api.post(`/api/apps/${appAcronym}/CreateTask`, {
        task_name: cleanTaskName,
        task_description: cleanTaskDescription,
        plan_name: cleanPlanName || null,
      });

      setOpenTaskDialog(false);

      setToast({
        open: true,
        severity: "success",
        message: "Task created successfully",
      });

      await loadTasks();
      await loadPlans();
    } catch (err) {
      setToast({
        open: true,
        severity: "error",
        message: err?.response?.data?.error?.message || "Failed to create task",
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
    try {
      setCreatingPlan(true);

      await api.post(`/api/apps/${appAcronym}/plans`, {
        plan_name: cleanPlanName,
        plan_startDate: planForm.plan_startDate,
        plan_endDate: planForm.plan_endDate,
      });

      setOpenPlanDialog(false);

      setToast({
        open: true,
        severity: "success",
        message: "Plan created successfully",
      });
      await loadTasks();
      await loadPlans();
    } catch (err) {
      setToast({
        open: true,
        severity: "error",
        message: err?.response?.data?.error?.message || "Failed to create plan",
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

  // project manager release task
  async function handleReleaseTask() {
    if (!selectedTask?.task_id) return;

    try {
      setReleasingTask(true);

      await api.post(`/api/tasks/${selectedTask.task_id}/release`);
      await refreshTaskInDialog(selectedTask.task_id);
      handleCloseTaskDetail();

      setToast({
        open: true,
        severity: "success",
        message: "Task released successfully",
      });
    } catch (err) {
      setToast({
        open: true,
        severity: "error",
        message: err?.response?.data?.error?.message || "Failed to release task",
      });
    } finally {
      setReleasingTask(false);
    }
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
        message: err?.response?.data?.error?.message || "Failed to take task",
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
        message: err?.response?.data?.error?.message || "Failed to forfeit task",
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

      await api.post(`/api/tasks/${selectedTask.task_id}/PromoteTask2Done`);
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
        message: err?.response?.data?.error?.message || "Failed to submit task",
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
        message: err?.response?.data?.error?.message || "Failed to reject task",
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
        message: err?.response?.data?.error?.message || "Failed to approve task",
      });
    } finally {
      setApprovingTask(false);
    }
  }

  const loadPlans = useCallback(async () => {
    const res = await api.get(`/api/apps/${appAcronym}/plans`);
    setPlans(Array.isArray(res.data?.plans) ? res.data.plans : []);
  }, [appAcronym]);

  const loadTasks = useCallback(async () => {
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
        setToast({
          open: true,
          severity: "error",
          message: err?.response?.data?.error?.message || "Failed to load tasks",
        });
      }
    } finally {
      setLoading(false);
    }
  }, [appAcronym, nav]);

  const displayAppName = location.state?.appName || appInfo?.app_name || appAcronym || "Application";

  useEffect(() => {
    if (!appAcronym) return;
    loadTasks();
    loadPlans();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadTasks, loadPlans]);

  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === "visible" && !openTaskDialog && !openTaskDetailDialog) {
        if (appAcronym) {
          loadTasks();
          loadPlans();
        }
      }
    };

    document.addEventListener("visibilitychange", refresh);
    window.addEventListener("focus", refresh);

    return () => {
      document.removeEventListener("visibilitychange", refresh);
      window.removeEventListener("focus", refresh);
    };
  }, [appAcronym, openTaskDialog, openTaskDetailDialog, loadTasks, loadPlans]);

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
      <div className="taskPageHeader">
        <Typography variant="h5" fontWeight="bold">
          Task Manager Dashboard: {displayAppName}
        </Typography>

        {/* back button */}
        <Button size="small" variant="outlined" startIcon={<ArrowBackRoundedIcon />} onClick={() => nav(-1)} className="pageBackBtn">
          Back
        </Button>
      </div>

      <Paper className="taskBoardCard">
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
      <Dialog open={openTaskDialog} onClose={handleCloseTaskDialog} fullWidth maxWidth="lg">
        <DialogTitle className="taskDetailDialog__title">
          <div className="taskDetailDialog__header">NEW TASK</div>
        </DialogTitle>

        <DialogContent dividers className="taskDetailDialog__content">
          <div className="taskDetailDialog__layout">
            {/* Left panel */}
            <div className="taskDetailDialog__left">
              <div className="taskDetailDialog__fieldList">
                <div className="taskDetailDialog__fieldRow taskDetailDialog__fieldRow--text">
                  <Typography fontWeight="bold">Task Name</Typography>
                  <TextField
                    fullWidth
                    size="small"
                    value={taskForm.task_name}
                    onChange={(e) =>
                      setTaskForm((prev) => ({
                        ...prev,
                        task_name: e.target.value,
                      }))
                    }
                  />
                </div>

                <div className="taskDetailDialog__fieldRow">
                  <Typography fontWeight="bold">Task Description</Typography>
                  <Paper className="taskDetailDialog__descriptionBox" elevation={0}>
                    <TextField
                      fullWidth
                      multiline
                      minRows={4}
                      variant="standard"
                      value={taskForm.task_description}
                      onChange={(e) =>
                        setTaskForm((prev) => ({
                          ...prev,
                          task_description: e.target.value,
                        }))
                      }
                      slotProps={{ input: { disableUnderline: true } }}
                    />
                  </Paper>
                </div>

                <div className="taskDetailDialog__fieldRow taskDetailDialog__fieldRow--text">
                  <Typography fontWeight="bold">Plan Name</Typography>
                  <FormControl fullWidth size="small">
                    <InputLabel>Plan Name</InputLabel>
                    <Select
                      label="Plan Name"
                      value={taskForm.plan_name}
                      onChange={(e) =>
                        setTaskForm((prev) => ({
                          ...prev,
                          plan_name: e.target.value,
                        }))
                      }
                    >
                      <MenuItem value="">
                        <em>Unassigned</em>
                      </MenuItem>

                      {planOptions.map((planName) => (
                        <MenuItem key={planName} value={planName}>
                          {planName}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </div>

                <div className="taskDetailDialog__fieldRow taskDetailDialog__fieldRow--text">
                  <Typography fontWeight="bold">Task State</Typography>
                  <Typography>{selectedTask?.task_state || "-"}</Typography>
                </div>

                <div className="taskDetailDialog__fieldRow taskDetailDialog__fieldRow--text">
                  <Typography fontWeight="bold">Task Creator</Typography>
                  <Typography>-</Typography>
                </div>

                <div className="taskDetailDialog__fieldRow taskDetailDialog__fieldRow--text">
                  <Typography fontWeight="bold">Task Developer</Typography>
                  <Typography>{selectedTask?.developer_username || "-"}</Typography>
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
                  <Typography className="taskDetailDialog__noteLine">Notes will be auto-generated after task creation.</Typography>
                </Paper>
              </div>

              <div className="taskDetailDialog__notesWrap">
                <TextField fullWidth multiline minRows={4} label="Input Notes" value="" disabled />
              </div>
            </div>
          </div>
        </DialogContent>

        <DialogActions className="taskDetailDialog__actions">
          <Button onClick={handleCloseTaskDialog} variant="contained" disabled={creatingTask}>
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

                  {canEditPlan ? (
                    <FormControl fullWidth size="small">
                      <InputLabel>Plan Name</InputLabel>
                      <Select label="Plan Name" value={selectedPlanName} onChange={(e) => setSelectedPlanName(e.target.value)}>
                        <MenuItem value="">
                          <em>Unassigned</em>
                        </MenuItem>

                        {planOptions.map((planName) => (
                          <MenuItem key={planName} value={planName}>
                            {planName}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  ) : (
                    <Typography>{selectedTask?.plan_name || "Unassigned"}</Typography>
                  )}
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
                  <Typography>{selectedTask?.developer_username || "-"}</Typography>
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

              {canEditNote ? (
                <div className="taskDetailDialog__notesWrap">
                  <TextField fullWidth multiline minRows={4} label="Input Notes" value={noteInput} onChange={(e) => setNoteInput(e.target.value)} />
                </div>
              ) : null}
            </div>
          </div>
        </DialogContent>

        <DialogActions className="taskDetailDialog__actions">
          {canReleaseTask && selectedTask?.task_state_slug === "OPEN" && selectedTask?.plan_name ? (
            <Button variant="outlined" onClick={handleReleaseTask} className="release_btn" disabled={releasingTask || updatingTask}>
              {releasingTask ? "Releasing..." : "Release Task"}
            </Button>
          ) : null}

          {canTakeTask && selectedTask?.task_state_slug === "TODO" ? (
            <Button variant="outlined" onClick={handleTakeTask} className="taketask_btn" disabled={takingTask || updatingTask}>
              {takingTask ? "Taking..." : "Take Task"}
            </Button>
          ) : null}

          {canSubmitTask && selectedTask?.task_state_slug === "DOING" ? (
            <>
              <Button variant="outlined" onClick={handleForfeitTask} className="forfeit_btn" disabled={forfeitingTask || updatingTask}>
                {forfeitingTask ? "Forfeiting..." : "Forfeit Task"}
              </Button>
              <Button variant="outlined" onClick={handleSubmitTask} className="submit_btn" disabled={submittingTask || updatingTask}>
                {submittingTask ? "Submitting..." : "Submit Task"}
              </Button>
            </>
          ) : null}

          {canCreateTask && selectedTask?.task_state_slug === "DONE" ? (
            <>
              <Button variant="outlined" onClick={handleRejectTask} className="reject_btn" disabled={rejectingTask || updatingTask}>
                {rejectingTask ? "Rejecting..." : "Reject Task"}
              </Button>
              <Button variant="outlined" onClick={handleApproveTask} className="approve_btn" disabled={approvingTask || updatingTask}>
                {approvingTask ? "Approving..." : "Approve Task"}
              </Button>
            </>
          ) : null}

          {canEditPlan || canEditNote ? (
            <Button variant="contained" onClick={handleUpdateTask} disabled={updatingTask || takingTask || forfeitingTask || submittingTask || rejectingTask || approvingTask}>
              {updatingTask ? "Updating..." : "Update"}
            </Button>
          ) : null}

          <Button variant="contained" onClick={handleCloseTaskDetail} className="taskDetailDialog__closeBtn" disabled={updatingTask}>
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
