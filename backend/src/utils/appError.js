export function appError(status, code) {
  const err = new Error(code);
  err.status = status;
  err.code = code;
  return err;
}
