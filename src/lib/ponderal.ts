/**
 * Cálculo de ganho ponderal — fonte única da verdade.
 *
 * REGRA (CLAUDE.md, seção 8):
 *   ponderal = (peso_atual - peso_nascimento) / dias_desde_nascimento × 1000
 *
 * Antes deste módulo, cinco páginas calculavam por conta própria e nenhuma
 * descontava o peso de nascimento — usavam `peso_atual × 1000 / dias`, o que
 * inflava o resultado em ~90–100 g/dia e podia promover animais de "Bom"
 * para "Excelente" na faixa de fronteira.
 */

/** Peso ao nascer assumido quando o animal não tem o valor cadastrado (kg). */
export const PESO_NASCIMENTO_PADRAO = 30;

export type RegistroPeso = { data: string; peso_kg: number };

function diasEntre(inicioISO: string, fimISO: string): number | null {
  const ini = new Date(inicioISO + "T12:00:00");
  const fim = new Date(fimISO    + "T12:00:00");
  if (isNaN(ini.getTime()) || isNaN(fim.getTime())) return null;
  const dias = (fim.getTime() - ini.getTime()) / 86_400_000;
  return dias > 0 ? dias : null;
}

/** Ordena pesagens da mais antiga para a mais recente. */
export function ordenarPesagens<T extends RegistroPeso>(records: T[]): T[] {
  return [...records].sort((a, b) => a.data.localeCompare(b.data));
}

/**
 * Ganho ponderal de uma pesagem isolada, referenciado ao nascimento.
 *
 * @param pesoKg          peso aferido
 * @param nascimento      data de nascimento (ISO) — sem ela não há cálculo
 * @param dataPesagem     data da aferição (ISO)
 * @param pesoNascimento  peso ao nascer; `null`/`undefined` usa o padrão de 30 kg
 */
export function ponderalGDia(
  pesoKg: number,
  nascimento: string | null | undefined,
  dataPesagem: string,
  pesoNascimento?: number | null,
): number | null {
  if (!nascimento) return null;
  const dias = diasEntre(nascimento, dataPesagem);
  if (dias == null) return null;

  const pesoNasc = pesoNascimento ?? PESO_NASCIMENTO_PADRAO;
  const ganho    = pesoKg - pesoNasc;
  if (ganho <= 0) return null;   // peso abaixo do de nascimento: dado inconsistente

  return (ganho / dias) * 1000;
}

/**
 * Ganho ponderal a partir do histórico completo de um animal.
 *
 * Com data de nascimento  → usa a pesagem mais recente contra o nascimento.
 * Sem data de nascimento  → cai para o ganho entre a primeira e a última
 *                           pesagem (exige 2+ registros).
 */
export function ponderalDoHistorico(
  records: RegistroPeso[],
  nascimento: string | null | undefined,
  pesoNascimento?: number | null,
): number | null {
  const sorted = ordenarPesagens(records);
  if (sorted.length === 0) return null;

  const ultimo = sorted[sorted.length - 1];

  if (nascimento) {
    const g = ponderalGDia(ultimo.peso_kg, nascimento, ultimo.data, pesoNascimento);
    return g == null ? null : Math.round(g);
  }

  if (sorted.length < 2) return null;
  const primeiro = sorted[0];
  const dias = diasEntre(primeiro.data, ultimo.data);
  if (dias == null) return null;
  return Math.round(((ultimo.peso_kg - primeiro.peso_kg) / dias) * 1000);
}

/** Classificação Nelore por g/dia (CLAUDE.md, seção 8). */
export function classificarPonderalSimples(ponderal: number | null) {
  if (ponderal === null) return null;
  if (ponderal >= 800) return { label: "Excelente", cls: "bg-green-100 text-green-700" };
  if (ponderal >= 600) return { label: "Bom",       cls: "bg-blue-100 text-blue-700"  };
  return                      { label: "Abaixo",    cls: "bg-red-100 text-red-600"    };
}
