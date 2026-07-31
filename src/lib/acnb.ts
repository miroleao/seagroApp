/**
 * Tabelas oficiais de peso para Nelore — Regulamento ExpZebu 2026 (ABCZ)
 * Fonte: Regulamento Expozebu 2026, págs. 31 e 37.
 *
 * PESOS MÍNIMOS: por mês completo, sexo.
 * PESOS MÁXIMOS: por mês + dia, sexo (tabela de 30 dias × meses 6–20).
 *   Para animais com mais de 20 meses não há peso máximo na tabela — apenas mínimo.
 */

// ─── Mínimos por mês (mês = número inteiro de meses completos) ────────────────

const PESO_MIN_F: Record<number, number> = {
   6: 240,  7: 270,  8: 300,  9: 330, 10: 360,
  11: 390, 12: 420, 13: 450, 14: 470, 15: 490,
  16: 510, 17: 530, 18: 550, 19: 570, 20: 590,
  21: 610, 22: 630, 23: 650, 24: 670, 25: 690,
  26: 700, 27: 710, 28: 720, 29: 730, 30: 735,
  31: 740, 32: 745, 33: 750, 34: 755, 35: 760,
  36: 765, 37: 770, 38: 775, 39: 780, 40: 785,
  41: 790, 42: 795,
};

const PESO_MIN_M: Record<number, number> = {
   6: 250,  7: 290,  8: 330,  9: 370, 10: 410,
  11: 440, 12: 470, 13: 500, 14: 530, 15: 560,
  16: 590, 17: 620, 18: 650, 19: 680, 20: 710,
  21: 730, 22: 750, 23: 770, 24: 790, 25: 810,
  26: 830, 27: 850, 28: 870, 29: 890, 30: 910,
};

// ─── Máximos por mês (6–20) e dia (0–29) ─────────────────────────────────────
// Índice: [mês - 6][dia]   ·   meses 6..20   ·   dias 0..29

const PESO_MAX_F: number[][] = [
  // mês 6
  [301,302,304,305,306,308,309,311,312,313,315,316,318,319,321,322,323,325,326,328,329,330,332,333,335,336,337,339,340,342],
  // mês 7
  [343,344,346,347,349,350,351,353,354,356,357,358,360,361,362,364,365,367,368,369,371,372,373,375,376,378,379,380,382,383],
  // mês 8
  [384,386,387,388,390,391,393,394,395,397,398,399,401,402,403,405,406,407,409,410,412,413,414,416,417,418,420,421,422,424],
  // mês 9
  [425,426,428,429,430,432,433,434,436,437,438,440,441,442,443,445,446,447,449,450,451,453,454,455,457,458,459,461,462,463],
  // mês 10
  [465,466,467,468,470,471,472,474,475,476,478,479,480,481,483,484,485,487,488,490,490,492,493,494,496,497,499,499,501,502],
  // mês 11
  [503,504,506,507,508,510,511,512,513,515,516,517,518,520,521,522,523,525,526,527,529,530,531,532,534,535,536,537,539,540],
  // mês 12
  [541,542,543,545,546,547,548,550,551,552,553,555,556,557,558,560,561,562,563,566,566,567,568,569,571,572,573,574,575,577],
  // mês 13
  [578,579,580,582,583,584,585,586,588,589,590,591,592,594,595,596,597,598,600,601,602,603,604,606,607,608,609,610,612,613],
  // mês 14
  [614,615,616,617,619,620,621,622,623,625,626,627,628,629,630,632,633,634,635,636,637,639,640,641,642,643,644,646,647,648],
  // mês 15
  [649,650,651,652,654,655,656,657,658,659,661,662,663,664,665,666,667,668,670,671,672,673,674,675,676,678,679,680,681,682],
  // mês 16
  [683,684,685,687,688,689,690,691,692,693,694,696,697,698,699,700,701,702,703,704,706,707,708,709,710,711,712,713,714,715],
  // mês 17
  [717,718,719,720,721,722,723,724,725,726,727,728,730,731,732,733,734,735,736,737,738,739,740,741,742,744,745,746,747,748],
  // mês 18
  [749,750,751,752,753,754,755,756,757,758,760,761,762,763,764,765,766,767,768,769,770,771,772,773,774,775,776,777,778,779],
  // mês 19
  [780,781,782,784,785,786,787,788,789,790,791,792,793,794,795,796,797,798,799,800,801,802,803,804,805,806,807,808,809,810],
  // mês 20 (só dia 0 disponível na tabela)
  [811],
];

