import type { PdPayload } from "./types";

const num = (v: string) => (v === "" ? 0 : Number(v) || 0);

export type EligResult = {
  bizNet: number;
  milkNet: number;
  agriNet: number;
  otherIncome: number;
  hhExpense: number;
  totalIncome: number;
  totalExpense: number;
  netDisposable: number;
  emiObligation: number;
  freeForEmi: number;
  applied: number;
  newEmi: number;
  totalNewEmi: number;
  foir: number;
  eligibleEmi: number;
  eligibleLoan: number;
  decision: "Eligible" | "Borderline" | "Not Eligible" | "—";
};

export function calcEligibility(p: PdPayload): EligResult {
  const turnover = num(p.ei_turnover);
  const margin = num(p.ei_margin) / 100;
  const bizExp = num(p.ei_bizexp);
  const bizNet = Math.max(0, turnover * margin - bizExp);

  const cowMilk = num(p.ei_cow_milk) * num(p.ei_cows);
  const bufMilk = num(p.ei_buf_milk) * num(p.ei_buffalo);
  const milkRev =
    cowMilk * num(p.ei_cow_rate) * 30 + bufMilk * num(p.ei_buf_rate) * 30;
  const milkNet = Math.max(0, milkRev - num(p.ei_feedcost));

  const agriNet = num(p.ei_agri_monthly);
  const otherIncome = num(p.ei_other_income);
  const hhExpense = num(p.ei_hh_exp);

  const totalIncome = bizNet + milkNet + agriNet + otherIncome;
  const totalExpense = hhExpense;
  const netDisposable = totalIncome - totalExpense;

  const emiObligation = p.otherLoans.reduce((acc, r) => acc + num(r.emi), 0);
  const freeForEmi = netDisposable - emiObligation;

  const applied = num(p.ei_applied);
  const tenure = Math.max(1, num(p.ei_tenure) || 24);
  const roi = (num(p.ei_roi) || 0) / 12 / 100;
  const newEmi = roi > 0
    ? (applied * roi * Math.pow(1 + roi, tenure)) / (Math.pow(1 + roi, tenure) - 1)
    : applied / tenure;

  const totalNewEmi = emiObligation + newEmi;
  const foir = totalIncome > 0 ? (totalNewEmi / totalIncome) * 100 : 0;

  const eligibleEmi = Math.max(0, freeForEmi * 0.65);
  const eligibleLoan = roi > 0
    ? (eligibleEmi * (Math.pow(1 + roi, tenure) - 1)) / (roi * Math.pow(1 + roi, tenure))
    : eligibleEmi * tenure;

  let decision: EligResult["decision"] = "—";
  if (applied > 0) {
    if (foir <= 50 && newEmi <= eligibleEmi) decision = "Eligible";
    else if (foir <= 65) decision = "Borderline";
    else decision = "Not Eligible";
  }

  return {
    bizNet,
    milkNet,
    agriNet,
    otherIncome,
    hhExpense,
    totalIncome,
    totalExpense,
    netDisposable,
    emiObligation,
    freeForEmi,
    applied,
    newEmi: Math.round(newEmi),
    totalNewEmi: Math.round(totalNewEmi),
    foir,
    eligibleEmi: Math.round(eligibleEmi),
    eligibleLoan: Math.round(eligibleLoan),
    decision,
  };
}

export const inr = (n: number) =>
  "₹" + Math.round(n).toLocaleString("en-IN");
