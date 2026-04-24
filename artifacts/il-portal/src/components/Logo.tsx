export function Logo({ size = 56 }: { size?: number }) {
  return (
    <div
      className="rounded-2xl bg-gradient-to-br from-[#1a3c5e] to-[#2563a8] text-white grid place-items-center font-extrabold shadow-lg"
      style={{ width: size, height: size, fontSize: size * 0.42 }}
    >
      IL
    </div>
  );
}

export function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-slate-100 via-blue-50 to-slate-100 font-sans">
      {children}
    </div>
  );
}
