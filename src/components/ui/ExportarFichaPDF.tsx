"use client";

import { useCallback, useMemo, useState } from "react";
import { FileDown, X, CheckSquare, Square, Lock } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

/**
 * Ficha individual do animal em PDF, com seleção de seções.
 *
 * Diferente do `ExportarPDF`, que é orientado a tabela (colunas × linhas),
 * aqui o documento é um dossiê: blocos de informação em sequência. Serve
 * para enviar a assessoria de leilão, comprador ou associação.
 *
 * A seção Financeiro nasce DESMARCADA de propósito — custo de aquisição e
 * parcelas não devem sair por acidente num arquivo enviado a terceiros.
 */

// ─── Tipos ────────────────────────────────────────────────────────────────────

export type CampoFicha = { rotulo: string; valor: string | null | undefined };

export type SecaoFicha = {
  /** Identificador estável, usado para lembrar a seleção. */
  key: string;
  titulo: string;
  /** Pares rótulo/valor, renderizados em duas colunas. */
  campos?: CampoFicha[];
  /** Tabela opcional (ex.: histórico de pesagens, premiações). */
  tabela?: { colunas: string[]; linhas: (string | number | null)[][] };
  /** Texto corrido opcional. */
  texto?: string | null;
  /** Vem desmarcada por padrão. Use para dados sensíveis. */
  sensivel?: boolean;
  /** Marcada por padrão (default: true, salvo se `sensivel`). */
  padrao?: boolean;
};

export type ExportarFichaPDFProps = {
  /** Nome do animal — vira o título do documento. */
  nomeAnimal: string;
  /** Linha de identificação sob o título (RGN, tipo, idade…). */
  subtitulo?: string;
  /** URL da foto do animal, se houver. */
  fotoUrl?: string | null;
  secoes: SecaoFicha[];
  nomeArquivo?: string;
};

// ─── Paleta SE (mesma do ExportarPDF) ─────────────────────────────────────────

const VERDE: [number, number, number] = [115, 118, 125];
const CINZA_CLARO: [number, number, number] = [244, 244, 246];

