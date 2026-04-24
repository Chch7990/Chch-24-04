import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiGet } from "../../lib/api";
import { downloadCsv } from "../../lib/csv";
import type { LucDataRow } from "./types";

export default function LucAllData() {
  const [search, setSearch] = useState("");
  const [branch, setBranch] = useState("");
  const [status, setStatus] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["luc", "all-data"],
    queryFn: () => apiGet<{ rows: LucDataRow[] }>("/luc/all-data"),
  });

  const rows = data?.rows ?? [];

  const branches = useMemo(
    () => Array.from(new Set(rows.map((r) => r.branch).filter(Boolean))).sort(),
    [rows],
  );

  const filtered = rows.filter((r) => {
    if (branch && r.branch !== branch) return false;
    if (status && r.status !== status) return false;
    if (search) {
      const s = search.toLowerCase();
      if (
        !r.clientId.toLowerCase().includes(s) &&
        !r.clientName.toLowerCase().includes(s) &&
        !r.branch.toLowerCase().includes(s)
      )
        return false;
    }
    return true;
  });

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-extrabold text-slate-800">All LUC Records</h1>
        <p className="text-sm text-slate-500">Complete list with filters</p>
      </div>

      <div className="flex gap-2 flex-wrap">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name, ID, branch…"
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
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="border border-slate-300 rounded-lg px-3 py-2 text-sm"
        >
          <option value="">All Status</option>
          <option value="done">Completed</option>
          <option value="pending">Pending</option>
        </select>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-200 flex items-center justify-between">
          <h3 className="font-bold text-slate-800">📋 Records ({filtered.length})</h3>
          <button
            onClick={() =>
              downloadCsv(
                "luc-records.csv",
                filtered.map((r) => ({ ...r, photos: r.photos.length })),
              )
            }
            className="text-xs font-bold border border-slate-300 hover:border-emerald-500 rounded px-3 py-1.5"
          >
            📥 Export CSV
          </button>
        </div>
        <div className="overflow-auto max-h-[60vh]">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 text-[10px] uppercase text-slate-500 sticky top-0">
              <tr>
                {[
                  "Client ID",
                  "Name",
                  "State",
                  "Branch",
                  "Loan Type",
                  "Amount",
                  "Dis Date",
                  "Purpose",
                  "LUC Date",
                  "Visit Person",
                  "Emp Code",
                  "Loan Used In",
                  "Observation",
                  "Remark",
                  "Photos",
                  "Status",
                  "Approved",
                ].map((h) => (
                  <th key={h} className="text-left px-2 py-2 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr>
                  <td colSpan={17} className="px-3 py-8 text-center text-slate-400">Loading…</td>
                </tr>
              )}
              {!isLoading && filtered.length === 0 && (
                <tr>
                  <td colSpan={17} className="px-3 py-8 text-center text-slate-400">No records</td>
                </tr>
              )}
              {filtered.map((r) => (
                <tr key={r.clientId} className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="px-2 py-1.5 font-mono">{r.clientId}</td>
                  <td className="px-2 py-1.5 font-semibold">{r.clientName}</td>
                  <td className="px-2 py-1.5">{r.state}</td>
                  <td className="px-2 py-1.5">{r.branch}</td>
                  <td className="px-2 py-1.5">{r.loanType}</td>
                  <td className="px-2 py-1.5 text-right">{r.loanAmount.toLocaleString("en-IN")}</td>
                  <td className="px-2 py-1.5">{r.disbursementDate}</td>
                  <td className="px-2 py-1.5">{r.loanPurpose}</td>
                  <td className="px-2 py-1.5">{r.visitDate || "—"}</td>
                  <td className="px-2 py-1.5">{r.visitPerson || "—"}</td>
                  <td className="px-2 py-1.5">{r.empCode || "—"}</td>
                  <td className="px-2 py-1.5">{r.loanUsedIn || "—"}</td>
                  <td className="px-2 py-1.5 max-w-[200px] truncate" title={r.observation}>{r.observation || "—"}</td>
                  <td className="px-2 py-1.5 max-w-[200px] truncate" title={r.remark}>{r.remark || "—"}</td>
                  <td className="px-2 py-1.5 text-center">{r.photos.length}</td>
                  <td className="px-2 py-1.5">
                    <span
                      className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                        r.status === "done"
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-amber-100 text-amber-700"
                      }`}
                    >
                      {r.status}
                    </span>
                  </td>
                  <td className="px-2 py-1.5">{r.approved || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
