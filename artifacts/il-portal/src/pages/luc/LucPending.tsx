import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiGet } from "../../lib/api";
import { downloadCsv } from "../../lib/csv";
import type { LucDataRow } from "./types";

export default function LucPending() {
  const [search, setSearch] = useState("");
  const [branch, setBranch] = useState("");
  const { data, isLoading } = useQuery({
    queryKey: ["luc", "all-data"],
    queryFn: () => apiGet<{ rows: LucDataRow[] }>("/luc/all-data"),
  });

  const rows = (data?.rows ?? []).filter((r) => r.status === "pending");
  const branches = useMemo(
    () => Array.from(new Set(rows.map((r) => r.branch).filter(Boolean))).sort(),
    [rows],
  );
  const filtered = rows.filter((r) => {
    if (branch && r.branch !== branch) return false;
    if (search) {
      const s = search.toLowerCase();
      if (
        !r.clientId.toLowerCase().includes(s) &&
        !r.clientName.toLowerCase().includes(s)
      )
        return false;
    }
    return true;
  });

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-extrabold text-slate-800">⏳ Pending LUC</h1>
        <p className="text-sm text-slate-500">Field visit abhi nahi hui</p>
      </div>
      <div className="flex gap-2 flex-wrap">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search…"
          className="flex-1 min-w-[200px] border border-slate-300 rounded-lg px-3 py-2 text-sm"
        />
        <select
          value={branch}
          onChange={(e) => setBranch(e.target.value)}
          className="border border-slate-300 rounded-lg px-3 py-2 text-sm"
        >
          <option value="">All Branches</option>
          {branches.map((b) => (
            <option key={b}>{b}</option>
          ))}
        </select>
      </div>
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-200 flex items-center justify-between">
          <h3 className="font-bold text-slate-800">⏳ Pending ({filtered.length})</h3>
          <button
            onClick={() => downloadCsv("luc-pending.csv", filtered)}
            className="text-xs font-bold border border-slate-300 hover:border-amber-500 rounded px-3 py-1.5"
          >
            📥 Export CSV
          </button>
        </div>
        <div className="overflow-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="text-left px-3 py-2">Client ID</th>
                <th className="text-left px-3 py-2">Name</th>
                <th className="text-left px-3 py-2">State</th>
                <th className="text-left px-3 py-2">Branch</th>
                <th className="text-right px-3 py-2">Amount</th>
                <th className="text-left px-3 py-2">Dis Date</th>
                <th className="text-left px-3 py-2">Purpose</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr>
                  <td colSpan={7} className="px-3 py-8 text-center text-slate-400">Loading…</td>
                </tr>
              )}
              {!isLoading && filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-3 py-8 text-center text-slate-400">No pending LUCs</td>
                </tr>
              )}
              {filtered.map((r) => (
                <tr key={r.clientId} className="border-t border-slate-100">
                  <td className="px-3 py-2 font-mono text-xs">{r.clientId}</td>
                  <td className="px-3 py-2 font-semibold">{r.clientName}</td>
                  <td className="px-3 py-2">{r.state}</td>
                  <td className="px-3 py-2">{r.branch}</td>
                  <td className="px-3 py-2 text-right">{r.loanAmount.toLocaleString("en-IN")}</td>
                  <td className="px-3 py-2">{r.disbursementDate}</td>
                  <td className="px-3 py-2">{r.loanPurpose}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
