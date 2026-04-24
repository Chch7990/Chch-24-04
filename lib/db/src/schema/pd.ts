import { pgTable, text, jsonb, integer, bigint, serial, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const pdMasterClientsTable = pgTable(
  "pd_master_clients",
  {
    id: serial("id").primaryKey(),
    clientId: text("client_id").notNull(),
    data: jsonb("data").$type<Record<string, unknown>>().notNull(),
    createdAt: bigint("created_at", { mode: "number" }).notNull(),
  },
  (t) => [index("pd_master_clients_client_id_idx").on(t.clientId)],
);

export const insertPdMasterClientSchema = createInsertSchema(pdMasterClientsTable).omit({
  id: true,
});
export type InsertPdMasterClient = z.infer<typeof insertPdMasterClientSchema>;
export type PdMasterClient = typeof pdMasterClientsTable.$inferSelect;

export const pdOtherLoansTable = pgTable(
  "pd_other_loans",
  {
    id: serial("id").primaryKey(),
    clientId: text("client_id").notNull(),
    data: jsonb("data").$type<Record<string, unknown>>().notNull(),
    createdAt: bigint("created_at", { mode: "number" }).notNull(),
  },
  (t) => [index("pd_other_loans_client_id_idx").on(t.clientId)],
);

export type PdOtherLoan = typeof pdOtherLoansTable.$inferSelect;

export const pdApplicationsTable = pgTable(
  "pd_applications",
  {
    id: text("id").primaryKey(),
    ownerUid: text("owner_uid").notNull(),
    ownerName: text("owner_name").notNull(),
    ownerBranch: text("owner_branch").notNull(),
    clientId: text("client_id").notNull(),
    clientName: text("client_name").notNull(),
    status: text("status").notNull().default("Pending"),
    remarks: text("remarks"),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
    photos: jsonb("photos").$type<Array<Record<string, unknown>>>().notNull().default([]),
    submittedAt: bigint("submitted_at", { mode: "number" }).notNull(),
    decidedAt: bigint("decided_at", { mode: "number" }),
  },
  (t) => [
    index("pd_applications_status_idx").on(t.status),
    index("pd_applications_owner_idx").on(t.ownerUid),
    index("pd_applications_submitted_idx").on(t.submittedAt),
  ],
);

export type PdApplication = typeof pdApplicationsTable.$inferSelect;

export const pdApplicationDraftsTable = pgTable("pd_application_drafts", {
  ownerUid: text("owner_uid").primaryKey(),
  payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
  photos: jsonb("photos").$type<Array<Record<string, unknown>>>().notNull().default([]),
  updatedAt: bigint("updated_at", { mode: "number" }).notNull(),
});

export type PdApplicationDraft = typeof pdApplicationDraftsTable.$inferSelect;
