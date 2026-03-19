import type { InventoryItem, CompanyInfo, Record50, Record61 } from "@shared/schema";

const fmt = (v: number) => v.toFixed(2).replace(".", ",");
const CENTER = "V9 INFORMATICA - (37) 4141-0341";

function pdfHeader(doc: any, title: string, subtitle: string, companyInfo: CompanyInfo, pageW: number) {
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.text(companyInfo.name, pageW / 2, 12, { align: "center" });
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text(`CNPJ: ${companyInfo.cnpj}`, pageW / 2, 18, { align: "center" });
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text(title, pageW / 2, 25, { align: "center" });
  if (subtitle) {
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text(subtitle, pageW / 2, 30, { align: "center" });
  }
  doc.setFontSize(7);
  doc.setFont("helvetica", "italic");
  doc.text(CENTER, pageW / 2, 35, { align: "center" });
}

function pdfPageNumbers(doc: any, pageW: number, pageH: number) {
  const count = doc.getNumberOfPages();
  for (let i = 1; i <= count; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.text(`Pagina ${i} de ${count}`, pageW - 10, pageH - 5, { align: "right" });
  }
}

// ─── INVENTÁRIO ───────────────────────────────────────────────────────────────

export async function exportToPDF(
  items: InventoryItem[],
  companyInfo: CompanyInfo,
  inventoryDate: string
) {
  const { default: jsPDF } = await import("jspdf");
  const autoTable = (await import("jspdf-autotable")).default;
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });

  pdfHeader(doc, `Inventario Existente em ${inventoryDate}`, "", companyInfo, 297);

  const totalGeral = items.reduce((s, i) => s + i.total, 0);

  autoTable(doc, {
    startY: 38,
    head: [["#", "Codigo", "NCM", "Descricao", "Un", "Qtde", "Vl. Unit.", "Total", "Posse"]],
    body: items.map((item, idx) => [
      idx + 1, item.productCode, item.ncm, item.description, item.unit,
      item.quantity.toFixed(3).replace(".", ","),
      fmt(item.unitPrice), fmt(item.total), item.ownership,
    ]),
    foot: [["", "", "", "", "", "TOTAL", "", fmt(totalGeral), ""]],
    styles: { fontSize: 7, cellPadding: 1.5 },
    headStyles: { fillColor: [37, 99, 163], textColor: 255, fontStyle: "bold", fontSize: 7 },
    footStyles: { fillColor: [240, 240, 240], fontStyle: "bold", fontSize: 8 },
    columnStyles: {
      0: { cellWidth: 10, halign: "center" }, 1: { cellWidth: 25 }, 2: { cellWidth: 18 },
      3: { cellWidth: 72 }, 4: { cellWidth: 12, halign: "center" },
      5: { cellWidth: 20, halign: "right" }, 6: { cellWidth: 20, halign: "right" },
      7: { cellWidth: 22, halign: "right" }, 8: { cellWidth: 10, halign: "center" },
    },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    margin: { left: 14, right: 14 },
  });

  pdfPageNumbers(doc, 297, 210);
  doc.save(`inventario_${inventoryDate.replace(/\//g, "-")}.pdf`);
}

