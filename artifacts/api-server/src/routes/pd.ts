import { Router, type IRouter } from "express";
import { eq, and, gte, lte, desc, sql } from "drizzle-orm";
import {
  db,
  pdMasterClientsTable,
  pdOtherLoansTable,
  pdApplicationsTable,
  pdApplicationDraftsTable,
} from "@workspace/db";
import { requireAnyCaller, requireAdminCaller, getCaller } from "../lib/auth";

const router: IRouter = Router();

/* ---------------- Auth no-ops (legacy hydration calls; harmless) ------- */
router.get("/auth/me", (_req, res) => {
  res.status(401).json({ ok: false });
});
router.post("/auth/logout", (_req, res) => {
  res.json({ ok: true });
});

/* ----------------------------- Master Clients --------------------------- */

// Case- and whitespace-insensitive key lookup so Excel/CSV header variants
// like "Client ID", "Client Id", "client_id", "CLIENTID" all match.
function normKey(k: string): string {
  return String(k).toLowerCase().replace(/[\s_\-./]+/g, "");
}
function pickField(row: Record<string, unknown>, candidates: string[]): string {
  const map: Record<string, unknown> = {};
  for (const k of Object.keys(row)) map[normKey(k)] = row[k];
  for (const c of candidates) {
    const v = map[normKey(c)];
    if (v != null && String(v).trim() !== "") return String(v).trim();
  }
  return "";
}

const CLIENT_ID_KEYS = ["Client ID", "ClientID", "Client Id", "client_id", "clientId", "CID", "MFI Client ID"];
const CLIENT_NAME_KEYS = ["Client Name", "ClientName", "client_name", "clientName", "Name", "Client NAME", "Customer Name"];
const BRANCH_KEYS = ["Branch", "Branch Name", "branch", "BranchName"];
const STATE_KEYS = ["State", "state"];

router.get("/pd/master-clients", requireAnyCaller, async (_req, res) => {
  const rows = await db.select().from(pdMasterClientsTable).orderBy(desc(pdMasterClientsTable.id));
  res.json(
    rows.map((r) => {
      const d = (r.data ?? {}) as Record<string, unknown>;
      return {
        id: r.id,
        clientId: r.clientId,
        clientName: pickField(d, CLIENT_NAME_KEYS),
        branch: pickField(d, BRANCH_KEYS),
        state: pickField(d, STATE_KEYS),
        ...d,
      };
    }),
  );
});

router.post("/pd/master-clients/bulk", requireAdminCaller, async (req, res) => {
  const incoming = Array.isArray(req.body?.rows)
    ? (req.body.rows as Array<Record<string, unknown>>)
    : null;
  if (!incoming) {
    return res.status(400).json({ ok: false, error: "`rows` array required" });
  }
  const replace = req.body?.replace !== false;
  const now = Date.now();
  const headersDetected = incoming[0] ? Object.keys(incoming[0]) : [];

  const cleaned: Array<{ clientId: string; data: Record<string, unknown>; createdAt: number }> = [];
  let skipped = 0;
  for (const row of incoming) {
    const cid = pickField(row, CLIENT_ID_KEYS);
    if (!cid) {
      skipped++;
      continue;
    }
    cleaned.push({ clientId: cid, data: row, createdAt: now });
  }

  // Safety: if all rows had missing Client ID, do NOT wipe existing data.
  if (cleaned.length === 0) {
    return res.status(400).json({
      ok: false,
      error: `No 'Client ID' column found in uploaded file. Detected headers: ${headersDetected.join(", ") || "(none)"}. Acceptable headers: ${CLIENT_ID_KEYS.join(" / ")}.`,
      headersDetected,
      skipped,
    });
  }

  if (replace) {
    await db.delete(pdMasterClientsTable);
  }
  const chunkSize = 500;
  for (let i = 0; i < cleaned.length; i += chunkSize) {
    await db.insert(pdMasterClientsTable).values(cleaned.slice(i, i + chunkSize));
  }
  const total = await db.$count(pdMasterClientsTable);
  res.json({ ok: true, count: total, inserted: cleaned.length, skipped, headersDetected });
});

