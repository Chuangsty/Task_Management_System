// export function errorHandler(err, req, res, next) {
//   console.error(err);

//   const status = err.status || 500;

//   res.status(status).json({
//     error: {
//       code: err.code || (status === 400 ? "BAD_REQUEST" : status === 401 ? "UNAUTHORIZED" : status === 403 ? "FORBIDDEN" : status === 404 ? "NOT_FOUND" : "INTERNAL_SERVER_ERROR"),
//       message: err.message || (status === 400 ? "Bad request" : status === 401 ? "Unauthorized" : status === 403 ? "Forbidden" : status === 404 ? "Route not found" : "Server error"),
//     },
//   });
// }

const STATUS_DEFAULT_CODES = {
  400: "BAD_REQUEST",
  401: "UNAUTHORIZED",
  403: "FORBIDDEN",
  404: "NOT_FOUND",
  409: "CONFLICT",
  500: "INTERNAL_SERVER_ERROR",
};

const SHORT_MESSAGES = {
  BAD_REQUEST: "BR",
  UNAUTHORIZED: "UA",
  FORBIDDEN: "FB",
  NOT_FOUND: "NF",
  CONFLICT: "CF",
  INTERNAL_SERVER_ERROR: "ISE",

  APP_NOT_FOUND: "ANF",
  APPLICATION_NOT_FOUND: "ANF",
  TASK_NOT_FOUND: "TNF",
  PLAN_NOT_FOUND: "PNF",
  USER_NOT_FOUND: "UNF",
  EMAIL_NOT_FOUND: "ENF",

  INVALID_TOKEN: "ITK",
  TOKEN_EXPIRED: "TEX",
  INVALID_TOKEN_USER: "ITU",
  ACCOUNT_DISABLED: "ACD",
  AUTH_FAILED: "ATH",

  INVALID_TASK_NAME: "ITN",
  INVALID_TASK_STATE: "ITS",
  TASK_STATE_REQUIRED: "TSR",
  TASK_STATE_NOT_FOUND: "TSF",
  APPLICATION_STATE_NOT_FOUND: "ASF",

  TASK_NAME_CONFLICT: "TNC",
  PLAN_NAME_CONFLICT: "PNC",
  USERNAME_CONFLICT: "UNC",
  EMAIL_CONFLICT: "EMC",
  APP_NAME_CONFLICT: "ANC",

  APP_FORBIDDEN_CREATE_TASK: "AFC",
  TASK_OWNERSHIP_REQUIRED: "TOR",
  TASK_DEV_OWNERSHIP_REQUIRED: "TDR",
  DONE_TASK_NOTE_UPDATE_FORBIDDEN: "DNF",

  TASK_INVALID_STATE_TRANSITION: "TST",
  TASK_NOT_PLANNED: "TNP",
  UNABLE_TO_TAKE_TASK: "UTT",
  UNASSIGNED_TASK: "UAT",
  UNOPEN_TASK_CANNOT_BE_RELEASE: "UOR",
  TASK_CLOSED: "TCL",

  MISSING_TASK_ID: "MTI",
  TASK_ID_REQUIRED: "TIR",
  MISSING_TASK: "MTK",
  MISSING_UPDATE_NOTE_INPUT: "MNI",
  APP_ACRONYM_REQUIRED: "AAR",
  PLAN_NAME_REQUIRED: "PNR",
  PLAN_DATE_REQUIRED: "PDR",
  PLAN_DATE_RANGE_INVALID: "PRI",
  APP_DATE_RANGE_INVALID: "ARI",
  INVALID_EMAIL: "IEM",
  INVALID_PASSWORD: "IPW",
  ROLE_REQUIRED: "RQR",
  INVALID_ROLE: "IRL",
  INVALID_STATUS: "IST",
  SAME_PASSWORD: "SPW",
  NO_UPDATE_FIELDS: "NUF",
  ACTIVE_STATUS_MISSING: "ASM",
  ADMIN_ROLE_MISSING: "ARM",
  DEFAULT_APP_STATE_MISSING: "DAS",

  PLAN_CHANGE_NOT_ALLOWED: "PCNA",
};

export function errorHandler(err, req, res, next) {
  console.error(err);

  let status = Number(err.status);

  // fallback if invalid
  if (!status || status < 100 || status > 599) {
    status = 500;
  }

  const defaultCode = STATUS_DEFAULT_CODES[status] || "INTERNAL_SERVER_ERROR";

  const code = err.code || defaultCode;

  const message = SHORT_MESSAGES[code] || SHORT_MESSAGES[defaultCode] || "ERR";

  res.status(status).json({
    error: {
      code,
      message,
    },
  });
}
