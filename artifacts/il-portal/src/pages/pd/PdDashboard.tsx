import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost } from "../../lib/api";
import { showToast } from "../../components/Toast";
import { downloadCsv } from "../../lib/csv";
import type { PdApplication, PdPayload } from "./types";

type DetailTab =
  | "summary"
  | "applicant"
  | "coapplicant"
  | "family"
  | "bank"
  | "otherloans"
  | "eligibility"
  | "reference"
  | "casestudy"
  | "photos"
  | "empdetails";

const TABS: { id: DetailTab; label: string; icon: string }[] = [
  { id: "summary", label: "Summary", icon: "📋" },
  { id: "applicant", label: "Applicant", icon: "👤" },
  { id: "coapplicant", label: "Co-applicant", icon: "👥" },
  { id: "family", label: "Family", icon: "🏠" },
  { id: "bank", label: "Bank", icon: "🏦" },
  { id: "otherloans", label: "Other Loans", icon: "📑" },
  { id: "eligibility", label: "Eligibility", icon: "✅" },
  { id: "reference", label: "References", icon: "📞" },
  { id: "casestudy", label: "Case Study", icon: "📝" },
  { id: "photos", label: "Photos", icon: "📷" },
  { id: "empdetails", label: "EMP Details", icon: "🪪" },
];

