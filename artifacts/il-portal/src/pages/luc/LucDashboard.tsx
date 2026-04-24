import { useQuery } from "@tanstack/react-query";
import { apiGet } from "../../lib/api";
import { downloadCsv } from "../../lib/csv";
import type { LucDataRow } from "./types";

export default function LucDashboard() {
  const stats = useQuery({
    queryKey: ["luc", "stats"],
    queryFn: () =>
      apiGet<{ total: number; completed: number; pending: number; approved: number }>("/luc/stats"),
  });
  const all = useQuery({
    queryKey: ["luc", "all-data"],
    queryFn: () => apiGet<{ rows: LucDataRow[] }>("/luc/all-data"),
  });

  const rows = all.data?.rows ?? [];
  const recent = rows.slice(0, 20);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-extrabold text-slate-800">Dashboard</h1>
        <p className="text-sm text-slate-500">LUC field collection overview</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Total Clients" value={stats.data?.total ?? 0} color="blue" />
        <Stat label="Completed" value={stats.data?.completed ?? 0} color="emerald" />
        <Stat label="Pending" value={stats.data?.pending ?? 0} color="amber" />
        <Stat label="Approved" value={stats.data?.approved ?? 0} color="indigo" />
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-200 flex items-center justify-between">
          <h3 className="font-bold text-slate-800">📌 Recent Entries</h3>
          <button
            onClick={() => downloadCsv("luc-all.csv", rows.map((r) => ({ ...r, photos: r.photos.length })))}
            className="text-xs font-bold border border-slate-300 hover:border-emerald-500 rounded px-3 py-1.5"
          >
            📥 Export CSV
          </button>
        </div>
        <div className="overflow-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="text-left px-3 py-2">Client ID</th>
                <th className="text-left px-3 py-2">Client Name</th>
                <th className="text-left px-3 py-2">Branch</th>
                <th className="text-right px-3 py-2">Amount</th>
                <th className="text-left px-3 py-2">Status</th>
                <th className="text-left px-3 py-2">LUC Date</th>
                <th className="text-right px-3 py-2">Photos</th>
              </tr>
            </thead>
            <tbody>
              {all.isLoading && (
                <tr>
                  <td colSpan={7} className="px-3 py-8 text-center text-slate-400">Loading…</td>
                </tr>
              )}
              {!all.isLoading && recent.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-3 py-8 text-center text-slate-400">No entries</td>
                </tr>
              )}
              {recent.map((r) => (
                <tr key={r.clientId} className="border-t border-slate-100">
                  <td className="px-3 py-2 font-mono text-xs">{r.clientId}</td>
                  <td className="px-3 py-2 font-semibold">{r.clientName}</td>
                  <td className="px-3 py-2">{r.branch}</td>
                  <td className="px-3 py-2 text-right">{r.loanAmount.toLocaleString("en-IN")}</td>
                  <td className="px-3 py-2">
                    <span
                      className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        r.status === "done"
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-amber-100 text-amber-700"
                      }`}
                    >
                      {r.status === "done" ? "Completed" : "Pending"}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-slate-600">{r.visitDate || "—"}</td>
                  <td className="px-3 py-2 text-right">{r.photos.length}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: "blue" | "emerald" | "amber" | "indigo";
}) {
  const colorMap = {
    blue: "from-blue-500 to-blue-700",
    emerald: "from-emerald-500 to-emerald-700",
    amber: "from-amber-500 to-amber-700",
    indigo: "from-indigo-500 to-indigo-700",
  };
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-4">
      <div className={`text-3xl font-extrabold bg-gradient-to-r ${colorMap[color]} bg-clip-text text-transparent`}>
        {value.toLocaleString("en-IN")}
      </div>
      <div className="text-xs uppercase tracking-wider text-slate-500 mt-1 font-bold">{label}</div>
    </div>
  );
}
