import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost } from "../../lib/api";
import { showToast } from "../../components/Toast";
import { downloadCsv } from "../../lib/csv";
import type { PdApplication } from "./types";

export default function PdDashboard() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [detail, setDetail] = useState<PdApplication | null>(null);

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
      apiPost<{ ok: boolean }>(`/pd/applications/${v.id}/status`, { status: v.status, remarks: v.remarks ?? "" }),
    onSuccess: () => {
      showToast("Updated", "ok");
      qc.invalidateQueries({ queryKey: ["pd"] });
      setDetail(null);
    },
    onError: (e: Error) => showToast(e.message, "err"),
  });

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
                      onClick={() => setDetail(a)}
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
        <div className="fixed inset-0 bg-black/50 z-[1500] grid place-items-center p-4" onClick={() => setDetail(null)}>
          <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center sticky top-0 bg-white">
              <h3 className="text-lg font-bold text-[#1a3c5e]">Application: {detail.clientId}</h3>
              <button onClick={() => setDetail(null)} className="text-xl">✕</button>
            </div>
            <div className="p-6 space-y-4">
              <Info label="Client" value={`${detail.clientId} · ${detail.clientName}`} />
              <Info label="Submitted By" value={`${detail.ownerName} (${detail.ownerBranch})`} />
              <Info label="Submitted At" value={new Date(detail.submittedAt).toLocaleString("en-IN")} />
              <Info label="PD Decision" value={detail.payload.decision || "—"} />
              <Info label="Decision Remark" value={detail.payload.decisionRemark || "—"} />
              <Info label="Mobile" value={detail.payload.mobile || "—"} />
              <Info label="Applied Loan" value={detail.payload.ei_applied ? "₹" + detail.payload.ei_applied : "—"} />
              <Info label="Case Study" value={<pre className="whitespace-pre-wrap text-sm">{detail.payload.caseStudy || "—"}</pre>} />
              {detail.photos.length > 0 && (
                <div>
                  <div className="text-[11px] uppercase font-bold text-slate-500 mb-2">Photos</div>
                  <div className="grid grid-cols-3 gap-2">
                    {detail.photos.map((p, i) => (
                      <div key={i}>
                        <img src={p.data} alt="" className="w-full h-24 object-cover rounded" />
                        <div className="text-xs text-slate-500 mt-1 truncate">{p.label}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div className="border-t border-slate-200 pt-4">
                <div className="text-[11px] uppercase font-bold text-slate-500 mb-2">Update Status</div>
                <div className="flex gap-2 flex-wrap">
                  {["Pending", "Approved", "Rejected", "On Hold"].map((s) => (
                    <button
                      key={s}
                      onClick={() => setStatus.mutate({ id: detail.id, status: s })}
                      disabled={setStatus.isPending}
                      className={`px-3 py-1.5 text-xs font-bold rounded border ${
                        detail.status === s
                          ? "bg-[#1a3c5e] text-white border-[#1a3c5e]"
                          : "border-slate-300 hover:border-[#1a3c5e]"
                      }`}
                    >
                      {s}
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

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-4">
      <div className={`text-3xl font-extrabold bg-gradient-to-r ${color} bg-clip-text text-transparent`}>
        {value.toLocaleString("en-IN")}
      </div>
      <div className="text-xs uppercase tracking-wider text-slate-500 mt-1 font-bold">{label}</div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-[11px] uppercase font-bold text-slate-500">{label}</div>
      <div className="text-sm text-slate-800">{value}</div>
    </div>
  );
}
