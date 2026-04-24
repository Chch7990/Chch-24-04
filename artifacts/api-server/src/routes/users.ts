import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import * as fs from "node:fs";
import * as path from "node:path";
import { adminSessions } from "../lib/sessions";

const router: IRouter = Router();

type ManagedUser = {
  uid: string;
  name: string;
  email: string;
  branch: string;
  createdAt: number;
};

const DATA_DIR = path.resolve(process.cwd(), "data");
const USERS_FILE = path.join(DATA_DIR, "users.json");

function ensureStorage() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(USERS_FILE)) fs.writeFileSync(USERS_FILE, "[]", "utf8");
}

function readUsers(): ManagedUser[] {
  ensureStorage();
  try {
    const raw = fs.readFileSync(USERS_FILE, "utf8");
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? (arr as ManagedUser[]) : [];
  } catch {
    return [];
  }
}

function writeUsers(users: ManagedUser[]) {
  ensureStorage();
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), "utf8");
}

function isValidEmail(s: unknown): s is string {
  return typeof s === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

function normalizeEmail(s: unknown): string {
  return (typeof s === "string" ? s : "").trim().toLowerCase();
}

function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const auth = req.header("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  const sess = token ? adminSessions.get(token) : undefined;
  if (!sess) {
    res.status(401).json({ ok: false, error: "Admin login required" });
    return;
  }
  next();
}

// Public — used by the wrapper login screen to check whether an email is allowed
router.get("/users/lookup", (req, res) => {
  const email = normalizeEmail(req.query["email"]);
  if (!isValidEmail(email)) {
    return res.status(400).json({ ok: false, error: "Invalid email" });
  }
  const u = readUsers().find((x) => x.email === email);
  if (!u) return res.json({ ok: true, exists: false });
  return res.json({
    ok: true,
    exists: true,
    user: { uid: u.uid, name: u.name, email: u.email, branch: u.branch },
  });
});

// Admin-only — list all managed users
router.get("/users", requireAdmin, (_req, res) => {
  const users = readUsers().sort((a, b) => b.createdAt - a.createdAt);
  res.json({ ok: true, users });
});

// Admin-only — create one user
router.post("/users", requireAdmin, (req, res) => {
  const uid = (req.body?.uid ?? "").toString().trim();
  const name = (req.body?.name ?? "").toString().trim();
  const email = normalizeEmail(req.body?.email);
  const branch = (req.body?.branch ?? "").toString().trim() || "—";

  if (!uid) return res.status(400).json({ ok: false, error: "User ID required" });
  if (!name) return res.status(400).json({ ok: false, error: "Name required" });
  if (!isValidEmail(email))
    return res.status(400).json({ ok: false, error: "Valid email required" });

  const users = readUsers();
  if (users.find((u) => u.email === email)) {
    return res.status(409).json({ ok: false, error: "Email already registered" });
  }
  if (users.find((u) => u.uid.toLowerCase() === uid.toLowerCase())) {
    return res.status(409).json({ ok: false, error: "User ID already exists" });
  }

  const user: ManagedUser = { uid, name, email, branch, createdAt: Date.now() };
  users.push(user);
  writeUsers(users);
  res.json({ ok: true, user });
});

// Admin-only — delete a user
router.delete("/users/:uid", requireAdmin, (req, res) => {
  const uid = (req.params["uid"] ?? "").toString();
  const users = readUsers();
  const next = users.filter((u) => u.uid !== uid);
  if (next.length === users.length) {
    return res.status(404).json({ ok: false, error: "Not found" });
  }
  writeUsers(next);
  res.json({ ok: true });
});

// Admin-only — bulk upload (replace or append based on `mode`)
router.post("/users/bulk", requireAdmin, (req, res) => {
  const mode = (req.body?.mode ?? "append").toString();
  const incoming = Array.isArray(req.body?.users) ? req.body.users : null;
  if (!incoming) {
    return res.status(400).json({ ok: false, error: "`users` array required" });
  }

  const cleaned: ManagedUser[] = [];
  const errors: { row: number; reason: string }[] = [];
  incoming.forEach((row: unknown, i: number) => {
    const r = (row ?? {}) as Record<string, unknown>;
    const uid = (r["uid"] ?? r["UID"] ?? r["User ID"] ?? r["user_id"] ?? "").toString().trim();
    const name = (r["name"] ?? r["Name"] ?? "").toString().trim();
    const email = normalizeEmail(r["email"] ?? r["Email"]);
    const branch = (r["branch"] ?? r["Branch"] ?? "—").toString().trim() || "—";
    if (!uid) return errors.push({ row: i + 1, reason: "Missing User ID" });
    if (!name) return errors.push({ row: i + 1, reason: "Missing Name" });
    if (!isValidEmail(email)) return errors.push({ row: i + 1, reason: "Invalid email" });
    cleaned.push({ uid, name, email, branch, createdAt: Date.now() });
  });

  let users = mode === "replace" ? [] : readUsers();
  let added = 0;
  let skipped = 0;
  for (const u of cleaned) {
    if (users.find((x) => x.email === u.email || x.uid.toLowerCase() === u.uid.toLowerCase())) {
      skipped++;
      continue;
    }
    users.push(u);
    added++;
  }
  writeUsers(users);
  res.json({ ok: true, added, skipped, errors, total: users.length });
});

export default router;
export { readUsers };
