export const APP_VERSION = "1.0.3";

import { z } from "zod";

export const inventoryItemSchema = z.object({
  id: z.string(),
  date: z.string(),
  productCode: z.string(),
  description: z.string(),
  unit: z.string(),
  ncm: z.string(),
  quantity: z.number(),
  unitPrice: z.number(),
  total: z.number(),
  ownership: z.number(),
  ownershipLabel: z.string(),
});

export type InventoryItem = z.infer<typeof inventoryItemSchema>;

export const companyInfoSchema = z.object({
  name: z.string(),
  cnpj: z.string(),
});

export type CompanyInfo = z.infer<typeof companyInfoSchema>;

// Registro 50 - Nota Fiscal modelos 01, 1-A e 02
export const record50Schema = z.object({
  id: z.string(),
  cnpj: z.string(),
  ie: z.string(),
  date: z.string(),
  uf: z.string(),
  modelo: z.string(),
  serie: z.string(),
  numero: z.string(),
  cfop: z.string(),
  emitente: z.string(), // P=Próprio (saída), T=Terceiros (entrada)
  valorTotal: z.number(),
  baseCalculo: z.number(),
  valorICMS: z.number(),
  isentaNT: z.number(),
  outras: z.number(),
  aliquota: z.number(),
  situacao: z.string(),
  cancelada: z.boolean(),
});

export type Record50 = z.infer<typeof record50Schema>;

// Registro 61 - Cupom Fiscal ECF/PDV
export const record61Schema = z.object({
  id: z.string(),
  cnpj: z.string(),
  ie: z.string(),
  date: z.string(),
  numMapaResumo: z.string(),
  modelo: z.string(),
  numOrdemECF: z.string(), // série do equipamento ECF
  numIniCupom: z.string(),
  numFinCupom: z.string(),
  valorTotal: z.number(),
});

export type Record61 = z.infer<typeof record61Schema>;

export interface SintegraData {
  companyInfo: CompanyInfo;
  inventoryDate: string;
  items: InventoryItem[];
  records50: Record50[];
  records61: Record61[];
}
