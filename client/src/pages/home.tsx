import { APP_VERSION } from "@shared/schema";
import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { parseSintegra } from "@/lib/sintegra-parser";
import {
  exportToPDF, exportToExcel,
  exportNFsToPDF, exportNFsToExcel,
  exportCuponsToPDF, exportCuponsToExcel,
  exportCfopToPDF, exportCfopToExcel,
  type CfopGroup,
} from "@/lib/export-utils";
import type { InventoryItem, CompanyInfo, SintegraData, Record50, Record61 } from "@shared/schema";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
  Upload,
  FileText,
  Download,
  Trash2,
  Pencil,
  Package,
  Search,
  X,
  FileSpreadsheet,
  BarChart3,
  Building2,
  CalendarDays,
  Hash,
  DollarSign,
  Boxes,
  RotateCcw,
  Receipt,
  ShoppingCart,
  TrendingUp,
  TrendingDown,
  ArrowUpDown,
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

type NfFilter = "todas" | "saidas" | "entradas";

export default function Home() {
  const [data, setData] = useState<SintegraData | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [editItem, setEditItem] = useState<InventoryItem | null>(null);
  const [deleteItemId, setDeleteItemId] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [uploadCount, setUploadCount] = useState<number>(0);
  const [activeTab, setActiveTab] = useState("inventario");
  const [nfFilter, setNfFilter] = useState<NfFilter>("todas");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetch("/api/upload-stats")
      .then(res => res.json())
      .then(data => setUploadCount(data.count))
      .catch(err => console.error("Error fetching counter:", err));
  }, []);

  const processFile = useCallback(
    async (file: File) => {
      if (!file.name.endsWith(".txt")) {
        toast({
          title: "Formato invalido",
          description: "Por favor, selecione um arquivo .txt SINTEGRA.",
          variant: "destructive",
        });
        return;
      }

      setIsLoading(true);
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const content = e.target?.result as string;
          const parsed = parseSintegra(content);

          if (parsed.items.length === 0 && parsed.records50.length === 0 && parsed.records61.length === 0) {
            toast({
              title: "Nenhum registro encontrado",
              description: "O arquivo nao contem registros validos (50, 61, 74 ou 75).",
              variant: "destructive",
            });
            setIsLoading(false);
            return;
          }

          try {
            const response = await apiRequest("POST", "/api/upload-stats/increment", {});
            const stats = await response.json();
            setUploadCount(stats.count);
          } catch (err) {
            console.error("Error incrementing counter:", err);
          }

          setData(parsed);
          setSearchTerm("");
          setNfFilter("todas");

          // Define tab padrão conforme o que foi encontrado
          const defaultTab =
            parsed.records50.length > 0 ? "notas"
            : parsed.records61.length > 0 ? "cupons"
            : "inventario";
          setActiveTab(defaultTab);

          const parts: string[] = [];
          if (parsed.items.length > 0) parts.push(`${parsed.items.length} itens inventario`);
          if (parsed.records50.length > 0) parts.push(`${parsed.records50.length} notas fiscais`);
          if (parsed.records61.length > 0) parts.push(`${parsed.records61.length} cupons`);

          toast({
            title: "Arquivo processado",
            description: parts.join(", ") + " carregados.",
          });
        } catch {
          toast({
            title: "Erro ao processar",
            description: "Nao foi possivel ler o arquivo SINTEGRA.",
            variant: "destructive",
          });
        }
        setIsLoading(false);
      };
      reader.readAsText(file, "latin1");
    },
    [toast]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) processFile(file);
    },
    [processFile]
  );

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) processFile(file);
    },
    [processFile]
  );

  const handleDelete = useCallback(
    (id: string) => {
      if (!data) return;
      const newItems = data.items.filter((item) => item.id !== id);
      setData({ ...data, items: newItems });
      setDeleteItemId(null);
      toast({ title: "Item removido", description: "O item foi excluido do inventario." });
    },
    [data, toast]
  );

  const handleEdit = useCallback(
    (updatedItem: InventoryItem) => {
      if (!data) return;
      const newItems = data.items.map((item) =>
        item.id === updatedItem.id ? updatedItem : item
      );
      setData({ ...data, items: newItems });
      setEditItem(null);
      toast({ title: "Item atualizado", description: "As alteracoes foram salvas." });
    },
    [data, toast]
  );

  const handleReset = useCallback(() => {
    setData(null);
    setSearchTerm("");
    setActiveTab("inventario");
    setNfFilter("todas");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, []);

  const filteredItems =
    data?.items.filter(
      (item) =>
        item.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.productCode.toLowerCase().includes(searchTerm.toLowerCase())
    ) || [];

  const filteredNFs = useMemo(() => {
    if (!data) return [];
    return data.records50.filter((nf) => {
      if (nfFilter === "saidas") return nf.emitente === "P";
      if (nfFilter === "entradas") return nf.emitente === "T";
      return true;
    });
  }, [data, nfFilter]);

  const cfopSummary = useMemo(() => {
    if (!data) return { entradas: [] as CfopGroup[], saidas: [] as CfopGroup[] };
    const entradasMap = new Map<string, CfopGroup>();
    const saidasMap = new Map<string, CfopGroup>();

    for (const nf of data.records50) {
      const cfop = nf.cfop;
      const firstDigit = cfop.charAt(0);
      const isEntrada = firstDigit === "1" || firstDigit === "2" || firstDigit === "3";
      const map = isEntrada ? entradasMap : saidasMap;
      const existing = map.get(cfop) || { cfop, count: 0, valorTotal: 0 };
      existing.count++;
      existing.valorTotal += nf.valorTotal;
      map.set(cfop, existing);
    }

    const toSorted = (m: Map<string, { cfop: string; count: number; valorTotal: number }>) =>
      Array.from(m.values()).sort((a, b) => a.cfop.localeCompare(b.cfop));

    return { entradas: toSorted(entradasMap), saidas: toSorted(saidasMap) };
  }, [data]);

  const totalGeral = data?.items.reduce((sum, item) => sum + item.total, 0) || 0;
  const totalFiltrado = filteredItems.reduce((sum, item) => sum + item.total, 0);
  const totalItens = filteredItems.length;
  const totalItensGeral = data?.items.length || 0;
  const isFiltered = searchTerm.length > 0;

  const fmtBRL = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 2 });

  // -------------------------
  // TELA DE UPLOAD (sem dados)
  // -------------------------
  if (!data) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <header className="border-b bg-card">
          <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-md bg-primary flex items-center justify-center">
                <BarChart3 className="w-5 h-5 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-lg font-bold tracking-tight" data-testid="text-app-title">
                  Leitor SINTEGRA <span className="text-[10px] font-normal opacity-70">v{APP_VERSION}</span>
                  <span className="text-[10px] font-normal opacity-70 ml-2">Uploads: {uploadCount}</span>
                </h1>
                <p className="text-xs text-muted-foreground" data-testid="text-company-ref">
                  V9 INFORMATICA - (37) 4141-0341
                </p>
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 flex items-center justify-center p-6">
          <div className="w-full max-w-xl">
            <div className="text-center mb-8">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <FileText className="w-8 h-8 text-primary" />
              </div>
              <h2 className="text-2xl font-bold mb-2" data-testid="text-welcome-title">
                Leitor SINTEGRA
              </h2>
              <p className="text-muted-foreground text-sm max-w-md mx-auto">
                Arraste seu arquivo .txt SINTEGRA para a area abaixo ou clique
                para selecionar. Registros 50, 61, 74 e 75 serao processados.
              </p>
            </div>

            <div
              data-testid="dropzone-file"
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`relative border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-all duration-200 ${
                isDragging
                  ? "border-primary bg-primary/5 scale-[1.01]"
                  : "border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/30"
              } ${isLoading ? "pointer-events-none opacity-60" : ""}`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".txt"
                onChange={handleFileInput}
                className="hidden"
                data-testid="input-file"
              />
              <Upload
                className={`w-10 h-10 mx-auto mb-4 transition-colors ${
                  isDragging ? "text-primary" : "text-muted-foreground"
                }`}
              />
              <p className="font-medium text-sm mb-1">
                {isLoading
                  ? "Processando arquivo..."
                  : isDragging
                    ? "Solte o arquivo aqui"
                    : "Arraste o arquivo .txt aqui"}
              </p>
              <p className="text-xs text-muted-foreground">
                ou clique para selecionar
              </p>
            </div>

            <div className="mt-6 grid grid-cols-4 gap-3">
              <div className="flex flex-col items-center p-3 rounded-md bg-muted/40">
                <Receipt className="w-4 h-4 text-muted-foreground mb-1" />
                <span className="text-[10px] text-muted-foreground text-center">Reg. 50</span>
                <span className="text-[10px] text-muted-foreground text-center">Notas Fiscais</span>
              </div>
              <div className="flex flex-col items-center p-3 rounded-md bg-muted/40">
                <ShoppingCart className="w-4 h-4 text-muted-foreground mb-1" />
                <span className="text-[10px] text-muted-foreground text-center">Reg. 61</span>
                <span className="text-[10px] text-muted-foreground text-center">Cupons ECF</span>
              </div>
              <div className="flex flex-col items-center p-3 rounded-md bg-muted/40">
                <Hash className="w-4 h-4 text-muted-foreground mb-1" />
                <span className="text-[10px] text-muted-foreground text-center">Reg. 74</span>
                <span className="text-[10px] text-muted-foreground text-center">Inventario</span>
              </div>
              <div className="flex flex-col items-center p-3 rounded-md bg-muted/40">
                <Package className="w-4 h-4 text-muted-foreground mb-1" />
                <span className="text-[10px] text-muted-foreground text-center">Reg. 75</span>
                <span className="text-[10px] text-muted-foreground text-center">Produtos</span>
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // -------------------------
  // TELA COM DADOS + TABS
  // -------------------------
  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b bg-card sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-md bg-primary flex items-center justify-center">
                <BarChart3 className="w-4 h-4 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-sm font-bold tracking-tight" data-testid="text-inventory-title">
                  SINTEGRA{data.inventoryDate !== "N/A" ? ` — Inventario em ${data.inventoryDate}` : ""}
                  <span className="text-[9px] font-normal opacity-70 ml-1">v{APP_VERSION}</span>
                  <span className="text-[9px] font-normal opacity-70 ml-2">Uploads: {uploadCount}</span>
                </h1>
                <div className="flex items-center gap-2">
                  <Building2 className="w-3 h-3 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground" data-testid="text-company-name">
                    {data.companyInfo.name}
                  </span>
                  {data.companyInfo.cnpj && (
                    <span className="text-xs text-muted-foreground" data-testid="text-cnpj">
                      — CNPJ: {data.companyInfo.cnpj}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-[10px] text-muted-foreground italic hidden sm:block">
                V9 INFORMATICA - (37) 4141-0341
              </p>
              {data.items.length > 0 && (
                <>
                  <Button variant="outline" size="sm" onClick={() => exportToPDF(data.items, data.companyInfo, data.inventoryDate)} data-testid="button-export-pdf">
                    <Download className="w-3.5 h-3.5 mr-1.5" />PDF
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => exportToExcel(data.items, data.companyInfo, data.inventoryDate)} data-testid="button-export-excel">
                    <FileSpreadsheet className="w-3.5 h-3.5 mr-1.5" />Excel
                  </Button>
                </>
              )}
              <Button variant="outline" size="sm" onClick={handleReset} data-testid="button-reset">
                <RotateCcw className="w-3.5 h-3.5 mr-1.5" />Novo
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
        <div className="border-b bg-card/80 sticky top-[57px] z-40">
          <div className="max-w-7xl mx-auto px-4">
            <TabsList className="h-10 bg-transparent gap-0 rounded-none border-0 p-0">
              {data.records50.length > 0 && (
                <TabsTrigger value="notas" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 h-10 gap-1.5">
                  <Receipt className="w-3.5 h-3.5" />
                  Notas Fiscais
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{data.records50.length}</Badge>
                </TabsTrigger>
              )}
              {data.records61.length > 0 && (
                <TabsTrigger value="cupons" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 h-10 gap-1.5">
                  <ShoppingCart className="w-3.5 h-3.5" />
                  Cupons Fiscais
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{data.records61.length}</Badge>
                </TabsTrigger>
              )}
              {data.records50.length > 0 && (
                <TabsTrigger value="cfop" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 h-10 gap-1.5">
                  <ArrowUpDown className="w-3.5 h-3.5" />
                  Resumo CFOP
                </TabsTrigger>
              )}
              {data.items.length > 0 && (
                <TabsTrigger value="inventario" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 h-10 gap-1.5">
                  <Boxes className="w-3.5 h-3.5" />
                  Inventario
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{data.items.length}</Badge>
                </TabsTrigger>
              )}
            </TabsList>
          </div>
        </div>

        {/* ===== TAB: NOTAS FISCAIS (Reg. 50) ===== */}
        {data.records50.length > 0 && (
          <TabsContent value="notas" className="flex-1 mt-0">
            <div className="max-w-7xl mx-auto px-4 py-3">
              {/* Filtros e totais */}
              <div className="flex items-center justify-between gap-4 flex-wrap mb-3">
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant={nfFilter === "todas" ? "default" : "outline"}
                    onClick={() => setNfFilter("todas")}
                    className="h-7 text-xs"
                  >
                    Todas ({data.records50.length})
                  </Button>
                  <Button
                    size="sm"
                    variant={nfFilter === "saidas" ? "default" : "outline"}
                    onClick={() => setNfFilter("saidas")}
                    className="h-7 text-xs gap-1"
                  >
                    <TrendingUp className="w-3 h-3" />
                    Saidas ({data.records50.filter(n => n.emitente === "P").length})
                  </Button>
                  <Button
                    size="sm"
                    variant={nfFilter === "entradas" ? "default" : "outline"}
                    onClick={() => setNfFilter("entradas")}
                    className="h-7 text-xs gap-1"
                  >
                    <TrendingDown className="w-3 h-3" />
                    Entradas ({data.records50.filter(n => n.emitente === "T").length})
                  </Button>
                </div>
                <div className="flex items-center gap-3 text-sm flex-wrap">
                  <span className="text-muted-foreground">{filteredNFs.length} notas</span>
                  <span className="font-semibold text-primary">
                    Total: R$ {fmtBRL(filteredNFs.reduce((s, n) => s + n.valorTotal, 0))}
                  </span>
                  <Button variant="outline" size="sm" className="h-7 text-xs gap-1"
                    onClick={() => exportNFsToPDF(filteredNFs, nfFilter === "saidas" ? "Saidas" : nfFilter === "entradas" ? "Entradas" : "Todas", data.companyInfo)}>
                    <Download className="w-3 h-3" />PDF
                  </Button>
                  <Button variant="outline" size="sm" className="h-7 text-xs gap-1"
                    onClick={() => exportNFsToExcel(filteredNFs, nfFilter === "saidas" ? "Saidas" : nfFilter === "entradas" ? "Entradas" : "Todas", data.companyInfo)}>
                    <FileSpreadsheet className="w-3 h-3" />Excel
                  </Button>
                </div>
              </div>

              {/* Tabela NFs */}
              <div className="rounded-md border overflow-auto">
                <table className="w-full text-xs">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="px-3 py-2 text-left font-semibold">Data</th>
                      <th className="px-3 py-2 text-left font-semibold">Modelo</th>
                      <th className="px-3 py-2 text-left font-semibold">Série</th>
                      <th className="px-3 py-2 text-left font-semibold">Nº NF</th>
                      <th className="px-3 py-2 text-left font-semibold">CFOP</th>
                      <th className="px-3 py-2 text-right font-semibold">Valor Total</th>
                      <th className="px-3 py-2 text-right font-semibold">Base Cálc.</th>
                      <th className="px-3 py-2 text-right font-semibold">Vl. ICMS</th>
                      <th className="px-3 py-2 text-right font-semibold">Alíq. %</th>
                      <th className="px-3 py-2 text-center font-semibold">Situação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredNFs.map((nf, i) => (
                      <tr key={nf.id} className={`border-t ${i % 2 === 0 ? "" : "bg-muted/20"} ${nf.cancelada ? "opacity-50" : ""}`}>
                        <td className="px-3 py-1.5 font-mono">{nf.date}</td>
                        <td className="px-3 py-1.5">{nf.modelo}</td>
                        <td className="px-3 py-1.5">{nf.serie}</td>
                        <td className="px-3 py-1.5 font-mono">{nf.numero}</td>
                        <td className="px-3 py-1.5">
                          <Badge variant="outline" className="font-mono text-[10px] px-1.5">{nf.cfop}</Badge>
                        </td>
                        <td className="px-3 py-1.5 text-right font-semibold">
                          R$ {fmtBRL(nf.valorTotal)}
                        </td>
                        <td className="px-3 py-1.5 text-right text-muted-foreground">
                          {nf.baseCalculo > 0 ? `R$ ${fmtBRL(nf.baseCalculo)}` : "—"}
                        </td>
                        <td className="px-3 py-1.5 text-right text-muted-foreground">
                          {nf.valorICMS > 0 ? `R$ ${fmtBRL(nf.valorICMS)}` : "—"}
                        </td>
                        <td className="px-3 py-1.5 text-right text-muted-foreground">
                          {nf.aliquota > 0 ? `${fmtBRL(nf.aliquota)}%` : "—"}
                        </td>
                        <td className="px-3 py-1.5 text-center">
                          {nf.cancelada ? (
                            <Badge variant="destructive" className="text-[10px] px-1.5">Cancelada</Badge>
                          ) : (
                            <Badge variant="secondary" className="text-[10px] px-1.5">Normal</Badge>
                          )}
                        </td>
                      </tr>
                    ))}
                    {filteredNFs.length === 0 && (
                      <tr>
                        <td colSpan={10} className="px-3 py-8 text-center text-muted-foreground">
                          Nenhuma nota encontrada.
                        </td>
                      </tr>
                    )}
                  </tbody>
                  {filteredNFs.length > 0 && (
                    <tfoot className="bg-muted/40 border-t">
                      <tr>
                        <td colSpan={5} className="px-3 py-2 font-semibold text-right">Total:</td>
                        <td className="px-3 py-2 font-bold text-right text-primary">
                          R$ {fmtBRL(filteredNFs.reduce((s, n) => s + n.valorTotal, 0))}
                        </td>
                        <td className="px-3 py-2 font-bold text-right">
                          R$ {fmtBRL(filteredNFs.reduce((s, n) => s + n.baseCalculo, 0))}
                        </td>
                        <td className="px-3 py-2 font-bold text-right">
                          R$ {fmtBRL(filteredNFs.reduce((s, n) => s + n.valorICMS, 0))}
                        </td>
                        <td colSpan={2} />
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>
          </TabsContent>
        )}

        {/* ===== TAB: CUPONS FISCAIS (Reg. 61) ===== */}
        {data.records61.length > 0 && (
          <TabsContent value="cupons" className="flex-1 mt-0">
            <div className="max-w-7xl mx-auto px-4 py-3">
              <div className="flex items-center justify-between gap-4 mb-3 flex-wrap">
                <div className="flex items-center gap-3 text-sm">
                  <span className="text-muted-foreground">{data.records61.length} registros de cupom</span>
                  <span className="font-semibold text-primary">
                    Total: R$ {fmtBRL(data.records61.reduce((s, c) => s + c.valorTotal, 0))}
                  </span>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="h-7 text-xs gap-1"
                    onClick={() => exportCuponsToPDF(data.records61, data.companyInfo)}>
                    <Download className="w-3 h-3" />PDF
                  </Button>
                  <Button variant="outline" size="sm" className="h-7 text-xs gap-1"
                    onClick={() => exportCuponsToExcel(data.records61, data.companyInfo)}>
                    <FileSpreadsheet className="w-3 h-3" />Excel
                  </Button>
                </div>
              </div>

              <div className="rounded-md border overflow-auto">
                <table className="w-full text-xs">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="px-3 py-2 text-left font-semibold">Data</th>
                      <th className="px-3 py-2 text-left font-semibold">Modelo</th>
                      <th className="px-3 py-2 text-left font-semibold">Série NFC-e</th>
                      <th className="px-3 py-2 text-left font-semibold">Nº Cupom</th>
                      <th className="px-3 py-2 text-right font-semibold">Valor Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.records61.map((cup, i) => (
                      <tr key={cup.id} className={`border-t ${i % 2 === 0 ? "" : "bg-muted/20"}`}>
                        <td className="px-3 py-1.5 font-mono">{cup.date}</td>
                        <td className="px-3 py-1.5">{cup.modelo}</td>
                        <td className="px-3 py-1.5 font-mono">{cup.numOrdemECF}</td>
                        <td className="px-3 py-1.5 font-mono">{cup.numIniCupom}</td>
                        <td className="px-3 py-1.5 text-right font-semibold">
                          {cup.valorTotal > 0 ? `R$ ${fmtBRL(cup.valorTotal)}` : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-muted/40 border-t">
                    <tr>
                      <td colSpan={4} className="px-3 py-2 font-semibold text-right">Total:</td>
                      <td className="px-3 py-2 font-bold text-right text-primary">
                        R$ {fmtBRL(data.records61.reduce((s, c) => s + c.valorTotal, 0))}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          </TabsContent>
        )}

        {/* ===== TAB: RESUMO CFOP ===== */}
        {data.records50.length > 0 && (
          <TabsContent value="cfop" className="flex-1 mt-0">
            <div className="max-w-7xl mx-auto px-4 py-4">
              <div className="flex justify-end gap-2 mb-4">
                <Button variant="outline" size="sm" className="h-7 text-xs gap-1"
                  onClick={() => exportCfopToPDF(cfopSummary.entradas, cfopSummary.saidas, data.companyInfo)}>
                  <Download className="w-3 h-3" />PDF
                </Button>
                <Button variant="outline" size="sm" className="h-7 text-xs gap-1"
                  onClick={() => exportCfopToExcel(cfopSummary.entradas, cfopSummary.saidas, data.companyInfo)}>
                  <FileSpreadsheet className="w-3 h-3" />Excel
                </Button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Entradas */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <TrendingDown className="w-4 h-4 text-blue-600" />
                    <h3 className="font-semibold text-sm">Entradas</h3>
                    <span className="text-xs text-muted-foreground">(CFOP 1xxx / 2xxx / 3xxx)</span>
                  </div>
                  <div className="rounded-md border overflow-hidden">
                    <table className="w-full text-xs">
                      <thead className="bg-blue-50 dark:bg-blue-950/30">
                        <tr>
                          <th className="px-3 py-2 text-left font-semibold">CFOP</th>
                          <th className="px-3 py-2 text-center font-semibold">Qtd NFs</th>
                          <th className="px-3 py-2 text-right font-semibold">Valor Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {cfopSummary.entradas.map((row, i) => (
                          <tr key={row.cfop} className={`border-t ${i % 2 === 0 ? "" : "bg-muted/20"}`}>
                            <td className="px-3 py-1.5">
                              <Badge variant="outline" className="font-mono text-[10px]">{row.cfop}</Badge>
                            </td>
                            <td className="px-3 py-1.5 text-center">{row.count}</td>
                            <td className="px-3 py-1.5 text-right font-semibold">R$ {fmtBRL(row.valorTotal)}</td>
                          </tr>
                        ))}
                        {cfopSummary.entradas.length === 0 && (
                          <tr><td colSpan={3} className="px-3 py-6 text-center text-muted-foreground">Nenhum CFOP de entrada.</td></tr>
                        )}
                      </tbody>
                      {cfopSummary.entradas.length > 0 && (
                        <tfoot className="bg-blue-50/60 dark:bg-blue-950/20 border-t">
                          <tr>
                            <td className="px-3 py-2 font-semibold">Total</td>
                            <td className="px-3 py-2 text-center font-semibold">
                              {cfopSummary.entradas.reduce((s, r) => s + r.count, 0)}
                            </td>
                            <td className="px-3 py-2 text-right font-bold text-blue-700 dark:text-blue-400">
                              R$ {fmtBRL(cfopSummary.entradas.reduce((s, r) => s + r.valorTotal, 0))}
                            </td>
                          </tr>
                        </tfoot>
                      )}
                    </table>
                  </div>
                </div>

                {/* Saídas */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <TrendingUp className="w-4 h-4 text-green-600" />
                    <h3 className="font-semibold text-sm">Saidas</h3>
                    <span className="text-xs text-muted-foreground">(CFOP 5xxx / 6xxx / 7xxx)</span>
                  </div>
                  <div className="rounded-md border overflow-hidden">
                    <table className="w-full text-xs">
                      <thead className="bg-green-50 dark:bg-green-950/30">
                        <tr>
                          <th className="px-3 py-2 text-left font-semibold">CFOP</th>
                          <th className="px-3 py-2 text-center font-semibold">Qtd NFs</th>
                          <th className="px-3 py-2 text-right font-semibold">Valor Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {cfopSummary.saidas.map((row, i) => (
                          <tr key={row.cfop} className={`border-t ${i % 2 === 0 ? "" : "bg-muted/20"}`}>
                            <td className="px-3 py-1.5">
                              <Badge variant="outline" className="font-mono text-[10px]">{row.cfop}</Badge>
                            </td>
                            <td className="px-3 py-1.5 text-center">{row.count}</td>
                            <td className="px-3 py-1.5 text-right font-semibold">R$ {fmtBRL(row.valorTotal)}</td>
                          </tr>
                        ))}
                        {cfopSummary.saidas.length === 0 && (
                          <tr><td colSpan={3} className="px-3 py-6 text-center text-muted-foreground">Nenhum CFOP de saida.</td></tr>
                        )}
                      </tbody>
                      {cfopSummary.saidas.length > 0 && (
                        <tfoot className="bg-green-50/60 dark:bg-green-950/20 border-t">
                          <tr>
                            <td className="px-3 py-2 font-semibold">Total</td>
                            <td className="px-3 py-2 text-center font-semibold">
                              {cfopSummary.saidas.reduce((s, r) => s + r.count, 0)}
                            </td>
                            <td className="px-3 py-2 text-right font-bold text-green-700 dark:text-green-400">
                              R$ {fmtBRL(cfopSummary.saidas.reduce((s, r) => s + r.valorTotal, 0))}
                            </td>
                          </tr>
                        </tfoot>
                      )}
                    </table>
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>
        )}

        {/* ===== TAB: INVENTÁRIO (Reg. 74/75) ===== */}
        {data.items.length > 0 && (
          <TabsContent value="inventario" className="flex-1 mt-0 flex flex-col">
            {/* Stats + Search */}
            <div className="border-b bg-card/60">
              <div className="max-w-7xl mx-auto px-4 py-2">
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <div className="flex items-center gap-4 flex-wrap">
                    <div className="flex items-center gap-2 text-sm">
                      <Boxes className="w-4 h-4 text-primary" />
                      <span className="text-muted-foreground">Itens:</span>
                      <span className="font-semibold" data-testid="text-total-items">
                        {isFiltered ? `${totalItens} de ${totalItensGeral}` : totalItensGeral}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <DollarSign className="w-4 h-4 text-primary" />
                      <span className="text-muted-foreground">Total:</span>
                      <span className="font-semibold text-primary" data-testid="text-total-value">
                        R$ {fmtBRL(isFiltered ? totalFiltrado : totalGeral)}
                      </span>
                    </div>
                    {data.inventoryDate !== "N/A" && (
                      <div className="flex items-center gap-2 text-sm">
                        <CalendarDays className="w-4 h-4 text-primary" />
                        <span className="text-muted-foreground">Data:</span>
                        <span className="font-semibold" data-testid="text-inventory-date">{data.inventoryDate}</span>
                      </div>
                    )}
                  </div>

                  <div className="relative w-full sm:w-72">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar por codigo ou descricao..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-9 pr-9"
                      data-testid="input-search"
                    />
                    {searchTerm && (
                      <button
                        onClick={() => setSearchTerm("")}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                        data-testid="button-clear-search"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <main className="flex-1 overflow-auto">
              <div className="max-w-7xl mx-auto px-4 py-4">
                {filteredItems.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 text-center">
                    <Search className="w-12 h-12 text-muted-foreground/30 mb-4" />
                    <h3 className="text-lg font-medium mb-1">Nenhum item encontrado</h3>
                    <p className="text-sm text-muted-foreground">Tente alterar o termo de busca.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                    {filteredItems.map((item, index) => (
                      <Card
                        key={item.id}
                        className={`group hover-elevate transition-all duration-150 ${
                          item.total <= 0 ? "bg-orange-50 dark:bg-orange-950/20 border-orange-200 dark:border-orange-900/50" : ""
                        }`}
                        data-testid={`card-item-${index}`}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between gap-2 mb-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <Badge variant="secondary" className="text-[10px] font-mono shrink-0">
                                  {item.productCode}
                                </Badge>
                                {item.ncm && (
                                  <Badge variant="outline" className="text-[10px] font-mono shrink-0">
                                    NCM: {item.ncm}
                                  </Badge>
                                )}
                                <Badge
                                  variant={item.ownership === 1 ? "default" : item.ownership === 2 ? "secondary" : "outline"}
                                  className="text-[10px] shrink-0"
                                >
                                  Posse {item.ownership}
                                </Badge>
                              </div>
                              <p className="text-sm font-medium leading-tight line-clamp-2" title={item.description} data-testid={`text-description-${index}`}>
                                {item.description}
                              </p>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <Button size="icon" variant="ghost" onClick={() => setEditItem({ ...item })} data-testid={`button-edit-${index}`}>
                                <Pencil className="w-3.5 h-3.5" />
                              </Button>
                              <Button size="icon" variant="ghost" onClick={() => setDeleteItemId(item.id)} data-testid={`button-delete-${index}`}>
                                <Trash2 className="w-3.5 h-3.5 text-destructive" />
                              </Button>
                            </div>
                          </div>

                          <div className="grid grid-cols-3 gap-2 text-xs">
                            <div className="bg-muted/40 rounded-md px-2 py-1.5">
                              <span className="text-muted-foreground block text-[10px]">Qtde</span>
                              <span className="font-semibold" data-testid={`text-qty-${index}`}>
                                {item.quantity.toLocaleString("pt-BR", { minimumFractionDigits: 3 })} {item.unit}
                              </span>
                            </div>
                            <div className="bg-muted/40 rounded-md px-2 py-1.5">
                              <span className="text-muted-foreground block text-[10px]">Vl. Unit.</span>
                              <span className="font-semibold" data-testid={`text-price-${index}`}>
                                R$ {fmtBRL(item.unitPrice)}
                              </span>
                            </div>
                            <div className="bg-primary/10 rounded-md px-2 py-1.5">
                              <span className="text-muted-foreground block text-[10px]">Total</span>
                              <span className="font-bold text-primary" data-testid={`text-total-${index}`}>
                                R$ {fmtBRL(item.total)}
                              </span>
                            </div>
                          </div>

                          <p className="text-[10px] text-muted-foreground mt-2 truncate" title={item.ownershipLabel}>
                            {item.ownershipLabel}
                          </p>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            </main>

            <footer className="border-t bg-card py-2 sticky bottom-0 z-40">
              <div className="max-w-7xl mx-auto px-4 flex items-center justify-between gap-2 text-xs text-muted-foreground">
                <span>{totalItensGeral} {totalItensGeral === 1 ? "item" : "itens"} no inventario</span>
                <span className="font-semibold text-foreground" data-testid="text-footer-total">
                  Total Geral: R$ {fmtBRL(totalGeral)}
                </span>
              </div>
            </footer>
          </TabsContent>
        )}
      </Tabs>

      <EditDialog item={editItem} onClose={() => setEditItem(null)} onSave={handleEdit} />

      <AlertDialog open={!!deleteItemId} onOpenChange={(open) => !open && setDeleteItemId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusao</AlertDialogTitle>
            <AlertDialogDescription>
              Deseja realmente excluir este item do inventario? Esta acao nao pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteItemId && handleDelete(deleteItemId)} data-testid="button-confirm-delete">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function EditDialog({
  item,
  onClose,
  onSave,
}: {
  item: InventoryItem | null;
  onClose: () => void;
  onSave: (item: InventoryItem) => void;
}) {
  const [formData, setFormData] = useState<InventoryItem | null>(null);
  const currentItem = formData?.id === item?.id ? formData : item;

  const handleOpen = (open: boolean) => {
    if (open && item) {
      setFormData({ ...item });
    } else if (!open) {
      setFormData(null);
      onClose();
    }
  };

  const handleSave = () => {
    if (!currentItem) return;
    const total = currentItem.quantity * currentItem.unitPrice;
    onSave({ ...currentItem, total: Math.round(total * 100) / 100 });
  };

  const fmtBRL = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 2 });

  return (
    <Dialog open={!!item} onOpenChange={handleOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Editar Item</DialogTitle>
        </DialogHeader>
        {currentItem && (
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="edit-code">Codigo do Produto</Label>
              <Input id="edit-code" value={currentItem.productCode} readOnly className="bg-muted" data-testid="input-edit-code" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-desc">Descricao</Label>
              <Input id="edit-desc" value={currentItem.description} onChange={(e) => setFormData({ ...currentItem, description: e.target.value })} data-testid="input-edit-description" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-ncm">NCM</Label>
              <Input id="edit-ncm" value={currentItem.ncm} onChange={(e) => setFormData({ ...currentItem, ncm: e.target.value })} data-testid="input-edit-ncm" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label htmlFor="edit-qty">Quantidade</Label>
                <Input id="edit-qty" type="number" step="0.001" value={currentItem.quantity} onChange={(e) => setFormData({ ...currentItem, quantity: parseFloat(e.target.value) || 0 })} data-testid="input-edit-quantity" />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-price">Preco Unitario</Label>
                <Input id="edit-price" type="number" step="0.01" value={currentItem.unitPrice} onChange={(e) => setFormData({ ...currentItem, unitPrice: parseFloat(e.target.value) || 0 })} data-testid="input-edit-price" />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-unit">Unidade</Label>
              <Input id="edit-unit" value={currentItem.unit} onChange={(e) => setFormData({ ...currentItem, unit: e.target.value })} data-testid="input-edit-unit" />
            </div>
            <div className="rounded-md bg-primary/10 p-3 text-center">
              <span className="text-xs text-muted-foreground">Total Calculado</span>
              <p className="text-lg font-bold text-primary">
                R$ {fmtBRL(currentItem.quantity * currentItem.unitPrice)}
              </p>
            </div>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose} data-testid="button-cancel-edit">Cancelar</Button>
          <Button onClick={handleSave} data-testid="button-save-edit">Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
