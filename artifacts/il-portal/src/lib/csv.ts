import * as XLSX from "xlsx";

export const TABULAR_FILE_ACCEPT = ".csv,.xls,.xlsx,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

export async function parseTabularFile(
  file: File,
): Promise<Record<string, string>[]> {
  const name = file.name.toLowerCase();
  const isExcel = name.endsWith(".xlsx") || name.endsWith(".xls");

  if (!isExcel) {
    const text = await file.text();
    return parseCsv(text);
  }

  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  const firstSheet = wb.SheetNames[0];
  if (!firstSheet) return [];
  const ws = wb.Sheets[firstSheet];
  if (!ws) return [];
  const aoa = XLSX.utils.sheet_to_json<unknown[]>(ws, {
    header: 1,
    raw: false,
    defval: "",
    blankrows: false,
  });
  if (aoa.length === 0) return [];
  const headers = (aoa[0] as unknown[]).map((h) => String(h ?? "").trim());
  const out: Record<string, string>[] = [];
  for (let i = 1; i < aoa.length; i++) {
    const row = aoa[i] as unknown[];
    const r: Record<string, string> = {};
    let hasAny = false;
    headers.forEach((h, j) => {
      const v = row[j];
      const s = v == null ? "" : String(v).trim();
      if (s !== "") hasAny = true;
      r[h] = s;
    });
    if (hasAny) out.push(r);
  }
  return out;
}

function parseCsvRow(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQ) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') {
        inQ = false;
      } else {
        cur += ch;
      }
    } else {
      if (ch === ",") {
        out.push(cur);
        cur = "";
      } else if (ch === '"' && cur === "") {
        inQ = true;
      } else {
        cur += ch;
      }
    }
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

export function parseCsv(text: string): Record<string, string>[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim() !== "");
  if (lines.length === 0) return [];
  const headers = parseCsvRow(lines[0]!).map((h) => h.trim());
  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = parseCsvRow(lines[i]!);
    const r: Record<string, string> = {};
    headers.forEach((h, j) => {
      r[h] = cols[j] ?? "";
    });
    rows.push(r);
  }
  return rows;
}

export function toCsv(rows: Array<Record<string, unknown>>, columns?: string[]): string {
  if (rows.length === 0) return "";
  const cols = columns ?? Array.from(new Set(rows.flatMap((r) => Object.keys(r))));
  const escape = (v: unknown) => {
    if (v == null) return "";
    const s = String(v);
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const lines = [cols.join(",")];
  for (const r of rows) {
    lines.push(cols.map((c) => escape(r[c])).join(","));
  }
  return lines.join("\n");
}

export function downloadCsv(filename: string, rows: Array<Record<string, unknown>>, columns?: string[]) {
  const csv = toCsv(rows, columns);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
