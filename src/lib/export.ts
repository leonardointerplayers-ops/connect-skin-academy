import "server-only";
import ExcelJS from "exceljs";

export interface Column<T> {
  header: string;
  value: (row: T) => string | number | boolean | null | undefined;
  width?: number;
}

function cell(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = typeof v === "boolean" ? (v ? "Sim" : "Não") : String(v);
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** CSV com BOM e separador ";" (abre corretamente no Excel em português). */
export function toCSV<T>(rows: T[], columns: Column<T>[]): string {
  const lines = [columns.map((c) => cell(c.header)).join(";"), ...rows.map((r) => columns.map((c) => cell(c.value(r))).join(";"))];
  return "﻿" + lines.join("\r\n");
}

export async function toXLSX<T>(sheetName: string, rows: T[], columns: Column<T>[]): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Connect Skin Academy";
  wb.created = new Date();
  const ws = wb.addWorksheet(sheetName.slice(0, 31));
  ws.columns = columns.map((c) => ({ header: c.header, width: c.width ?? Math.max(12, Math.min(48, c.header.length + 4)) }));
  for (const r of rows) {
    ws.addRow(columns.map((c) => {
      const v = c.value(r);
      return typeof v === "boolean" ? (v ? "Sim" : "Não") : (v ?? null);
    }));
  }
  const header = ws.getRow(1);
  header.font = { bold: true, color: { argb: "FFFFFFFF" } };
  header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF252F7E" } };
  ws.views = [{ state: "frozen", ySplit: 1 }];
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: columns.length } };
  return Buffer.from(await wb.xlsx.writeBuffer());
}
