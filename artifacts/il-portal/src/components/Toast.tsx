import { useEffect, useState } from "react";

type ToastMsg = { id: number; kind: "ok" | "err" | "info"; text: string };
let nextId = 1;
const listeners: ((m: ToastMsg) => void)[] = [];

export function showToast(text: string, kind: ToastMsg["kind"] = "info") {
  const m: ToastMsg = { id: nextId++, kind, text };
  for (const l of listeners) l(m);
}

export function ToastHost() {
  const [items, setItems] = useState<ToastMsg[]>([]);
  useEffect(() => {
    const fn = (m: ToastMsg) => {
      setItems((prev) => [...prev, m]);
      setTimeout(() => setItems((prev) => prev.filter((x) => x.id !== m.id)), 3500);
    };
    listeners.push(fn);
    return () => {
      const i = listeners.indexOf(fn);
      if (i >= 0) listeners.splice(i, 1);
    };
  }, []);
  return (
    <div className="fixed top-4 right-4 z-[1000] flex flex-col gap-2 pointer-events-none">
      {items.map((m) => (
        <div
          key={m.id}
          className={`px-4 py-2.5 rounded-lg shadow-lg text-sm font-semibold pointer-events-auto ${
            m.kind === "err"
              ? "bg-rose-600 text-white"
              : m.kind === "ok"
              ? "bg-emerald-600 text-white"
              : "bg-slate-800 text-white"
          }`}
        >
          {m.text}
        </div>
      ))}
    </div>
  );
}
