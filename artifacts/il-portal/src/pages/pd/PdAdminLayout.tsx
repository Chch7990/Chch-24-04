import { Link, useLocation } from "wouter";
import PdLayout, { PdSidebarItem, PdSidebarLabel } from "./PdLayout";
import type { SessionUser } from "../../lib/session";

const items = [
  { path: "/", label: "PD Dashboard", icon: "📋", section: "OVERVIEW" },
  { path: "/master-upload", label: "Master Client Upload", icon: "📁", section: "DATA" },
  { path: "/other-loans-upload", label: "Other Loans Upload", icon: "📑", section: "DATA" },
  { path: "/date-wise-download", label: "Date-wise Download", icon: "📤", section: "REPORTS" },
];

export default function PdAdminLayout({
  session,
  children,
}: {
  session: SessionUser;
  children: React.ReactNode;
}) {
  const [loc] = useLocation();

  const grouped = new Map<string, typeof items>();
  for (const it of items) {
    if (!grouped.has(it.section)) grouped.set(it.section, []);
    grouped.get(it.section)!.push(it);
  }

  return (
    <PdLayout
      session={session}
      sidebar={
        <>
          {Array.from(grouped.entries()).map(([sec, list]) => (
            <div key={sec}>
              <PdSidebarLabel>{sec}</PdSidebarLabel>
              {list.map((it) => (
                <Link key={it.path} href={it.path}>
                  <a className="block">
                    <PdSidebarItem
                      active={loc === it.path}
                      onClick={() => {}}
                      icon={it.icon}
                      label={it.label}
                    />
                  </a>
                </Link>
              ))}
            </div>
          ))}
        </>
      }
    >
      {children}
    </PdLayout>
  );
}
