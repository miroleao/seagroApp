"use client";

import { useState, useCallback } from "react";
import { FileDown, X, CheckSquare, Square } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

// ─── Tipos ────────────────────────────────────────────────────────────────────

export interface ColunaPDF {
  key: string;
  label: string;
  padrao?: boolean;
  largura?: number;
}

export interface GrupoPDF {
  key: string;
  label: string;
  padrao?: boolean;
}

export interface ExportarPDFProps {
  titulo: string;
  subtitulo?: string;
  colunas: ColunaPDF[];
  dados: Record<string, unknown>[];
  orientacao?: "portrait" | "landscape";
  nomeArquivo?: string;
  grupos?: GrupoPDF[];
  campoGrupo?: string;
}

// ─── Paleta SE ────────────────────────────────────────────────────────────────

const VERDE_R = 80;
const VERDE_G = 160;
const VERDE_B = 115;

const VERDE_CLARO_R = 237;
const VERDE_CLARO_G = 248;
const VERDE_CLARO_B = 243;

// ─── Helper: carrega imagem como data URL ─────────────────────────────────────

async function fetchImgDataUrl(url: string): Promise<string | null> {
  try {
    const resp = await fetch(url);
    if (!resp.ok) return null;
    const blob = await resp.blob();
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload  = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

// ─── Labels de status ─────────────────────────────────────────────────────────

const STATUS_LABELS: Record<string, string> = {
  COLETANDO: "Coletando", INSEMINADA: "Inseminada", GESTANTE: "Prenha",
  PARIDA: "Parida", ABORTOU: "Abortou", VAZIA: "Vazia", SECA: "Seca",
  DESCARTADA: "Descartada", VENDIDA: "Vendida", PROTOCOLADA: "Protocolada",
  IMPLANTADA: "Implantada c/ Embrião", PRENHA: "Prenha",
  PRENHA_EMBRIAO: "Prenha de Embrião", MORTA: "Óbito", DESCARTE: "Descarte",
  APTO: "Apto", INAPTO: "Inapto", PENDENTE: "Pendente",
  DISPONIVEL: "Disponível", IMPLANTADO: "Implantado", DESCARTADO: "Descartado",
  NAO_SEXADO: "Não Sexado", MACHO: "Macho", FEMEA: "Fêmea",
  RECEPTORA: "Receptora", RECRIA: "Recria", OUTRO: "Outro",
};

function formatarCelula(valor: unknown): string {
  if (valor === null || valor === undefined || valor === "") return "—";
  if (typeof valor === "boolean") return valor ? "Sim" : "Não";
  if (typeof valor === "number") return String(valor);
  const str = String(valor);
  return STATUS_LABELS[str] ?? str;
}

// ─── Componente ───────────────────────────────────────────────────────────────

export function ExportarPDF({
  titulo,
  subtitulo,
  colunas,
  dados,
  orientacao = "landscape",
  nomeArquivo,
  grupos,
  campoGrupo = "grupo",
}: ExportarPDFProps) {
  const [aberto, setAberto] = useState(false);
  const [selecionadas, setSelecionadas] = useState<Set<string>>(
    () => new Set(colunas.filter((c) => c.padrao !== false).map((c) => c.key))
  );
  const [gruposSel, setGruposSel] = useState<Set<string>>(
    () => new Set((grupos ?? []).filter((g) => g.padrao !== false).map((g) => g.key))
  );

  const toggleColuna = useCallback((key: string) => {
    setSelecionadas((prev) => {
      const next = new Set(prev);
      if (next.has(key)) { if (next.size > 1) next.delete(key); }
      else next.add(key);
      return next;
    });
  }, []);

  const toggleGrupo = useCallback((key: string) => {
    setGruposSel((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const selecionarTodas       = () => setSelecionadas(new Set(colunas.map((c) => c.key)));
  const limparSelecao         = () => { const p = colunas[0]?.key; if (p) setSelecionadas(new Set([p])); };
  const selecionarTodosGrupos = () => setGruposSel(new Set((grupos ?? []).map((g) => g.key)));
  const limparGrupos          = () => setGruposSel(new Set());

  const dadosFiltrados =
    grupos && grupos.length > 0
      ? dados.filter((row) => {
          const g = row[campoGrupo];
          return typeof g === "string" && gruposSel.has(g);
        })
      : dados;

  // Aspect ratio real: 3508 × 2481
  const LOGO_RATIO = 3508 / 2481; // ≈ 1.414

  const gerarPDF = useCallback(async () => {
    const colsSel = colunas.filter((c) => selecionadas.has(c.key));
    if (colsSel.length === 0 || dadosFiltrados.length === 0) return;

    // Carrega logos em paralelo
    const [logoEscura, logoBranca] = await Promise.all([
      fetchImgDataUrl("/logo-se.png"),
      fetchImgDataUrl("/logo-se-white.png"),
    ]);

    const doc    = new jsPDF({ orientation: orientacao, unit: "mm", format: "a4" });
    const pageW  = doc.internal.pageSize.getWidth();
    const pageH  = doc.internal.pageSize.getHeight();
    const mH     = 14;
    const mBottom = 14;
    const tableW = pageW - mH * 2;

    // ── Helper fallback: logo "SE" desenhado manualmente ─────────────────────
    function logoSEFallback(x: number, y: number, sz: number, branco: boolean) {
      if (branco) {
        doc.setFillColor(255, 255, 255);
        doc.roundedRect(x, y, sz, sz, 1.5, 1.5, "F");
        doc.setTextColor(VERDE_R, VERDE_G, VERDE_B);
      } else {
        doc.setFillColor(VERDE_R, VERDE_G, VERDE_B);
        doc.roundedRect(x, y, sz, sz, 2, 2, "F");
        doc.setTextColor(255, 255, 255);
      }
      doc.setFontSize(sz * 0.54);
      doc.setFont("helvetica", "bold");
      doc.text("SE", x + sz / 2, y + sz * 0.68, { align: "center" });
    }

    // ── Cabeçalho ─────────────────────────────────────────────────────────────
    function drawHeader() {
      doc.setFillColor(VERDE_R, VERDE_G, VERDE_B);
      doc.rect(0, 0, pageW, 18, "F");

      // Logo branca no canto esquerdo da faixa verde
      const lhH = 12;                         // altura da logo no header
      const lhW = lhH * LOGO_RATIO;           // ≈ 17 mm
      if (logoBranca) {
        doc.addImage(logoBranca, "PNG", mH, 3, lhW, lhH, "logo-white", "FAST");
      } else {
        logoSEFallback(mH, 3, 12, true);
      }

      const txX = mH + lhW + 3;
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.text("SE Agropecuária Nelore de Elite", txX, 7.5);

      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.text(titulo, txX, 13.5);

      const agora   = new Date();
      const dataStr = agora.toLocaleDateString("pt-BR");
      const horaStr = agora.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
      doc.setFontSize(7.5);
      doc.text(`Gerado em ${dataStr} às ${horaStr}`, pageW - mH, 13.5, { align: "right" });
    }

    drawHeader();

    let startY = 14 + 12;
    if (subtitulo) {
      doc.setTextColor(80, 80, 80);
      doc.setFontSize(8);
      doc.setFont("helvetica", "italic");
      doc.text(subtitulo, mH, startY);
      startY += 5;
    }

    // ── Larguras ─────────────────────────────────────────────────────────────
    const totalPeso = colsSel.reduce((acc, c) => acc + (c.largura ?? 1), 0);
    const colWidths = colsSel.map((c) => Math.floor(((c.largura ?? 1) / totalPeso) * tableW));

    const head = [colsSel.map((c) => c.label)];
    const body = dadosFiltrados.map((row) => colsSel.map((c) => formatarCelula(row[c.key])));

    // ── Tabela ───────────────────────────────────────────────────────────────
    autoTable(doc, {
      head,
      body,
      startY,
      margin: { left: mH, right: mH, bottom: mBottom },
      tableWidth: tableW,
      columnStyles: Object.fromEntries(colWidths.map((w, i) => [i, { cellWidth: w }])),
      styles: {
        fontSize: 7.5,
        cellPadding: { top: 2.5, bottom: 2.5, left: 3, right: 3 },
        overflow: "linebreak",
        lineColor: [200, 230, 215],
        lineWidth: 0.2,
        font: "helvetica",
        textColor: [40, 40, 40],
        valign: "middle",
      },
      headStyles: {
        fillColor: [VERDE_R, VERDE_G, VERDE_B],
        textColor: [255, 255, 255],
        fontStyle: "bold",
        fontSize: 8,
        halign: "left",
      },
      alternateRowStyles: { fillColor: [VERDE_CLARO_R, VERDE_CLARO_G, VERDE_CLARO_B] },
      bodyStyles:         { fillColor: [255, 255, 255] },
      didDrawPage: () => {
        if ((doc as any).internal.getCurrentPageInfo().pageNumber > 1) {
          drawHeader();
        }
        const pageCount = (doc as any).internal.getNumberOfPages();
        const pageNum   = (doc as any).internal.getCurrentPageInfo().pageNumber;
        doc.setFontSize(7);
        doc.setTextColor(160, 160, 160);
        doc.setFont("helvetica", "normal");
        doc.text(`Página ${pageNum} de ${pageCount}`, pageW / 2, pageH - 5, { align: "center" });
        doc.setDrawColor(200, 225, 212);
        doc.setLineWidth(0.3);
        doc.line(mH, pageH - 8, pageW - mH, pageH - 8);
      },
    });

    // ── Rodapé final ─────────────────────────────────────────────────────────
    const finalY     = ((doc as any).lastAutoTable?.finalY ?? startY) as number;
    const lfH        = 20;                   // altura da logo no rodapé
    const lfW        = lfH * LOGO_RATIO;     // ≈ 28.3 mm
    const spaceNeeded = lfH + 14;

    let footerY: number;
    if (finalY + spaceNeeded > pageH - 16) {
      doc.addPage();
      drawHeader();
      footerY = 32;
    } else {
      footerY = finalY + 12;
    }

    // Linha separadora
    doc.setDrawColor(200, 210, 205);
    doc.setLineWidth(0.3);
    doc.line(pageW / 2 - 25, footerY, pageW / 2 + 25, footerY);
    footerY += 5;

    // Logo original (escura) centralizada
    if (logoEscura) {
      doc.addImage(logoEscura, "PNG", pageW / 2 - lfW / 2, footerY, lfW, lfH, "logo-dark", "FAST");
    } else {
      logoSEFallback(pageW / 2 - 7, footerY, 14, false);
      lfH; // keep reference
    }

    // "Criando tradição"
    doc.setFontSize(7.5);
    doc.setFont("helvetica", "italic");
    doc.setTextColor(160, 160, 160);
    doc.text("Criando tradição", pageW / 2, footerY + lfH + 5, { align: "center" });

    // ── Salva ─────────────────────────────────────────────────────────────────
    const agora   = new Date();
    const dataStr = agora.toLocaleDateString("pt-BR");
    const arquivo = nomeArquivo ?? `${titulo.replace(/\s+/g, "_")}_${dataStr.replace(/\//g, "-")}.pdf`;
    doc.save(arquivo);
    setAberto(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [colunas, dadosFiltrados, orientacao, selecionadas, titulo, subtitulo, nomeArquivo]);

  return (
    <>
      {/* ── Botão ─────────────────────────────────────────────────────────────── */}
      <button
        onClick={() => setAberto(true)}
        className="inline-flex items-center gap-1.5 text-sm border border-gray-200 px-3 py-2 rounded-lg hover:bg-gray-50 transition-colors text-gray-600 font-medium shrink-0"
        title="Exportar para PDF"
      >
        <FileDown className="w-4 h-4" />
        <span className="hidden sm:inline">Exportar PDF</span>
      </button>

      {/* ── Modal ─────────────────────────────────────────────────────────────── */}
      {aberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">

            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-gray-900 text-base">Exportar PDF</h3>
                <p className="text-xs text-gray-400 mt-0.5">{titulo}</p>
              </div>
              <button onClick={() => setAberto(false)} className="text-gray-400 hover:text-gray-600 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="px-6 py-4">
              {grupos && grupos.length > 0 && (
                <div className="mb-5">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      Selecione os grupos ({gruposSel.size}/{grupos.length})
                    </p>
                    <div className="flex gap-3">
                      <button onClick={selecionarTodosGrupos} className="text-xs text-brand-600 hover:underline">Todos</button>
                      <button onClick={limparGrupos} className="text-xs text-gray-400 hover:underline">Limpar</button>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    {grupos.map((g) => {
                      const ativa = gruposSel.has(g.key);
                      const total = dados.filter((r) => r[campoGrupo] === g.key).length;
                      return (
                        <button
                          key={g.key}
                          onClick={() => toggleGrupo(g.key)}
                          className={`flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg text-xs text-left transition-colors border ${
                            ativa ? "bg-brand-50 border-brand-200 text-brand-800 font-medium" : "bg-gray-50 border-gray-100 text-gray-500 hover:border-gray-200"
                          }`}
                        >
                          <span className="flex items-center gap-2">
                            {ativa ? <CheckSquare className="w-3.5 h-3.5 text-brand-600 shrink-0" /> : <Square className="w-3.5 h-3.5 text-gray-300 shrink-0" />}
                            {g.label}
                          </span>
                          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${ativa ? "bg-brand-100 text-brand-700" : "bg-gray-200 text-gray-500"}`}>
                            {total}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Selecione as colunas ({selecionadas.size}/{colunas.length})
                </p>
                <div className="flex gap-3">
                  <button onClick={selecionarTodas} className="text-xs text-brand-600 hover:underline">Todas</button>
                  <button onClick={limparSelecao} className="text-xs text-gray-400 hover:underline">Limpar</button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-1.5 max-h-64 overflow-y-auto pr-1">
                {colunas.map((col) => {
                  const ativa = selecionadas.has(col.key);
                  return (
                    <button
                      key={col.key}
                      onClick={() => toggleColuna(col.key)}
                      className={`flex items-center gap-2 px-3 py-2.5 rounded-lg text-xs text-left transition-colors border ${
                        ativa ? "bg-brand-50 border-brand-200 text-brand-800 font-medium" : "bg-gray-50 border-gray-100 text-gray-500 hover:border-gray-200"
                      }`}
                    >
                      {ativa ? <CheckSquare className="w-3.5 h-3.5 text-brand-600 shrink-0" /> : <Square className="w-3.5 h-3.5 text-gray-300 shrink-0" />}
                      {col.label}
                    </button>
                  );
                })}
              </div>

              <p className="text-[11px] text-gray-400 mt-3">
                {dadosFiltrados.length} {dadosFiltrados.length === 1 ? "registro" : "registros"}
                {grupos && grupos.length > 0 && dadosFiltrados.length !== dados.length && (
                  <span className="text-gray-300"> de {dados.length}</span>
                )}
                {" "}· Formato A4{" "}
                {orientacao === "landscape" ? "paisagem" : "retrato"}
              </p>
            </div>

            <div className="px-6 py-4 border-t border-gray-100 flex gap-3">
              <button
                onClick={() => setAberto(false)}
                className="flex-1 text-sm border border-gray-200 rounded-lg py-2.5 hover:bg-gray-50 text-gray-600 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={gerarPDF}
                disabled={selecionadas.size === 0 || dadosFiltrados.length === 0}
                style={{ backgroundColor: `rgb(${VERDE_R},${VERDE_G},${VERDE_B})` }}
                className="flex-1 inline-flex items-center justify-center gap-2 disabled:opacity-50 text-white text-sm font-medium py-2.5 rounded-lg transition-opacity"
              >
                <FileDown className="w-4 h-4" />
                Gerar PDF
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
