import { Router, type IRouter } from "express";
import { eq, desc, sql, and, or, ilike } from "drizzle-orm";
import { db, lucClientsTable, lucVisitsTable } from "@workspace/db";
import { requireAnyCaller, requireAdminCaller, getCaller } from "../lib/auth";

const router: IRouter = Router();

function num(v: unknown, def = 0): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
}
function str(v: unknown, def = ""): string {
  return v == null ? def : String(v);
}

/* --------------------------------- Clients ----------------------------- */

router.get("/luc/clients", requireAnyCaller, async (req, res) => {
  const search = String(req.query["search"] ?? "").trim();
  const branch = String(req.query["branch"] ?? "").trim();
  const wheres = [] as ReturnType<typeof eq>[];
  if (branch) wheres.push(eq(lucClientsTable.branch, branch));
  if (search) {
    const like = `%${search}%`;
    wheres.push(
      or(
        ilike(lucClientsTable.clientId, like),
        ilike(lucClientsTable.clientName, like),
        ilike(lucClientsTable.branch, like),
      )!,
    );
  }
  const rows = wheres.length
    ? await db
        .select()
        .from(lucClientsTable)
        .where(and(...wheres))
        .orderBy(desc(lucClientsTable.id))
    : await db.select().from(lucClientsTable).orderBy(desc(lucClientsTable.id));
  res.json({ ok: true, clients: rows });
});

router.get("/luc/clients/:clientId", requireAnyCaller, async (req, res) => {
  const cid = String(req.params["clientId"] ?? "").trim();
  const rows = await db
    .select()
    .from(lucClientsTable)
    .where(eq(lucClientsTable.clientId, cid))
    .limit(1);
  if (!rows[0]) return res.status(404).json({ ok: false, error: "Not found" });
  const visits = await db
    .select()
    .from(lucVisitsTable)
    .where(eq(lucVisitsTable.clientId, cid))
    .limit(1);
  res.json({ ok: true, client: rows[0], visit: visits[0] ?? null });
});

router.post("/luc/clients", requireAdminCaller, async (req, res) => {
  const b = req.body ?? {};
  const clientId = str(b.clientId).trim();
  const clientName = str(b.clientName).trim();
  if (!clientId) return res.status(400).json({ ok: false, error: "clientId required" });
  if (!clientName) return res.status(400).json({ ok: false, error: "clientName required" });
  const exists = await db
    .select({ id: lucClientsTable.id })
    .from(lucClientsTable)
    .where(eq(lucClientsTable.clientId, clientId))
    .limit(1);
  if (exists[0]) return res.status(409).json({ ok: false, error: "clientId already exists" });
  const inserted = await db
    .insert(lucClientsTable)
    .values({
      clientId,
      clientName,
      state: str(b.state).trim(),
      branch: str(b.branch).trim(),
      loanType: str(b.loanType, "Unsecured Business Loan").trim(),
      loanAmount: num(b.loanAmount, 0),
      disbursementDate: str(b.disbursementDate).trim(),
      loanPurpose: str(b.loanPurpose).trim(),
      createdAt: Date.now(),
    })
    .returning();
  res.json({ ok: true, client: inserted[0] });
});

router.delete("/luc/clients/:clientId", requireAdminCaller, async (req, res) => {
  const cid = String(req.params["clientId"] ?? "").trim();
  await db.delete(lucVisitsTable).where(eq(lucVisitsTable.clientId, cid));
  const result = await db
    .delete(lucClientsTable)
    .where(eq(lucClientsTable.clientId, cid))
    .returning();
  if (!result[0]) return res.status(404).json({ ok: false, error: "Not found" });
  res.json({ ok: true });
});

