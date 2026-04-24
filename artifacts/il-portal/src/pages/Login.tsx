import { useState } from "react";
import { useLocation } from "wouter";
import { Logo, Shell } from "../components/Logo";
import { saveSession, type SessionUser } from "../lib/session";

type ManagedUser = { uid: string; name: string; email: string; branch: string };

export default function LoginPage() {
  const [, navigate] = useLocation();
  const [tab, setTab] = useState<"user" | "admin">("user");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState<"email" | "code">("email");
  const [msg, setMsg] = useState<{ kind: "ok" | "err" | "info"; text: string } | null>(null);
  const [devCode, setDevCode] = useState("");
  const [busy, setBusy] = useState(false);

  function resetFlow() {
    setStep("email");
    setOtp("");
    setMsg(null);
    setDevCode("");
  }

  function switchTab(next: "user" | "admin") {
    if (next === tab) return;
    setTab(next);
    resetFlow();
  }

  async function sendOtp(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    setDevCode("");
    const em = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) {
      setMsg({ kind: "err", text: "Please enter a valid email address" });
      return;
    }
    setBusy(true);
    try {
      const r = await fetch("/api/otp/send", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: em, role: tab }),
      });
      const j = await r.json();
      if (!r.ok || !j.ok) {
        setMsg({ kind: "err", text: j.error || "Failed to send OTP" });
      } else {
        setStep("code");
        setDevCode(j.devCode || "");
        setMsg({
          kind: "info",
          text: j.devCode
            ? `Demo mode: your OTP is ${j.devCode} (would normally be emailed to ${em})`
            : `OTP sent to ${em}`,
        });
      }
    } catch {
      setMsg({ kind: "err", text: "Network error. Please try again." });
    } finally {
      setBusy(false);
    }
  }

  async function verifyOtp(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    const em = email.trim().toLowerCase();
    const code = otp.trim();
    if (!/^\d{4,8}$/.test(code)) {
      setMsg({ kind: "err", text: "Enter the 6-digit code" });
      return;
    }
    setBusy(true);
    try {
      const r = await fetch("/api/otp/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: em, code, role: tab }),
      });
      const j = await r.json();
      if (!r.ok || !j.ok) {
        setMsg({ kind: "err", text: j.error || "Verification failed" });
        return;
      }

      if (tab === "admin") {
        const adminName = em.split("@")[0] ?? "admin";
        const user: SessionUser = {
          uid: "admin",
          name: adminName.charAt(0).toUpperCase() + adminName.slice(1),
          email: em,
          branch: "HO",
          role: "admin",
          token: j.token,
        };
        saveSession(user);
        navigate("/", { replace: true });
      } else {
        const u = j.user as ManagedUser;
        const user: SessionUser = {
          uid: u.uid,
          name: u.name,
          email: u.email,
          branch: u.branch,
          role: "user",
        };
        saveSession(user);
        navigate("/", { replace: true });
      }
    } catch {
      setMsg({ kind: "err", text: "Network error. Please try again." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Shell>
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="w-full max-w-[440px] bg-white rounded-2xl shadow-2xl overflow-hidden">
          <div className="bg-gradient-to-br from-[#1a3c5e] to-[#2563a8] text-white px-7 py-7 text-center">
            <div className="flex justify-center mb-3">
              <Logo size={64} />
            </div>
            <h1 className="text-xl font-extrabold tracking-tight">IL Digital Portal</h1>
            <p className="text-xs opacity-85 mt-1">Unified access to PD &amp; LUC apps</p>
          </div>

          <div className="grid grid-cols-2 border-b border-slate-200">
            <button
              onClick={() => switchTab("user")}
              className={`py-3 text-sm font-bold transition ${
                tab === "user"
                  ? "bg-white text-[#1a3c5e] border-b-2 border-[#1a3c5e]"
                  : "bg-slate-50 text-slate-500 hover:bg-slate-100"
              }`}
            >
              👤 User Login
            </button>
            <button
              onClick={() => switchTab("admin")}
              className={`py-3 text-sm font-bold transition ${
                tab === "admin"
                  ? "bg-white text-[#1a3c5e] border-b-2 border-[#1a3c5e]"
                  : "bg-slate-50 text-slate-500 hover:bg-slate-100"
              }`}
            >
              ⚙️ Admin Login
            </button>
          </div>

          <div className="p-7">
            {step === "email" ? (
              <form onSubmit={sendOtp} className="space-y-4">
                <div>
                  <label className="block text-[11px] font-bold uppercase text-slate-500 tracking-wide mb-1.5">
                    {tab === "admin" ? "Admin Email" : "Your Registered Email"}
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoFocus
                    placeholder={tab === "admin" ? "admin@example.com" : "you@example.com"}
                    className="w-full border border-slate-300 rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#2563a8]"
                  />
                </div>
                {msg && <Msg msg={msg} />}
                <button
                  type="submit"
                  disabled={busy}
                  className="w-full py-3 rounded-lg bg-[#1a3c5e] text-white text-sm font-bold hover:bg-[#15324f] transition disabled:opacity-60"
                >
                  {busy ? "Sending…" : "Send OTP"}
                </button>
                <div className="text-[11px] text-slate-500 text-center pt-2 border-t border-slate-100">
                  {tab === "admin"
                    ? "A 6-digit one-time code will be sent to your email."
                    : "Only emails registered by an admin can sign in."}
                </div>
              </form>
            ) : (
              <form onSubmit={verifyOtp} className="space-y-4">
                <div className="text-xs text-slate-600">
                  Code sent to <strong className="text-slate-800">{email}</strong>
                  {devCode && (
                    <span className="ml-2 inline-block px-2 py-0.5 rounded bg-amber-100 text-amber-800 font-mono">
                      {devCode}
                    </span>
                  )}
                </div>
                <div>
                  <label className="block text-[11px] font-bold uppercase text-slate-500 tracking-wide mb-1.5">
                    Enter OTP
                  </label>
                  <input
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    inputMode="numeric"
                    autoFocus
                    placeholder="6-digit code"
                    className="w-full border border-slate-300 rounded-lg px-3.5 py-3 text-lg font-mono text-center tracking-[0.5em] focus:outline-none focus:ring-2 focus:ring-[#2563a8]"
                  />
                </div>
                {msg && <Msg msg={msg} />}
                <button
                  type="submit"
                  disabled={busy}
                  className="w-full py-3 rounded-lg bg-[#1a3c5e] text-white text-sm font-bold hover:bg-[#15324f] transition disabled:opacity-60"
                >
                  {busy ? "Verifying…" : "Verify & Continue"}
                </button>
                <button
                  type="button"
                  onClick={() => resetFlow()}
                  className="w-full text-xs text-slate-500 hover:text-slate-800 underline"
                >
                  ← Use a different email
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </Shell>
  );
}

function Msg({ msg }: { msg: { kind: "ok" | "err" | "info"; text: string } }) {
  return (
    <div
      className={`text-xs px-3 py-2 rounded-lg border ${
        msg.kind === "err"
          ? "bg-rose-50 border-rose-200 text-rose-700"
          : msg.kind === "ok"
          ? "bg-emerald-50 border-emerald-200 text-emerald-700"
          : "bg-blue-50 border-blue-200 text-blue-800"
      }`}
    >
      {msg.text}
    </div>
  );
}
