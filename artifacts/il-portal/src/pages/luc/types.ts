export type LucDataRow = {
  clientId: string;
  clientName: string;
  state: string;
  branch: string;
  loanType: string;
  loanAmount: number;
  disbursementDate: string;
  loanPurpose: string;
  visitDate: string;
  visitPerson: string;
  empCode: string;
  loanUsedIn: string;
  observation: string;
  remark: string;
  photos: string[];
  status: "pending" | "done";
  approved: "" | "approved" | "rejected";
  approvalRemark: string;
  submittedByName: string;
};

export type LucClient = {
  id: number;
  clientId: string;
  clientName: string;
  state: string;
  branch: string;
  loanType: string;
  loanAmount: number;
  disbursementDate: string;
  loanPurpose: string;
};

export type LucVisit = {
  id: number;
  clientId: string;
  visitDate: string;
  visitPerson: string;
  empCode: string;
  loanUsedIn: string;
  observation: string;
  remark: string;
  photos: string[];
  status: "pending" | "done";
  approved: "" | "approved" | "rejected";
};
