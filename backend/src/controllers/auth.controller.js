import { loginService, getUserMeService } from "../services/auth.service.js";

// Controller: handles HTTP layer only
export async function login(req, res, next) {
  try {
    const { email, password } = req.body;
    const result = await loginService({ email, password });

    const cookieName = process.env.JWT_COOKIE_NAME || "token";
    const isProd = process.env.NODE_ENV === "production";

    res.cookie(cookieName, result.token, {
      // Token stored as cookie with the below
      httpOnly: true, // Prevent JS in browser from seeing the token
      secure: isProd, // true in production (HTTPS): Cookie is only sent over HTTPS
      sameSite: isProd ? "none" : "lax", // Lax allows for backend and frontend to communicate as they are in different origin
      path: "/",
    });

    // Return safe payload (no token needed in frontend now)
    res.json({ user: result.user, message: "Logged in" });

    // res.json(result); // Frontend stores token in localStorage
  } catch (err) {
    next(err);
  }
}

// GET /api/auth/me
export async function meController(req, res, next) {
  try {
    // req.user is set by requireAuth after verifying cookie JWT
    const UId = req.user.id;

    const me = await getUserMeService(UId);
    res.json({ user: me });
  } catch (err) {
    next(err);
  }
}

export async function logout(req, res) {
  const cookieName = process.env.JWT_COOKIE_NAME || "token";
  const isProd = process.env.NODE_ENV === "production";

  res.clearCookie(cookieName, {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? "none" : "lax",
    path: "/",
  });

  res.json({ message: "Logged out" });
}
