import { createClient } from "@/lib/supabase/server";
import { ordenarPesagens, ponderalDoHistorico } from "@/lib/ponderal";
import { FARM_ID } from "@/lib/utils";
import { ExportarPDF, type ColunaPDF, type GrupoPDF } from "@/components/ui/ExportarPDF";
import { FileText } from "lucide-react";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function idadeEmMeses(nascimento: string | null | undefined): number | null {
  if (!nascimento) return null;
  const inicio = new Date(nascimento);
  const hoje   = new Date();
  return (
    (hoje.getFullYear() - inicio.getFullYear()) * 12 +
    (hoje.getMonth() - inicio.getMonth())
  );
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "";
  return new Date(iso + "T12:00:00").toLocaleDateString("pt-BR");
}

type WeightRecord = { id: string; data: string; peso_kg: number };

const sortedWeights = ordenarPesagens<WeightRecord>;

// Cálculo canônico em @/lib/ponderal (desconta o peso de nascimento).
const calcPonderal = ponderalDoHistorico;

function classificacao(ponderal: number | null): string {
  if (ponderal === null) return "";
  if (ponderal >= 800) return "Excelente";
  if (ponderal >= 600) return "Bom";
  return "Abaixo";
}

const STATUS_UI: Record<string, string> = {
  COLETANDO: "Coletando", INSEMINADA: "Inseminada", GESTANTE: "Prenha",
  PARIDA: "Parida", ABORTOU: "Abortou", VAZIA: "Vazia", SECA: "Seca",
  DESCARTADA: "Descartada", VENDIDA: "Vendida",
  PRENHA_EMBRIAO: "Prenha (embrião)", MORTA: "Óbito",
  ATIVA: "Ativa", PRENHA_NATURAL: "Prenha (natural)",
  FALHADA: "Falhada",
};

const TIPO_LABEL: Record<string, string> = {
  DOADORA:   "Doadora",
  TOURO:     "Touro",
  RECEPTORA: "Receptora",
  DESCARTE:  "Descarte",
  NASCIDO:   "Nascido SE",
};

// ─── Colunas disponíveis ─────────────────────────────────────────────────────

const COLUNAS: ColunaPDF[] = [
  { key: "nome",           label: "Nome",          padrao: true,  largura: 2.5 },
  { key: "rgn_brinco",     label: "RGN / Brinco",  padrao: true,  largura: 1.1 },
  { key: "tipo_label",     label: "Tipo",          padrao: false, largura: 1.0 },
  { key: "nascimento_fmt", label: "Nascimento",    padrao: true,  largura: 1.4 },
  { key: "idade",          label: "Idade",         padrao: true,  largura: 0.7 },
  { key: "localizacao",    label: "Localização",   padrao: false, largura: 1.5 },
  { key: "status_label",   label: "Status",        padrao: true,  largura: 1.2 },
  { key: "peso_atual",     label: "Peso (kg)",     padrao: true,  largura: 0.9 },
  { key: "data_pesagem",   label: "Data Pesagem",  padrao: false, largura: 1.0 },
  { key: "ponderal",       label: "Ponderal",      padrao: true,  largura: 0.9 },
  { key: "classif",        label: "Classificação", padrao: false, largura: 1.0 },
  { key: "pai_nome",       label: "Pai",           padrao: true,  largura: 1.5 },
  { key: "mae_nome",       label: "Mãe",           padrao: true,  largura: 1.5 },
];