// Single client lookup with trim + case-insensitive Client ID match.
router.get("/pd/master-clients/:clientId", requireAnyCaller, async (req, res) => {
  const cid = String(req.params["clientId"] ?? "").trim();
  if (!cid) return res.status(400).json({ ok: false, error: "clientId required" });
  // Try exact, then case-insensitive
  let rows = await db
    .select()
    .from(pdMasterClientsTable)
    .where(eq(pdMasterClientsTable.clientId, cid))
    .limit(1);
  if (!rows[0]) {
    rows = await db
      .select()
      .from(pdMasterClientsTable)
      .where(sql`lower(${pdMasterClientsTable.clientId}) = lower(${cid})`)
      .limit(1);
  }
  const r = rows[0];
  if (!r) return res.status(404).json({ ok: false, error: "Not found" });
  const d = (r.data ?? {}) as Record<string, unknown>;
  res.json({
    ok: true,
    client: {
      id: r.id,
      clientId: r.clientId,
      clientName: pickField(d, CLIENT_NAME_KEYS),
      branch: pickField(d, BRANCH_KEYS),
      state: pickField(d, STATE_KEYS),
      ...d,
    },
  });
});

router.delete("/pd/master-clients/:clientId", requireAdminCaller, async (req, res) => {
  const cid = String(req.params["clientId"] ?? "");
  await db.delete(pdMasterClientsTable).where(eq(pdMasterClientsTable.clientId, cid));
  res.json({ ok: true });
});

/* ------------------------------ Other Loans ----------------------------- */

router.get("/pd/other-loans", requireAnyCaller, async (req, res) => {
  const clientId = String(req.query["clientId"] ?? "").trim();
  let rows;
  if (clientId) {
    rows = await db
      .select()
      .from(pdOtherLoansTable)
      .where(eq(pdOtherLoansTable.clientId, clientId));
  } else {
    rows = await db.select().from(pdOtherLoansTable).orderBy(desc(pdOtherLoansTable.id));
  }
  res.json(rows.map((r) => ({ id: r.id, clientId: r.clientId, ...r.data })));
});

router.post("/pd/other-loans/bulk", requireAdminCaller, async (req, res) => {
  const incoming = Array.isArray(req.body?.rows)
    ? (req.body.rows as Array<Record<string, unknown>>)
    : null;
  if (!incoming) {
    return res.status(400).json({ ok: false, error: "`rows` array required" });
  }
  const replace = req.body?.replace !== false;
  const now = Date.now();
  const headersDetected = incoming[0] ? Object.keys(incoming[0]) : [];
  const cleaned: Array<{ clientId: string; data: Record<string, unknown>; createdAt: number }> = [];
  let skipped = 0;
  for (const row of incoming) {
    const cid = pickField(row, CLIENT_ID_KEYS);
    if (!cid) {
      skipped++;
      continue;
    }
    cleaned.push({ clientId: cid, data: row, createdAt: now });
  }
  if (cleaned.length === 0) {
    return res.status(400).json({
      ok: false,
      error: `No 'Client ID' column found in uploaded file. Detected headers: ${headersDetected.join(", ") || "(none)"}.`,
      headersDetected,
      skipped,
    });
  }
  if (replace) {
    await db.delete(pdOtherLoansTable);
  }
  const chunkSize = 500;
  for (let i = 0; i < cleaned.length; i += chunkSize) {
    await db.insert(pdOtherLoansTable).values(cleaned.slice(i, i + chunkSize));
  }
  const total = await db.$count(pdOtherLoansTable);
  res.json({ ok: true, count: total, inserted: cleaned.length, skipped, headersDetected });
});

/* ------------------------------ Draft (per user) ----------------------- */

router.get("/pd/draft", requireAnyCaller, async (req, res) => {
  const c = getCaller(req);
  const rows = await db
    .select()
    .from(pdApplicationDraftsTable)
    .where(eq(pdApplicationDraftsTable.ownerUid, c.uid))
    .limit(1);
  if (!rows[0]) return res.json({ ok: true, draft: null });
  res.json({
    ok: true,
    draft: { payload: rows[0].payload, photos: rows[0].photos, updatedAt: rows[0].updatedAt },
  });
});

router.put("/pd/draft", requireAnyCaller, async (req, res) => {
  const c = getCaller(req);
  const payload = (req.body?.payload ?? {}) as Record<string, unknown>;
  const photos = Array.isArray(req.body?.photos)
    ? (req.body.photos as Array<Record<string, unknown>>)
    : [];
  const updatedAt = Date.now();
  const existing = await db
    .select({ uid: pdApplicationDraftsTable.ownerUid })
    .from(pdApplicationDraftsTable)
    .where(eq(pdApplicationDraftsTable.ownerUid, c.uid))
    .limit(1);
  if (existing[0]) {
    await db
      .update(pdApplicationDraftsTable)
      .set({ payload, photos, updatedAt })
      .where(eq(pdApplicationDraftsTable.ownerUid, c.uid));
  } else {
    await db.insert(pdApplicationDraftsTable).values({
      ownerUid: c.uid,
      payload,
      photos,
      updatedAt,
    });
  }
  res.json({ ok: true, updatedAt });
});

