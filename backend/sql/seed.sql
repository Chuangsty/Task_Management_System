USE tms;

-- =========================
-- ACCOUNT STATUS
-- =========================
INSERT IGNORE INTO account_status (slug, status_name) VALUES
('ACTIVE', 'Active'),
('DISABLED', 'Disabled');

-- =========================
-- ROLES
-- =========================
INSERT IGNORE INTO roles (slug, role_name) VALUES
('ADMIN', 'Admin'),
('PROJECT_LEAD', 'Project Lead'),
('PROJECT_MANAGER', 'Project Manager'),
('DEVELOPER', 'Developer');

-- =========================
-- STATES (Apps + Plans)
-- =========================
INSERT IGNORE INTO states (slug, state_name) VALUES
('ON_GOING', 'On-going'),
('COMPLETED', 'Completed');

-- =========================
-- TASK STATES
-- =========================
INSERT IGNORE INTO task_states (slug, task_state_name) VALUES
('OPEN', 'Open'),
('TODO', 'To Do'),
('DOING', 'Doing'),
('DONE', 'Done'),
('CLOSED', 'Closed');