const PESO_MAX_M: number[][] = [
  // mês 6
  [328,329,331,332,334,336,337,339,340,342,343,345,347,348,350,351,353,354,356,357,359,361,362,364,365,367,368,370,371,373],
  // mês 7
  [375,376,378,379,381,382,384,385,387,388,390,391,393,395,396,398,399,401,402,404,405,407,408,410,411,413,414,416,417,419],
  // mês 8
  [420,422,423,425,426,428,429,431,432,434,436,437,439,440,442,443,445,446,448,449,451,452,453,455,456,458,459,461,462,464],
  // mês 9
  [465,467,468,470,471,473,474,476,477,479,480,482,483,485,486,488,489,491,492,493,495,496,498,499,501,502,504,505,507,508],
  // mês 10
  [510,511,512,514,515,517,518,520,521,523,524,525,527,528,530,531,533,534,536,537,538,540,541,543,544,546,547,548,550,551],
  // mês 11
  [553,554,556,557,558,560,561,563,564,565,567,568,570,571,573,574,575,577,578,580,581,582,584,585,587,588,589,591,592,594],
  // mês 12
  [595,596,598,599,601,602,603,605,606,608,609,610,612,613,614,616,617,619,620,621,623,624,625,627,628,630,631,633,634,635],
  // mês 13
  [636,638,639,640,642,643,645,646,647,649,650,651,653,654,655,657,658,659,661,662,664,665,666,668,669,670,672,673,674,676],
  // mês 14
  [677,678,680,681,682,684,685,686,688,689,690,692,693,694,695,697,698,699,701,702,703,705,706,707,709,710,711,713,714,715],
  // mês 15
  [717,718,719,720,722,723,724,726,727,728,730,731,732,733,735,736,737,739,740,741,742,744,745,746,748,749,750,751,753,754],
  // mês 16
  [755,756,758,759,760,762,763,764,765,767,768,769,770,772,773,774,775,777,778,779,781,782,783,784,786,787,788,789,791,792],
  // mês 17
  [793,794,795,797,798,799,800,802,803,804,805,807,808,809,810,812,813,814,815,816,818,819,820,821,823,824,825,826,827,829],
  // mês 18
  [830,831,832,833,835,836,837,838,840,841,842,843,844,846,847,848,849,850,852,853,854,855,856,858,859,860,861,862,864,865],
  // mês 19
  [866,867,868,869,871,872,873,874,875,877,878,879,880,881,882,884,885,886,887,888,889,891,892,893,894,895,896,898,899,900],
  // mês 20 (só dia 0 disponível na tabela)
  [901],
];

// ─── Grupos ABCZ (Regulamento ExpoZebu 2025/2026 — Art. 29°) ─────────────────
// Faixa de idade em meses completos: [min, max) — o limite superior é exclusivo.

export type GrupoNelore = {
  nome: string;
  sexo: "M" | "F";
  min: number;
  max: number;
};

export const GRUPOS_NELORE: GrupoNelore[] = [
  { nome: "Bezerra Menor",  sexo: "F", min:  6, max:  9 },
  { nome: "Bezerra Maior",  sexo: "F", min:  9, max: 12 },
  { nome: "Novilha Menor",  sexo: "F", min: 12, max: 16 },
  { nome: "Novilha",        sexo: "F", min: 16, max: 20 },
  { nome: "Novilha Maior",  sexo: "F", min: 20, max: 24 },
  { nome: "Vaca Jovem",     sexo: "F", min: 24, max: 30 },
  { nome: "Vaca",           sexo: "F", min: 30, max: 36 },
  { nome: "Vaca Adulta",    sexo: "F", min: 36, max: 42 },
  { nome: "Bezerro Menor",  sexo: "M", min:  6, max:  9 },
  { nome: "Bezerro Maior",  sexo: "M", min:  9, max: 12 },
  { nome: "Júnior Menor",   sexo: "M", min: 12, max: 16 },
  { nome: "Júnior",         sexo: "M", min: 16, max: 20 },
  { nome: "Júnior Maior",   sexo: "M", min: 20, max: 24 },
  { nome: "Touro Jovem",    sexo: "M", min: 24, max: 30 },
  { nome: "Touro Sênior",   sexo: "M", min: 30, max: 36 },
];

/** Encontra o grupo ABCZ pela idade em meses completos e sexo. */
export function grupoPorIdade(sexo: "M" | "F", meses: number): GrupoNelore | null {
  return GRUPOS_NELORE.find(g => g.sexo === sexo && meses >= g.min && meses < g.max) ?? null;
}

/** Encontra o grupo ABCZ de um animal numa data de referência (data base do evento). */
export function grupoNaData(
  nascimento: string | null,
  sexo: string | null,
  ref: Date,
): GrupoNelore | null {
  if (!nascimento) return null;
  const { meses } = idadeExata(nascimento, ref);
  return grupoPorIdade(sexo === "M" ? "M" : "F", meses);
}

// ─── Simulação completa (usada pelo simulador da aba Pista) ───────────────────

export type SimulacaoCategoria = {
  meses: number;
  dias: number;
  grupo: GrupoNelore | null;
  pesoMin: number | null;
  pesoMax: number | null;
  /** Motivo pelo qual o animal não se enquadra em nenhum grupo. */
  motivoForaDeGrupo: string | null;
  /** Data em que o animal entra no próximo grupo (ISO yyyy-mm-dd), se houver. */
  proximoGrupo: { nome: string; entraEm: string } | null;
};