export async function exportToExcel(
  items: InventoryItem[],
  companyInfo: CompanyInfo,
  inventoryDate: string
) {
  const XLSX = await import("xlsx");
  const wsData: any[][] = [
    [companyInfo.name], [`CNPJ: ${companyInfo.cnpj}`],
    [`Inventario Existente em ${inventoryDate}`], [],
    ["#", "Codigo", "NCM", "Descricao", "Unidade", "Quantidade", "Vl. Unitario", "Total", "Posse"],
  ];
  items.forEach((item, idx) => wsData.push([
    idx + 1, item.productCode, item.ncm, item.description, item.unit,
    item.quantity.toFixed(3), item.unitPrice.toFixed(2), item.total.toFixed(2), item.ownershipLabel,
  ]));
  const totalGeral = items.reduce((s, i) => s + i.total, 0);
  wsData.push([], ["", "", "", "", "", "TOTAL GERAL:", totalGeral.toFixed(2), ""]);
  const ws = XLSX.utils.aoa_to_sheet(wsData);
  ws["!cols"] = [{ wch: 5 }, { wch: 16 }, { wch: 10 }, { wch: 50 }, { wch: 8 }, { wch: 14 }, { wch: 14 }, { wch: 16 }, { wch: 30 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Inventario");
  XLSX.writeFile(wb, `inventario_${inventoryDate.replace(/\//g, "-")}.xlsx`);
}

// ─── NOTAS FISCAIS (Reg 50) ───────────────────────────────────────────────────

export async function exportNFsToPDF(
  records: Record50[],
  filterLabel: string,
  companyInfo: CompanyInfo
) {
  const { default: jsPDF } = await import("jspdf");
  const autoTable = (await import("jspdf-autotable")).default;
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });

  pdfHeader(doc, `Notas Fiscais — ${filterLabel}`, `${records.length} registros`, companyInfo, 297);

  const totalNF    = records.reduce((s, n) => s + n.valorTotal, 0);
  const totalBase  = records.reduce((s, n) => s + n.baseCalculo, 0);
  const totalICMS  = records.reduce((s, n) => s + n.valorICMS, 0);

  autoTable(doc, {
    startY: 38,
    head: [["Data", "Mod.", "Serie", "Nº NF", "CFOP", "Valor Total", "Base Calc.", "Vl. ICMS", "Aliq.%", "Situacao"]],
    body: records.map(nf => [
      nf.date, nf.modelo, nf.serie, nf.numero, nf.cfop,
      fmt(nf.valorTotal),
      nf.baseCalculo > 0 ? fmt(nf.baseCalculo) : "",
      nf.valorICMS > 0 ? fmt(nf.valorICMS) : "",
      nf.aliquota > 0 ? fmt(nf.aliquota) + "%" : "",
      nf.cancelada ? "Cancelada" : "Normal",
    ]),
    foot: [["", "", "", "", "TOTAL",
      fmt(totalNF), fmt(totalBase), fmt(totalICMS), "", ""]],
    styles: { fontSize: 7, cellPadding: 1.5 },
    headStyles: { fillColor: [37, 99, 163], textColor: 255, fontStyle: "bold", fontSize: 7 },
    footStyles: { fillColor: [240, 240, 240], fontStyle: "bold", fontSize: 7 },
    columnStyles: {
      0: { cellWidth: 20 }, 1: { cellWidth: 10, halign: "center" },
      2: { cellWidth: 12 }, 3: { cellWidth: 16, halign: "right" },
      4: { cellWidth: 14, halign: "center" },
      5: { cellWidth: 26, halign: "right" }, 6: { cellWidth: 26, halign: "right" },
      7: { cellWidth: 22, halign: "right" }, 8: { cellWidth: 14, halign: "right" },
      9: { cellWidth: 18, halign: "center" },
    },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    margin: { left: 10, right: 10 },
  });

  pdfPageNumbers(doc, 297, 210);
  const slug = filterLabel.toLowerCase().replace(/\s+/g, "_");
  doc.save(`notas_fiscais_${slug}.pdf`);
}