async function fetchImgDataUrl(url: string): Promise<string | null> {
  try {
    const resp = await fetch(url);
    if (!resp.ok) return null;
    const blob = await resp.blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

function temConteudo(s: SecaoFicha): boolean {
  const campos = (s.campos ?? []).filter(c => c.valor != null && String(c.valor).trim() !== "" && c.valor !== "—");
  const linhas = s.tabela?.linhas ?? [];
  return campos.length > 0 || linhas.length > 0 || !!s.texto?.trim();
}

// ─── Componente ───────────────────────────────────────────────────────────────

export function ExportarFichaPDF({
  nomeAnimal, subtitulo, fotoUrl, secoes, nomeArquivo,
}: ExportarFichaPDFProps) {
  const [aberto, setAberto] = useState(false);
  const [gerando, setGerando] = useState(false);

  // Só oferece seções que têm algo dentro
  const disponiveis = useMemo(() => secoes.filter(temConteudo), [secoes]);

  const [sel, setSel] = useState<Set<string>>(
    () => new Set(
      secoes.filter(s => temConteudo(s) && !s.sensivel && s.padrao !== false).map(s => s.key)
    )
  );
  const [incluirFoto, setIncluirFoto] = useState(true);

  const alternar = useCallback((key: string) => {
    setSel(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }, []);

  const gerar = useCallback(async () => {
    const escolhidas = disponiveis.filter(s => sel.has(s.key));
    if (escolhidas.length === 0) return;

    setGerando(true);
    try {
      const [logoBranca, foto] = await Promise.all([
        fetchImgDataUrl("/logo-se-white.png"),
        incluirFoto && fotoUrl ? fetchImgDataUrl(fotoUrl) : Promise.resolve(null),
      ]);

      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const pageW = doc.internal.pageSize.getWidth();
      const pageH = doc.internal.pageSize.getHeight();
      const m = 16;
      const larguraUtil = pageW - m * 2;

      function cabecalho() {
        doc.setFillColor(...VERDE);
        doc.rect(0, 0, pageW, 18, "F");
        if (logoBranca) {
          const h = 16, w = h * (3508 / 2481);
          doc.addImage(logoBranca, "PNG", m, 1, w, h, "logo", "FAST");
          doc.setTextColor(255, 255, 255);
          doc.setFont("helvetica", "bold");
          doc.setFontSize(11);
          doc.text("SE Agropecuária Nelore de Elite", m + w + 4, 7.5);
          doc.setFont("helvetica", "normal");
          doc.setFontSize(9);
          doc.text("Ficha do Animal", m + w + 4, 13.5);
        } else {
          doc.setTextColor(255, 255, 255);
          doc.setFont("helvetica", "bold");
          doc.setFontSize(11);
          doc.text("SE Agropecuária Nelore de Elite", m, 11);
        }
        const agora = new Date();
        doc.setFontSize(7.5);
        doc.setFont("helvetica", "normal");
        doc.text(
          `Gerado em ${agora.toLocaleDateString("pt-BR")} às ${agora.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`,
          pageW - m, 13.5, { align: "right" }
        );
      }

      function rodape() {
        const total = doc.getNumberOfPages();
        for (let i = 1; i <= total; i++) {
          doc.setPage(i);
          doc.setTextColor(150, 150, 150);
          doc.setFontSize(7.5);
          doc.setFont("helvetica", "normal");
          doc.text(nomeAnimal, m, pageH - 8);
          doc.text(`${i} / ${total}`, pageW - m, pageH - 8, { align: "right" });
        }
      }

      cabecalho();

      // ── Identificação do animal ─────────────────────────────────────────
      let y = 28;
      const temFoto = !!foto;
      const larguraFoto = 34;
      const textoX = temFoto ? m + larguraFoto + 6 : m;

      if (temFoto) {
        try {
          doc.addImage(foto!, m, y, larguraFoto, larguraFoto, "foto", "FAST");
        } catch {
          /* formato não suportado — segue sem foto */
        }
      }

      doc.setTextColor(30, 30, 30);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(18);
      const nomeQuebrado = doc.splitTextToSize(nomeAnimal, pageW - textoX - m);
      doc.text(nomeQuebrado, textoX, y + 7);
      y += 7 + (nomeQuebrado.length - 1) * 7;

      if (subtitulo) {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9.5);
        doc.setTextColor(110, 110, 110);
        const subQuebrado = doc.splitTextToSize(subtitulo, pageW - textoX - m);
        doc.text(subQuebrado, textoX, y + 6);
        y += 6 + (subQuebrado.length - 1) * 5;
      }

      y = Math.max(y + 8, temFoto ? 28 + larguraFoto + 6 : y + 8);

      // ── Seções ──────────────────────────────────────────────────────────
      for (const secao of escolhidas) {
        const espacoNecessario = 24;
        if (y + espacoNecessario > pageH - 18) {
          doc.addPage();
          cabecalho();
          y = 28;
        }

        // Título da seção
        doc.setFillColor(...CINZA_CLARO);
        doc.rect(m, y, larguraUtil, 7, "F");
        doc.setTextColor(...VERDE);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        doc.text(secao.titulo.toUpperCase(), m + 2.5, y + 4.8);
        y += 11;

        // Campos em duas colunas
        const campos = (secao.campos ?? []).filter(
          c => c.valor != null && String(c.valor).trim() !== "" && c.valor !== "—"
        );
        if (campos.length > 0) {
          const colW = larguraUtil / 2;
          for (let i = 0; i < campos.length; i += 2) {
            if (y + 9 > pageH - 18) { doc.addPage(); cabecalho(); y = 28; }
            for (const [j, campo] of [campos[i], campos[i + 1]].entries()) {
              if (!campo) continue;
              const x = m + j * colW;
              doc.setFont("helvetica", "normal");
              doc.setFontSize(7);
              doc.setTextColor(140, 140, 140);
              doc.text(campo.rotulo.toUpperCase(), x, y);
              doc.setFont("helvetica", "bold");
              doc.setFontSize(9.5);
              doc.setTextColor(40, 40, 40);
              const v = doc.splitTextToSize(String(campo.valor), colW - 4);
              doc.text(v[0] ?? "", x, y + 4.6);
            }
            y += 10;
          }
          y += 1;
        }

        // Texto corrido
        if (secao.texto?.trim()) {
          if (y + 12 > pageH - 18) { doc.addPage(); cabecalho(); y = 28; }
          doc.setFont("helvetica", "normal");
          doc.setFontSize(9);
          doc.setTextColor(60, 60, 60);
          const linhas = doc.splitTextToSize(secao.texto.trim(), larguraUtil);
          doc.text(linhas, m, y);
          y += linhas.length * 4.6 + 3;
        }

        // Tabela
        if (secao.tabela && secao.tabela.linhas.length > 0) {
          autoTable(doc, {
            startY: y,
            head: [secao.tabela.colunas],
            body: secao.tabela.linhas.map(l => l.map(c => (c == null ? "—" : String(c)))),
            margin: { left: m, right: m },
            theme: "grid",
            styles: { fontSize: 8, cellPadding: 1.8, textColor: [50, 50, 50], lineColor: [225, 225, 228] },
            headStyles: { fillColor: VERDE, textColor: [255, 255, 255], fontSize: 8, fontStyle: "bold" },
            alternateRowStyles: { fillColor: [250, 250, 251] },
            didDrawPage: () => { /* cabeçalho já desenhado manualmente */ },
          });
          y = (doc as any).lastAutoTable.finalY + 6;
        }

        y += 2;
      }

      rodape();

      const arquivo = nomeArquivo
        ?? `Ficha_${nomeAnimal.replace(/[^\p{L}\p{N}]+/gu, "_").replace(/^_|_$/g, "")}.pdf`;
      doc.save(arquivo);
      setAberto(false);
    } finally {
      setGerando(false);
    }
  }, [disponiveis, sel, incluirFoto, fotoUrl, nomeAnimal, subtitulo, nomeArquivo]);

  const temSensivelMarcada = disponiveis.some(s => s.sensivel && sel.has(s.key));

  return (
    <>
      <button
        onClick={() => setAberto(true)}
        className="inline-flex items-center gap-1.5 text-sm border border-gray-200 px-3 py-2 rounded-lg hover:bg-gray-50 transition-colors text-gray-600"
      >
        <FileDown className="w-4 h-4" /> Exportar Ficha
      </button>

      {aberto && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg my-6">
            <div className="flex items-center gap-2 px-5 py-4 border-b border-gray-100">
              <FileDown className="w-4 h-4 text-brand-600 shrink-0" />
              <div className="min-w-0">
                <h2 className="font-semibold text-gray-900 text-sm truncate">Exportar ficha</h2>
                <p className="text-[11px] text-gray-400 truncate">{nomeAnimal}</p>
              </div>
              <button
                onClick={() => setAberto(false)}
                className="ml-auto p-1 rounded-lg text-gray-400 hover:bg-gray-100 shrink-0"
                aria-label="Fechar"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 max-h-[60vh] overflow-y-auto">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Seções ({sel.size}/{disponiveis.length})
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => setSel(new Set(disponiveis.map(s => s.key)))}
                    className="text-xs text-brand-600 hover:underline"
                  >
                    Todas
                  </button>
                  <button
                    onClick={() => setSel(new Set())}
                    className="text-xs text-gray-400 hover:underline"
                  >
                    Limpar
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                {fotoUrl && (
                  <button
                    onClick={() => setIncluirFoto(v => !v)}
                    className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-xs text-left transition-colors border ${
                      incluirFoto
                        ? "bg-brand-50 border-brand-200 text-brand-800 font-medium"
                        : "bg-gray-50 border-gray-100 text-gray-500 hover:border-gray-200"
                    }`}
                  >
                    {incluirFoto
                      ? <CheckSquare className="w-3.5 h-3.5 text-brand-600 shrink-0" />
                      : <Square className="w-3.5 h-3.5 text-gray-300 shrink-0" />}
                    Foto do animal
                  </button>
                )}

                {disponiveis.map(s => {
                  const ativa = sel.has(s.key);
                  return (
                    <button
                      key={s.key}
                      onClick={() => alternar(s.key)}
                      className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-xs text-left transition-colors border ${
                        ativa
                          ? s.sensivel
                            ? "bg-amber-50 border-amber-300 text-amber-800 font-medium"
                            : "bg-brand-50 border-brand-200 text-brand-800 font-medium"
                          : "bg-gray-50 border-gray-100 text-gray-500 hover:border-gray-200"
                      }`}
                    >
                      {ativa
                        ? <CheckSquare className={`w-3.5 h-3.5 shrink-0 ${s.sensivel ? "text-amber-600" : "text-brand-600"}`} />
                        : <Square className="w-3.5 h-3.5 text-gray-300 shrink-0" />}
                      {s.titulo}
                      {s.sensivel && (
                        <span className="ml-auto inline-flex items-center gap-1 text-[9px] text-amber-600 shrink-0">
                          <Lock className="w-2.5 h-2.5" /> interno
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {temSensivelMarcada && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-[11px] text-amber-800 leading-relaxed">
                  Você marcou uma seção de uso interno. Valores de compra, parcelas e
                  participação vão aparecer no arquivo — confira antes de enviar a
                  assessoria ou comprador.
                </div>
              )}
            </div>

            <div className="px-5 py-4 border-t border-gray-100 flex gap-3">
              <button
                onClick={() => setAberto(false)}
                className="flex-1 text-sm border border-gray-200 rounded-lg py-2.5 hover:bg-gray-50 text-gray-600 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={gerar}
                disabled={sel.size === 0 || gerando}
                className="flex-1 text-sm bg-brand-600 hover:bg-brand-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg py-2.5 font-medium transition-colors"
              >
                {gerando ? "Gerando…" : "Gerar PDF"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
