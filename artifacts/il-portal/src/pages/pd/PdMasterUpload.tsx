import { useState } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { apiPost, apiGet } from "../../lib/api";
import { parseTabularFile, downloadCsv, TABULAR_FILE_ACCEPT } from "../../lib/csv";
import { showToast } from "../../components/Toast";
import type { PdMasterClient } from "./types";

export default function PdMasterUpload() {
  const qc = useQueryClient();
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [replace, setReplace] = useState(true);

  const list = useQuery({
    queryKey: ["pd", "master-clients"],
    queryFn: () => apiGet<PdMasterClient[]>("/pd/master-clients"),
  });

  const mut = useMutation({
    mutationFn: (body: { rows: Record<string, string>[]; replace: boolean }) =>
      apiPost<{ ok: boolean; count: number }>("/pd/master-clients/bulk", body),
    onSuccess: (j) => {
      showToast(`Master roster updated · ${j.count} rows`, "ok");
      setRows([]);
      qc.invalidateQueries({ queryKey: ["pd"] });
    },
    onError: (e: Error) => showToast(e.message, "err"),
  });

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    try {
      const parsed = await parseTabularFile(f);
      if (parsed.length === 0) {
        showToast("No rows", "err");
        return;
      }
      setRows(parsed);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to read file", "err");
    }
  }

  function downloadTemplate() {
    downloadCsv(
      "pd-master-clients-template.csv",
      [
        {
          "Client ID": "60480",
          "MFI Client ID": "MFI001",
          "Loan ID": "LN001",
          "Client Name": "Kiran Surender",
          Address: "Village Road, Kaithal",
          "Permanent Address": "Same",
          State: "HR",
          Branch: "KAITHAL",
        },
      ],
      ["Client ID", "MFI Client ID", "Loan ID", "Client Name", "Address", "Permanent Address", "State", "Branch"],
    );
  }

  const headers = rows[0] ? Object.keys(rows[0]) : [];
  const masterRows = list.data ?? [];

  return (
    <div className="space-y-5 max-w-5xl mx-auto">
      <div>
        <h1 className="text-xl font-extrabold text-slate-800">📁 Master Client Data Upload</h1>
        <p className="text-sm text-slate-500">CSV upload se PD master client roster manage karein</p>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        <div className="flex items-start gap-3 mb-3">
          <button
            onClick={downloadTemplate}
            className="text-xs font-bold border border-slate-300 hover:border-[#1a3c5e] rounded px-3 py-2"
          >
            📄 Download Template
          </button>
          <label className="flex items-center gap-1 text-xs">
            <input
              type="checkbox"
              checked={replace}
              onChange={(e) => setReplace(e.target.checked)}
            />
            Replace existing roster
          </label>
        </div>
        <input
          type="file"
          accept={TABULAR_FILE_ACCEPT}
          onChange={onFile}
          className="block w-full text-xs file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-[#1a3c5e] file:text-white"
        />
      </div>

      {rows.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="font-bold text-slate-800">Preview ({rows.length} rows)</div>
              <div className="text-xs text-slate-500">{headers.join(", ")}</div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setRows([])}
                className="px-3 py-1.5 text-xs font-bold border border-slate-300 rounded"
              >
                Cancel
              </button>
              <button
                onClick={() => mut.mutate({ rows, replace })}
                disabled={mut.isPending}
                className="px-3 py-1.5 text-xs font-bold bg-[#1a3c5e] text-white rounded disabled:opacity-60"
              >
                {mut.isPending ? "Uploading…" : `✅ Upload ${rows.length} rows`}
              </button>
            </div>
          </div>
          <div className="overflow-auto max-h-72 border border-slate-200 rounded-lg">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 text-[10px] uppercase text-slate-500 sticky top-0">
                <tr>
                  {headers.map((h) => (
                    <th key={h} className="text-left px-2 py-1.5 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 30).map((r, i) => (
                  <tr key={i} className="border-t border-slate-100">
                    {headers.map((h) => (
                      <td key={h} className="px-2 py-1 whitespace-nowrap">{r[h]}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        <div className="font-bold text-slate-800 mb-2">
          Current Roster ({masterRows.length})
        </div>
        <div className="overflow-auto max-h-96 border border-slate-200 rounded-lg">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 text-[10px] uppercase text-slate-500 sticky top-0">
              <tr>
                <th className="text-left px-2 py-1.5">Client ID</th>
                <th className="text-left px-2 py-1.5">Client Name</th>
                <th className="text-left px-2 py-1.5">Branch</th>
                <th className="text-left px-2 py-1.5">State</th>
              </tr>
            </thead>
            <tbody>
              {list.isLoading && (
                <tr>
                  <td colSpan={4} className="px-3 py-8 text-center text-slate-400">Loading…</td>
                </tr>
              )}
              {!list.isLoading && masterRows.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-3 py-8 text-center text-slate-400">No clients yet</td>
                </tr>
              )}
              {masterRows.slice(0, 200).map((r) => (
                <tr key={r.id} className="border-t border-slate-100">
                  <td className="px-2 py-1.5 font-mono">{r.clientId}</td>
                  <td className="px-2 py-1.5">{r.clientName || "—"}</td>
                  <td className="px-2 py-1.5">{r.branch || "—"}</td>
                  <td className="px-2 py-1.5">{r.state || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
