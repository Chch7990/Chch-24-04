import { pgTable, text, jsonb, bigint, serial, index, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const lucClientsTable = pgTable(
  "luc_clients",
  {
    id: serial("id").primaryKey(),
    clientId: text("client_id").notNull().unique(),
    clientName: text("client_name").notNull(),
    state: text("state").notNull().default(""),
    branch: text("branch").notNull().default(""),
    loanType: text("loan_type").notNull().default("Unsecured Business Loan"),
    loanAmount: integer("loan_amount").notNull().default(0),
    disbursementDate: text("disbursement_date").notNull().default(""),
    loanPurpose: text("loan_purpose").notNull().default(""),
    createdAt: bigint("created_at", { mode: "number" }).notNull(),
  },
  (t) => [index("luc_clients_branch_idx").on(t.branch)],
);

export const insertLucClientSchema = createInsertSchema(lucClientsTable).omit({
  id: true,
  createdAt: true,
});
export type InsertLucClient = z.infer<typeof insertLucClientSchema>;
export type LucClient = typeof lucClientsTable.$inferSelect;

export const lucVisitsTable = pgTable(
  "luc_visits",
  {
    id: serial("id").primaryKey(),
    clientId: text("client_id").notNull().unique(), // one visit per client (matches HTML behavior)
    visitDate: text("visit_date").notNull(),
    visitPerson: text("visit_person").notNull(),
    empCode: text("emp_code").notNull(),
    loanUsedIn: text("loan_used_in").notNull().default(""),
    observation: text("observation").notNull().default(""),
    remark: text("remark").notNull().default(""),
    photos: jsonb("photos").$type<string[]>().notNull().default([]), // base64 data URLs
    status: text("status").notNull().default("done"), // 'pending' | 'done'
    approved: text("approved").notNull().default(""), // '' | 'approved' | 'rejected'
    submittedByUid: text("submitted_by_uid").notNull().default(""),
    submittedByName: text("submitted_by_name").notNull().default(""),
    createdAt: bigint("created_at", { mode: "number" }).notNull(),
    updatedAt: bigint("updated_at", { mode: "number" }).notNull(),
  },
  (t) => [
    index("luc_visits_status_idx").on(t.status),
    index("luc_visits_approved_idx").on(t.approved),
  ],
);

export type LucVisit = typeof lucVisitsTable.$inferSelect;
