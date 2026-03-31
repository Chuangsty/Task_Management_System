import { appError } from "../utils/appError.js";

// Usage: for example requireRole("ADMIN")
export function requireRole(roleSlug) {
  return (req, res, next) => {
    // Get user's roles from request (attached by requireAuth from auth.middleware.js)
    // Default to empty array if undefined
    const roles = req.user?.roles || [];

    //  If required role doesn't match user's role array
    if (!roles.includes(roleSlug)) {
      return next(appError(403, "FORBIDDEN"));
    }
    // if (!roles.includes(roleSlug)) {
    //   const err = new Error("Forbidden");
    //   err.status = 403;
    //   return next(err);
    // }

    next();
  };
}
