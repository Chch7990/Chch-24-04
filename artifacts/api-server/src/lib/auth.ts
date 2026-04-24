import type { Request, Response, NextFunction } from "express";
import { adminSessions } from "./sessions";

export type Caller = {
  uid: string;
  name: string;
  branch: string;
  role: "user" | "admin";
};

/**
 * Soft auth — pulls a caller from either the admin token (if present and
 * valid) or from x-portal-uid/x-portal-name headers that the React wrapper
 * sends after OTP login. Returns null if no caller can be derived.
 */
export function readCaller(req: Request): Caller | null {
  const auth = req.header("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  const sess = token ? adminSessions.get(token) : undefined;
  if (sess) {
    return {
      uid: "admin",
      name: sess.email.split("@")[0] ?? "admin",
      branch: "HO",
      role: "admin",
    };
  }
  const uid = (req.header("x-portal-uid") ?? "").trim();
  const name = (req.header("x-portal-name") ?? "").trim();
  const branch = (req.header("x-portal-branch") ?? "").trim();
  const role = (req.header("x-portal-role") ?? "user").trim() === "admin" ? "admin" : "user";
  if (!uid) return null;
  return { uid, name: name || uid, branch: branch || "—", role };
}

export function requireAnyCaller(req: Request, res: Response, next: NextFunction) {
  const c = readCaller(req);
  if (!c) {
    res.status(401).json({ ok: false, error: "Login required" });
    return;
  }
  (req as Request & { caller: Caller }).caller = c;
  next();
}

export function requireAdminCaller(req: Request, res: Response, next: NextFunction) {
  const c = readCaller(req);
  if (!c) {
    res.status(401).json({ ok: false, error: "Login required" });
    return;
  }
  if (c.role !== "admin") {
    res.status(403).json({ ok: false, error: "Admin only" });
    return;
  }
  (req as Request & { caller: Caller }).caller = c;
  next();
}

export function getCaller(req: Request): Caller {
  const c = (req as Request & { caller?: Caller }).caller;
  if (!c) throw new Error("getCaller called without auth middleware");
  return c;
}
