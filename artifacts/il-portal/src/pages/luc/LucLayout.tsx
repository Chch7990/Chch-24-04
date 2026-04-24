import { useLocation, Link } from "wouter";
import { Logo } from "../../components/Logo";
import { clearSession, type SessionUser } from "../../lib/session";

const adminMenu = [
  { path: "/luc", label: "Dashboard", icon: "📊", section: "MAIN" },
  { path: "/luc/all-data", label: "All LUC Data", icon: "📋", section: "MAIN" },
  { path: "/luc/add-client", label: "Add Client", icon: "➕", section: "CLIENTS" },
  { path: "/luc/bulk-upload", label: "Bulk Upload", icon: "📤", section: "CLIENTS" },
  { path: "/luc/pending", label: "Pending LUC", icon: "⏳", section: "CLIENTS" },
  { path: "/luc/completed", label: "Completed LUC", icon: "✅", section: "CLIENTS" },
  { path: "/luc/approvals", label: "LUC Approvals", icon: "🔍", section: "ADMIN" },
];

export default function LucLayout({
  session,
  children,
}: {
  session: SessionUser;
  children: React.ReactNode;
}) {
  const [loc, navigate] = useLocation();
  const isAdmin = session.role === "admin";
  const baseLoc = loc === "/" ? "/luc" : `/luc${loc}`;

  function logout() {
    clearSession();
    navigate("/login", { replace: true });
  }

  if (!isAdmin) {
    // user view — just a topbar with a logout button; no sidebar
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-emerald-50 font-sans">
        <div className="bg-gradient-to-r from-[#0f5132] to-[#198754] text-white px-5 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/">
              <a className="flex items-center gap-2">
                <Logo size={36} />
                <div>
                  <div className="font-extrabold text-sm leading-tight">📋 LUC Field Entry</div>
                  <div className="text-[11px] opacity-90">Loan Use Check</div>
                </div>
              </a>
            </Link>
          </div>
          <div className="flex items-center gap-3 text-xs">
            <span className="opacity-90">Welcome, <strong>{session.name}</strong></span>
            <Link href="/">
              <a className="bg-white/20 hover:bg-white/30 rounded px-2.5 py-1.5 font-bold">Hub</a>
            </Link>
            <button
              onClick={logout}
              className="bg-white/20 hover:bg-rose-500 rounded px-2.5 py-1.5 font-bold transition"
            >
              Logout
            </button>
          </div>
        </div>
        <div className="max-w-2xl mx-auto px-4 py-6">{children}</div>
      </div>
    );
  }

  // admin layout
  const grouped = new Map<string, typeof adminMenu>();
  for (const item of adminMenu) {
    if (!grouped.has(item.section)) grouped.set(item.section, []);
    grouped.get(item.section)!.push(item);
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-100 font-sans">
      <div className="bg-gradient-to-r from-[#0f5132] to-[#198754] text-white px-5 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Logo size={36} />
          <div>
            <div className="font-extrabold text-sm leading-tight">📋 LUC Admin Console</div>
            <div className="text-[11px] opacity-90">Loan Use Check Field Collection</div>
          </div>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <span className="bg-white/20 rounded px-2 py-0.5 font-bold uppercase tracking-wider">Admin</span>
          <span className="opacity-90">Welcome, <strong>{session.name}</strong></span>
          <Link href="/">
            <a className="bg-white/20 hover:bg-white/30 rounded px-2.5 py-1.5 font-bold">Hub</a>
          </Link>
          <button
            onClick={logout}
            className="bg-white/20 hover:bg-rose-500 rounded px-2.5 py-1.5 font-bold transition"
          >
            Logout
          </button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        <aside className="w-[210px] bg-[#0f2c1a] text-white/90 overflow-y-auto">
          {Array.from(grouped.entries()).map(([sec, items]) => (
            <div key={sec}>
              <div className="px-4 pt-4 pb-1 text-[10px] font-bold uppercase opacity-50 tracking-widest">
                {sec}
              </div>
              {items.map((it) => {
                const active = baseLoc === it.path;
                return (
                  <Link key={it.path} href={it.path === "/luc" ? "/" : it.path.replace(/^\/luc/, "")}>
                    <a
                      className={`flex items-center gap-2 px-4 py-2.5 text-sm border-l-[3px] ${
                        active
                          ? "bg-white/10 border-emerald-400 text-emerald-300"
                          : "border-transparent hover:bg-white/5"
                      }`}
                    >
                      <span className="w-5 text-center">{it.icon}</span>
                      {it.label}
                    </a>
                  </Link>
                );
              })}
            </div>
          ))}
        </aside>
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