export async function exportNFsToExcel(
  records: Record50[],
  filterLabel: string,
  companyInfo: CompanyInfo
) {
  const XLSX = await import("xlsx");
  const wsData: any[][] = [
    [companyInfo.name], [`CNPJ: ${companyInfo.cnpj}`],
    [`Notas Fiscais — ${filterLabel}  (${records.length} registros)`], [],
    ["Data", "Modelo", "Serie", "Nº NF", "CFOP", "Emitente", "Valor Total", "Base Calc.", "Vl. ICMS", "Aliq. %", "Situacao"],
  ];
  records.forEach(nf => wsData.push([
    nf.date, nf.modelo, nf.serie, nf.numero, nf.cfop,
    nf.emitente === "P" ? "Propria (Saida)" : "Terceiros (Entrada)",
    nf.valorTotal.toFixed(2),
    nf.baseCalculo > 0 ? nf.baseCalculo.toFixed(2) : "",
    nf.valorICMS > 0 ? nf.valorICMS.toFixed(2) : "",
    nf.aliquota > 0 ? nf.aliquota.toFixed(2) : "",
    nf.cancelada ? "Cancelada" : "Normal",
  ]));
  const totalNF   = records.reduce((s, n) => s + n.valorTotal, 0);
  const totalBase = records.reduce((s, n) => s + n.baseCalculo, 0);
  const totalICMS = records.reduce((s, n) => s + n.valorICMS, 0);
  wsData.push([], ["", "", "", "", "TOTAL", totalNF.toFixed(2), totalBase.toFixed(2), totalICMS.toFixed(2), "", ""]);

  const ws = XLSX.utils.aoa_to_sheet(wsData);
  ws["!cols"] = [
    { wch: 12 }, { wch: 7 }, { wch: 8 }, { wch: 10 }, { wch: 8 },
    { wch: 22 }, { wch: 14 }, { wch: 14 }, { wch: 12 }, { wch: 9 }, { wch: 12 },
  ];
  const wb = XLSX.utils.book_new();
  const slug = filterLabel.slice(0, 28);
  XLSX.utils.book_append_sheet(wb, ws, slug);
  XLSX.writeFile(wb, `notas_fiscais_${filterLabel.toLowerCase().replace(/\s+/g, "_")}.xlsx`);
}

// ─── CUPONS FISCAIS (Reg 61) ──────────────────────────────────────────────────

export async function exportCuponsToPDF(
  records: Record61[],
  companyInfo: CompanyInfo
) {
  const { default: jsPDF } = await import("jspdf");
  const autoTable = (await import("jspdf-autotable")).default;
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  pdfHeader(doc, "Cupons Fiscais (Reg. 61)", `${records.length} registros`, companyInfo, 210);

  const totalGeral = records.reduce((s, c) => s + c.valorTotal, 0);

  autoTable(doc, {
    startY: 38,
    head: [["Data", "Modelo", "Serie NFC-e", "Nº Cupom", "Valor Total"]],
    body: records.map(c => [
      c.date, c.modelo, c.numOrdemECF, c.numIniCupom,
      c.valorTotal > 0 ? fmt(c.valorTotal) : "",
    ]),
    foot: [["", "", "", "TOTAL", fmt(totalGeral)]],
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [37, 99, 163], textColor: 255, fontStyle: "bold", fontSize: 8 },
    footStyles: { fillColor: [240, 240, 240], fontStyle: "bold", fontSize: 8 },
    columnStyles: {
      0: { cellWidth: 25 }, 1: { cellWidth: 18, halign: "center" },
      2: { cellWidth: 28, halign: "center" }, 3: { cellWidth: 28, halign: "center" },
      4: { cellWidth: 35, halign: "right" },
    },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    margin: { left: 14, right: 14 },
  });

  pdfPageNumbers(doc, 210, 297);
  doc.save("cupons_fiscais.pdf");
}