/** Data em que o animal completa N meses de vida (ISO yyyy-mm-dd). */
export function dataAoCompletarMeses(nascimento: string, meses: number): string {
  const d = new Date(nascimento + "T12:00:00");
  d.setMonth(d.getMonth() + meses);
  return d.toISOString().split("T")[0];
}

/**
 * Simula em qual categoria um animal entraria numa exposição.
 * @param nascimento  data de nascimento (ISO yyyy-mm-dd)
 * @param sexo        "M" | "F"
 * @param dataBase    data base do evento (ISO yyyy-mm-dd)
 */
export function simularCategoria(
  nascimento: string,
  sexo: "M" | "F",
  dataBase: string,
): SimulacaoCategoria {
  const ref = new Date(dataBase + "T12:00:00");
  const { meses, dias } = idadeExata(nascimento, ref);
  const grupo = grupoPorIdade(sexo, meses);

  let motivoForaDeGrupo: string | null = null;
  if (!grupo) {
    if (meses < 6) {
      motivoForaDeGrupo = `Muito novo — ${meses}m na data base. A pista começa aos 6 meses.`;
    } else {
      const ultimo = [...GRUPOS_NELORE].filter(g => g.sexo === sexo).pop();
      motivoForaDeGrupo = `Acima da idade máxima de pista (${ultimo?.max ?? 42} meses).`;
    }
  }

  // Próximo grupo da mesma categoria de sexo
  const listaSexo = GRUPOS_NELORE.filter(g => g.sexo === sexo).sort((a, b) => a.min - b.min);
  const proximo = listaSexo.find(g => g.min > meses) ?? null;

  return {
    meses,
    dias,
    grupo,
    pesoMin: grupo ? pesoMinimo(sexo, meses) : null,
    pesoMax: grupo ? pesoMaximo(sexo, meses, dias) : null,
    motivoForaDeGrupo,
    proximoGrupo: proximo
      ? { nome: proximo.nome, entraEm: dataAoCompletarMeses(nascimento, proximo.min) }
      : null,
  };
}

// ─── Funções públicas ─────────────────────────────────────────────────────────

/** Retorna o peso mínimo oficial para a idade e sexo (ou null se fora do range). */
export function pesoMinimo(sexo: "M" | "F", meses: number): number | null {
  const tabela = sexo === "M" ? PESO_MIN_M : PESO_MIN_F;
  // Para machos, +30m = mesmo mínimo
  if (sexo === "M" && meses > 30) return tabela[30] ?? null;
  return tabela[meses] ?? null;
}

/** Retorna o peso máximo oficial (tabela ExpoZebu 2026).
 *  Só disponível para meses 6–20.  Retorna null se fora da tabela. */
export function pesoMaximo(sexo: "M" | "F", meses: number, dias: number): number | null {
  if (meses < 6 || meses > 20) return null;
  const tabela = sexo === "M" ? PESO_MAX_M : PESO_MAX_F;
  const col = tabela[meses - 6];
  if (!col) return null;
  const d = Math.min(dias, col.length - 1);
  return col[d] ?? col[0];
}

/** Calcula idade exata em meses e dias restantes, referenciada a uma data. */
export function idadeExata(nascimento: string, dataRef: Date): { meses: number; dias: number } {
  const nasc = new Date(nascimento + "T12:00:00");
  let meses  = (dataRef.getFullYear() - nasc.getFullYear()) * 12
             + (dataRef.getMonth() - nasc.getMonth());
  // Ajuste: se o dia ainda não chegou neste mês, subtrai 1 mês
  if (dataRef.getDate() < nasc.getDate()) meses--;

  // Dia do mês em que o animal nasceu no mês atual
  const inicioMes = new Date(dataRef.getFullYear(), dataRef.getMonth(), nasc.getDate());
  if (inicioMes > dataRef) {
    // Ainda não chegou o "aniversário" neste mês — volta um mês para pegar o início correto
    inicioMes.setMonth(inicioMes.getMonth() - 1);
  }
  const dias = Math.floor((dataRef.getTime() - inicioMes.getTime()) / 86400000);

  return { meses: Math.max(0, meses), dias: Math.max(0, dias) };
}

export type StatusPeso = "ABAIXO" | "IDEAL" | "ACIMA" | "SEM_DADOS";

/**
 * Compara o peso atual com as tabelas oficiais.
 * Retorna "ABAIXO", "IDEAL", "ACIMA" ou "SEM_DADOS".
 */
export function statusPeso(
  peso: number | null | undefined,
  sexo: "M" | "F",
  meses: number,
  dias: number,
): StatusPeso {
  if (peso == null || meses < 6) return "SEM_DADOS";
  const min = pesoMinimo(sexo, meses);
  const max = pesoMaximo(sexo, meses, dias);

  if (min != null && peso < min) return "ABAIXO";
  if (max != null && peso > max) return "ACIMA";
  if (min != null) return "IDEAL";
  return "SEM_DADOS";
}
