import { api } from "./client";

export function getRoles() {
  return api.get("/api/roles");
}
