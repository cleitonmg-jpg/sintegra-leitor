import type { InventoryItem, CompanyInfo } from "@shared/schema";

export async function exportToPDF(
  items: InventoryItem[],
  companyInfo: CompanyInfo,
  inventoryDate: string
) {
  const { default: jsPDF } = await import("jspdf");
  const autoTable = (await import("jspdf-autotable")).default;

  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });

  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text(`${companyInfo.name}`, 148, 12, { align: "center" });

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(`CNPJ: ${companyInfo.cnpj}`, 148, 18, { align: "center" });

  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text(`Inventario Existente em ${inventoryDate}`, 148, 26, { align: "center" });

  doc.setFontSize(7);
  doc.setFont("helvetica", "italic");
  doc.text("V9 INFORMATICA - (37) 4141-0341", 148, 31, { align: "center" });

  const tableData = items.map((item, index) => [
    index + 1,
    item.productCode,
    item.ncm,
    item.description,
    item.unit,
    item.quantity.toFixed(3).replace(".", ","),
    item.unitPrice.toFixed(2).replace(".", ","),
    item.total.toFixed(2).replace(".", ","),
    item.ownership,
  ]);

  const totalGeral = items.reduce((sum, item) => sum + item.total, 0);

  autoTable(doc, {
    startY: 34,
    head: [["#", "Codigo", "NCM", "Descricao", "Un", "Qtde", "Vl. Unit.", "Total", "Posse"]],
    body: tableData,
    foot: [["", "", "", "", "", "", totalGeral.toFixed(2).replace(".", ","), ""]],
    styles: { fontSize: 7, cellPadding: 1.5 },
    headStyles: { fillColor: [37, 99, 163], textColor: 255, fontStyle: "bold", fontSize: 7 },
    footStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: "bold", fontSize: 8 },
    columnStyles: {
      0: { cellWidth: 10, halign: "center" },
      1: { cellWidth: 25 },
      2: { cellWidth: 18 },
      3: { cellWidth: 72 },
      4: { cellWidth: 12, halign: "center" },
      5: { cellWidth: 20, halign: "right" },
      6: { cellWidth: 20, halign: "right" },
      7: { cellWidth: 22, halign: "right" },
      8: { cellWidth: 10, halign: "center" },
    },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    margin: { left: 14, right: 14 },
  });

  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.text(`Pagina ${i} de ${pageCount}`, 283, 205, { align: "right" });
  }

  doc.save(`inventario_${inventoryDate.replace(/\//g, "-")}.pdf`);
}

export async function exportToExcel(
  items: InventoryItem[],
  companyInfo: CompanyInfo,
  inventoryDate: string
) {
  const XLSX = await import("xlsx");

  const wsData = [
    [companyInfo.name],
    [`CNPJ: ${companyInfo.cnpj}`],
    [`Inventario Existente em ${inventoryDate}`],
    [],
    ["#", "Codigo", "NCM", "Descricao", "Unidade", "Quantidade", "Vl. Unitario", "Total", "Posse"],
  ];

  items.forEach((item, index) => {
    wsData.push([
      (index + 1).toString(),
      item.productCode,
      item.ncm,
      item.description,
      item.unit,
      item.quantity.toFixed(3),
      item.unitPrice.toFixed(2),
      item.total.toFixed(2),
      item.ownershipLabel,
    ]);
  });

  const totalGeral = items.reduce((sum, item) => sum + item.total, 0);
  wsData.push([]);
  wsData.push(["", "", "", "", "", "TOTAL GERAL:", totalGeral.toFixed(2), ""]);

  const ws = XLSX.utils.aoa_to_sheet(wsData);

  ws["!cols"] = [
    { wch: 5 },
    { wch: 16 },
    { wch: 50 },
    { wch: 8 },
    { wch: 14 },
    { wch: 14 },
    { wch: 16 },
    { wch: 45 },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Inventario");
  XLSX.writeFile(wb, `inventario_${inventoryDate.replace(/\//g, "-")}.xlsx`);
}