router.delete("/pd/draft", requireAnyCaller, async (req, res) => {
  const c = getCaller(req);
  await db.delete(pdApplicationDraftsTable).where(eq(pdApplicationDraftsTable.ownerUid, c.uid));
  res.json({ ok: true });
});

/* ------------------------------ Applications --------------------------- */

function genId() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

router.get("/pd/applications", requireAnyCaller, async (req, res) => {
  const c = getCaller(req);
  const status = String(req.query["status"] ?? "").trim();
  const from = String(req.query["from"] ?? "").trim();
  const to = String(req.query["to"] ?? "").trim();
  const wheres = [] as ReturnType<typeof eq>[];
  if (c.role !== "admin") {
    wheres.push(eq(pdApplicationsTable.ownerUid, c.uid));
  }
  if (status) wheres.push(eq(pdApplicationsTable.status, status));
  if (from) {
    const t = new Date(from).getTime();
    if (!Number.isNaN(t)) wheres.push(gte(pdApplicationsTable.submittedAt, t));
  }
  if (to) {
    const t = new Date(to).getTime() + 24 * 60 * 60 * 1000 - 1;
    if (!Number.isNaN(t)) wheres.push(lte(pdApplicationsTable.submittedAt, t));
  }
  const rows = wheres.length
    ? await db
        .select()
        .from(pdApplicationsTable)
        .where(and(...wheres))
        .orderBy(desc(pdApplicationsTable.submittedAt))
    : await db
        .select()
        .from(pdApplicationsTable)
        .orderBy(desc(pdApplicationsTable.submittedAt));
  res.json(rows);
});

router.post("/pd/applications", requireAnyCaller, async (req, res) => {
  const c = getCaller(req);
  const body = (req.body ?? {}) as Record<string, unknown>;
  const payload = (body["payload"] ?? body) as Record<string, unknown>;
  const photos = Array.isArray(body["photos"])
    ? (body["photos"] as Array<Record<string, unknown>>)
    : [];
  const clientId = String(payload["clientId"] ?? payload["a_clientId"] ?? "").trim();
  const clientName = String(payload["name"] ?? payload["a_name"] ?? "").trim();
  if (!clientId) return res.status(400).json({ ok: false, error: "clientId required" });

  const app = {
    id: genId(),
    ownerUid: c.uid,
    ownerName: c.name,
    ownerBranch: c.branch,
    clientId,
    clientName,
    status: "Pending",
    payload,
    photos,
    submittedAt: Date.now(),
  };
  await db.insert(pdApplicationsTable).values(app);
  // Clear the draft after a successful submit
  await db.delete(pdApplicationDraftsTable).where(eq(pdApplicationDraftsTable.ownerUid, c.uid));
  res.json({ ok: true, application: app });
});

router.get("/pd/applications/:id", requireAnyCaller, async (req, res) => {
  const c = getCaller(req);
  const id = String(req.params["id"] ?? "");
  const rows = await db
    .select()
    .from(pdApplicationsTable)
    .where(eq(pdApplicationsTable.id, id))
    .limit(1);
  const app = rows[0];
  if (!app) return res.status(404).json({ ok: false, error: "Not found" });
  if (c.role !== "admin" && app.ownerUid !== c.uid) {
    return res.status(403).json({ ok: false, error: "Not allowed" });
  }
  res.json({ ok: true, application: app });
});

router.post("/pd/applications/:id/status", requireAdminCaller, async (req, res) => {
  const id = String(req.params["id"] ?? "");
  const status = String(req.body?.status ?? "").trim();
  const remarks = String(req.body?.remarks ?? "").trim();
  if (!status) return res.status(400).json({ ok: false, error: "status required" });
  const result = await db
    .update(pdApplicationsTable)
    .set({ status, remarks, decidedAt: Date.now() })
    .where(eq(pdApplicationsTable.id, id))
    .returning();
  if (!result[0]) return res.status(404).json({ ok: false, error: "Not found" });
  res.json({ ok: true, application: result[0] });
});

/* ------------------------------ Stats / Dashboard ---------------------- */

router.get("/pd/applications-stats", requireAdminCaller, async (_req, res) => {
  const rows = await db
    .select({
      status: pdApplicationsTable.status,
      count: sql<number>`count(*)::int`.as("count"),
    })
    .from(pdApplicationsTable)
    .groupBy(pdApplicationsTable.status);
  res.json({ ok: true, byStatus: rows });
});

export default router;
