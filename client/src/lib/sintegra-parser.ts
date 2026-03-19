import type { InventoryItem, CompanyInfo, SintegraData, Record50, Record61 } from "@shared/schema";

function getOwnershipLabel(code: number): string {
  switch (code) {
    case 1:
      return "Propriedade do Informante e em seu poder";
    case 2:
      return "Propriedade do Informante em poder de terceiros";
    case 3:
      return "Propriedade de terceiros em poder do Informante";
    default:
      return "Desconhecido";
  }
}

function formatDate(rawDate: string): string {
  const cleaned = rawDate.replace(/-/g, "");
  if (cleaned.length === 8) {
    const year = cleaned.substring(0, 4);
    const month = cleaned.substring(4, 6);
    const day = cleaned.substring(6, 8);
    return `${day}/${month}/${year}`;
  }
  return rawDate;
}

function parseValue(raw: string): number {
  const n = parseInt(raw.trim(), 10);
  return isNaN(n) ? 0 : n / 100;
}

export function parseSintegra(content: string): SintegraData {
  const lines = content.split(/\r?\n/);

  const record75Map: Map<string, { description: string; unit: string; ncm: string }> = new Map();
  let companyName10 = "";
  let companyName11 = "";
  let cnpj = "";
  let inventoryDate = "";
  const items: InventoryItem[] = [];
  const records50: Record50[] = [];
  const records61: Record61[] = [];

  // First pass: collect 10, 11, 75 info
  for (const line of lines) {
    if (line.length < 2) continue;
    const recordType = line.substring(0, 2);

    if (recordType === "10") {
      cnpj = line.substring(2, 16).trim();
      companyName10 = line.substring(30, 65).trim();
    }

    if (recordType === "11") {
      companyName11 = line.substring(2, 49).trim();
    }

    if (recordType === "75") {
      const productCode = line.substring(18, 32).trim();
      const ncm = line.substring(32, 40).trim();
      const description = line.substring(40, 93).trim();
      const unit = line.substring(93, 99).trim();
      record75Map.set(productCode, { description, unit, ncm });
    }
  }

  const companyName = companyName10 || companyName11;
  const companyInfo: CompanyInfo = { name: companyName, cnpj };

  // Second pass: collect 50, 61, 74
  let hasRecord74 = false;
  for (const line of lines) {
    if (line.length < 2) continue;
    const recordType = line.substring(0, 2);

    // Registro 74 - Inventário
    if (recordType === "74") {
      hasRecord74 = true;
      const rawDate = line.substring(2, 10).trim();
      const formattedDate = formatDate(rawDate);
      if (!inventoryDate) inventoryDate = formattedDate;

      const productCode = line.substring(10, 24).trim();
      const rawQty = line.substring(24, 37).trim();
      const rawTotal = line.substring(37, 50).trim();
      const ownershipCode = parseInt(line.substring(50, 51).trim()) || 1;

      const quantity = parseInt(rawQty, 10) / 1000;
      const total = parseInt(rawTotal, 10) / 100;
      const unitPrice = quantity > 0 ? total / quantity : 0;

      const productInfo = record75Map.get(productCode);
      const description = productInfo?.description || "Produto nao encontrado";
      const unit = productInfo?.unit || "UN";
      const ncm = productInfo?.ncm || "";

      items.push({
        id: `${productCode}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        date: formattedDate,
        productCode,
        description,
        unit,
        ncm,
        quantity: Math.round(quantity * 1000) / 1000,
        unitPrice: Math.round(unitPrice * 100) / 100,
        total: Math.round(total * 100) / 100,
        ownership: ownershipCode,
        ownershipLabel: getOwnershipLabel(ownershipCode),
      });
    }

    // Registro 50 - Nota Fiscal (modelos 01, 1-A e 02)
    // Layout (0-indexed):
    // [0:2]   tipo
    // [2:16]  cnpj (14)
    // [16:30] ie (14)
    // [30:38] data AAAAMMDD (8)
    // [38:40] uf (2)
    // [40:42] modelo (2)
    // [42:45] serie (3)
    // [45:51] numero NF (6)
    // [51:55] cfop (4)
    // [55:56] emitente P/T (1)
    // [56:69] valor total (13)
    // [69:82] base calculo ICMS (13)
    // [82:95] valor ICMS (13)
    // [95:108] isenta/NT (13)
    // [108:121] outras (13)
    // [121:125] aliquota ICMS (4)
    // [125:126] situacao S=Cancelada (1)
    if (recordType === "50" && line.length >= 126) {
      const nfCnpj = line.substring(2, 16).trim();
      const ie = line.substring(16, 30).trim();
      const rawDate = line.substring(30, 38).trim();
      const date = formatDate(rawDate);
      const uf = line.substring(38, 40).trim();
      const modelo = line.substring(40, 42).trim();
      const serie = line.substring(42, 45).trim();
      const numero = line.substring(45, 51).trim();
      const cfop = line.substring(51, 55).trim();
      const emitente = line.substring(55, 56).trim();
      const valorTotal = parseValue(line.substring(56, 69));
      const baseCalculo = parseValue(line.substring(70, 83));
      const valorICMS = parseValue(line.substring(83, 95));
      const isentaNT = parseValue(line.substring(95, 108));
      const outras = parseValue(line.substring(108, 121));
      const aliquota = parseValue(line.substring(121, 125));
      const situacao = line.substring(125, 126).trim();
      const cancelada = situacao === "S";

      records50.push({
        id: `50-${rawDate}-${numero}-${Math.random().toString(36).substr(2, 6)}`,
        cnpj: nfCnpj,
        ie,
        date,
        uf,
        modelo,
        serie,
        numero,
        cfop,
        emitente,
        valorTotal: Math.round(valorTotal * 100) / 100,
        baseCalculo: Math.round(baseCalculo * 100) / 100,
        valorICMS: Math.round(valorICMS * 100) / 100,
        isentaNT: Math.round(isentaNT * 100) / 100,
        outras: Math.round(outras * 100) / 100,
        aliquota: Math.round(aliquota * 100) / 100,
        situacao,
        cancelada,
      });
    }

    // Registro 61 - Cupom Fiscal ECF/PDV
    // Layout (1-indexed, corrigido):
    // 1-2:   tipo
    // 3-16:  cnpj (14)
    // 17-30: ie (14)
    // 31-38: data AAAAMMDD (8)
    // 39-40: UF (2)
    // 41-43: serie ECF (3)
    // 44-45: modelo (2)
    // 46-51: num inicial cupom (6)
    // 52-57: num final cupom (6)
    // 58-70: valor total (13)
    if (recordType === "61" && line.length >= 70) {
      const cupCnpj = line.substring(2, 16).trim();
      const ie = line.substring(16, 30).trim();
      const rawDate = line.substring(30, 38).trim();
      const date = formatDate(rawDate);
      const numMapaResumo = line.substring(38, 40).trim();
      const modelo = line.substring(43, 45).trim();
      const numOrdemECF = line.substring(40, 43).trim(); // serie ECF
      const numIniCupom = line.substring(45, 51).trim();
      const numFinCupom = line.substring(51, 57).trim();
      const valorTotal = parseValue(line.substring(57, 70));

      records61.push({
        id: `61-${rawDate}-${numOrdemECF}-${numIniCupom}-${Math.random().toString(36).substr(2, 6)}`,
        cnpj: cupCnpj,
        ie,
        date,
        numMapaResumo,
        modelo,
        numOrdemECF,
        numIniCupom,
        numFinCupom,
        valorTotal: Math.round(valorTotal * 100) / 100,
      });
    }
  }

  // Se não houver registro 74, carregar todos os produtos do registro 75
  if (!hasRecord74) {
    record75Map.forEach((info, code) => {
      items.push({
        id: `${code}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        date: "",
        productCode: code,
        description: info.description,
        unit: info.unit,
        ncm: info.ncm,
        quantity: 0,
        unitPrice: 0,
        total: 0,
        ownership: 0,
        ownershipLabel: "Apenas Cadastro",
      });
    });
  }

  return {
    companyInfo,
    inventoryDate: inventoryDate || "N/A",
    items,
    records50,
    records61,
  };
}