export default function PdDashboard() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [detail, setDetail] = useState<PdApplication | null>(null);
  const [tab, setTab] = useState<DetailTab>("summary");
  const [remarks, setRemarks] = useState("");

  const apps = useQuery({
    queryKey: ["pd", "applications"],
    queryFn: () => apiGet<PdApplication[]>("/pd/applications"),
  });

  const stats = useQuery({
    queryKey: ["pd", "stats"],
    queryFn: () =>
      apiGet<{ ok: boolean; byStatus: { status: string; count: number }[] }>("/pd/applications-stats"),
  });

  const setStatus = useMutation({
    mutationFn: (v: { id: string; status: string; remarks?: string }) =>
      apiPost<{ ok: boolean }>(`/pd/applications/${v.id}/status`, {
        status: v.status,
        remarks: v.remarks ?? "",
      }),
    onSuccess: () => {
      showToast("Updated", "ok");
      qc.invalidateQueries({ queryKey: ["pd"] });
      setDetail(null);
      setRemarks("");
    },
    onError: (e: Error) => showToast(e.message, "err"),
  });

  function openDetail(a: PdApplication) {
    setDetail(a);
    setTab("summary");
    setRemarks(a.remarks ?? "");
  }

  const list = apps.data ?? [];
  const filtered = list.filter((a) => {
    if (statusFilter && a.status !== statusFilter) return false;
    if (search) {
      const s = search.toLowerCase();
      if (
        !a.clientId.toLowerCase().includes(s) &&
        !a.clientName.toLowerCase().includes(s) &&
        !a.ownerName.toLowerCase().includes(s)
      )
        return false;
    }
    return true;
  });

  const counts: Record<string, number> = {};
  for (const r of stats.data?.byStatus ?? []) counts[r.status] = r.count;
  const total = list.length;

  return (
    <div className="space-y-5 max-w-6xl mx-auto">
      <div>
        <h1 className="text-xl font-extrabold text-slate-800">📋 PD Client Dashboard</h1>
        <p className="text-sm text-slate-500">Submitted applications, decisions and exports</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Total" value={total} color="from-blue-500 to-blue-700" />
        <Stat label="Pending" value={counts["Pending"] ?? 0} color="from-amber-500 to-amber-700" />
        <Stat label="Approved" value={counts["Approved"] ?? 0} color="from-emerald-500 to-emerald-700" />
        <Stat label="Rejected" value={counts["Rejected"] ?? 0} color="from-rose-500 to-rose-700" />
      </div>

      <div className="flex gap-2 flex-wrap">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search Client ID / Name / Submitter…"
          className="flex-1 min-w-[200px] border border-slate-300 rounded-lg px-3 py-2 text-sm"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="border border-slate-300 rounded-lg px-3 py-2 text-sm"
        >
          <option value="">All Status</option>
          <option>Pending</option>
          <option>Approved</option>
          <option>Rejected</option>
          <option>On Hold</option>
        </select>
        <button
          onClick={() =>
            downloadCsv(
              "pd-applications.csv",
              filtered.map((a) => ({
                id: a.id,
                clientId: a.clientId,
                clientName: a.clientName,
                ownerName: a.ownerName,
                ownerBranch: a.ownerBranch,
                status: a.status,
                decision: a.payload.decision,
                remarks: a.remarks ?? "",
                submittedAt: new Date(a.submittedAt).toISOString(),
              })),
            )
          }
          className="text-xs font-bold border border-slate-300 hover:border-[#1a3c5e] rounded px-3 py-2"
        >
          📥 Export CSV
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="overflow-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="text-left px-3 py-2">Submitted</th>
                <th className="text-left px-3 py-2">Client ID</th>
                <th className="text-left px-3 py-2">Client Name</th>
                <th className="text-left px-3 py-2">Submitted By</th>
                <th className="text-left px-3 py-2">Branch</th>
                <th className="text-left px-3 py-2">PD Decision</th>
                <th className="text-left px-3 py-2">Status</th>
                <th className="text-left px-3 py-2">Action</th>
              </tr>
            </thead>
            <tbody>
              {apps.isLoading && (
                <tr><td colSpan={8} className="px-3 py-8 text-center text-slate-400">Loading…</td></tr>
              )}
              {!apps.isLoading && filtered.length === 0 && (
                <tr><td colSpan={8} className="px-3 py-8 text-center text-slate-400">No applications</td></tr>
              )}
              {filtered.map((a) => (
                <tr key={a.id} className="border-t border-slate-100">
                  <td className="px-3 py-2 text-xs">{new Date(a.submittedAt).toLocaleString("en-IN")}</td>
                  <td className="px-3 py-2 font-mono text-xs">{a.clientId}</td>
                  <td className="px-3 py-2 font-semibold">{a.clientName || "—"}</td>
                  <td className="px-3 py-2">{a.ownerName}</td>
                  <td className="px-3 py-2">{a.ownerBranch}</td>
                  <td className="px-3 py-2">
                    <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${
                      a.payload.decision === "Pass" ? "bg-emerald-100 text-emerald-700"
                        : a.payload.decision === "Fail" ? "bg-rose-100 text-rose-700"
                        : "bg-slate-100 text-slate-600"
                    }`}>{a.payload.decision || "—"}</span>
                  </td>
                  <td className="px-3 py-2">
                    <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${
                      a.status === "Approved" ? "bg-emerald-100 text-emerald-700"
                        : a.status === "Rejected" ? "bg-rose-100 text-rose-700"
                        : a.status === "On Hold" ? "bg-purple-100 text-purple-700"
                        : "bg-amber-100 text-amber-700"
                    }`}>{a.status}</span>
                  </td>
                  <td className="px-3 py-2">
                    <button
                      onClick={() => openDetail(a)}
                      className="text-xs font-bold text-[#2563a8] hover:underline"
                    >
                      View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {detail && (
        <div
          className="fixed inset-0 bg-black/50 z-[1500] grid place-items-center p-4"
          onClick={() => setDetail(null)}
        >
          <div
            className="bg-white rounded-2xl max-w-5xl w-full max-h-[90vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center">
              <div>
                <h3 className="text-lg font-bold text-[#1a3c5e]">
                  {detail.clientName || detail.clientId}
                </h3>
                <div className="text-xs text-slate-500">
                  {detail.clientId} · By {detail.ownerName} ({detail.ownerBranch}) ·{" "}
                  {new Date(detail.submittedAt).toLocaleString("en-IN")}
                </div>
              </div>
              <button onClick={() => setDetail(null)} className="text-2xl leading-none">✕</button>
            </div>

            <div className="border-b border-slate-200 overflow-x-auto">
              <div className="flex gap-1 px-3 py-2 min-w-max">
                {TABS.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setTab(t.id)}
                    className={`px-3 py-1.5 text-xs font-bold rounded-lg whitespace-nowrap ${
                      tab === t.id
                        ? "bg-[#1a3c5e] text-white"
                        : "text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    {t.icon} {t.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              <DetailBody tab={tab} app={detail} />
            </div>

            <div className="border-t border-slate-200 px-6 py-4 bg-slate-50">
              <div className="flex flex-col gap-3">
                <div>
                  <label className="text-[11px] uppercase font-bold text-slate-500 block mb-1">
                    Admin Remarks (Pass / Fail / Hold ke liye)
                  </label>
                  <textarea
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    rows={2}
                    placeholder="Verification notes, reason for decision…"
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                  />
                </div>
                <div className="flex gap-2 flex-wrap items-center">
                  <span className="text-[11px] uppercase font-bold text-slate-500 mr-2">
                    Update Status:
                  </span>
                  {[
                    { s: "Approved", cls: "bg-emerald-600 hover:bg-emerald-700 text-white", label: "✅ Pass / Approve" },
                    { s: "Rejected", cls: "bg-rose-600 hover:bg-rose-700 text-white", label: "❌ Fail / Reject" },
                    { s: "On Hold", cls: "bg-purple-600 hover:bg-purple-700 text-white", label: "⏸ On Hold" },
                    { s: "Pending", cls: "bg-amber-500 hover:bg-amber-600 text-white", label: "↩ Pending" },
                  ].map(({ s, cls, label }) => (
                    <button
                      key={s}
                      onClick={() => setStatus.mutate({ id: detail.id, status: s, remarks })}
                      disabled={setStatus.isPending}
                      className={`px-3 py-1.5 text-xs font-bold rounded ${cls} disabled:opacity-60 ${
                        detail.status === s ? "ring-2 ring-offset-1 ring-slate-700" : ""
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function DetailBody({ tab, app }: { tab: DetailTab; app: PdApplication }) {
  const p = app.payload;
  if (tab === "summary") return <SummaryTab app={app} />;
  if (tab === "applicant") return <ApplicantTab p={p} />;
  if (tab === "coapplicant") return <CoApplicantTab p={p} />;
  if (tab === "family") return <FamilyTab p={p} />;
  if (tab === "bank") return <BankTab p={p} />;
  if (tab === "otherloans") return <OtherLoansTab p={p} />;
  if (tab === "eligibility") return <EligibilityTab p={p} />;
  if (tab === "reference") return <ReferenceTab p={p} />;
  if (tab === "casestudy") return <CaseStudyTab p={p} />;
  if (tab === "photos") return <PhotosTab app={app} />;
  if (tab === "empdetails") return <EmpTab p={p} />;
  return null;
}

function SummaryTab({ app }: { app: PdApplication }) {
  const p = app.payload;
  return (
    <div className="space-y-4">
      <Section title="Application">
        <Field label="Status" value={app.status} />
        <Field label="PD Decision" value={p.decision || "—"} />
        <Field label="Field PD Remark" value={p.decisionRemark || "—"} />
        <Field label="Admin Remarks" value={app.remarks || "—"} />
        <Field label="Submitted" value={new Date(app.submittedAt).toLocaleString("en-IN")} />
        {app.decidedAt ? (
          <Field label="Decided" value={new Date(app.decidedAt).toLocaleString("en-IN")} />
        ) : null}
      </Section>
      <Section title="Client">
        <Field label="Client ID" value={app.clientId} />
        <Field label="Client Name" value={app.clientName || p.name || "—"} />
        <Field label="Mobile" value={p.mobile || "—"} />
        <Field label="Branch" value={p.branch || app.ownerBranch} />
      </Section>
      <Section title="Loan">
        <Field label="Applied Amount" value={p.ei_applied ? `₹${p.ei_applied}` : "—"} />
        <Field label="Tenure (months)" value={p.ei_tenure || "—"} />
        <Field label="ROI %" value={p.ei_roi || "—"} />
      </Section>
    </div>
  );
}

function ApplicantTab({ p }: { p: PdPayload }) {
  return (
    <Section title="Applicant Details">
      <Field label="IL Client ID" value={p.ilClientId} />
      <Field label="Loan ID" value={p.loanId} />
      <Field label="Name" value={p.name} />
      <Field label="Father / Spouse" value={p.fatherName} />
      <Field label="DOB" value={p.dob} />
      <Field label="Age" value={p.age} />
      <Field label="Gender" value={p.gender} />
      <Field label="Marital" value={p.marital} />
      <Field label="Mobile" value={p.mobile} />
      <Field label="Alt Mobile" value={p.altMobile} />
      <Field label="Address" value={p.address} wide />
      <Field label="Permanent Address" value={p.permAddress} wide />
      <Field label="State" value={p.state} />
      <Field label="PIN" value={p.pin} />
      <Field label="Branch" value={p.branch} />
      <Field label="Occupation" value={p.occupation} />
      <Field label="Distance from Branch" value={p.distanceFromBranch} />
    </Section>
  );
}

function CoApplicantTab({ p }: { p: PdPayload }) {
  return (
    <Section title="Co-applicant Details">
      <Field label="Name" value={p.caName} />
      <Field label="Relation" value={p.caRelation} />
      <Field label="DOB" value={p.caDob} />
      <Field label="Age" value={p.caAge} />
      <Field label="Gender" value={p.caGender} />
      <Field label="Mobile" value={p.caMobile} />
      <Field label="Occupation" value={p.caOccupation} />
    </Section>
  );
}

function FamilyTab({ p }: { p: PdPayload }) {
  const rows = p.family.filter((f) => f.name || f.relation || f.age);
  return (
    <div className="space-y-2">
      <h4 className="font-bold text-slate-800">Family Members ({rows.length})</h4>
      {rows.length === 0 ? (
        <div className="text-sm text-slate-400">No family members listed.</div>
      ) : (
        <DataTable
          columns={["#", "Name", "Relation", "Age", "Gender", "Occupation"]}
          rows={rows.map((f, i) => [
            String(i + 1),
            f.name || "—",
            f.relation || "—",
            f.age || "—",
            f.gender || "—",
            f.occupation || "—",
          ])}
        />
      )}
    </div>
  );
}

function BankTab({ p }: { p: PdPayload }) {
  return (
    <div className="space-y-4">
      <Section title="Bank Account 1">
        <Field label="Bank Name" value={p.bk1Name} />
        <Field label="Account No" value={p.bk1AccNo} />
        <Field label="Type" value={p.bk1Type} />
        <Field label="Holder" value={p.bk1Holder} />
        <Field label="IFSC" value={p.bk1Ifsc} />
        <Field label="Abbreviation" value={p.bk1Abb} />
      </Section>
      <Section title="Bank Account 2">
        <Field label="Bank Name" value={p.bk2Name} />
        <Field label="Account No" value={p.bk2AccNo} />
        <Field label="Type" value={p.bk2Type} />
        <Field label="Holder" value={p.bk2Holder} />
        <Field label="IFSC" value={p.bk2Ifsc} />
        <Field label="Abbreviation" value={p.bk2Abb} />
      </Section>
    </div>
  );
}

function OtherLoansTab({ p }: { p: PdPayload }) {
  const rows = p.otherLoans.filter((l) => l.bank || l.loanType || l.loanAmount || l.outstanding);
  return (
    <div className="space-y-2">
      <h4 className="font-bold text-slate-800">Other Loans ({rows.length})</h4>
      {rows.length === 0 ? (
        <div className="text-sm text-slate-400">No other loans listed.</div>
      ) : (
        <DataTable
          columns={["#", "Bank", "Type", "Amount", "Outstanding", "EMI", "Tenure Left", "Remarks"]}
          rows={rows.map((l, i) => [
            String(i + 1),
            l.bank || "—",
            l.loanType || "—",
            l.loanAmount || "—",
            l.outstanding || "—",
            l.emi || "—",
            l.tenureLeft || "—",
            l.remarks || "—",
          ])}
        />
      )}
    </div>
  );
}

function EligibilityTab({ p }: { p: PdPayload }) {
  return (
    <div className="space-y-4">
      <Section title="Income Sources">
        <Field label="Business Turnover (monthly)" value={p.ei_turnover} />
        <Field label="Margin %" value={p.ei_margin} />
        <Field label="Business Expense" value={p.ei_bizexp} />
        <Field label="Cows" value={p.ei_cows} />
        <Field label="Buffalo" value={p.ei_buffalo} />
        <Field label="Cow Milk (L/day)" value={p.ei_cow_milk} />
        <Field label="Buffalo Milk (L/day)" value={p.ei_buf_milk} />
        <Field label="Cow Milk Rate" value={p.ei_cow_rate} />
        <Field label="Buffalo Milk Rate" value={p.ei_buf_rate} />
        <Field label="Feed Cost (monthly)" value={p.ei_feedcost} />
        <Field label="Agri Income (monthly)" value={p.ei_agri_monthly} />
        <Field label="Other Income Source" value={p.ei_other_name} />
        <Field label="Other Income (monthly)" value={p.ei_other_income} />
      </Section>
      <Section title="Loan Eligibility">
        <Field label="Household Expense" value={p.ei_hh_exp} />
        <Field label="Applied Amount" value={p.ei_applied} />
        <Field label="Tenure (months)" value={p.ei_tenure} />
        <Field label="ROI %" value={p.ei_roi} />
      </Section>
    </div>
  );
}

function ReferenceTab({ p }: { p: PdPayload }) {
  return (
    <div className="space-y-4">
      <Section title="Reference 1">
        <Field label="Name" value={p.ref1Name} />
        <Field label="Relation" value={p.ref1Relation} />
        <Field label="Mobile" value={p.ref1Mobile} />
        <Field label="Address" value={p.ref1Address} wide />
        <Field label="Verified?" value={p.ref1Verified || "—"} />
      </Section>
      <Section title="Reference 2">
        <Field label="Name" value={p.ref2Name} />
        <Field label="Relation" value={p.ref2Relation} />
        <Field label="Mobile" value={p.ref2Mobile} />
        <Field label="Address" value={p.ref2Address} wide />
        <Field label="Verified?" value={p.ref2Verified || "—"} />
      </Section>
    </div>
  );
}

function CaseStudyTab({ p }: { p: PdPayload }) {
  return (
    <div className="space-y-4">
      <Section title="Case Study & PD Decision">
        <Field label="PD Decision" value={p.decision || "—"} />
        <Field label="Decision Remark" value={p.decisionRemark || "—"} />
      </Section>
      <div>
        <div className="text-[11px] uppercase font-bold text-slate-500 mb-1">Case Study</div>
        <pre className="whitespace-pre-wrap text-sm bg-slate-50 border border-slate-200 rounded-lg p-3 max-h-[40vh] overflow-auto">
          {p.caseStudy || "No case study"}
        </pre>
      </div>
    </div>
  );
}

function PhotosTab({ app }: { app: PdApplication }) {
  const [zoom, setZoom] = useState<string | null>(null);
  if (app.photos.length === 0) {
    return <div className="text-sm text-slate-400">No photos uploaded.</div>;
  }
  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {app.photos.map((p, i) => (
          <button
            key={i}
            onClick={() => setZoom(p.data)}
            className="block text-left bg-white border border-slate-200 rounded-lg overflow-hidden hover:border-[#1a3c5e]"
          >
            <img src={p.data} alt={p.label} className="w-full h-32 object-cover" />
            <div className="px-2 py-1.5 text-xs font-semibold text-slate-700 truncate">
              {p.label || `Photo ${i + 1}`}
            </div>
          </button>
        ))}
      </div>
      {zoom && (
        <div
          className="fixed inset-0 bg-black/85 z-[1600] grid place-items-center p-4"
          onClick={() => setZoom(null)}
        >
          <img src={zoom} alt="" className="max-w-full max-h-[90vh] object-contain" />
        </div>
      )}
    </>
  );
}

function EmpTab({ p }: { p: PdPayload }) {
  return (
    <Section title="Field PD Officer">
      <Field label="Name" value={p.emp_name} />
      <Field label="Code" value={p.emp_code} />
      <Field label="Designation" value={p.emp_designation} />
      <Field label="Branch" value={p.emp_branch} />
      <Field label="Date" value={p.emp_date} />
    </Section>
  );
}

/* ---------------- Building blocks ---------------- */

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden">
      <div className="px-3 py-2 bg-slate-50 text-[11px] uppercase font-bold text-slate-600 border-b border-slate-200">
        {title}
      </div>
      <div className="p-3 grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-3">{children}</div>
    </div>
  );
}

function Field({ label, value, wide }: { label: string; value?: React.ReactNode; wide?: boolean }) {
  const v = value == null || value === "" ? "—" : value;
  return (
    <div className={wide ? "md:col-span-2" : ""}>
      <div className="text-[10px] uppercase font-bold text-slate-500">{label}</div>
      <div className="text-sm text-slate-800 break-words">{v}</div>
    </div>
  );
}

function DataTable({ columns, rows }: { columns: string[]; rows: string[][] }) {
  return (
    <div className="border border-slate-200 rounded-lg overflow-auto">
      <table className="w-full text-xs">
        <thead className="bg-slate-50 text-[10px] uppercase text-slate-500">
          <tr>
            {columns.map((c) => (
              <th key={c} className="text-left px-2 py-1.5 whitespace-nowrap">{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-t border-slate-100">
              {r.map((cell, j) => (
                <td key={j} className="px-2 py-1.5 align-top whitespace-pre-wrap">{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  // useMemo to avoid linter complaining about unused import
  const v = useMemo(() => value.toLocaleString("en-IN"), [value]);
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-4">
      <div className={`text-3xl font-extrabold bg-gradient-to-r ${color} bg-clip-text text-transparent`}>
        {v}
      </div>
      <div className="text-xs uppercase tracking-wider text-slate-500 mt-1 font-bold">{label}</div>
    </div>
  );
}
