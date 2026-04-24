import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiPost } from "../../lib/api";
import { showToast } from "../../components/Toast";

const empty = {
  clientId: "",
  clientName: "",
  state: "",
  branch: "",
  loanType: "Unsecured Business Loan",
  loanAmount: 0,
  disbursementDate: "",
  loanPurpose: "",
};

export default function LucAddClient() {
  const [form, setForm] = useState(empty);
  const qc = useQueryClient();

  const mut = useMutation({
    mutationFn: (body: typeof empty) => apiPost<{ ok: boolean }>("/luc/clients", body),
    onSuccess: () => {
      showToast(`Client ${form.clientId} added`, "ok");
      setForm(empty);
      qc.invalidateQueries({ queryKey: ["luc"] });
    },
    onError: (e: Error) => showToast(e.message, "err"),
  });

  return (
    <div className="space-y-5 max-w-3xl">
      <div>
        <h1 className="text-xl font-extrabold text-slate-800">Add New Client</h1>
        <p className="text-sm text-slate-500">Single client add karein</p>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          mut.mutate(form);
        }}
        className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4"
      >
        <div className="grid md:grid-cols-3 gap-3">
          <Field label="State" value={form.state} onChange={(v) => setForm({ ...form, state: v })} />
          <Field label="Branch Name" value={form.branch} onChange={(v) => setForm({ ...form, branch: v })} />
          <Field
            label="Client ID *"
            value={form.clientId}
            onChange={(v) => setForm({ ...form, clientId: v })}
            required
          />
        </div>
        <div className="grid md:grid-cols-3 gap-3">
          <Field
            label="Client Name *"
            value={form.clientName}
            onChange={(v) => setForm({ ...form, clientName: v })}
            required
          />
          <Field
            label="Loan Type"
            value={form.loanType}
            onChange={(v) => setForm({ ...form, loanType: v })}
          />
          <div>
            <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">Loan Amount</label>
            <input
              type="number"
              value={form.loanAmount || ""}
              onChange={(e) => setForm({ ...form, loanAmount: Number(e.target.value) })}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
              placeholder="100000"
            />
          </div>
        </div>
        <div className="grid md:grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">Disbursement Date</label>
            <input
              type="date"
              value={form.disbursementDate}
              onChange={(e) => setForm({ ...form, disbursementDate: e.target.value })}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <Field
            label="Loan Purpose"
            value={form.loanPurpose}
            onChange={(v) => setForm({ ...form, loanPurpose: v })}
          />
        </div>
        <div className="flex gap-2 justify-end">
          <button
            type="button"
            onClick={() => setForm(empty)}
            className="px-4 py-2 text-sm font-bold border border-slate-300 rounded-lg"
          >
            🗑️ Clear
          </button>
          <button
            type="submit"
            disabled={mut.isPending}
            className="px-4 py-2 text-sm font-bold bg-[#198754] hover:bg-[#0f5132] text-white rounded-lg disabled:opacity-60"
          >
            {mut.isPending ? "Adding…" : "✅ Add Client"}
          </button>
        </div>
      </form>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
}) {
  return (
    <div>
      <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">{label}</label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
      />
    </div>
  );
}