export async function exportCuponsToExcel(
  records: Record61[],
  companyInfo: CompanyInfo
) {
  const XLSX = await import("xlsx");
  const wsData: any[][] = [
    [companyInfo.name], [`CNPJ: ${companyInfo.cnpj}`],
    [`Cupons Fiscais (Reg. 61)  —  ${records.length} registros`], [],
    ["Data", "Modelo", "Serie NFC-e", "Nº Cupom", "Valor Total"],
  ];
  records.forEach(c => wsData.push([
    c.date, c.modelo, c.numOrdemECF, c.numIniCupom,
    c.valorTotal > 0 ? c.valorTotal.toFixed(2) : "",
  ]));
  const totalGeral = records.reduce((s, c) => s + c.valorTotal, 0);
  wsData.push([], ["", "", "", "TOTAL", totalGeral.toFixed(2)]);

  const ws = XLSX.utils.aoa_to_sheet(wsData);
  ws["!cols"] = [{ wch: 12 }, { wch: 8 }, { wch: 14 }, { wch: 12 }, { wch: 14 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Cupons");
  XLSX.writeFile(wb, "cupons_fiscais.xlsx");
}

// ─── RESUMO CFOP ─────────────────────────────────────────────────────────────

export type CfopGroup = { cfop: string; count: number; valorTotal: number };

export async function exportCfopToPDF(
  entradas: CfopGroup[],
  saidas: CfopGroup[],
  companyInfo: CompanyInfo
) {
  const { default: jsPDF } = await import("jspdf");
  const autoTable = (await import("jspdf-autotable")).default;
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  pdfHeader(doc, "Resumo por CFOP", "Entradas e Saidas", companyInfo, 210);

  const makeRows = (rows: CfopGroup[]) =>
    rows.map(r => [r.cfop, r.count, fmt(r.valorTotal)]);

  let y = 38;

  // Entradas
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30, 80, 160);
  doc.text("ENTRADAS  (CFOP 1xxx / 2xxx / 3xxx)", 14, y);
  doc.setTextColor(0, 0, 0);
  y += 2;

  const totalEntrada = entradas.reduce((s, r) => s + r.valorTotal, 0);
  autoTable(doc, {
    startY: y,
    head: [["CFOP", "Qtd NFs", "Valor Total"]],
    body: makeRows(entradas),
    foot: [["TOTAL", entradas.reduce((s, r) => s + r.count, 0), fmt(totalEntrada)]],
    styles: { fontSize: 8, cellPadding: 1.8 },
    headStyles: { fillColor: [30, 80, 160], textColor: 255, fontStyle: "bold" },
    footStyles: { fillColor: [220, 230, 245], fontStyle: "bold" },
    columnStyles: { 0: { cellWidth: 25 }, 1: { cellWidth: 25, halign: "center" }, 2: { cellWidth: 40, halign: "right" } },
    alternateRowStyles: { fillColor: [240, 245, 255] },
    margin: { left: 14, right: 120 },
  });

  y = (doc as any).lastAutoTable.finalY + 10;

  // Saídas
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(20, 120, 50);
  doc.text("SAIDAS  (CFOP 5xxx / 6xxx / 7xxx)", 14, y);
  doc.setTextColor(0, 0, 0);
  y += 2;

  const totalSaida = saidas.reduce((s, r) => s + r.valorTotal, 0);
  autoTable(doc, {
    startY: y,
    head: [["CFOP", "Qtd NFs", "Valor Total"]],
    body: makeRows(saidas),
    foot: [["TOTAL", saidas.reduce((s, r) => s + r.count, 0), fmt(totalSaida)]],
    styles: { fontSize: 8, cellPadding: 1.8 },
    headStyles: { fillColor: [20, 120, 50], textColor: 255, fontStyle: "bold" },
    footStyles: { fillColor: [220, 245, 225], fontStyle: "bold" },
    columnStyles: { 0: { cellWidth: 25 }, 1: { cellWidth: 25, halign: "center" }, 2: { cellWidth: 40, halign: "right" } },
    alternateRowStyles: { fillColor: [240, 250, 242] },
    margin: { left: 14, right: 120 },
  });

  pdfPageNumbers(doc, 210, 297);
  doc.save("resumo_cfop.pdf");
}

export async function exportCfopToExcel(
  entradas: CfopGroup[],
  saidas: CfopGroup[],
  companyInfo: CompanyInfo
) {
  const XLSX = await import("xlsx");
  const wb = XLSX.utils.book_new();

  const makeSheet = (rows: CfopGroup[], label: string) => {
    const data: any[][] = [
      [companyInfo.name], [`CNPJ: ${companyInfo.cnpj}`],
      [`Resumo CFOP — ${label}`], [],
      ["CFOP", "Qtd NFs", "Valor Total"],
    ];
    rows.forEach(r => data.push([r.cfop, r.count, r.valorTotal.toFixed(2)]));
    const total = rows.reduce((s, r) => s + r.valorTotal, 0);
    const countTotal = rows.reduce((s, r) => s + r.count, 0);
    data.push([], ["TOTAL", countTotal, total.toFixed(2)]);
    const ws = XLSX.utils.aoa_to_sheet(data);
    ws["!cols"] = [{ wch: 10 }, { wch: 10 }, { wch: 16 }];
    return ws;
  };

  XLSX.utils.book_append_sheet(wb, makeSheet(entradas, "Entradas"), "Entradas");
  XLSX.utils.book_append_sheet(wb, makeSheet(saidas, "Saidas"), "Saidas");
  XLSX.writeFile(wb, "resumo_cfop.xlsx");
}
