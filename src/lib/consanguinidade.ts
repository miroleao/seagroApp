/**
 * SE Agropecuária Nelore de Elite
 * Módulo: Cálculo de Consanguinidade (Coeficiente de Endogamia de Wright)
 *
 * Hierarquia:
 *  1. calcularConsanguinidade()     — função principal, chama RPC do Supabase
 *  2. detectarConsanguinidadeTexto()— fallback por nome quando FK faltam
 *  3. formatarLabel()               — gera o texto "Consanguinidade de X% do [Nome]"
 */

import { createClient } from "@/lib/supabase/server";

// ─────────────────────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────────────────────

export type NivelConsanguinidade = "ZERO" | "BAIXO" | "MODERADO" | "ALTO";

export interface AncestralComum {
  id: string;
  nome: string;
  /** Profundidade no lado paterno (geração) */
  n1: number;
  /** Profundidade no lado materno (geração) */
  n2: number;
  /** Contribuição individual para F (decimal) */
  contribuicao: number;
  /** Contribuição individual para F (%) */
  percentual_contribuicao: number;
}

export interface ResultadoConsanguinidade {
  /** A função pôde calcular com base em FKs? */
  calculavel: boolean;
  /** Coeficiente de endogamia F (decimal, ex: 0.0625) */
  coeficiente: number;
  /** F em percentual (ex: 6.25) */
  percentual: number;
  /** Classificação do nível */
  nivel: NivelConsanguinidade;
  /** Ancestrais comuns encontrados, ordenados por maior contribuição */
  ancestraisComuns: AncestralComum[];
  /**
   * Texto para exibir na ficha, ex:
   *   "Consanguinidade de 6,25% — Ancestral: Brado S. Marina"
   */
  label: string;
  /**
   * true quando o cálculo é apenas por similaridade de nome (sem FK)
   * — confiança menor, exibe como aviso, não como dado exato
   */
  modoFallback: boolean;
}

// ─────────────────────────────────────────────────────────
// Animal com campos de genealogia (subset do tipo Animal completo)
// ─────────────────────────────────────────────────────────

interface AnimalGenealogia {
  id: string;
  nome: string;
  pai_id?: string | null;
  pai_nome?: string | null;
  mae_id?: string | null;
  mae_nome?: string | null;
  avo_materno?: string | null;
  avo_materna?: string | null;
  bisavo?: string | null;
}

// ─────────────────────────────────────────────────────────
// Constantes de classificação
// ─────────────────────────────────────────────────────────

const LIMITES: Record<NivelConsanguinidade, number> = {
  ZERO:     0,
  BAIXO:    0.015625, // 1,5625% — equivale a primo de 3° grau
  MODERADO: 0.0625,   // 6,25%   — equivale a meio-irmão × meio-irmã
  ALTO:     Infinity,
};

function classificarNivel(coeficiente: number): NivelConsanguinidade {
  if (coeficiente <= 0)                      return "ZERO";
  if (coeficiente < LIMITES.BAIXO)           return "BAIXO";
  if (coeficiente < LIMITES.MODERADO)        return "MODERADO";
  return "ALTO";
}

// ─────────────────────────────────────────────────────────
// Formatação do label exibido na ficha
// ─────────────────────────────────────────────────────────

function formatarPercentual(valor: number): string {
  // Ex: 6.25 → "6,25%"  |  0.39 → "0,39%"
  return valor
    .toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 4 })
    .replace(/,?0+$/, "") + "%";
}

function formatarLabel(resultado: Omit<ResultadoConsanguinidade, "label">): string {
  if (!resultado.calculavel && !resultado.modoFallback) {
    return "Pedigree incompleto — consanguinidade não calculável";
  }

  if (resultado.percentual === 0 && resultado.ancestraisComuns.length === 0) {
    return "Sem consanguinidade detectada no pedigree cadastrado";
  }

  const principal = resultado.ancestraisComuns[0];
  const pct       = formatarPercentual(resultado.percentual);
  const prefixo   = resultado.modoFallback ? "⚠️ Possível consanguinidade" : "Consanguinidade";
  const sufixo    = principal ? ` — Ancestral: ${principal.nome}` : "";

  return `${prefixo} de ${pct}${sufixo}`;
}

// ─────────────────────────────────────────────────────────
// Fallback: comparação por nome quando não há FK
// ─────────────────────────────────────────────────────────

/**
 * Quando pai e/ou mãe não estão cadastrados por FK, tenta detectar
 * ancestrais comuns comparando os campos de texto da genealogia.
 * Retorna uma estimativa conservadora (não calcula F preciso).
 */