const GRUPOS: GrupoPDF[] = [
  { key: "DOADORA",   label: "Doadoras",   padrao: true  },
  { key: "TOURO",     label: "Machos",     padrao: true  },
  { key: "RECEPTORA", label: "Receptoras", padrao: false },
  { key: "DESCARTE",  label: "Descarte",   padrao: false },
];

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function RelatorioAnimaisPage() {
  const supabase = await createClient();

  const { data: animais } = await supabase
    .from("animals")
    .select(`
      id, nome, rgn, brinco, tipo, nascimento, localizacao,
      status_rebanho, nascido_se_agro, pai_nome, mae_nome,
      peso_nascimento,
      weight_records ( id, data, peso_kg )
    `)
    .eq("farm_id", FARM_ID)
    .order("nascimento", { ascending: false, nullsFirst: false })
    .order("nome");

  // ── Monta dados para o PDF ──────────────────────────────────────────────────
  const dados = (animais ?? []).map((a) => {
    const wrs     = (a.weight_records ?? []) as WeightRecord[];
    const sorted  = sortedWeights(wrs);
    const ultimo  = sorted[sorted.length - 1] ?? null;
    const pond    = calcPonderal(wrs, a.nascimento, a.peso_nascimento);
    const classif = classificacao(pond);
    const idade   = idadeEmMeses(a.nascimento);

    // Anotação automática de desfecho para a coluna de Observações
    const obs_auto =
      a.status_rebanho === "MORTA"   ? "Óbito"   :
      a.status_rebanho === "VENDIDA" ? "Vendida" : "";

    return {
      // campos usados como chave de grupo
      tipo: a.tipo as string,

      // pré-preenchimento da coluna de Observações
      obs_auto,

      // colunas
      nome:           a.nome ?? "—",
      rgn_brinco:     a.rgn ?? a.brinco ?? "—",
      tipo_label:     TIPO_LABEL[a.tipo as string] ?? a.tipo ?? "—",
      nascimento_fmt: fmtDate(a.nascimento),
      idade:          idade !== null ? `${idade}m` : "—",
      localizacao:    a.localizacao ?? "",
      status_label:   STATUS_UI[a.status_rebanho as string] ?? a.status_rebanho ?? "—",
      peso_atual:     ultimo ? `${ultimo.peso_kg.toFixed(1)} kg` : "—",
      data_pesagem:   ultimo ? fmtDate(ultimo.data) : "—",
      ponderal:       pond !== null ? `${pond} g/dia` : "—",
      classif,
      pai_nome:       a.pai_nome ?? "",
      mae_nome:       a.mae_nome ?? "",
    };
  });

  // ── Counts por tipo ─────────────────────────────────────────────────────────
  const nDoadoras   = dados.filter((d) => d.tipo === "DOADORA").length;
  const nMachos     = dados.filter((d) => d.tipo === "TOURO").length;
  const nReceptoras = dados.filter((d) => d.tipo === "RECEPTORA").length;
  const nDescarte   = dados.filter((d) => d.tipo === "DESCARTE").length;

  return (
    <div className="px-6 py-8 max-w-4xl mx-auto">
      {/* ── Cabeçalho ── */}
      <div className="flex flex-wrap items-start justify-between gap-4 mb-8">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand-100 flex items-center justify-center shrink-0">
            <FileText className="w-5 h-5 text-brand-700" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Relatório de Animais</h1>
            <p className="text-sm text-gray-400 mt-0.5">
              Selecione grupos, colunas e gere o PDF.
            </p>
          </div>
        </div>

        <ExportarPDF
          titulo="Relatório de Animais"
          subtitulo="SE Agropecuária Nelore de Elite"
          colunas={COLUNAS}
          dados={dados}
          orientacao="landscape"
          nomeArquivo="Relatorio_Animais.pdf"
          grupos={GRUPOS}
          campoGrupo="tipo"
          obsPreFillField="obs_auto"
          obsDefault={1}
        />
      </div>

      {/* ── Stats ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        {[
          { label: "Doadoras",   count: nDoadoras,   cls: "text-rose-600",   bg: "bg-rose-50"   },
          { label: "Machos",     count: nMachos,     cls: "text-blue-600",   bg: "bg-blue-50"   },
          { label: "Receptoras", count: nReceptoras, cls: "text-green-600",  bg: "bg-green-50"  },
          { label: "Descarte",   count: nDescarte,   cls: "text-gray-500",   bg: "bg-gray-50"   },
        ].map(({ label, count, cls, bg }) => (
          <div key={label} className={`card p-5 ${bg} border-0`}>
            <p className="text-xs font-medium text-gray-500 mb-1">{label}</p>
            <p className={`text-3xl font-bold ${cls}`}>{count}</p>
          </div>
        ))}
      </div>

      {/* ── Legenda de colunas ── */}
      <div className="card p-5">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-4">
          Colunas disponíveis
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {COLUNAS.map((col) => (
            <div key={col.key} className="flex items-center gap-2 text-xs text-gray-600">
              <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${col.padrao ? "bg-brand-500" : "bg-gray-300"}`} />
              <span>{col.label}</span>
              {col.padrao && (
                <span className="text-[9px] text-brand-400 font-medium">padrão</span>
              )}
            </div>
          ))}
          <div className="flex items-center gap-2 text-xs text-gray-600">
            <div className="w-1.5 h-1.5 rounded-full bg-gray-300 shrink-0" />
            <span>Observações</span>
            <span className="text-[9px] text-gray-400 font-medium">em branco</span>
          </div>
        </div>

        <div className="mt-4 pt-4 border-t border-gray-100">
          <p className="text-xs text-gray-400">
            Total de {dados.length} animais cadastrados ·{" "}
            Clique em <strong className="text-gray-600">Exportar PDF</strong> para configurar e baixar o relatório.
          </p>
        </div>
      </div>
    </div>
  );
}
