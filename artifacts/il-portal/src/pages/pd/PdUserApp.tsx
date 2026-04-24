import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import PdLayout, { PdSidebarItem, PdSidebarLabel } from "./PdLayout";
import type { SessionUser } from "../../lib/session";
import { apiGet, apiPost, apiPut } from "../../lib/api";
import { showToast } from "../../components/Toast";
import {
  emptyPayload,
  PD_SECTIONS,
  type PdPayload,
  type PdSection,
  type PhotoEntry,
  type PdMasterClient,
} from "./types";
import { calcEligibility, inr } from "./eligibility";

export default function PdUserApp({ session }: { session: SessionUser }) {
  const qc = useQueryClient();
  const [section, setSection] = useState<PdSection>("clientSearch");
  const [payload, setPayload] = useState<PdPayload>(emptyPayload);
  const [photos, setPhotos] = useState<PhotoEntry[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  // -- Load draft once --
  const draftQ = useQuery({
    queryKey: ["pd", "draft"],
    queryFn: () =>
      apiGet<{ ok: boolean; draft: { payload: PdPayload; photos: PhotoEntry[]; updatedAt: number } | null }>(
        "/pd/draft",
      ),
  });

  useEffect(() => {
    if (!draftQ.data || loaded) return;
    if (draftQ.data.draft) {
      setPayload({ ...emptyPayload, ...draftQ.data.draft.payload });
      setPhotos(draftQ.data.draft.photos ?? []);
      setSavedAt(draftQ.data.draft.updatedAt);
    } else {
      setPayload((p) => ({
        ...p,
        emp_name: session.name,
        emp_code: session.uid,
        emp_branch: session.branch,
        emp_date: new Date().toISOString().slice(0, 10),
      }));
    }
    setLoaded(true);
  }, [draftQ.data, loaded, session]);

  // -- Autosave (debounced) --
  const saveTimer = useRef<number | null>(null);
  const saveMut = useMutation({
    mutationFn: (body: { payload: PdPayload; photos: PhotoEntry[] }) =>
      apiPut<{ ok: boolean; updatedAt: number }>("/pd/draft", body),
    onSuccess: (j) => setSavedAt(j.updatedAt),
  });

  useEffect(() => {
    if (!loaded) return;
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      saveMut.mutate({ payload, photos });
    }, 1000);
    return () => {
      if (saveTimer.current) window.clearTimeout(saveTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payload, photos, loaded]);

  function update<K extends keyof PdPayload>(key: K, value: PdPayload[K]) {
    setPayload((p) => ({ ...p, [key]: value }));
  }

  // -- Master client lookup --
  const [searchBusy, setSearchBusy] = useState(false);
  const [searchMsg, setSearchMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  async function doSearch() {
    if (!payload.clientId.trim()) {
      setSearchMsg({ kind: "err", text: "Client ID required" });
      return;
    }
    setSearchBusy(true);
    setSearchMsg(null);
    try {
      const masters = await apiGet<PdMasterClient[]>("/pd/master-clients");
      const found = masters.find((m) => String(m.clientId) === payload.clientId.trim());
      if (!found) {
        setSearchMsg({ kind: "err", text: `❌ Client ID ${payload.clientId} not in master roster` });
        return;
      }
      const get = (...keys: string[]): string => {
        for (const k of keys) {
          const v = found[k];
          if (v != null && String(v).trim() !== "") return String(v);
        }
        return "";
      };
      setPayload((p) => ({
        ...p,
        ilClientId: get("MFI Client ID", "ilClientId", "MFI ID"),
        loanId: get("Loan ID", "loanId", "Loan ID (IL)"),
        name: get("Client Name", "Name", "name", "clientName", "Client NAME"),
        address: get("Address", "address", "Current Address"),
        permAddress: get("Permanent Address", "permAddress"),
        state: get("State", "state"),
        branch: get("Branch", "branch", "Branch Name"),
      }));
      // Pull other loans for this client and pre-fill rows
      try {
        const loans = await apiGet<Array<Record<string, unknown>>>(
          `/pd/other-loans?clientId=${encodeURIComponent(payload.clientId.trim())}`,
        );
        if (loans.length > 0) {
          const next = [...payload.otherLoans];
          loans.slice(0, 10).forEach((l, i) => {
            next[i] = {
              bank: String(l["Bank"] ?? l["Bank Name"] ?? l["bank"] ?? ""),
              loanType: String(l["Loan Type"] ?? l["loanType"] ?? ""),
              loanAmount: String(l["Loan Amount"] ?? l["loanAmount"] ?? ""),
              outstanding: String(l["Outstanding"] ?? l["outstanding"] ?? ""),
              emi: String(l["EMI"] ?? l["emi"] ?? ""),
              tenureLeft: String(l["Tenure Left"] ?? l["tenureLeft"] ?? ""),
              remarks: String(l["Remarks"] ?? l["remarks"] ?? ""),
            };
          });
          setPayload((p) => ({ ...p, otherLoans: next }));
        }
      } catch {
        // ignore
      }
      setSearchMsg({ kind: "ok", text: `✅ Found: ${get("Client Name", "Name", "name") || payload.clientId}` });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Lookup failed";
      setSearchMsg({ kind: "err", text: msg });
    } finally {
      setSearchBusy(false);
    }
  }

  // -- Submit --
  const submitMut = useMutation({
    mutationFn: () => apiPost<{ ok: boolean }>("/pd/applications", { payload, photos }),
    onSuccess: () => {
      showToast("✅ Application submitted", "ok");
      setPayload(emptyPayload);
      setPhotos([]);
      setSection("clientSearch");
      qc.invalidateQueries({ queryKey: ["pd", "draft"] });
    },
    onError: (e: Error) => showToast(e.message, "err"),
  });

  const elig = useMemo(() => calcEligibility(payload), [payload]);

  if (!loaded) {
    return (
      <PdLayout session={session}>
        <div className="p-6 text-sm text-slate-500">Loading…</div>
      </PdLayout>
    );
  }

  return (
    <PdLayout
      session={session}
      sidebar={
        <>
          <PdSidebarLabel>Application</PdSidebarLabel>
          {PD_SECTIONS.map((s) => (
            <PdSidebarItem
              key={s.id}
              active={section === s.id}
              onClick={() => setSection(s.id)}
              icon={s.icon}
              label={s.label}
            />
          ))}
        </>
      }
    >
      <div className="max-w-5xl mx-auto space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-extrabold text-slate-800">
              {PD_SECTIONS.find((s) => s.id === section)?.icon}{" "}
              {PD_SECTIONS.find((s) => s.id === section)?.label}
            </h1>
            <p className="text-xs text-slate-500">
              Step {PD_SECTIONS.findIndex((s) => s.id === section) + 1} of {PD_SECTIONS.length}
            </p>
          </div>
          <div className="text-[11px] text-slate-500 text-right">
            {saveMut.isPending ? (
              <span className="text-amber-600 font-bold">💾 Saving…</span>
            ) : savedAt ? (
              <span className="text-emerald-700 font-bold">
                ✅ Auto-saved {new Date(savedAt).toLocaleTimeString()}
              </span>
            ) : (
              <span className="text-slate-400">Not saved yet</span>
            )}
          </div>
        </div>

        {section === "clientSearch" && (
          <Card title="🔖 Client Decision" badge="Pass / Fail">
            <div className="flex gap-2 items-end mb-3 flex-wrap">
              <div className="flex-1 min-w-[200px]">
                <Label>IL Client ID *</Label>
                <input
                  value={payload.clientId}
                  onChange={(e) => update("clientId", e.target.value)}
                  placeholder="Client ID likhein — auto-fill hoga"
                  className="w-full border-2 border-blue-300 rounded-lg px-3 py-2.5 text-sm font-bold"
                />
              </div>
              <button
                onClick={doSearch}
                disabled={searchBusy}
                className="px-4 py-2.5 bg-[#1a3c5e] text-white text-sm font-bold rounded-lg disabled:opacity-60"
              >
                {searchBusy ? "Searching…" : "🔍 Search"}
              </button>
            </div>
            {searchMsg && (
              <div
                className={`text-xs px-3 py-2 rounded-lg border mb-3 ${
                  searchMsg.kind === "err"
                    ? "bg-rose-50 border-rose-200 text-rose-700"
                    : "bg-emerald-50 border-emerald-200 text-emerald-700"
                }`}
              >
                {searchMsg.text}
              </div>
            )}
            <div className="max-w-xs">
              <Label>Client Type</Label>
              <select
                value={payload.clientType}
                onChange={(e) => update("clientType", e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
              >
                <option value="">-- Select Type --</option>
                <option>Open Market</option>
                <option>Existing Client</option>
                <option>Renewal</option>
              </select>
            </div>
            <div className="mt-3 text-xs bg-blue-50 border border-blue-200 text-blue-800 rounded-lg px-3 py-2">
              💡 Client search ke baad <b>Case Study</b> tab mein Pass/Fail decision dein.
            </div>
          </Card>
        )}

        {section === "applicant" && (
          <Card title="👤 Applicant Details" badge="Auto-Fill">
            <Grid>
              <ReadField label="Client ID (IL)" value={payload.clientId} />
              <ReadField label="MFI Client ID" value={payload.ilClientId} />
              <ReadField label="Loan ID (IL)" value={payload.loanId} />
              <ReadField label="Full Name" value={payload.name} />
              <Field label="Father/Husband Name" value={payload.fatherName} onChange={(v) => update("fatherName", v)} />
              <Field
                label="Date of Birth"
                type="date"
                value={payload.dob}
                onChange={(v) => {
                  update("dob", v);
                  if (v) {
                    const age = new Date().getFullYear() - new Date(v).getFullYear();
                    update("age", String(age));
                  }
                }}
              />
              <Field label="Age" type="number" value={payload.age} onChange={(v) => update("age", v)} />
              <Select label="Gender" value={payload.gender} onChange={(v) => update("gender", v)} options={["Male", "Female", "Other"]} />
              <Select label="Marital Status" value={payload.marital} onChange={(v) => update("marital", v)} options={["Married", "Single", "Widow", "Divorced"]} />
              <Field label="Mobile No." value={payload.mobile} onChange={(v) => update("mobile", v)} />
              <Field label="Alternate Mobile" value={payload.altMobile} onChange={(v) => update("altMobile", v)} />
              <ReadField label="Current Address" value={payload.address} />
              <ReadField label="Permanent Address" value={payload.permAddress} />
              <ReadField label="State" value={payload.state} />
              <Field label="PIN Code" value={payload.pin} onChange={(v) => update("pin", v)} />
              <ReadField label="Branch" value={payload.branch} />
              <Field label="Occupation" value={payload.occupation} onChange={(v) => update("occupation", v)} />
              <Field label="Distance from Branch (km)" type="number" value={payload.distanceFromBranch} onChange={(v) => update("distanceFromBranch", v)} />
            </Grid>
          </Card>
        )}

        {section === "coapplicant" && (
          <Card title="👥 Co-Applicant Details">
            <Grid>
              <Field label="Name" value={payload.caName} onChange={(v) => update("caName", v)} />
              <Select label="Relation" value={payload.caRelation} onChange={(v) => update("caRelation", v)} options={["Spouse", "Son", "Daughter", "Father", "Mother", "Brother", "Other"]} />
              <Field
                label="Date of Birth"
                type="date"
                value={payload.caDob}
                onChange={(v) => {
                  update("caDob", v);
                  if (v) {
                    const age = new Date().getFullYear() - new Date(v).getFullYear();
                    update("caAge", String(age));
                  }
                }}
              />
              <Field label="Age" type="number" value={payload.caAge} onChange={(v) => update("caAge", v)} />
              <Select label="Gender" value={payload.caGender} onChange={(v) => update("caGender", v)} options={["Male", "Female", "Other"]} />
              <Field label="Mobile No." value={payload.caMobile} onChange={(v) => update("caMobile", v)} />
              <Field label="Occupation" value={payload.caOccupation} onChange={(v) => update("caOccupation", v)} />
            </Grid>
          </Card>
        )}

        {section === "family" && (
          <Card title="🏠 Family Details" badge="10 Members">
            <div className="overflow-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 text-xs uppercase text-slate-500">
                    <th className="text-left px-2 py-2 w-10">#</th>
                    <th className="text-left px-2 py-2">Name</th>
                    <th className="text-left px-2 py-2">Relation</th>
                    <th className="text-left px-2 py-2 w-20">Age</th>
                    <th className="text-left px-2 py-2 w-28">Gender</th>
                    <th className="text-left px-2 py-2">Occupation</th>
                  </tr>
                </thead>
                <tbody>
                  {payload.family.map((row, i) => (
                    <tr key={i} className="border-t border-slate-100">
                      <td className="px-2 py-1 text-xs text-slate-500">{i + 1}</td>
                      <td className="px-1 py-1">
                        <input value={row.name} onChange={(e) => updateFamily(i, "name", e.target.value)} className="w-full border border-slate-200 rounded px-2 py-1 text-sm" />
                      </td>
                      <td className="px-1 py-1">
                        <input value={row.relation} onChange={(e) => updateFamily(i, "relation", e.target.value)} className="w-full border border-slate-200 rounded px-2 py-1 text-sm" />
                      </td>
                      <td className="px-1 py-1">
                        <input type="number" value={row.age} onChange={(e) => updateFamily(i, "age", e.target.value)} className="w-full border border-slate-200 rounded px-2 py-1 text-sm" />
                      </td>
                      <td className="px-1 py-1">
                        <select value={row.gender} onChange={(e) => updateFamily(i, "gender", e.target.value)} className="w-full border border-slate-200 rounded px-2 py-1 text-sm">
                          <option value=""></option>
                          <option>Male</option>
                          <option>Female</option>
                          <option>Other</option>
                        </select>
                      </td>
                      <td className="px-1 py-1">
                        <input value={row.occupation} onChange={(e) => updateFamily(i, "occupation", e.target.value)} className="w-full border border-slate-200 rounded px-2 py-1 text-sm" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {section === "bank" && (
          <Card title="🏦 Bank Account Details">
            <BankCard idx={1} primary payload={payload} onChange={update} />
            <div className="h-4" />
            <BankCard idx={2} payload={payload} onChange={update} />
          </Card>
        )}

        {section === "otherloans" && (
          <Card title="📑 Other Loan Details" badge="10 Rows">
            <p className="text-xs text-slate-500 mb-3">Bank / MFI / NBFC saari existing loans fill karein. EMI auto-total hoga.</p>
            <div className="overflow-auto">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 text-[10px] uppercase text-slate-500">
                  <tr>
                    <th className="px-2 py-2 w-8">#</th>
                    <th className="px-2 py-2 text-left">Bank / MFI / NBFC</th>
                    <th className="px-2 py-2 text-left">Loan Type</th>
                    <th className="px-2 py-2 text-right">Loan Amount</th>
                    <th className="px-2 py-2 text-right">Outstanding</th>
                    <th className="px-2 py-2 text-right">EMI/month</th>
                    <th className="px-2 py-2 text-right">Tenure Left</th>
                    <th className="px-2 py-2 text-left">Remarks</th>
                  </tr>
                </thead>
                <tbody>
                  {payload.otherLoans.map((row, i) => (
                    <tr key={i} className="border-t border-slate-100">
                      <td className="px-2 py-1 text-slate-500">{i + 1}</td>
                      <td className="px-1 py-1"><input value={row.bank} onChange={(e) => updateLoan(i, "bank", e.target.value)} className="w-full border border-slate-200 rounded px-2 py-1 text-xs" /></td>
                      <td className="px-1 py-1"><input value={row.loanType} onChange={(e) => updateLoan(i, "loanType", e.target.value)} className="w-full border border-slate-200 rounded px-2 py-1 text-xs" /></td>
                      <td className="px-1 py-1"><input type="number" value={row.loanAmount} onChange={(e) => updateLoan(i, "loanAmount", e.target.value)} className="w-full border border-slate-200 rounded px-2 py-1 text-xs text-right" /></td>
                      <td className="px-1 py-1"><input type="number" value={row.outstanding} onChange={(e) => updateLoan(i, "outstanding", e.target.value)} className="w-full border border-slate-200 rounded px-2 py-1 text-xs text-right" /></td>
                      <td className="px-1 py-1"><input type="number" value={row.emi} onChange={(e) => updateLoan(i, "emi", e.target.value)} className="w-full border border-slate-200 rounded px-2 py-1 text-xs text-right" /></td>
                      <td className="px-1 py-1"><input value={row.tenureLeft} onChange={(e) => updateLoan(i, "tenureLeft", e.target.value)} className="w-full border border-slate-200 rounded px-2 py-1 text-xs text-right" /></td>
                      <td className="px-1 py-1"><input value={row.remarks} onChange={(e) => updateLoan(i, "remarks", e.target.value)} className="w-full border border-slate-200 rounded px-2 py-1 text-xs" /></td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-amber-50 font-bold text-sm">
                    <td colSpan={3} className="text-right px-2 py-2 text-slate-600">TOTAL</td>
                    <td className="px-2 py-2 text-right text-[#1a3c5e]">
                      {inr(payload.otherLoans.reduce((a, r) => a + (Number(r.loanAmount) || 0), 0))}
                    </td>
                    <td className="px-2 py-2 text-right text-[#1a3c5e]">
                      {inr(payload.otherLoans.reduce((a, r) => a + (Number(r.outstanding) || 0), 0))}
                    </td>
                    <td className="px-2 py-2 text-right text-rose-700">
                      {inr(elig.emiObligation)}
                    </td>
                    <td colSpan={2}></td>
                  </tr>
                </tfoot>
              </table>
            </div>
            <div className="mt-3 inline-flex gap-3 items-center bg-rose-50 rounded-lg px-4 py-2">
              <span className="text-xs text-slate-600">Total Monthly EMI Obligation:</span>
              <span className="text-lg font-extrabold text-rose-700">{inr(elig.emiObligation)}</span>
            </div>
          </Card>
        )}

        {section === "eligibility" && (
          <>
            <Card title="💰 Income Details">
              <div className="grid md:grid-cols-2 gap-4">
                <ColorBox color="green" title="🏪 Business Income">
                  <Field small label="Monthly Turnover (₹)" type="number" value={payload.ei_turnover} onChange={(v) => update("ei_turnover", v)} />
                  <Field small label="Gross Margin (%)" type="number" value={payload.ei_margin} onChange={(v) => update("ei_margin", v)} />
                  <Field small label="Monthly Business Expense (₹)" type="number" value={payload.ei_bizexp} onChange={(v) => update("ei_bizexp", v)} />
                  <SubTotal label="Net Business Income" value={inr(elig.bizNet)} />
                </ColorBox>
                <ColorBox color="green" title="🐄 Cattle / Milk Income">
                  <div className="grid grid-cols-2 gap-2">
                    <Field small label="Cows" type="number" value={payload.ei_cows} onChange={(v) => update("ei_cows", v)} />
                    <Field small label="Buffaloes" type="number" value={payload.ei_buffalo} onChange={(v) => update("ei_buffalo", v)} />
                    <Field small label="Cow Milk/day (Ltr)" type="number" value={payload.ei_cow_milk} onChange={(v) => update("ei_cow_milk", v)} />
                    <Field small label="Buffalo Milk/day (Ltr)" type="number" value={payload.ei_buf_milk} onChange={(v) => update("ei_buf_milk", v)} />
                    <Field small label="Cow Rate/Ltr (₹)" type="number" value={payload.ei_cow_rate} onChange={(v) => update("ei_cow_rate", v)} />
                    <Field small label="Buffalo Rate/Ltr (₹)" type="number" value={payload.ei_buf_rate} onChange={(v) => update("ei_buf_rate", v)} />
                  </div>
                  <Field small label="Feed Cost/month (₹)" type="number" value={payload.ei_feedcost} onChange={(v) => update("ei_feedcost", v)} />
                  <SubTotal label="Net Milk Income" value={inr(elig.milkNet)} />
                </ColorBox>
                <ColorBox color="yellow" title="🌾 Agriculture Income">
                  <Field small label="Monthly Agriculture Income (₹)" type="number" value={payload.ei_agri_monthly} onChange={(v) => update("ei_agri_monthly", v)} />
                  <SubTotal label="Monthly Agri Income" value={inr(elig.agriNet)} />
                </ColorBox>
                <ColorBox color="blue" title="👤 Other Person Income">
                  <Field small label="Person Name / Relation" value={payload.ei_other_name} onChange={(v) => update("ei_other_name", v)} />
                  <Field small label="Monthly Income (₹)" type="number" value={payload.ei_other_income} onChange={(v) => update("ei_other_income", v)} />
                  <Field small label="Monthly Household Expense (₹)" type="number" value={payload.ei_hh_exp} onChange={(v) => update("ei_hh_exp", v)} />
                </ColorBox>
              </div>
            </Card>

            <Card title="📋 Applied Loan Details">
              <Grid>
                <Field label="Applied Loan Amount (₹) *" type="number" value={payload.ei_applied} onChange={(v) => update("ei_applied", v)} />
                <Field label="Tenure (Months)" type="number" value={payload.ei_tenure} onChange={(v) => update("ei_tenure", v)} />
                <Field label="Interest Rate (% p.a.)" type="number" value={payload.ei_roi} onChange={(v) => update("ei_roi", v)} />
              </Grid>
            </Card>

            <Card title="🧮 Live Eligibility Result" border>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
                <MetricCard color="green" label="Business" value={inr(elig.bizNet)} />
                <MetricCard color="green" label="Milk" value={inr(elig.milkNet)} />
                <MetricCard color="yellow" label="Agriculture" value={inr(elig.agriNet)} />
                <MetricCard color="rose" label="Expenses" value={inr(elig.totalExpense)} />
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mb-4">
                <MetricCard color="blue" label="Total Monthly Income" value={inr(elig.totalIncome)} />
                <MetricCard color="blue" label="Net Disposable" value={inr(elig.netDisposable)} />
                <MetricCard color="rose" label="Existing EMI" value={inr(elig.emiObligation)} />
                <MetricCard color="indigo" label="New EMI (calculated)" value={inr(elig.newEmi)} />
                <MetricCard color="indigo" label="Eligible Loan (max)" value={inr(elig.eligibleLoan)} />
                <MetricCard color="indigo" label="FOIR %" value={`${elig.foir.toFixed(1)}%`} />
              </div>
              <div className={`text-center font-extrabold text-lg p-4 rounded-lg ${
                elig.decision === "Eligible"
                  ? "bg-emerald-100 text-emerald-800"
                  : elig.decision === "Borderline"
                  ? "bg-amber-100 text-amber-800"
                  : elig.decision === "Not Eligible"
                  ? "bg-rose-100 text-rose-800"
                  : "bg-slate-100 text-slate-600"
              }`}>
                Decision: {elig.decision}
              </div>
            </Card>
          </>
        )}

        {section === "reference" && (
          <Card title="📞 Reference Check">
            <h4 className="font-bold text-sm text-slate-700 mb-2">Reference 1</h4>
            <Grid>
              <Field label="Name" value={payload.ref1Name} onChange={(v) => update("ref1Name", v)} />
              <Field label="Relation" value={payload.ref1Relation} onChange={(v) => update("ref1Relation", v)} />
              <Field label="Mobile" value={payload.ref1Mobile} onChange={(v) => update("ref1Mobile", v)} />
              <Field label="Address" value={payload.ref1Address} onChange={(v) => update("ref1Address", v)} />
              <Select label="Verified?" value={payload.ref1Verified} onChange={(v) => update("ref1Verified", v)} options={["", "Yes", "No"]} />
            </Grid>
            <h4 className="font-bold text-sm text-slate-700 mt-5 mb-2">Reference 2</h4>
            <Grid>
              <Field label="Name" value={payload.ref2Name} onChange={(v) => update("ref2Name", v)} />
              <Field label="Relation" value={payload.ref2Relation} onChange={(v) => update("ref2Relation", v)} />
              <Field label="Mobile" value={payload.ref2Mobile} onChange={(v) => update("ref2Mobile", v)} />
              <Field label="Address" value={payload.ref2Address} onChange={(v) => update("ref2Address", v)} />
              <Select label="Verified?" value={payload.ref2Verified} onChange={(v) => update("ref2Verified", v)} options={["", "Yes", "No"]} />
            </Grid>
          </Card>
        )}

        {section === "casestudy" && (
          <Card title="📝 Case Study & Decision" badge="Pass / Fail">
            <Label>Case Study (notes, observations, repayment behavior)</Label>
            <textarea
              value={payload.caseStudy}
              onChange={(e) => update("caseStudy", e.target.value)}
              rows={8}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
              placeholder="Detailed write-up of client business, family, repayment intent, observations..."
            />
            <div className="grid md:grid-cols-2 gap-3 mt-4">
              <div>
                <Label>Final Decision</Label>
                <select
                  value={payload.decision}
                  onChange={(e) => update("decision", e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm font-bold"
                >
                  <option value="">-- Select --</option>
                  <option value="Pass">✅ Pass</option>
                  <option value="Fail">❌ Fail</option>
                </select>
              </div>
              <Field label="Decision Remark" value={payload.decisionRemark} onChange={(v) => update("decisionRemark", v)} />
            </div>
          </Card>
        )}

        {section === "photos" && (
          <Card title="📷 Photo Upload" badge="5 Photos">
            <PhotosSection photos={photos} setPhotos={setPhotos} />
          </Card>
        )}

        {section === "empdetails" && (
          <Card title="🪪 Submitted By — Employee Details">
            <Grid>
              <Field label="Employee Name" value={payload.emp_name} onChange={(v) => update("emp_name", v)} />
              <Field label="Employee Code" value={payload.emp_code} onChange={(v) => update("emp_code", v)} />
              <Field label="Designation" value={payload.emp_designation} onChange={(v) => update("emp_designation", v)} />
              <Field label="Branch" value={payload.emp_branch} onChange={(v) => update("emp_branch", v)} />
              <Field label="Submission Date" type="date" value={payload.emp_date} onChange={(v) => update("emp_date", v)} />
            </Grid>
          </Card>
        )}

        {section === "submit" && (
          <Card title="🚀 Submit Application">
            <div className="text-center py-6 space-y-4">
              <div className="text-5xl">🚀</div>
              <h3 className="text-lg font-extrabold text-slate-800">Ready to Submit</h3>
              <p className="text-sm text-slate-500">
                Application client <strong>{payload.clientId || "—"}</strong> ({payload.name || "no name"}) ko submit kiya jayega.
              </p>
              <div className={`inline-block px-4 py-2 rounded-lg font-bold ${
                payload.decision === "Pass" ? "bg-emerald-100 text-emerald-800"
                  : payload.decision === "Fail" ? "bg-rose-100 text-rose-800"
                  : "bg-amber-100 text-amber-800"
              }`}>
                Decision: {payload.decision || "Not set"}
              </div>
              <div>
                <button
                  onClick={() => {
                    if (!payload.clientId) {
                      showToast("Client ID is required", "err");
                      return;
                    }
                    if (!payload.decision) {
                      showToast("Please set Pass/Fail in Case Study", "err");
                      return;
                    }
                    submitMut.mutate();
                  }}
                  disabled={submitMut.isPending}
                  className="px-6 py-3 bg-[#1a3c5e] hover:bg-[#15324f] text-white text-sm font-bold rounded-lg disabled:opacity-60"
                >
                  {submitMut.isPending ? "Submitting…" : "✅ Submit Application"}
                </button>
              </div>
            </div>
          </Card>
        )}

        <div className="flex justify-between pt-4">
          <button
            onClick={() => {
              const idx = PD_SECTIONS.findIndex((s) => s.id === section);
              if (idx > 0) setSection(PD_SECTIONS[idx - 1]!.id);
            }}
            disabled={PD_SECTIONS[0]!.id === section}
            className="px-4 py-2 text-sm font-bold border border-slate-300 rounded-lg disabled:opacity-40"
          >
            ← Prev
          </button>
          <button
            onClick={() => {
              const idx = PD_SECTIONS.findIndex((s) => s.id === section);
              if (idx < PD_SECTIONS.length - 1) setSection(PD_SECTIONS[idx + 1]!.id);
            }}
            disabled={PD_SECTIONS[PD_SECTIONS.length - 1]!.id === section}
            className="px-4 py-2 text-sm font-bold bg-[#1a3c5e] text-white rounded-lg disabled:opacity-40"
          >
            Next →
          </button>
        </div>
      </div>
    </PdLayout>
  );

  function updateFamily(i: number, key: keyof PdPayload["family"][number], value: string) {
    setPayload((p) => {
      const next = [...p.family];
      next[i] = { ...next[i]!, [key]: value };
      return { ...p, family: next };
    });
  }
  function updateLoan(i: number, key: keyof PdPayload["otherLoans"][number], value: string) {
    setPayload((p) => {
      const next = [...p.otherLoans];
      next[i] = { ...next[i]!, [key]: value };
      return { ...p, otherLoans: next };
    });
  }
}

/* ---------------- Helpers / sub-components ---------------- */

function Card({
  title,
  badge,
  border,
  children,
}: {
  title: string;
  badge?: string;
  border?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`bg-white rounded-2xl ${border ? "border-2 border-[#1a3c5e]" : "border border-slate-200"} p-5`}
    >
      <h3 className="text-base font-bold text-[#1a3c5e] mb-4 flex items-center gap-2">
        {title}
        {badge && (
          <span className="text-[10px] font-bold uppercase bg-amber-100 text-amber-700 px-2 py-0.5 rounded">
            {badge}
          </span>
        )}
      </h3>
      {children}
    </div>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">{children}</div>;
}

function Label({ children }: { children: React.ReactNode }) {
  return <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">{children}</label>;
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  small,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  small?: boolean;
}) {
  return (
    <div className={small ? "mb-2" : ""}>
      <Label>{label}</Label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white"
      />
    </div>
  );
}

function ReadField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <Label>{label}</Label>
      <input value={value} readOnly className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-blue-50" />
    </div>
  );
}

function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
}) {
  return (
    <div>
      <Label>{label}</Label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white"
      >
        {options.map((o) => (
          <option key={o} value={o}>
            {o || "-- Select --"}
          </option>
        ))}
      </select>
    </div>
  );
}

function BankCard({
  idx,
  primary,
  payload,
  onChange,
}: {
  idx: 1 | 2;
  primary?: boolean;
  payload: PdPayload;
  onChange: <K extends keyof PdPayload>(k: K, v: PdPayload[K]) => void;
}) {
  const k = (suffix: string) => (`bk${idx}${suffix}` as keyof PdPayload);
  return (
    <div className={`rounded-xl p-4 border-2 ${primary ? "border-blue-200 bg-blue-50/40" : "border-slate-200 bg-slate-50/40"}`}>
      <div className="flex items-center gap-2 mb-3">
        <span className={`w-6 h-6 rounded-full grid place-items-center text-xs font-bold text-white ${primary ? "bg-[#1a3c5e]" : "bg-slate-500"}`}>
          {idx}
        </span>
        <div className="font-bold text-[#1a3c5e]">Bank {idx}{idx === 2 ? <span className="text-xs text-slate-500 font-normal"> (optional)</span> : null}</div>
      </div>
      <Grid>
        <Field label="Bank Name" value={payload[k("Name")] as string} onChange={(v) => onChange(k("Name") as keyof PdPayload, v)} />
        <Field label="Account No." value={payload[k("AccNo")] as string} onChange={(v) => onChange(k("AccNo") as keyof PdPayload, v)} />
        <Select label="Account Type" value={payload[k("Type")] as string} onChange={(v) => onChange(k("Type") as keyof PdPayload, v)} options={["Saving", "Current", "OD", "CC"]} />
        <Field label="Account Holder Name" value={payload[k("Holder")] as string} onChange={(v) => onChange(k("Holder") as keyof PdPayload, v)} />
        <Field label="IFSC Code" value={payload[k("Ifsc")] as string} onChange={(v) => onChange(k("Ifsc") as keyof PdPayload, v)} />
        <Field label="ABB — Avg Bank Balance (₹)" type="number" value={payload[k("Abb")] as string} onChange={(v) => onChange(k("Abb") as keyof PdPayload, v)} />
      </Grid>
    </div>
  );
}

function ColorBox({
  color,
  title,
  children,
}: {
  color: "green" | "yellow" | "blue";
  title: string;
  children: React.ReactNode;
}) {
  const map = {
    green: "bg-emerald-50 border-emerald-300 text-emerald-800",
    yellow: "bg-amber-50 border-amber-300 text-amber-900",
    blue: "bg-sky-50 border-sky-300 text-sky-800",
  };
  return (
    <div className={`rounded-xl p-3 border-2 ${map[color]}`}>
      <div className="font-bold text-sm mb-2">{title}</div>
      {children}
    </div>
  );
}

function SubTotal({ label, value }: { label: string; value: string }) {
  return (
    <div className="mt-2 px-3 py-1.5 bg-white rounded flex justify-between items-center">
      <span className="text-[11px] text-slate-600">{label}</span>
      <span className="font-extrabold text-emerald-700 text-sm">{value}</span>
    </div>
  );
}

function MetricCard({
  color,
  label,
  value,
}: {
  color: "green" | "yellow" | "rose" | "blue" | "indigo";
  label: string;
  value: string;
}) {
  const map = {
    green: "bg-emerald-50 text-emerald-800",
    yellow: "bg-amber-50 text-amber-800",
    rose: "bg-rose-50 text-rose-800",
    blue: "bg-blue-50 text-blue-800",
    indigo: "bg-indigo-50 text-indigo-800",
  };
  return (
    <div className={`rounded-lg p-3 text-center ${map[color]}`}>
      <div className="text-[10px] uppercase font-bold tracking-wider opacity-80">{label}</div>
      <div className="text-base font-extrabold mt-1">{value}</div>
    </div>
  );
}

function PhotosSection({
  photos,
  setPhotos,
}: {
  photos: PhotoEntry[];
  setPhotos: (p: PhotoEntry[]) => void;
}) {
  async function handleFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    const room = 5 - photos.length;
    if (room <= 0) return;
    const next = await Promise.all(
      files.slice(0, room).map(
        (f) =>
          new Promise<PhotoEntry>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve({ label: f.name, data: reader.result as string });
            reader.onerror = reject;
            reader.readAsDataURL(f);
          }),
      ),
    );
    setPhotos([...photos, ...next]);
  }
  function remove(i: number) {
    setPhotos(photos.filter((_, j) => j !== i));
  }
  function setLabel(i: number, label: string) {
    setPhotos(photos.map((p, j) => (j === i ? { ...p, label } : p)));
  }
  return (
    <div>
      <label className="cursor-pointer block border-2 border-dashed border-slate-300 hover:border-[#1a3c5e] rounded-lg p-6 text-center mb-4">
        <input
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={handleFiles}
          disabled={photos.length >= 5}
        />
        <div className="text-3xl mb-2">📷</div>
        <div className="text-sm font-bold">Click to add photos ({photos.length}/5)</div>
        <div className="text-xs text-slate-500">JPG, PNG · Max 5 photos</div>
      </label>
      {photos.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {photos.map((p, i) => (
            <div key={i} className="border border-slate-200 rounded-lg overflow-hidden bg-white">
              <div className="aspect-video bg-slate-100">
                <img src={p.data} alt="" className="w-full h-full object-cover" />
              </div>
              <div className="p-2 space-y-1">
                <input
                  value={p.label}
                  onChange={(e) => setLabel(i, e.target.value)}
                  placeholder="Label"
                  className="w-full border border-slate-200 rounded px-2 py-1 text-xs"
                />
                <button onClick={() => remove(i)} className="text-xs text-rose-600 hover:underline">Remove</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
