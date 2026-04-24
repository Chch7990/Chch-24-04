import { useState } from "react";
import { apiGet } from "../../lib/api";
import { downloadCsv } from "../../lib/csv";
import { showToast } from "../../components/Toast";
import type { PdApplication } from "./types";

export default function PdDateWiseDownload() {
  const today = new Date().toISOString().slice(0, 10);
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<PdApplication[] | null>(null);

  async function fetchData() {
    setBusy(true);
    try {
      const q = new URLSearchParams();
      if (from) q.set("from", from);
      if (to) q.set("to", to);
      const apps = await apiGet<PdApplication[]>(`/pd/applications?${q.toString()}`);
      setPreview(apps);
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : "Fetch failed", "err");
    } finally {
      setBusy(false);
    }
  }

  function exportCsv() {
    if (!preview) return;
    downloadCsv(
      `pd-${from}_to_${to}.csv`,
      preview.map((a) => ({
        id: a.id,
        submittedAt: new Date(a.submittedAt).toISOString(),
        ownerName: a.ownerName,
        ownerBranch: a.ownerBranch,
        clientId: a.clientId,
        clientName: a.clientName,
        decision: a.payload.decision,
        status: a.status,
        appliedLoan: a.payload.ei_applied,
        mobile: a.payload.mobile,
        state: a.payload.state,
        branch: a.payload.branch,
      })),
    );
  }

  return (
    <div className="space-y-5 max-w-4xl mx-auto">
      <div>
        <h1 className="text-xl font-extrabold text-slate-800">📤 Date-wise Download</h1>
        <p className="text-sm text-slate-500">Specific date range ke applications export karein</p>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3">
        <div className="grid md:grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">From</label>
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">To</label>
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
            />
          </div>
        </div>
        <div className="flex gap-2 justify-end">
          <button
            onClick={fetchData}
            disabled={busy}
            className="px-4 py-2 text-sm font-bold bg-[#1a3c5e] text-white rounded-lg disabled:opacity-60"
          >
            {busy ? "Loading…" : "🔍 Preview"}
          </button>
          <button
            onClick={exportCsv}
            disabled={!preview || preview.length === 0}
            className="px-4 py-2 text-sm font-bold bg-emerald-600 text-white rounded-lg disabled:opacity-60"
          >
            📥 Download CSV
          </button>
        </div>
      </div>

      {preview && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-200">
            <h3 className="font-bold text-slate-800">{preview.length} application(s) found</h3>
          </div>
          <div className="overflow-auto max-h-[60vh]">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 text-[10px] uppercase text-slate-500 sticky top-0">
                <tr>
                  <th className="text-left px-2 py-2">Submitted</th>
                  <th className="text-left px-2 py-2">Client ID</th>
                  <th className="text-left px-2 py-2">Client Name</th>
                  <th className="text-left px-2 py-2">Submitted By</th>
                  <th className="text-left px-2 py-2">Branch</th>
                  <th className="text-left px-2 py-2">Decision</th>
                  <th className="text-left px-2 py-2">Status</th>
                  <th className="text-right px-2 py-2">Applied (₹)</th>
                </tr>
              </thead>
              <tbody>
                {preview.length === 0 && (
                  <tr><td colSpan={8} className="px-3 py-8 text-center text-slate-400">No applications in this range</td></tr>
                )}
                {preview.map((a) => (
                  <tr key={a.id} className="border-t border-slate-100">
                    <td className="px-2 py-1.5">{new Date(a.submittedAt).toLocaleString("en-IN")}</td>
                    <td className="px-2 py-1.5 font-mono">{a.clientId}</td>
                    <td className="px-2 py-1.5 font-semibold">{a.clientName}</td>
                    <td className="px-2 py-1.5">{a.ownerName}</td>
                    <td className="px-2 py-1.5">{a.ownerBranch}</td>
                    <td className="px-2 py-1.5">{a.payload.decision || "—"}</td>
                    <td className="px-2 py-1.5">{a.status}</td>
                    <td className="px-2 py-1.5 text-right">{a.payload.ei_applied || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
