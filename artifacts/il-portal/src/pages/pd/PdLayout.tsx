import { Link, useLocation } from "wouter";
import { Logo } from "../../components/Logo";
import { clearSession, type SessionUser } from "../../lib/session";

export default function PdLayout({
  session,
  children,
  sidebar,
}: {
  session: SessionUser;
  children: React.ReactNode;
  sidebar?: React.ReactNode;
}) {
  const [, navigate] = useLocation();
  function logout() {
    clearSession();
    navigate("/login", { replace: true });
  }
  return (
    <div className="min-h-screen flex flex-col bg-slate-100 font-sans">
      <div className="bg-gradient-to-r from-[#1a3c5e] to-[#2563a8] text-white px-5 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Logo size={36} />
          <div>
            <div className="font-extrabold text-sm leading-tight">💼 IL Digital Product Portal</div>
            <div className="text-[11px] opacity-90">Personal Discussion · Eligibility · Application</div>
          </div>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <span className="bg-white/20 rounded px-2 py-0.5 font-bold uppercase tracking-wider">
            {session.role}
          </span>
          <span className="opacity-90">
            Welcome, <strong>{session.name}</strong>
          </span>
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
        {sidebar && <aside className="w-[230px] bg-[#0f2440] text-white/90 overflow-y-auto">{sidebar}</aside>}
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}

export function PdSidebarItem({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: string;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left flex items-center gap-2 px-4 py-2.5 text-sm border-l-[3px] ${
        active
          ? "bg-white/10 border-amber-400 text-amber-300"
          : "border-transparent hover:bg-white/5"
      }`}
    >
      <span className="w-5 text-center">{icon}</span>
      <span className="flex-1">{label}</span>
    </button>
  );
}

export function PdSidebarLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-4 pt-4 pb-1 text-[10px] font-bold uppercase opacity-50 tracking-widest">
      {children}
    </div>
  );
}
