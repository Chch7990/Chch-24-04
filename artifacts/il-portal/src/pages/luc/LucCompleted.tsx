import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiGet } from "../../lib/api";
import { downloadCsv } from "../../lib/csv";
import type { LucDataRow } from "./types";
import PhotoLightbox from "./PhotoLightbox";

export default function LucCompleted() {
  const [search, setSearch] = useState("");
  const [branch, setBranch] = useState("");
  const [lightbox, setLightbox] = useState<{ photos: string[]; idx: number } | null>(null);
  const { data, isLoading } = useQuery({
    queryKey: ["luc", "all-data"],
    queryFn: () => apiGet<{ rows: LucDataRow[] }>("/luc/all-data"),
  });

  const rows = (data?.rows ?? []).filter((r) => r.status === "done");
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
        <h1 className="text-xl font-extrabold text-slate-800">✅ Completed LUC</h1>
        <p className="text-sm text-slate-500">Field visit ho chuki hai</p>
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
          <h3 className="font-bold text-slate-800">✅ Completed ({filtered.length})</h3>
          <button
            onClick={() => downloadCsv("luc-completed.csv", filtered.map((r) => ({ ...r, photos: r.photos.length })))}
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
                <th className="text-left px-3 py-2">Name</th>
                <th className="text-left px-3 py-2">Branch</th>
                <th className="text-left px-3 py-2">LUC Date</th>
                <th className="text-left px-3 py-2">Visit Person</th>
                <th className="text-left px-3 py-2">Emp Code</th>
                <th className="text-left px-3 py-2">Loan Used In</th>
                <th className="text-left px-3 py-2">Photos</th>
                <th className="text-left px-3 py-2">Approved</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr>
                  <td colSpan={9} className="px-3 py-8 text-center text-slate-400">Loading…</td>
                </tr>
              )}
              {!isLoading && filtered.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-3 py-8 text-center text-slate-400">No completed LUCs</td>
                </tr>
              )}
              {filtered.map((r) => (
                <tr key={r.clientId} className="border-t border-slate-100">
                  <td className="px-3 py-2 font-mono text-xs">{r.clientId}</td>
                  <td className="px-3 py-2 font-semibold">{r.clientName}</td>
                  <td className="px-3 py-2">{r.branch}</td>
                  <td className="px-3 py-2">{r.visitDate}</td>
                  <td className="px-3 py-2">{r.visitPerson}</td>
                  <td className="px-3 py-2">{r.empCode}</td>
                  <td className="px-3 py-2">{r.loanUsedIn}</td>
                  <td className="px-3 py-2">
                    {r.photos.length > 0 ? (
                      <button
                        onClick={() => setLightbox({ photos: r.photos, idx: 0 })}
                        className="text-xs font-bold text-emerald-700 hover:underline"
                      >
                        🖼️ {r.photos.length} photo{r.photos.length > 1 ? "s" : ""}
                      </button>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {r.approved ? (
                      <span
                        className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${
                          r.approved === "approved"
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-rose-100 text-rose-700"
                        }`}
                      >
                        {r.approved}
                      </span>
                    ) : (
                      <span className="text-[10px] text-slate-400">pending</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {lightbox && (
        <PhotoLightbox
          photos={lightbox.photos}
          idx={lightbox.idx}
          onClose={() => setLightbox(null)}
          onIdx={(idx) => setLightbox({ ...lightbox, idx })}
        />
      )}
    </div>
  );
}
