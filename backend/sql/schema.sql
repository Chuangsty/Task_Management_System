CREATE DATABASE IF NOT EXISTS tms;
USE tms;

-- =========================
-- SECTION 1: ACCESS CONTROL
-- =========================

-- Account status table
CREATE TABLE IF NOT EXISTS account_status(
  id INT AUTO_INCREMENT PRIMARY KEY,
  slug VARCHAR(20) NOT NULL UNIQUE,
  status_name VARCHAR(50) NOT NULL UNIQUE
);

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(50) NOT NULL UNIQUE,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  account_status_id INT NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  -- Index to speed up: "find all users with account status X"
  KEY idx_users_account_status (account_status_id),

  CONSTRAINT fk_users_account_status
    FOREIGN KEY (account_status_id) REFERENCES account_status(id)
);

-- Roles table
CREATE TABLE IF NOT EXISTS roles(
  id INT AUTO_INCREMENT PRIMARY KEY,
  slug VARCHAR(20) NOT NULL UNIQUE,
  role_name VARCHAR(50) NOT NULL UNIQUE
);

-- User roles (many to many) table
CREATE TABLE IF NOT EXISTS user_roles (
  user_id INT NOT NULL,
  role_id INT NOT NULL,
  PRIMARY KEY (user_id, role_id),

  -- Index to speed up: "find all users with role X"
  KEY idx_user_roles_role (role_id),

  CONSTRAINT fk_user_roles_users
    FOREIGN KEY (user_id) REFERENCES users(id),

  CONSTRAINT fk_user_roles_roles
    FOREIGN KEY (role_id) REFERENCES roles(id)
);

-- =========================
-- SECTION 2: WORKFLOW
-- =========================

-- States of progress for apps and plans
CREATE TABLE IF NOT EXISTS states (
  id INT AUTO_INCREMENT PRIMARY KEY,
  slug VARCHAR(20) NOT NULL UNIQUE,
  state_name VARCHAR(50) NOT NULL UNIQUE
);

-- States of progress for tasks
CREATE TABLE IF NOT EXISTS task_states (
  id INT AUTO_INCREMENT PRIMARY KEY,
  slug VARCHAR(20) NOT NULL UNIQUE,
  task_state_name VARCHAR(50) NOT NULL UNIQUE
);

-- =============================================
-- SECTION 3: APPLICATIONS / PLANS / TASKS
-- =============================================

-- Apps table
CREATE TABLE IF NOT EXISTS applications (
  app_id INT AUTO_INCREMENT PRIMARY KEY,

  app_name VARCHAR(100) NOT NULL,
  app_acronym VARCHAR(20) NOT NULL UNIQUE, -- generate in backend when creating app
  app_description TEXT NULL,

  app_startDate DATE NULL,
  app_endDate DATE NULL,

  project_lead INT NOT NULL, -- users.id with project lead role
  state_id INT NOT NULL DEFAULT 1, -- states.id ("on-going", "completed", but by default set to on-going)

  next_task_no INT NOT NULL DEFAULT 1, -- per-app running number counter for task
  next_plan_no INT NOT NULL DEFAULT 1, -- per-app running number counter for plan

  CONSTRAINT fk_app_project_lead
    FOREIGN KEY (project_lead) REFERENCES users(id),

  CONSTRAINT fk_app_state
    FOREIGN KEY (state_id) REFERENCES states(id)
);

-- Plans table
CREATE TABLE IF NOT EXISTS plans (
  app_acronym VARCHAR(20) NOT NULL,

  plan_no INT NOT NULL, -- running number inside each app

  plan_id VARCHAR(50)
    GENERATED ALWAYS AS (CONCAT(app_acronym, '-', plan_no)) STORED,

  plan_name VARCHAR(100) NOT NULL,
  plan_startDate DATE NULL,
  plan_endDate DATE NULL,

  project_manager INT NOT NULL, -- users.id with project manager role
  state_id INT NOT NULL DEFAULT 1,

  PRIMARY KEY (plan_id),

  UNIQUE KEY uq_plan_no_per_app (app_acronym, plan_no), -- prevent duplicate plan numbers within same app
  UNIQUE KEY uq_plan_name_per_app (app_acronym, plan_name), -- prevent duplicate plan names within same app

  KEY idx_plans_app (app_acronym), -- index lookup

  CONSTRAINT fk_plans_app
    FOREIGN KEY (app_acronym) REFERENCES applications(app_acronym),

  CONSTRAINT fk_plans_pm
    FOREIGN KEY (project_manager) REFERENCES users(id),

  CONSTRAINT fk_plans_state
    FOREIGN KEY (state_id) REFERENCES states(id)
);


-- Tasks table
CREATE TABLE IF NOT EXISTS tasks (
  app_acronym VARCHAR(20) NOT NULL,

  task_no INT NOT NULL, -- Running number inside each app

  -- Your PK format: tms-1, tms-2 ...
  task_id VARCHAR(50)
    GENERATED ALWAYS AS (CONCAT(app_acronym, '-', task_no)) STORED,

  task_name VARCHAR(100) NOT NULL,
  task_description TEXT NULL,
  task_note TEXT NULL,

  -- UPDATED: link to plans via plan_id instead of (app_acronym, plan_no)
  plan_id VARCHAR(50) NULL,

  task_state_id INT NOT NULL DEFAULT 1,  -- task_states.id
  developer INT NULL,          -- users.id with developer role

  task_created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  task_taken_at TIMESTAMP NULL,
  task_update_at TIMESTAMP NULL,

  PRIMARY KEY (task_id),
  UNIQUE KEY uq_task_no_per_app (app_acronym, task_no),

  KEY idx_tasks_app (app_acronym),
  KEY idx_tasks_plan_id (plan_id),
  KEY idx_tasks_state (task_state_id),
  KEY idx_tasks_dev (developer),

  CONSTRAINT fk_tasks_app
    FOREIGN KEY (app_acronym) REFERENCES applications(app_acronym),

  -- UPDATED FK: tasks.plan_id -> plans.plan_id
  CONSTRAINT fk_tasks_plan_by_id
    FOREIGN KEY (plan_id) REFERENCES plans(plan_id),

  CONSTRAINT fk_tasks_task_state
    FOREIGN KEY (task_state_id) REFERENCES task_states(id),

  CONSTRAINT fk_tasks_developer
    FOREIGN KEY (developer) REFERENCES users(id)
);