"use client";

import { useState, useCallback } from "react";
import { FileDown, X, CheckSquare, Square } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

// ─── Tipos ────────────────────────────────────────────────────────────────────

export interface ColunaPDF {
  key: string;
  label: string;
  padrao?: boolean; // true = marcada por padrão
  largura?: number; // largura relativa (pontos jsPDF)
}

export interface ExportarPDFProps {
  titulo: string;
  subtitulo?: string;
  colunas: ColunaPDF[];
  dados: Record<string, unknown>[];
  orientacao?: "portrait" | "landscape";
  nomeArquivo?: string;
}

// ─── Labels de status ─────────────────────────────────────────────────────────

const STATUS_LABELS: Record<string, string> = {
  // Doadoras
  COLETANDO: "Coletando",
  INSEMINADA: "Inseminada",
  GESTANTE: "Gestante",
  PARIDA: "Parida",
  ABORTOU: "Abortou",
  VAZIA: "Vazia",
  SECA: "Seca",
  DESCARTADA: "Descartada",
  VENDIDA: "Vendida",
  // Rebanho
  PROTOCOLADA: "Protocolada",
  IMPLANTADA: "Implantada c/ Embrião",
  PRENHA: "Prenha",
  PRENHA_EMBRIAO: "Prenha de Embrião",
  MORTA: "Óbito",
  DESCARTE: "Descarte",
  // Machos
  APTO: "Apto",
  INAPTO: "Inapto",
  PENDENTE: "Pendente",
  // Embriões
  DISPONIVEL: "Disponível",
  IMPLANTADO: "Implantado",
  DESCARTADO: "Descartado",
  NAO_SEXADO: "Não Sexado",
  MACHO: "Macho",
  FEMEA: "Fêmea",
  // Classificação
  RECEPTORA: "Receptora",
  RECRIA: "Recria",
  OUTRO: "Outro",
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
}: ExportarPDFProps) {
  const [aberto, setAberto] = useState(false);
  const [selecionadas, setSelecionadas] = useState<Set<string>>(
    () => new Set(colunas.filter((c) => c.padrao !== false).map((c) => c.key))
  );

  const toggleColuna = useCallback((key: string) => {
    setSelecionadas((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        if (next.size > 1) next.delete(key); // sempre manter ao menos 1
      } else {
        next.add(key);
      }
      return next;
    });
  }, []);

  const selecionarTodas = () =>
    setSelecionadas(new Set(colunas.map((c) => c.key)));

  const limparSelecao = () => {
    const primeira = colunas[0]?.key;
    if (primeira) setSelecionadas(new Set([primeira]));
  };

  const gerarPDF = useCallback(() => {
    const colsSel = colunas.filter((c) => selecionadas.has(c.key));
    if (colsSel.length === 0) return;

    const doc = new jsPDF({ orientation: orientacao, unit: "mm", format: "a4" });

    // ── Dimensões A4 ──────────────────────────────────────────────────────────
    const pageW = doc.internal.pageSize.getWidth();
    const marginH = 14; // margem horizontal
    const marginTop = 14;
    const marginBottom = 12;
    const tableWidth = pageW - marginH * 2;

    // ── Cabeçalho ─────────────────────────────────────────────────────────────
    // Linha de fundo verde
    doc.setFillColor(22, 101, 52); // verde escuro
    doc.rect(0, 0, pageW, 18, "F");

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text("SE Agropecuária Nelore de Elite", marginH, 7.5);

    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text(titulo, marginH, 13.5);

    // Data de geração (canto direito)
    const agora = new Date();
    const dataStr = agora.toLocaleDateString("pt-BR");
    const horaStr = agora.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    doc.setFontSize(7.5);
    doc.text(`Gerado em ${dataStr} às ${horaStr}`, pageW - marginH, 13.5, { align: "right" });

    // Subtítulo (se houver)
    let startY = marginTop + 12;
    if (subtitulo) {
      doc.setTextColor(80, 80, 80);
      doc.setFontSize(8);
      doc.setFont("helvetica", "italic");
      doc.text(subtitulo, marginH, startY);
      startY += 5;
    }

    // ── Larguras das colunas ──────────────────────────────────────────────────
    // Distribui proporcionalmente dentro da largura disponível
    const totalPeso = colsSel.reduce((acc, c) => acc + (c.largura ?? 1), 0);
    const colWidths = colsSel.map((c) =>
      Math.floor(((c.largura ?? 1) / totalPeso) * tableWidth)
    );

    // ── Dados da tabela ───────────────────────────────────────────────────────
    const head = [colsSel.map((c) => c.label)];
    const body = dados.map((row) =>
      colsSel.map((c) => formatarCelula(row[c.key]))
    );

    // ── autoTable ─────────────────────────────────────────────────────────────
    autoTable(doc, {
      head,
      body,
      startY,
      margin: { left: marginH, right: marginH, bottom: marginBottom },
      tableWidth,
      columnStyles: Object.fromEntries(
        colWidths.map((w, i) => [i, { cellWidth: w }])
      ),
      styles: {
        fontSize: 7.5,
        cellPadding: { top: 2.5, bottom: 2.5, left: 3, right: 3 },
        overflow: "linebreak",
        lineColor: [220, 220, 220],
        lineWidth: 0.2,
        font: "helvetica",
        textColor: [40, 40, 40],
        valign: "middle",
      },
      headStyles: {
        fillColor: [22, 101, 52],
        textColor: [255, 255, 255],
        fontStyle: "bold",
        fontSize: 8,
        halign: "left",
      },
      alternateRowStyles: {
        fillColor: [245, 250, 246],
      },
      bodyStyles: {
        fillColor: [255, 255, 255],
      },
      // Rodapé com nº de página
      didDrawPage: (data) => {
        const pageCount = (doc as any).internal.getNumberOfPages();
        const pageNum = (doc as any).internal.getCurrentPageInfo().pageNumber;
        doc.setFontSize(7);
        doc.setTextColor(160, 160, 160);
        doc.setFont("helvetica", "normal");
        doc.text(
          `Página ${pageNum} de ${pageCount}`,
          pageW / 2,
          doc.internal.pageSize.getHeight() - 5,
          { align: "center" }
        );
        // Linha separadora no rodapé
        doc.setDrawColor(200, 200, 200);
        doc.setLineWidth(0.3);
        doc.line(
          marginH,
          doc.internal.pageSize.getHeight() - 8,
          pageW - marginH,
          doc.internal.pageSize.getHeight() - 8
        );
      },
    });

    const arquivo = nomeArquivo ?? `${titulo.replace(/\s+/g, "_")}_${dataStr.replace(/\//g, "-")}.pdf`;
    doc.save(arquivo);
    setAberto(false);
  }, [colunas, dados, orientacao, selecionadas, titulo, subtitulo, nomeArquivo]);

  return (
    <>
      {/* ── Botão ────────────────────────────────────────────────────────────── */}
      <button
        onClick={() => setAberto(true)}
        className="inline-flex items-center gap-1.5 text-sm border border-gray-200 px-3 py-2 rounded-lg hover:bg-gray-50 transition-colors text-gray-600 font-medium shrink-0"
        title="Exportar para PDF"
      >
        <FileDown className="w-4 h-4" />
        <span className="hidden sm:inline">Exportar PDF</span>
      </button>

      {/* ── Modal ────────────────────────────────────────────────────────────── */}
      {aberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            {/* Header */}
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-gray-900 text-base">Exportar PDF</h3>
                <p className="text-xs text-gray-400 mt-0.5">{titulo}</p>
              </div>
              <button
                onClick={() => setAberto(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Corpo */}
            <div className="px-6 py-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Selecione as colunas ({selecionadas.size}/{colunas.length})
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={selecionarTodas}
                    className="text-xs text-brand-600 hover:underline"
                  >
                    Todas
                  </button>
                  <button
                    onClick={limparSelecao}
                    className="text-xs text-gray-400 hover:underline"
                  >
                    Limpar
                  </button>
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
                        ativa
                          ? "bg-brand-50 border-brand-200 text-brand-800 font-medium"
                          : "bg-gray-50 border-gray-100 text-gray-500 hover:border-gray-200"
                      }`}
                    >
                      {ativa ? (
                        <CheckSquare className="w-3.5 h-3.5 text-brand-600 shrink-0" />
                      ) : (
                        <Square className="w-3.5 h-3.5 text-gray-300 shrink-0" />
                      )}
                      {col.label}
                    </button>
                  );
                })}
              </div>

              <p className="text-[11px] text-gray-400 mt-3">
                {dados.length} {dados.length === 1 ? "registro" : "registros"} · Formato A4{" "}
                {orientacao === "landscape" ? "paisagem" : "retrato"}
              </p>
            </div>

            {/* Rodapé */}
            <div className="px-6 py-4 border-t border-gray-100 flex gap-3">
              <button
                onClick={() => setAberto(false)}
                className="flex-1 text-sm border border-gray-200 rounded-lg py-2.5 hover:bg-gray-50 text-gray-600 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={gerarPDF}
                disabled={selecionadas.size === 0}
                className="flex-1 inline-flex items-center justify-center gap-2 bg-green-700 hover:bg-green-800 disabled:opacity-50 text-white text-sm font-medium py-2.5 rounded-lg transition-colors"
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
