import axios from "axios";

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || "http://localhost:3000",
  withCredentials: true,
  headers: { "Content-Type": "application/json" },
});

// Prevent multiple redirects firing at once
let isRedirectingToLogin = false;

// axios allows intercepting every req or res
api.interceptors.response.use(
  // success handler: return res normally if req status 200/201/etc
  (response) => response,
  // when req fails
  (error) => {
    // get HTTP status code, error code
    const code = error?.response?.status; // optional chaining '?' to prevent crashes/error
    const requestUrl = error?.config?.url || "";

    const isLoginRequest = requestUrl.includes("/api/auth/login") || requestUrl.includes("/auth/login");

    // when code 401/403 & isRedirectingToLogin false
    if ((code === 401 || code === 403) && !isLoginRequest && !isRedirectingToLogin) {
      isRedirectingToLogin = true; // prevents any other request from triggering another redirect

      // force redirect to login
      window.location.href = "/login";
    }

    // rethrow the error
    return Promise.reject(error); // ensures the original request still fails normally
  },
);
