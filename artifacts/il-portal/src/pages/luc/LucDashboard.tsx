import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPatch } from "../../lib/api";
import { downloadCsv } from "../../lib/csv";
import { showToast } from "../../components/Toast";
import type { LucDataRow } from "./types";
import PhotoLightbox from "./PhotoLightbox";

export default function LucDashboard() {
  const qc = useQueryClient();
  const [detail, setDetail] = useState<LucDataRow | null>(null);
  const [remarks, setRemarks] = useState("");
  const [lightbox, setLightbox] = useState<{ photos: string[]; idx: number } | null>(null);

  const stats = useQuery({
    queryKey: ["luc", "stats"],
    queryFn: () =>
      apiGet<{ total: number; completed: number; pending: number; approved: number }>("/luc/stats"),
  });
  const all = useQuery({
    queryKey: ["luc", "all-data"],
    queryFn: () => apiGet<{ rows: LucDataRow[] }>("/luc/all-data"),
  });

  const approval = useMutation({
    mutationFn: (v: { cid: string; approved: "approved" | "rejected" | ""; remarks: string }) =>
      apiPatch<{ ok: boolean }>(`/luc/visits/${encodeURIComponent(v.cid)}/approval`, {
        approved: v.approved,
        remarks: v.remarks,
      }),
    onSuccess: () => {
      showToast("Updated", "ok");
      qc.invalidateQueries({ queryKey: ["luc"] });
      setDetail(null);
      setRemarks("");
    },
    onError: (e: Error) => showToast(e.message, "err"),
  });

  const rows = all.data?.rows ?? [];
  const recent = rows.slice(0, 50);

  function openDetail(r: LucDataRow) {
    setDetail(r);
    setRemarks(r.approvalRemark || "");
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-extrabold text-slate-800">Dashboard</h1>
        <p className="text-sm text-slate-500">LUC field collection overview · click row to verify</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Total Clients" value={stats.data?.total ?? 0} color="blue" />
        <Stat label="Completed" value={stats.data?.completed ?? 0} color="emerald" />
        <Stat label="Pending" value={stats.data?.pending ?? 0} color="amber" />
        <Stat label="Approved" value={stats.data?.approved ?? 0} color="indigo" />
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-200 flex items-center justify-between">
          <h3 className="font-bold text-slate-800">📌 Client View — Verify & Approve</h3>
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
                <th className="text-left px-3 py-2">LUC Status</th>
                <th className="text-left px-3 py-2">Approval</th>
                <th className="text-right px-3 py-2">Photos</th>
                <th className="text-left px-3 py-2">Action</th>
              </tr>
            </thead>
            <tbody>
              {all.isLoading && (
                <tr>
                  <td colSpan={8} className="px-3 py-8 text-center text-slate-400">Loading…</td>
                </tr>
              )}
              {!all.isLoading && recent.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-3 py-8 text-center text-slate-400">No entries</td>
                </tr>
              )}
              {recent.map((r) => (
                <tr
                  key={r.clientId}
                  className="border-t border-slate-100 hover:bg-slate-50 cursor-pointer"
                  onClick={() => openDetail(r)}
                >
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
                  <td className="px-3 py-2">
                    <span
                      className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                        r.approved === "approved"
                          ? "bg-emerald-100 text-emerald-700"
                          : r.approved === "rejected"
                          ? "bg-rose-100 text-rose-700"
                          : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {r.approved === "approved"
                        ? "Pass"
                        : r.approved === "rejected"
                        ? "Fail"
                        : "—"}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right">{r.photos.length}</td>
                  <td className="px-3 py-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        openDetail(r);
                      }}
                      className="text-xs font-bold text-emerald-700 hover:underline"
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
            className="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center">
              <div>
                <h3 className="text-lg font-bold text-slate-800">
                  {detail.clientName}
                </h3>
                <div className="text-xs text-slate-500">{detail.clientId}</div>
              </div>
              <button onClick={() => setDetail(null)} className="text-2xl leading-none">✕</button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              <Section title="Client Details">
                <Field label="State" value={detail.state} />
                <Field label="Branch" value={detail.branch} />
                <Field label="Loan Type" value={detail.loanType} />
                <Field label="Loan Amount" value={`₹ ${detail.loanAmount.toLocaleString("en-IN")}`} />
                <Field label="Disbursement Date" value={detail.disbursementDate} />
                <Field label="Loan Purpose" value={detail.loanPurpose} wide />
              </Section>

              {detail.status === "done" ? (
                <Section title="Field Visit">
                  <Field label="Visit Date" value={detail.visitDate} />
                  <Field label="Visit Person" value={detail.visitPerson} />
                  <Field label="Emp Code" value={detail.empCode} />
                  <Field label="Submitted By" value={detail.submittedByName || "—"} />
                  <Field label="Loan Used In" value={detail.loanUsedIn} wide />
                  <Field label="Observation" value={detail.observation} wide />
                  <Field label="Field Remark" value={detail.remark} wide />
                </Section>
              ) : (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                  Field visit abhi tak nahi hua. Pass/Fail visit complete hone ke baad hi karo.
                </div>
              )}

              {detail.photos.length > 0 && (
                <div>
                  <div className="text-[11px] uppercase font-bold text-slate-500 mb-2">
                    Photos ({detail.photos.length})
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {detail.photos.map((src, i) => (
                      <button
                        key={i}
                        onClick={() => setLightbox({ photos: detail.photos, idx: i })}
                        className="block bg-white border border-slate-200 rounded-lg overflow-hidden hover:border-emerald-500"
                      >
                        <img src={src} alt="" className="w-full h-24 object-cover" />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {detail.approvalRemark ? (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <div className="text-[11px] uppercase font-bold text-slate-500 mb-1">
                    Last Admin Remark
                  </div>
                  <div className="text-sm text-slate-800 whitespace-pre-wrap">{detail.approvalRemark}</div>
                </div>
              ) : null}
            </div>

            <div className="border-t border-slate-200 px-6 py-4 bg-slate-50 space-y-3">
              <div>
                <label className="text-[11px] uppercase font-bold text-slate-500 block mb-1">
                  Admin Remarks (Pass / Fail ke liye)
                </label>
                <textarea
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  rows={2}
                  placeholder="Reason for pass / fail…"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() =>
                    approval.mutate({ cid: detail.clientId, approved: "approved", remarks })
                  }
                  disabled={approval.isPending || detail.status !== "done"}
                  className="px-3 py-1.5 text-xs font-bold rounded bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-60"
                >
                  ✅ Pass
                </button>
                <button
                  onClick={() =>
                    approval.mutate({ cid: detail.clientId, approved: "rejected", remarks })
                  }
                  disabled={approval.isPending || detail.status !== "done"}
                  className="px-3 py-1.5 text-xs font-bold rounded bg-rose-600 hover:bg-rose-700 text-white disabled:opacity-60"
                >
                  ❌ Fail
                </button>
                <button
                  onClick={() =>
                    approval.mutate({ cid: detail.clientId, approved: "", remarks })
                  }
                  disabled={approval.isPending || detail.status !== "done"}
                  className="px-3 py-1.5 text-xs font-bold rounded border border-slate-300 hover:bg-slate-100 disabled:opacity-60"
                >
                  ↩ Reset
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

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
      <div className="text-sm text-slate-800 break-words whitespace-pre-wrap">{v}</div>
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
