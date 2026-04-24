import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost } from "../../lib/api";
import { showToast } from "../../components/Toast";
import { loadSession } from "../../lib/session";
import type { LucClient, LucVisit } from "./types";

const todayIso = () => new Date().toISOString().slice(0, 10);

export default function LucFieldVisit() {
  const session = loadSession();
  const qc = useQueryClient();

  const [searchId, setSearchId] = useState("");
  const [client, setClient] = useState<LucClient | null>(null);
  const [existing, setExisting] = useState<LucVisit | null>(null);
  const [searchErr, setSearchErr] = useState("");
  const [searching, setSearching] = useState(false);

  const [form, setForm] = useState({
    visitDate: todayIso(),
    visitPerson: session?.name ?? "",
    empCode: session?.uid ?? "",
    loanUsedIn: "",
    observation: "",
    remark: "",
  });
  const [photos, setPhotos] = useState<string[]>([]);
  const [submitted, setSubmitted] = useState(false);

  async function findClient() {
    setSearchErr("");
    setClient(null);
    setExisting(null);
    setSubmitted(false);
    const cid = searchId.trim();
    if (!cid) {
      setSearchErr("Client ID daalein");
      return;
    }
    setSearching(true);
    try {
      const j = await apiGet<{ ok: boolean; client: LucClient; visit: LucVisit | null }>(
        `/luc/clients/${encodeURIComponent(cid)}`,
      );
      setClient(j.client);
      setExisting(j.visit ?? null);
      if (j.visit) {
        setForm({
          visitDate: j.visit.visitDate || todayIso(),
          visitPerson: j.visit.visitPerson || (session?.name ?? ""),
          empCode: j.visit.empCode || (session?.uid ?? ""),
          loanUsedIn: j.visit.loanUsedIn || "",
          observation: j.visit.observation || "",
          remark: j.visit.remark || "",
        });
        setPhotos(j.visit.photos || []);
      } else {
        setForm({
          visitDate: todayIso(),
          visitPerson: session?.name ?? "",
          empCode: session?.uid ?? "",
          loanUsedIn: "",
          observation: "",
          remark: "",
        });
        setPhotos([]);
      }
    } catch (e) {
      setSearchErr("❌ Client ID not found");
    } finally {
      setSearching(false);
    }
  }

  async function handlePhotos(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (files.length === 0) return;
    const room = 5 - photos.length;
    if (room <= 0) {
      showToast("Max 5 photos", "err");
      return;
    }
    const next = files.slice(0, room);
    const dataUrls = await Promise.all(
      next.map(
        (f) =>
          new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(f);
          }),
      ),
    );
    setPhotos([...photos, ...dataUrls]);
  }

  function removePhoto(i: number) {
    setPhotos(photos.filter((_, j) => j !== i));
  }

  const submitMut = useMutation({
    mutationFn: () =>
      apiPost<{ ok: boolean }>("/luc/visits", {
        clientId: client!.clientId,
        ...form,
        photos,
      }),
    onSuccess: () => {
      showToast("✅ LUC submitted", "ok");
      setSubmitted(true);
      qc.invalidateQueries({ queryKey: ["luc"] });
    },
    onError: (e: Error) => showToast(e.message, "err"),
  });

  function reset() {
    setSearchId("");
    setClient(null);
    setExisting(null);
    setPhotos([]);
    setSubmitted(false);
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-extrabold text-[#0f5132]">LUC Field Entry</h2>
        <p className="text-xs text-slate-500">Client ID se search karo aur LUC submit karo</p>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        <h3 className="font-bold text-[#0f5132] mb-3">🔍 Find Client</h3>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            findClient();
          }}
          className="flex gap-2"
        >
          <input
            value={searchId}
            onChange={(e) => setSearchId(e.target.value)}
            placeholder="Client ID daalein…"
            className="flex-1 border-2 border-slate-200 focus:border-emerald-500 rounded-lg px-3 py-2.5 text-sm"
          />
          <button
            type="submit"
            disabled={searching}
            className="px-4 py-2 bg-[#198754] hover:bg-[#0f5132] text-white text-sm font-bold rounded-lg disabled:opacity-60"
          >
            {searching ? "Searching…" : "Search"}
          </button>
        </form>
        {searchErr && (
          <div className="mt-3 text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded px-3 py-2">
            {searchErr}
          </div>
        )}
      </div>

      {client && (
        <div className="bg-white rounded-2xl border-l-4 border-l-[#198754] border border-slate-200 p-5">
          <div className="font-bold text-[#0f5132] text-lg mb-3">{client.clientName}</div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-xs">
            <Info label="Client ID" value={client.clientId} />
            <Info label="State" value={client.state} />
            <Info label="Branch" value={client.branch} />
            <Info label="Loan Type" value={client.loanType} />
            <Info label="Amount" value={client.loanAmount.toLocaleString("en-IN")} />
            <Info label="Dis Date" value={client.disbursementDate} />
            <Info label="Purpose" value={client.loanPurpose} />
          </div>
          {existing && (
            <div className="mt-3 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded px-3 py-2">
              ⚠️ This client already has a LUC visit. Submitting again will update it.
            </div>
          )}
        </div>
      )}

      {client && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
          <h3 className="font-bold text-[#0f5132]">📝 LUC Visit Details</h3>
          <Field label="LUC Visit Date *" type="date" value={form.visitDate} onChange={(v) => setForm({ ...form, visitDate: v })} />
          <Field label="Visit Person Name *" value={form.visitPerson} onChange={(v) => setForm({ ...form, visitPerson: v })} />
          <Field label="Employee Code *" value={form.empCode} onChange={(v) => setForm({ ...form, empCode: v })} />
          <Field label="Loan Used In" value={form.loanUsedIn} onChange={(v) => setForm({ ...form, loanUsedIn: v })} placeholder="Loan ka use kahan hua" />
          <TextArea label="Visit Time & Observation" value={form.observation} onChange={(v) => setForm({ ...form, observation: v })} />
          <TextArea label="Remark" value={form.remark} onChange={(v) => setForm({ ...form, remark: v })} />
          <div>
            <label className="block text-xs font-bold uppercase text-slate-500 mb-1.5">📸 Photos (Max 5)</label>
            <label className="cursor-pointer block border-2 border-dashed border-slate-300 hover:border-emerald-500 rounded-lg p-5 text-center">
              <input
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={handlePhotos}
                disabled={photos.length >= 5}
              />
              <div className="text-2xl">📷</div>
              <div className="text-sm font-bold mt-1">Click to add photos</div>
              <div className="text-xs text-slate-500">JPG, PNG — Max 5</div>
            </label>
            {photos.length > 0 && (
              <div className="mt-3 grid grid-cols-3 sm:grid-cols-5 gap-2">
                {photos.map((p, i) => (
                  <div key={i} className="relative">
                    <img src={p} alt="" className="w-full h-20 object-cover rounded-lg border border-slate-200" />
                    <button
                      onClick={() => removePhoto(i)}
                      className="absolute -top-1 -right-1 bg-rose-600 text-white text-xs font-bold w-5 h-5 rounded-full grid place-items-center"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
          <button
            onClick={() => {
              if (!form.visitDate || !form.visitPerson || !form.empCode) {
                showToast("Required fields missing", "err");
                return;
              }
              submitMut.mutate();
            }}
            disabled={submitMut.isPending}
            className="w-full py-3 bg-[#198754] hover:bg-[#0f5132] text-white text-sm font-bold rounded-lg disabled:opacity-60"
          >
            {submitMut.isPending ? "Submitting…" : "✅ Submit LUC"}
          </button>
        </div>
      )}

      {submitted && (
        <div className="fixed inset-0 bg-black/50 grid place-items-center z-[1500] p-4" onClick={reset}>
          <div className="bg-white rounded-2xl p-7 max-w-sm w-full text-center" onClick={(e) => e.stopPropagation()}>
            <div className="text-5xl mb-3">🎉</div>
            <div className="text-lg font-extrabold mb-1">Successfully Submitted!</div>
            <div className="text-sm text-slate-500 mb-5">LUC data record ho gaya!</div>
            <button onClick={reset} className="w-full py-2.5 bg-[#198754] text-white font-bold rounded-lg">
              Submit Another
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] uppercase text-slate-500 font-bold">{label}</div>
      <div className="font-semibold text-slate-800">{value || "—"}</div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="block text-xs font-bold uppercase text-slate-500 mb-1.5">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full border border-slate-300 focus:border-emerald-500 rounded-lg px-3 py-2 text-sm"
      />
    </div>
  );
}

function TextArea({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="block text-xs font-bold uppercase text-slate-500 mb-1.5">{label}</label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={3}
        className="w-full border border-slate-300 focus:border-emerald-500 rounded-lg px-3 py-2 text-sm"
      />
    </div>
  );
}
