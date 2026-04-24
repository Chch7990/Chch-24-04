export type FamilyMember = {
  name: string;
  relation: string;
  age: string;
  gender: string;
  occupation: string;
};

export type OtherLoanRow = {
  bank: string;
  loanType: string;
  loanAmount: string;
  outstanding: string;
  emi: string;
  tenureLeft: string;
  remarks: string;
};

export type PhotoEntry = {
  label: string;
  data: string; // data URL
};

export type PdPayload = {
  // Client search / decision
  clientId: string;
  clientType: string;

  // Applicant
  ilClientId: string;
  loanId: string;
  name: string;
  fatherName: string;
  dob: string;
  age: string;
  gender: string;
  marital: string;
  mobile: string;
  altMobile: string;
  address: string;
  permAddress: string;
  state: string;
  pin: string;
  branch: string;
  occupation: string;
  distanceFromBranch: string;

  // Co-applicant
  caName: string;
  caRelation: string;
  caDob: string;
  caAge: string;
  caGender: string;
  caMobile: string;
  caOccupation: string;

  family: FamilyMember[]; // length 10

  // Bank
  bk1Name: string;
  bk1AccNo: string;
  bk1Type: string;
  bk1Holder: string;
  bk1Ifsc: string;
  bk1Abb: string;
  bk2Name: string;
  bk2AccNo: string;
  bk2Type: string;
  bk2Holder: string;
  bk2Ifsc: string;
  bk2Abb: string;

  otherLoans: OtherLoanRow[]; // length 10

  // Eligibility
  ei_turnover: string;
  ei_margin: string;
  ei_bizexp: string;
  ei_cows: string;
  ei_buffalo: string;
  ei_cow_milk: string;
  ei_buf_milk: string;
  ei_cow_rate: string;
  ei_buf_rate: string;
  ei_feedcost: string;
  ei_agri_monthly: string;
  ei_other_name: string;
  ei_other_income: string;
  ei_hh_exp: string;
  ei_applied: string;
  ei_tenure: string;
  ei_roi: string;

  // Reference
  ref1Name: string;
  ref1Relation: string;
  ref1Mobile: string;
  ref1Address: string;
  ref1Verified: string;
  ref2Name: string;
  ref2Relation: string;
  ref2Mobile: string;
  ref2Address: string;
  ref2Verified: string;

  // Case study
  caseStudy: string;
  decision: string; // "Pass" | "Fail" | ""
  decisionRemark: string;

  // EMP details
  emp_name: string;
  emp_code: string;
  emp_designation: string;
  emp_branch: string;
  emp_date: string;
};

export const emptyPayload: PdPayload = {
  clientId: "",
  clientType: "",
  ilClientId: "",
  loanId: "",
  name: "",
  fatherName: "",
  dob: "",
  age: "",
  gender: "Male",
  marital: "Married",
  mobile: "",
  altMobile: "",
  address: "",
  permAddress: "",
  state: "",
  pin: "",
  branch: "",
  occupation: "",
  distanceFromBranch: "",
  caName: "",
  caRelation: "Spouse",
  caDob: "",
  caAge: "",
  caGender: "Male",
  caMobile: "",
  caOccupation: "",
  family: Array.from({ length: 10 }, () => ({
    name: "",
    relation: "",
    age: "",
    gender: "",
    occupation: "",
  })),
  bk1Name: "",
  bk1AccNo: "",
  bk1Type: "Saving",
  bk1Holder: "",
  bk1Ifsc: "",
  bk1Abb: "",
  bk2Name: "",
  bk2AccNo: "",
  bk2Type: "Saving",
  bk2Holder: "",
  bk2Ifsc: "",
  bk2Abb: "",
  otherLoans: Array.from({ length: 10 }, () => ({
    bank: "",
    loanType: "",
    loanAmount: "",
    outstanding: "",
    emi: "",
    tenureLeft: "",
    remarks: "",
  })),
  ei_turnover: "",
  ei_margin: "",
  ei_bizexp: "",
  ei_cows: "",
  ei_buffalo: "",
  ei_cow_milk: "",
  ei_buf_milk: "",
  ei_cow_rate: "38",
  ei_buf_rate: "55",
  ei_feedcost: "",
  ei_agri_monthly: "",
  ei_other_name: "",
  ei_other_income: "",
  ei_hh_exp: "",
  ei_applied: "",
  ei_tenure: "24",
  ei_roi: "27",
  ref1Name: "",
  ref1Relation: "",
  ref1Mobile: "",
  ref1Address: "",
  ref1Verified: "",
  ref2Name: "",
  ref2Relation: "",
  ref2Mobile: "",
  ref2Address: "",
  ref2Verified: "",
  caseStudy: "",
  decision: "",
  decisionRemark: "",
  emp_name: "",
  emp_code: "",
  emp_designation: "",
  emp_branch: "",
  emp_date: "",
};

export type PdApplication = {
  id: string;
  ownerUid: string;
  ownerName: string;
  ownerBranch: string;
  clientId: string;
  clientName: string;
  status: string;
  remarks?: string;
  payload: PdPayload;
  photos: PhotoEntry[];
  submittedAt: number;
  decidedAt?: number | null;
};

export type PdMasterClient = {
  id: number;
  clientId: string;
  [k: string]: unknown;
};

export type PdSection =
  | "clientSearch"
  | "applicant"
  | "coapplicant"
  | "family"
  | "bank"
  | "otherloans"
  | "eligibility"
  | "reference"
  | "casestudy"
  | "photos"
  | "empdetails"
  | "submit";

export const PD_SECTIONS: { id: PdSection; label: string; icon: string }[] = [
  { id: "clientSearch", label: "Client Decision", icon: "🔖" },
  { id: "applicant", label: "Applicant Details", icon: "👤" },
  { id: "coapplicant", label: "Co-applicant", icon: "👥" },
  { id: "family", label: "Family Details", icon: "🏠" },
  { id: "bank", label: "Bank Accounts", icon: "🏦" },
  { id: "otherloans", label: "Other Loans", icon: "📑" },
  { id: "eligibility", label: "Eligibility Calc", icon: "✅" },
  { id: "reference", label: "Reference Check", icon: "📞" },
  { id: "casestudy", label: "Case Study", icon: "📝" },
  { id: "photos", label: "Photos Upload", icon: "📷" },
  { id: "empdetails", label: "EMP Details", icon: "🪪" },
  { id: "submit", label: "Submit Application", icon: "🚀" },
];
