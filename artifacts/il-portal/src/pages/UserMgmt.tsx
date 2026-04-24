import { useState } from "react";
import { useLocation, Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Logo, Shell } from "../components/Logo";
import { showToast } from "../components/Toast";
import { apiGet, apiPost, apiDelete } from "../lib/api";
import { loadSession, clearSession } from "../lib/session";
import { parseTabularFile, downloadCsv, TABULAR_FILE_ACCEPT } from "../lib/csv";

type ManagedUser = {
  uid: string;
  name: string;
  email: string;
  branch: string;
  createdAt: number;
};

export default function UserMgmtPage() {
  const [, navigate] = useLocation();
  const session = loadSession();
  const qc = useQueryClient();

  if (!session || session.role !== "admin") {
    navigate("/", { replace: true });
    return null;
  }

  const { data, isLoading, error } = useQuery({
    queryKey: ["users"],
    queryFn: () => apiGet<{ ok: boolean; users: ManagedUser[] }>("/users"),
  });

  if (error && /Login required|401/i.test(String(error.message))) {
    clearSession();
    navigate("/login", { replace: true });
  }

  const users = data?.users ?? [];

  const [form, setForm] = useState({ uid: "", name: "", email: "", branch: "" });
  const [bulkMode, setBulkMode] = useState<"append" | "replace">("append");

  const createMut = useMutation({
    mutationFn: (body: typeof form) => apiPost<{ ok: boolean }>("/users", body),
    onSuccess: () => {
      showToast("User created", "ok");
      setForm({ uid: "", name: "", email: "", branch: "" });
      qc.invalidateQueries({ queryKey: ["users"] });
    },
    onError: (e: Error) => showToast(e.message, "err"),
  });

  const deleteMut = useMutation({
    mutationFn: (uid: string) => apiDelete<{ ok: boolean }>(`/users/${encodeURIComponent(uid)}`),
    onSuccess: () => {
      showToast("Deleted", "ok");
      qc.invalidateQueries({ queryKey: ["users"] });
    },
    onError: (e: Error) => showToast(e.message, "err"),
  });

  const bulkMut = useMutation({
    mutationFn: (body: { users: Record<string, string>[]; mode: "append" | "replace" }) =>
      apiPost<{ ok: boolean; added: number; skipped: number; errors: { row: number; reason: string }[]; total: number }>(
        "/users/bulk",
        body,
      ),
    onSuccess: (j) => {
      showToast(`Added ${j.added} · Skipped ${j.skipped} · Total ${j.total}`, "ok");
      qc.invalidateQueries({ queryKey: ["users"] });
    },
    onError: (e: Error) => showToast(e.message, "err"),
  });

  async function handleBulkUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    try {
      const rows = await parseTabularFile(f);
      if (rows.length === 0) {
        showToast("No rows found", "err");
        return;
      }
      bulkMut.mutate({ users: rows, mode: bulkMode });
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to read file", "err");
    }
  }

  function downloadTemplate() {
    downloadCsv(
      "users-template.csv",
      [
        { uid: "user01", name: "Ramesh Kumar", email: "ramesh@example.com", branch: "Kaithal" },
        { uid: "user02", name: "Sunita Sharma", email: "sunita@example.com", branch: "Panipat" },
      ],
      ["uid", "name", "email", "branch"],
    );
  }

  return (
    <Shell>
      <div className="max-w-5xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-6 bg-white rounded-2xl shadow-sm border border-slate-200 px-5 py-4">
          <div className="flex items-center gap-3">
            <Logo size={44} />
            <div>
              <div className="text-base font-extrabold text-slate-800 leading-tight">
                User Management
              </div>
              <div className="text-xs text-slate-500">
                Create users and manage who can sign in to the portal
              </div>
            </div>
          </div>
          <Link href="/">
            <a className="text-xs font-bold text-slate-600 hover:text-[#2563a8] border border-slate-300 hover:border-[#2563a8] rounded-lg px-3 py-2 transition">
              ← Back to Hub
            </a>
          </Link>
        </div>

        <div className="grid md:grid-cols-2 gap-5 mb-6">
          <div className="bg-white rounded-2xl border border-slate-200 p-5">
            <h3 className="font-bold text-slate-800 mb-3">➕ Create User</h3>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                createMut.mutate(form);
              }}
              className="space-y-3"
            >
              <input
                placeholder="User ID (e.g. emp042)"
                value={form.uid}
                onChange={(e) => setForm({ ...form, uid: e.target.value })}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                required
              />
              <input
                placeholder="Full Name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                required
              />
              <input
                type="email"
                placeholder="Email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                required
              />
              <input
                placeholder="Branch (e.g. Kaithal)"
                value={form.branch}
                onChange={(e) => setForm({ ...form, branch: e.target.value })}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
              />
              <button
                type="submit"
                disabled={createMut.isPending}
                className="w-full bg-[#1a3c5e] text-white py-2.5 rounded-lg font-bold text-sm disabled:opacity-60"
              >
                {createMut.isPending ? "Creating…" : "Create User"}
              </button>
            </form>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-5">
            <h3 className="font-bold text-slate-800 mb-3">📤 Bulk Upload</h3>
            <p className="text-xs text-slate-500 mb-3">
              Upload a CSV with columns: <code>uid, name, email, branch</code>
            </p>
            <button
              onClick={downloadTemplate}
              className="w-full mb-3 border border-slate-300 hover:border-[#2563a8] rounded-lg py-2 text-xs font-bold text-slate-600"
            >
              📄 Download Template
            </button>
            <div className="flex gap-2 mb-3 text-xs">
              <label className="flex items-center gap-1">
                <input
                  type="radio"
                  checked={bulkMode === "append"}
                  onChange={() => setBulkMode("append")}
                />
                Append
              </label>
              <label className="flex items-center gap-1">
                <input
                  type="radio"
                  checked={bulkMode === "replace"}
                  onChange={() => setBulkMode("replace")}
                />
                Replace all
              </label>
            </div>
            <label className="block">
              <input
                type="file"
                accept={TABULAR_FILE_ACCEPT}
                onChange={handleBulkUpload}
                disabled={bulkMut.isPending}
                className="block w-full text-xs file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-[#1a3c5e] file:text-white hover:file:bg-[#15324f] disabled:opacity-60"
              />
            </label>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-200 flex items-center justify-between">
            <h3 className="font-bold text-slate-800">All Users ({users.length})</h3>
          </div>
          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="text-left px-4 py-2">UID</th>
                  <th className="text-left px-4 py-2">Name</th>
                  <th className="text-left px-4 py-2">Email</th>
                  <th className="text-left px-4 py-2">Branch</th>
                  <th className="px-4 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {isLoading && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                      Loading…
                    </td>
                  </tr>
                )}
                {!isLoading && users.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                      No users yet
                    </td>
                  </tr>
                )}
                {users.map((u) => (
                  <tr key={u.uid} className="border-t border-slate-100">
                    <td className="px-4 py-2 font-mono text-xs">{u.uid}</td>
                    <td className="px-4 py-2 font-semibold">{u.name}</td>
                    <td className="px-4 py-2 text-slate-600">{u.email}</td>
                    <td className="px-4 py-2">{u.branch}</td>
                    <td className="px-4 py-2 text-right">
                      <button
                        onClick={() => {
                          if (confirm(`Delete "${u.uid}"?`)) deleteMut.mutate(u.uid);
                        }}
                        className="text-xs text-rose-600 hover:underline"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </Shell>
  );
}