router.post("/luc/clients/bulk", requireAdminCaller, async (req, res) => {
  const mode = (req.body?.mode ?? "append").toString();
  const incoming = Array.isArray(req.body?.clients)
    ? (req.body.clients as Array<Record<string, unknown>>)
    : null;
  if (!incoming) return res.status(400).json({ ok: false, error: "`clients` array required" });
  if (mode === "replace") {
    await db.delete(lucVisitsTable);
    await db.delete(lucClientsTable);
  }
  const now = Date.now();
  const errors: { row: number; reason: string }[] = [];
  let added = 0;
  let skipped = 0;
  // Pre-load existing IDs to skip duplicates
  const existing = await db.select({ cid: lucClientsTable.clientId }).from(lucClientsTable);
  const existingSet = new Set(existing.map((r) => r.cid));
  const toInsert: typeof lucClientsTable.$inferInsert[] = [];
  incoming.forEach((row, i) => {
    const r = row ?? {};
    const clientId = str(
      r["clientId"] ??
        r["Client Id"] ??
        r["Client ID"] ??
        r["client_id"] ??
        r["ClientId"] ??
        "",
    ).trim();
    const clientName = str(
      r["clientName"] ?? r["Client Name"] ?? r["Client NAME"] ?? r["client_name"] ?? "",
    ).trim();
    if (!clientId) return errors.push({ row: i + 1, reason: "Missing Client Id" });
    if (!clientName) return errors.push({ row: i + 1, reason: "Missing Client Name" });
    if (existingSet.has(clientId)) {
      skipped++;
      return;
    }
    existingSet.add(clientId);
    toInsert.push({
      clientId,
      clientName,
      state: str(r["state"] ?? r["State"] ?? "").trim(),
      branch: str(r["branch"] ?? r["Branch Name"] ?? r["Branch"] ?? "").trim(),
      loanType: str(
        r["loanType"] ?? r["Loan Type"] ?? "Unsecured Business Loan",
      ).trim() || "Unsecured Business Loan",
      loanAmount: num(r["loanAmount"] ?? r["Loan Amount"] ?? r["Laon amount"] ?? 0),
      disbursementDate: str(
        r["disbursementDate"] ?? r["Dis Date"] ?? r["Disbursement Date"] ?? "",
      ).trim(),
      loanPurpose: str(r["loanPurpose"] ?? r["Loan Purpose"] ?? "").trim(),
      createdAt: now,
    });
    added++;
  });
  if (toInsert.length) {
    const chunk = 500;
    for (let i = 0; i < toInsert.length; i += chunk) {
      await db.insert(lucClientsTable).values(toInsert.slice(i, i + chunk));
    }
  }
  res.json({ ok: true, added, skipped, errors, total: existingSet.size });
});

/* --------------------------------- Visits ------------------------------ */

router.get("/luc/visits", requireAnyCaller, async (req, res) => {
  const status = String(req.query["status"] ?? "").trim();
  const approved = String(req.query["approved"] ?? "").trim();
  const wheres = [] as ReturnType<typeof eq>[];
  if (status) wheres.push(eq(lucVisitsTable.status, status));
  if (approved) wheres.push(eq(lucVisitsTable.approved, approved));
  const rows = wheres.length
    ? await db
        .select()
        .from(lucVisitsTable)
        .where(and(...wheres))
        .orderBy(desc(lucVisitsTable.updatedAt))
    : await db.select().from(lucVisitsTable).orderBy(desc(lucVisitsTable.updatedAt));
  res.json({ ok: true, visits: rows });
});