function detectarConsanguinidadeTexto(
  animal: AnimalGenealogia
): ResultadoConsanguinidade {
  // Coleta todos os nomes de ancestrais de cada lado
  const ladoPaterno: string[] = [
    animal.pai_nome,
  ].filter(Boolean) as string[];

  const ladoMaterno: string[] = [
    animal.mae_nome,
    animal.avo_materno,
    animal.avo_materna,
    animal.bisavo,
  ].filter(Boolean) as string[];

  // Normaliza (lowercase, sem acentos) para comparação
  const normalizar = (s: string) =>
    s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();

  const nomesPaternos = new Set(ladoPaterno.map(normalizar));
  const nomesMaternos = ladoMaterno.map(normalizar);

  const encontrados = nomesMaternos.filter((n) => nomesPaternos.has(n));

  if (encontrados.length === 0) {
    return {
      calculavel:      false,
      modoFallback:    true,
      coeficiente:     0,
      percentual:      0,
      nivel:           "ZERO",
      ancestraisComuns: [],
      label:           "Sem consanguinidade detectada nos nomes do pedigree",
    };
  }

  // Gera "ancestrais" sintéticos para exibição (sem F calculado)
  const ancestraisComuns: AncestralComum[] = encontrados.map((nome) => ({
    id:   "",
    nome: ladoMaterno.find((n) => normalizar(n) === nome) ?? nome,
    n1:   0,
    n2:   0,
    contribuicao:             0,
    percentual_contribuicao:  0,
  }));

  const label =
    `⚠️ Possível consanguinidade — Ancestral em comum: ${ancestraisComuns.map((a) => a.nome).join(", ")}` +
    " (confirme cadastrando os ancestrais por FK para cálculo exato)";

  return {
    calculavel:       false,
    modoFallback:     true,
    coeficiente:      0,
    percentual:       0,
    nivel:            "BAIXO",  // conservador — não sabemos o grau real
    ancestraisComuns,
    label,
  };
}

// ─────────────────────────────────────────────────────────
// Função principal
// ─────────────────────────────────────────────────────────

/**
 * Calcula (ou estima) o Coeficiente de Endogamia de um animal.
 *
 * Ordem de tentativas:
 *  1. RPC `calcular_consanguinidade` via Supabase (FK-based, preciso)
 *  2. Fallback por comparação de nome nos campos de texto da genealogia
 */
export async function calcularConsanguinidade(
  animalId: string
): Promise<ResultadoConsanguinidade> {
  const supabase = await createClient();

  // ── Tenta cálculo via RPC (requer pai_id e mae_id como FK) ──
  const { data: rpcData, error: rpcError } = await supabase.rpc(
    "calcular_consanguinidade",
    { p_animal_id: animalId }
  );

  if (!rpcError && rpcData) {
    const raw = rpcData as {
      calculavel:  boolean;
      coeficiente: number;
      percentual:  number;
      nivel:       NivelConsanguinidade;
      ancestrais:  AncestralComum[];
    };

    const ancestraisComuns = (raw.ancestrais ?? []).map((a) => ({
      ...a,
      contribuicao:            Number(a.contribuicao),
      percentual_contribuicao: Number(a.percentual_contribuicao),
    }));

    const parcial = {
      calculavel:   raw.calculavel,
      modoFallback: false,
      coeficiente:  Number(raw.coeficiente),
      percentual:   Number(raw.percentual),
      nivel:        raw.calculavel
                      ? classificarNivel(Number(raw.coeficiente))
                      : "ZERO" as NivelConsanguinidade,
      ancestraisComuns,
    };

    // Se calculável mas coeficiente = 0, ainda retorna resultado limpo
    if (raw.calculavel) {
      return { ...parcial, label: formatarLabel(parcial) };
    }

    // FK insuficiente → tenta fallback por nome
  }

  // ── Fallback: busca o animal e compara nomes ──
  const { data: animal } = await supabase
    .from("animals")
    .select("id, nome, pai_id, pai_nome, mae_id, mae_nome, avo_materno, avo_materna, bisavo")
    .eq("id", animalId)
    .single();

  if (!animal) {
    return {
      calculavel:       false,
      modoFallback:     false,
      coeficiente:      0,
      percentual:       0,
      nivel:            "ZERO",
      ancestraisComuns: [],
      label:            "Animal não encontrado",
    };
  }

  return detectarConsanguinidadeTexto(animal as AnimalGenealogia);
}

// ─────────────────────────────────────────────────────────
// Helper: cor do badge por nível (para uso em Tailwind)
// ─────────────────────────────────────────────────────────

export const CORES_NIVEL: Record<NivelConsanguinidade, {
  bg: string; text: string; border: string; icon: string;
}> = {
  ZERO:     { bg: "bg-gray-50",   text: "text-gray-500",  border: "border-gray-200", icon: "✓" },
  BAIXO:    { bg: "bg-blue-50",   text: "text-blue-700",  border: "border-blue-200", icon: "ℹ" },
  MODERADO: { bg: "bg-amber-50",  text: "text-amber-700", border: "border-amber-300", icon: "⚠" },
  ALTO:     { bg: "bg-red-50",    text: "text-red-700",   border: "border-red-300",   icon: "⛔" },
};

export const DESCRICAO_NIVEL: Record<NivelConsanguinidade, string> = {
  ZERO:     "Sem consanguinidade detectada",
  BAIXO:    "Consanguinidade baixa (< 1,56%)",
  MODERADO: "Consanguinidade moderada (1,56% – 6,25%)",
  ALTO:     "Consanguinidade alta (≥ 6,25%) — revisar cruzamento",
};
