import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPatch, apiPost } from "../../lib/api";
import { showToast } from "../../components/Toast";
import type { LucDataRow } from "./types";
import PhotoLightbox from "./PhotoLightbox";

export default function LucApprovals() {
  const [search, setSearch] = useState("");
  const [stat, setStat] = useState("");
  const [lightbox, setLightbox] = useState<{ photos: string[]; idx: number } | null>(null);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["luc", "all-data"],
    queryFn: () => apiGet<{ rows: LucDataRow[] }>("/luc/all-data"),
  });

  const rows = (data?.rows ?? []).filter((r) => r.status === "done");
  const filtered = rows.filter((r) => {
    if (stat) {
      if (stat === "pending" && r.approved !== "") return false;
      if (stat !== "pending" && r.approved !== stat) return false;
    }
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

  const setMut = useMutation({
    mutationFn: (v: { cid: string; approved: "approved" | "rejected" | "" }) =>
      apiPatch<{ ok: boolean }>(`/luc/visits/${encodeURIComponent(v.cid)}/approval`, { approved: v.approved }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["luc"] });
    },
    onError: (e: Error) => showToast(e.message, "err"),
  });

  const approveAll = useMutation({
    mutationFn: () => apiPost<{ ok: boolean }>("/luc/visits/approve-all", {}),
    onSuccess: () => {
      showToast("All pending approvals approved", "ok");
      qc.invalidateQueries({ queryKey: ["luc"] });
    },
    onError: (e: Error) => showToast(e.message, "err"),
  });

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-extrabold text-slate-800">🔍 LUC Approvals</h1>
        <p className="text-sm text-slate-500">Completed entries review aur approve karein</p>
      </div>
      <div className="flex gap-2 flex-wrap">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search…"
          className="flex-1 min-w-[200px] border border-slate-300 rounded-lg px-3 py-2 text-sm"
        />
        <select
          value={stat}
          onChange={(e) => setStat(e.target.value)}
          className="border border-slate-300 rounded-lg px-3 py-2 text-sm"
        >
          <option value="">All</option>
          <option value="pending">Pending Approval</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </select>
      </div>
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-200 flex items-center justify-between">
          <h3 className="font-bold text-slate-800">🔍 Approval Queue ({filtered.length})</h3>
          <button
            onClick={() => approveAll.mutate()}
            disabled={approveAll.isPending}
            className="text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded px-3 py-1.5 disabled:opacity-60"
          >
            ✅ Approve All Pending
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
                <th className="text-left px-3 py-2">Photos</th>
                <th className="text-left px-3 py-2">Approval</th>
                <th className="text-left px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr>
                  <td colSpan={8} className="px-3 py-8 text-center text-slate-400">Loading…</td>
                </tr>
              )}
              {!isLoading && filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-3 py-8 text-center text-slate-400">No entries</td>
                </tr>
              )}
              {filtered.map((r) => (
                <tr key={r.clientId} className="border-t border-slate-100">
                  <td className="px-3 py-2 font-mono text-xs">{r.clientId}</td>
                  <td className="px-3 py-2 font-semibold">{r.clientName}</td>
                  <td className="px-3 py-2">{r.branch}</td>
                  <td className="px-3 py-2">{r.visitDate}</td>
                  <td className="px-3 py-2">{r.visitPerson}</td>
                  <td className="px-3 py-2">
                    {r.photos.length > 0 ? (
                      <button
                        onClick={() => setLightbox({ photos: r.photos, idx: 0 })}
                        className="text-xs font-bold text-emerald-700 hover:underline"
                      >
                        🖼️ {r.photos.length}
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
                      <span className="text-[10px] text-amber-700 font-bold">pending</span>
                    )}
                  </td>
                  <td className="px-3 py-2 space-x-2">
                    <button
                      onClick={() => setMut.mutate({ cid: r.clientId, approved: "approved" })}
                      className="text-xs font-bold text-emerald-700 hover:underline"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => setMut.mutate({ cid: r.clientId, approved: "rejected" })}
                      className="text-xs font-bold text-rose-700 hover:underline"
                    >
                      Reject
                    </button>
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