router.post("/luc/visits", requireAnyCaller, async (req, res) => {
  const c = getCaller(req);
  const b = req.body ?? {};
  const clientId = str(b.clientId).trim();
  const visitDate = str(b.visitDate).trim();
  const visitPerson = str(b.visitPerson).trim();
  const empCode = str(b.empCode).trim() || c.uid;
  if (!clientId) return res.status(400).json({ ok: false, error: "clientId required" });
  if (!visitDate) return res.status(400).json({ ok: false, error: "visitDate required" });
  if (!visitPerson) return res.status(400).json({ ok: false, error: "visitPerson required" });

  const photos = Array.isArray(b.photos) ? (b.photos as string[]).slice(0, 5) : [];
  const now = Date.now();

  // upsert: one visit per client (matches HTML behavior)
  const existing = await db
    .select({ id: lucVisitsTable.id })
    .from(lucVisitsTable)
    .where(eq(lucVisitsTable.clientId, clientId))
    .limit(1);

  if (existing[0]) {
    const updated = await db
      .update(lucVisitsTable)
      .set({
        visitDate,
        visitPerson,
        empCode,
        loanUsedIn: str(b.loanUsedIn).trim(),
        observation: str(b.observation).trim(),
        remark: str(b.remark).trim(),
        photos,
        status: "done",
        submittedByUid: c.uid,
        submittedByName: c.name,
        updatedAt: now,
      })
      .where(eq(lucVisitsTable.id, existing[0].id))
      .returning();
    return res.json({ ok: true, visit: updated[0] });
  }
  const inserted = await db
    .insert(lucVisitsTable)
    .values({
      clientId,
      visitDate,
      visitPerson,
      empCode,
      loanUsedIn: str(b.loanUsedIn).trim(),
      observation: str(b.observation).trim(),
      remark: str(b.remark).trim(),
      photos,
      status: "done",
      approved: "",
      submittedByUid: c.uid,
      submittedByName: c.name,
      createdAt: now,
      updatedAt: now,
    })
    .returning();
  res.json({ ok: true, visit: inserted[0] });
});

router.patch("/luc/visits/:clientId/approval", requireAdminCaller, async (req, res) => {
  const cid = String(req.params["clientId"] ?? "").trim();
  const approved = String(req.body?.approved ?? "").trim();
  if (!["", "approved", "rejected"].includes(approved)) {
    return res.status(400).json({ ok: false, error: "Invalid approval value" });
  }
  const updated = await db
    .update(lucVisitsTable)
    .set({ approved, updatedAt: Date.now() })
    .where(eq(lucVisitsTable.clientId, cid))
    .returning();
  if (!updated[0]) return res.status(404).json({ ok: false, error: "Not found" });
  res.json({ ok: true, visit: updated[0] });
});

router.post("/luc/visits/approve-all", requireAdminCaller, async (_req, res) => {
  const now = Date.now();
  await db
    .update(lucVisitsTable)
    .set({ approved: "approved", updatedAt: now })
    .where(and(eq(lucVisitsTable.status, "done"), eq(lucVisitsTable.approved, "")));
  res.json({ ok: true });
});

/* ------------------------------- Combined ------------------------------ */
// All client+visit rows in one shot for the admin dashboard tables.
router.get("/luc/all-data", requireAnyCaller, async (_req, res) => {
  const rows = await db
    .select({
      c: lucClientsTable,
      v: lucVisitsTable,
    })
    .from(lucClientsTable)
    .leftJoin(lucVisitsTable, eq(lucVisitsTable.clientId, lucClientsTable.clientId))
    .orderBy(desc(lucClientsTable.id));
  res.json({
    ok: true,
    rows: rows.map(({ c, v }) => ({
      clientId: c.clientId,
      clientName: c.clientName,
      state: c.state,
      branch: c.branch,
      loanType: c.loanType,
      loanAmount: c.loanAmount,
      disbursementDate: c.disbursementDate,
      loanPurpose: c.loanPurpose,
      visitDate: v?.visitDate ?? "",
      visitPerson: v?.visitPerson ?? "",
      empCode: v?.empCode ?? "",
      loanUsedIn: v?.loanUsedIn ?? "",
      observation: v?.observation ?? "",
      remark: v?.remark ?? "",
      photos: v?.photos ?? [],
      status: v ? v.status : "pending",
      approved: v?.approved ?? "",
    })),
  });
});

router.get("/luc/stats", requireAnyCaller, async (_req, res) => {
  const total = await db.$count(lucClientsTable);
  const completed = await db.$count(lucVisitsTable, eq(lucVisitsTable.status, "done"));
  const approved = await db.$count(lucVisitsTable, eq(lucVisitsTable.approved, "approved"));
  const pending = total - completed;
  res.json({ ok: true, total, completed, pending, approved });
});

export default router;
