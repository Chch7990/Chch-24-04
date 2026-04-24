import { Router, type IRouter } from "express";
import { readUsers } from "./users";
import { adminSessions } from "../lib/sessions";

const router: IRouter = Router();

type OtpEntry = { code: string; expiresAt: number; attempts: number; role: "user" | "admin" };
const store = new Map<string, OtpEntry>();

const TTL_MS = 5 * 60 * 1000;
const MAX_ATTEMPTS = 5;

function genCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function genToken(): string {
  return (
    Math.random().toString(36).slice(2) +
    Math.random().toString(36).slice(2) +
    Date.now().toString(36)
  );
}

function isValidEmail(s: unknown): s is string {
  return typeof s === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

router.post("/otp/send", (req, res) => {
  const email = (req.body?.email ?? "").toString().trim().toLowerCase();
  const role = req.body?.role === "user" ? "user" : "admin";
  if (!isValidEmail(email)) {
    return res.status(400).json({ ok: false, error: "Invalid email" });
  }

  // For user logins: only admin-created users may receive an OTP
  if (role === "user") {
    const u = readUsers().find((x) => x.email === email);
    if (!u) {
      return res
        .status(403)
        .json({ ok: false, error: "Email not registered. Ask admin to create your account." });
    }
  }

  const code = genCode();
  store.set(`${role}:${email}`, { code, expiresAt: Date.now() + TTL_MS, attempts: 0, role });
  // No email service is configured. Return the OTP in the response so the
  // wrapper UI can show it as a demo. Replace with real email sending later.
  return res.json({ ok: true, email, role, devCode: code, ttlSeconds: TTL_MS / 1000 });
});

router.post("/otp/verify", (req, res) => {
  const email = (req.body?.email ?? "").toString().trim().toLowerCase();
  const code = (req.body?.code ?? "").toString().trim();
  const role = req.body?.role === "user" ? "user" : "admin";
  if (!isValidEmail(email)) {
    return res.status(400).json({ ok: false, error: "Invalid email" });
  }
  const key = `${role}:${email}`;
  const entry = store.get(key);
  if (!entry) {
    return res
      .status(400)
      .json({ ok: false, error: "No code requested. Send OTP first." });
  }
  if (Date.now() > entry.expiresAt) {
    store.delete(key);
    return res.status(400).json({ ok: false, error: "Code expired" });
  }
  entry.attempts += 1;
  if (entry.attempts > MAX_ATTEMPTS) {
    store.delete(key);
    return res
      .status(429)
      .json({ ok: false, error: "Too many attempts. Request a new code." });
  }
  if (entry.code !== code) {
    return res.status(400).json({ ok: false, error: "Incorrect code" });
  }
  store.delete(key);

  if (role === "admin") {
    const token = genToken();
    adminSessions.set(token, { email, createdAt: Date.now() });
    return res.json({ ok: true, token, email, role });
  }

  // User login — return the user record from the managed users list
  const u = readUsers().find((x) => x.email === email);
  if (!u) {
    return res
      .status(403)
      .json({ ok: false, error: "User no longer exists. Contact admin." });
  }
  return res.json({
    ok: true,
    role: "user",
    user: { uid: u.uid, name: u.name, email: u.email, branch: u.branch },
  });
});

router.get("/otp/me", (req, res) => {
  const auth = req.header("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  const sess = token ? adminSessions.get(token) : undefined;
  if (!sess) return res.status(401).json({ ok: false });
  return res.json({ ok: true, email: sess.email });
});

export default router;
