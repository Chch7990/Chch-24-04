import { useMemo } from "react";
import { useLocation, Link } from "wouter";
import { Logo, Shell } from "../components/Logo";
import { clearSession, loadSession } from "../lib/session";

export default function HubPage() {
  const [, navigate] = useLocation();
  const user = loadSession();
  if (!user) {
    navigate("/login", { replace: true });
    return null;
  }

  const isAdmin = user.role === "admin";

  function logout() {
    clearSession();
    navigate("/login", { replace: true });
  }

  const cards = useMemo(
    () => [
      {
        href: "/pd",
        emoji: "📋",
        title: "PD",
        subtitle: "IL Digital Product Portal",
        desc: "Personal discussion, eligibility calculation, applicant data, photos, case study & submit application.",
        accent: "from-[#1a3c5e] to-[#2563a8]",
        cta: "from-[#2563a8]",
      },
      {
        href: "/luc",
        emoji: "✅",
        title: "LUC",
        subtitle: "Loan Use Check",
        desc: "Field-level loan utilization checks, photo capture, observations, approvals & bulk uploads.",
        accent: "from-[#0f5132] to-[#198754]",
        cta: "from-[#198754]",
      },
    ],
    [],
  );

  return (
    <Shell>
      <div className="max-w-5xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-8 bg-white rounded-2xl shadow-sm border border-slate-200 px-5 py-4">
          <div className="flex items-center gap-3">
            <Logo size={44} />
            <div>
              <div className="text-base font-extrabold text-slate-800 leading-tight">
                IL Digital Portal
              </div>
              <div className="text-xs text-slate-500">
                Welcome, <strong className="text-slate-700">{user.name}</strong>{" · "}
                <span className="inline-block px-2 py-0.5 rounded bg-blue-50 text-blue-700 font-bold uppercase text-[10px] tracking-wider">
                  {isAdmin ? "Admin" : "User"}
                </span>
              </div>
            </div>
          </div>
          <button
            onClick={logout}
            className="text-xs font-bold text-slate-600 hover:text-rose-600 border border-slate-300 hover:border-rose-300 rounded-lg px-3 py-2 transition"
          >
            🚪 Sign out
          </button>
        </div>

        <div className="text-center mb-7">
          <h1 className="text-2xl md:text-3xl font-extrabold text-slate-800">
            {isAdmin ? "Admin Panel — Choose an App" : "Choose an App"}
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            {isAdmin
              ? "Open either PD or LUC to manage data, view dashboards, and run reports."
              : "Open either PD or LUC to continue your work."}
          </p>
        </div>

        <div className={`grid grid-cols-1 ${isAdmin ? "md:grid-cols-3" : "md:grid-cols-2"} gap-5`}>
          {cards.map((c) => (
            <Link key={c.href} href={c.href}>
              <a className="group text-left bg-white rounded-2xl border border-slate-200 hover:border-[#2563a8] shadow-sm hover:shadow-xl transition overflow-hidden block">
                <div className={`bg-gradient-to-br ${c.accent} text-white px-6 py-7 flex items-center gap-4`}>
                  <div className="text-4xl">{c.emoji}</div>
                  <div>
                    <div className="text-2xl font-extrabold leading-tight">{c.title}</div>
                    <div className="text-xs opacity-90">{c.subtitle}</div>
                  </div>
                </div>
                <div className="px-6 py-5">
                  <p className="text-sm text-slate-600 leading-relaxed">{c.desc}</p>
                  <div className="mt-4 inline-flex items-center gap-1 text-sm font-bold text-[#2563a8] group-hover:translate-x-1 transition">
                    Open {c.title} {isAdmin ? "Admin" : ""} →
                  </div>
                </div>
              </a>
            </Link>
          ))}

          {isAdmin && (
            <Link href="/users">
              <a className="group text-left bg-white rounded-2xl border border-slate-200 hover:border-[#7c3aed] shadow-sm hover:shadow-xl transition overflow-hidden block">
                <div className="bg-gradient-to-br from-[#5b21b6] to-[#7c3aed] text-white px-6 py-7 flex items-center gap-4">
                  <div className="text-4xl">👥</div>
                  <div>
                    <div className="text-2xl font-extrabold leading-tight">Users</div>
                    <div className="text-xs opacity-90">User Management</div>
                  </div>
                </div>
                <div className="px-6 py-5">
                  <p className="text-sm text-slate-600 leading-relaxed">
                    Create individual users or upload a bulk list. Only registered emails can log in via OTP.
                  </p>
                  <div className="mt-4 inline-flex items-center gap-1 text-sm font-bold text-[#7c3aed] group-hover:translate-x-1 transition">
                    Manage Users →
                  </div>
                </div>
              </a>
            </Link>
          )}
        </div>

        <div className="mt-10 text-center text-[11px] text-slate-400">
          IL Digital Portal · React rewrite with backend persistence
        </div>
      </div>
    </Shell>
  );
}
