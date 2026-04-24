import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiPost } from "../../lib/api";
import { parseCsv, downloadCsv } from "../../lib/csv";
import { showToast } from "../../components/Toast";

export default function LucBulkUpload() {
  const [mode, setMode] = useState<"append" | "replace">("append");
  const [preview, setPreview] = useState<Record<string, string>[]>([]);
  const qc = useQueryClient();

  const mut = useMutation({
    mutationFn: (body: { clients: Record<string, string>[]; mode: "append" | "replace" }) =>
      apiPost<{
        ok: boolean;
        added: number;
        skipped: number;
        errors: { row: number; reason: string }[];
        total: number;
      }>("/luc/clients/bulk", body),
    onSuccess: (j) => {
      showToast(
        `Added ${j.added} · Skipped ${j.skipped}${j.errors.length ? ` · ${j.errors.length} errors` : ""} · Total ${j.total}`,
        "ok",
      );
      setPreview([]);
      qc.invalidateQueries({ queryKey: ["luc"] });
    },
    onError: (e: Error) => showToast(e.message, "err"),
  });

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    const text = await f.text();
    const rows = parseCsv(text);
    setPreview(rows);
  }

  function downloadTemplate() {
    downloadCsv(
      "luc-clients-template.csv",
      [
        {
          State: "HR",
          "Branch Name": "KAITHAL",
          "Client Id": "60480",
          "Client NAME": "Kiran Surender",
          "Loan Type": "Unsecured Business Loan",
          "Laon amount": "100000",
          "Dis Date": "2026-01-21",
          "Loan Purpose": "Purchase of cattle",
        },
      ],
      [
        "State",
        "Branch Name",
        "Client Id",
        "Client NAME",
        "Loan Type",
        "Laon amount",
        "Dis Date",
        "Loan Purpose",
      ],
    );
  }

  const headers = preview[0] ? Object.keys(preview[0]) : [];

  return (
    <div className="space-y-5 max-w-4xl">
      <div>
        <h1 className="text-xl font-extrabold text-slate-800">📤 Bulk Upload</h1>
        <p className="text-sm text-slate-500">CSV se ek saath kai clients add karein</p>
      </div>

      <div className="bg-white rounded-2xl border-l-4 border-l-[#198754] border border-slate-200 p-5">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-7 h-7 bg-[#198754] text-white rounded-full grid place-items-center font-bold">1</div>
          <div>
            <div className="font-bold">Template Download</div>
            <div className="text-xs text-slate-500">Correct format ke liye template use karein</div>
          </div>
        </div>
        <code className="block bg-slate-50 px-3 py-2 rounded text-[11px] text-slate-600 mb-3">
          State, Branch Name, Client Id, Client NAME, Loan Type, Laon amount, Dis Date, Loan Purpose
        </code>
        <button
          onClick={downloadTemplate}
          className="text-xs font-bold border border-slate-300 hover:border-[#198754] rounded-lg px-3 py-2"
        >
          📄 Template Download (CSV)
        </button>
      </div>

      <div className="bg-white rounded-2xl border-l-4 border-l-[#0f5132] border border-slate-200 p-5">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-7 h-7 bg-[#0f5132] text-white rounded-full grid place-items-center font-bold">2</div>
          <div>
            <div className="font-bold">File Upload</div>
            <div className="text-xs text-slate-500">CSV file</div>
          </div>
        </div>
        <div className="flex gap-2 mb-3 text-xs">
          <label className="flex items-center gap-1">
            <input type="radio" checked={mode === "append"} onChange={() => setMode("append")} />
            Append
          </label>
          <label className="flex items-center gap-1">
            <input type="radio" checked={mode === "replace"} onChange={() => setMode("replace")} />
            Replace all
          </label>
        </div>
        <input
          type="file"
          accept=".csv"
          onChange={handleFile}
          className="block w-full text-xs file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-[#0f5132] file:text-white"
        />
      </div>

      {preview.length > 0 && (
        <div className="bg-white rounded-2xl border-l-4 border-l-amber-400 border border-slate-200 p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-7 h-7 bg-amber-400 text-white rounded-full grid place-items-center font-bold">3</div>
            <div>
              <div className="font-bold">Preview &amp; Confirm</div>
              <div className="text-xs text-slate-500">{preview.length} records</div>
            </div>
          </div>
          <div className="max-h-72 overflow-auto border border-slate-200 rounded-lg mb-3">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 text-[10px] uppercase text-slate-500 sticky top-0">
                <tr>
                  {headers.map((h) => (
                    <th key={h} className="text-left px-2 py-1.5 whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.slice(0, 50).map((r, i) => (
                  <tr key={i} className="border-t border-slate-100">
                    {headers.map((h) => (
                      <td key={h} className="px-2 py-1.5 whitespace-nowrap">
                        {r[h]}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setPreview([])}
              className="px-4 py-2 text-sm font-bold border border-slate-300 rounded-lg"
            >
              ❌ Cancel
            </button>
            <button
              onClick={() => mut.mutate({ clients: preview, mode })}
              disabled={mut.isPending}
              className="px-4 py-2 text-sm font-bold bg-[#198754] hover:bg-[#0f5132] text-white rounded-lg disabled:opacity-60"
            >
              {mut.isPending ? "Uploading…" : "✅ Confirm Upload"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
