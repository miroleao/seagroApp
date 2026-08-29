/**
 * Regras de Conjunto Progênie — Regulamento dos Rankings Nacionais e Regionais
 * da Raça Nelore (2025/2026), ACNB, Edição 01, out/2025. Recorte: Nelore padrão.
 *
 * PROGÊNIE DE MÃE — 2+ filhos da mesma matriz.
 *   • Se todos os filhos são do mesmo pai → exige ao menos 1 de sexo diferente.
 *   • Se os filhos são de pais diferentes → podem ser todos do mesmo sexo.
 *
 * PROGÊNIE DE PAI — 4+ filhos do mesmo reprodutor, em pelo menos 2 matrizes
 *   diferentes, com ao menos 1 de sexo diferente entre eles.
 *   Pontuação sobe para 72/48/38 (em vez de 60/40/32) quando o reprodutor é
 *   "Pai Nova Geração" — menos de 84m0d de idade na data-base do evento.
 *
 * Em ambos os casos só entra na pista animal já julgado individualmente na
 * mesma exposição, e fêmea parida com cria própria < 7m0d se apresenta com a
 * cria ao pé — regras que este módulo não verifica (dependem do julgamento
 * do dia), apenas sinaliza como lembrete na UI.
 */

export type SexoAnimal = "M" | "F";

export interface AnimalGenealogico {
  id: string;
  nome: string;
  sexo: SexoAnimal;
  pai_id?: string | null;
  pai_nome?: string | null;
  mae_id?: string | null;
  mae_nome?: string | null;
}

export interface GrupoProgenieMae {
  chave: string;
  maeNome: string;
  filhos: AnimalGenealogico[];
  mesmoPai: boolean;
  paiComum: string | null;
  elegivel: boolean;
  motivo: string;
}

export interface GrupoProgeniePai {
  chave: string;
  paiNome: string;
  paiId: string | null;
  filhos: AnimalGenealogico[];
  matrizesDistintas: number;
  temSexoMisto: boolean;
  elegivel: boolean;
  motivo: string;
}

/** Chave de agrupamento: prioriza o ID cadastrado; cai para o nome (normalizado) quando não há FK. */
function chaveGenealogica(id?: string | null, nome?: string | null): string | null {
  if (id) return `id:${id}`;
  if (nome && nome.trim()) return `nome:${nome.trim().toLowerCase()}`;
  return null;
}

/** Agrupa candidatos por mãe (mae_id ou mae_nome) e aplica a regra de sexo do Conjunto Progênie de Mãe. */
export function montarProgeniesDeMae(animais: AnimalGenealogico[]): GrupoProgenieMae[] {
  const grupos = new Map<string, AnimalGenealogico[]>();

  for (const a of animais) {
    const chave = chaveGenealogica(a.mae_id, a.mae_nome);
    if (!chave) continue;
    if (!grupos.has(chave)) grupos.set(chave, []);
    grupos.get(chave)!.push(a);
  }

  const resultado: GrupoProgenieMae[] = [];

  for (const [chave, filhos] of grupos) {
    if (filhos.length < 2) continue;

    const paisChaves = new Set(
      filhos.map(f => chaveGenealogica(f.pai_id, f.pai_nome) ?? `__sem_pai__${f.id}`)
    );
    const primeiroPai = chaveGenealogica(filhos[0].pai_id, filhos[0].pai_nome);
    const mesmoPai = paisChaves.size === 1 && !!primeiroPai;

    const temMacho = filhos.some(f => f.sexo === "M");
    const temFemea = filhos.some(f => f.sexo === "F");

    let elegivel: boolean;
    let motivo: string;
    if (mesmoPai) {
      elegivel = temMacho && temFemea;
      motivo = elegivel
        ? "Mesma mãe e mesmo pai, com macho e fêmea no conjunto — atende à regra."
        : "Mesma mãe e mesmo pai: precisa de ao menos 1 macho e 1 fêmea no conjunto.";
    } else {
      elegivel = true;
      motivo = "Mesma mãe, filhos de pais diferentes — o conjunto pode repetir sexo.";
    }

    resultado.push({
      chave,
      maeNome: filhos[0].mae_nome ?? "—",
      filhos: [...filhos].sort((x, y) => x.nome.localeCompare(y.nome, "pt-BR")),
      mesmoPai,
      paiComum: mesmoPai ? (filhos[0].pai_nome ?? "—") : null,
      elegivel,
      motivo,
    });
  }

  return resultado.sort((a, b) => b.filhos.length - a.filhos.length);
}

/** Agrupa candidatos por pai (pai_id ou pai_nome) e aplica a regra de 4+ filhos / 2+ matrizes / sexo misto. */
export function montarProgeniesDePai(animais: AnimalGenealogico[]): GrupoProgeniePai[] {
  const grupos = new Map<string, AnimalGenealogico[]>();

  for (const a of animais) {
    const chave = chaveGenealogica(a.pai_id, a.pai_nome);
    if (!chave) continue;
    if (!grupos.has(chave)) grupos.set(chave, []);
    grupos.get(chave)!.push(a);
  }

  const resultado: GrupoProgeniePai[] = [];

  for (const [chave, filhos] of grupos) {
    if (filhos.length < 4) continue;

    const matrizesChaves = new Set(
      filhos
        .map(f => chaveGenealogica(f.mae_id, f.mae_nome))
        .filter((v): v is string => !!v)
    );
    const matrizesDistintas = matrizesChaves.size;

    const temMacho = filhos.some(f => f.sexo === "M");
    const temFemea = filhos.some(f => f.sexo === "F");
    const temSexoMisto = temMacho && temFemea;

    const pendencias: string[] = [];
    if (matrizesDistintas < 2) pendencias.push(`apenas ${matrizesDistintas} matriz cadastrada — precisa de 2+`);
    if (!temSexoMisto) pendencias.push("precisa de ao menos 1 macho e 1 fêmea");

    const elegivel = pendencias.length === 0;
    const motivo = elegivel
      ? "4+ filhos, 2+ matrizes e sexo misto — atende à regra."
      : `Não atende ainda: ${pendencias.join("; ")}.`;

    const paiIdComum = filhos.find(f => f.pai_id)?.pai_id ?? null;

    resultado.push({
      chave,
      paiNome: filhos[0].pai_nome ?? "—",
      paiId: paiIdComum,
      filhos: [...filhos].sort((x, y) => x.nome.localeCompare(y.nome, "pt-BR")),
      matrizesDistintas,
      temSexoMisto,
      elegivel,
      motivo,
    });
  }

  return resultado.sort((a, b) => b.filhos.length - a.filhos.length);
}

/** Idade do reprodutor (em meses completos) numa data de referência — usada para o status Pai Nova Geração. */
export function idadeReprodutorEmMeses(nascimento: string, ref: Date): number {
  const nasc = new Date(nascimento + "T12:00:00");
  let meses = (ref.getFullYear() - nasc.getFullYear()) * 12 + (ref.getMonth() - nasc.getMonth());
  if (ref.getDate() < nasc.getDate()) meses--;
  return Math.max(0, meses);
}

/** Pai Nova Geração = menos de 84 meses (7 anos) na data-base. Muda a pontuação do Conjunto Progênie de Pai para 72/48/38. */
export function ehPaiNovaGeracao(mesesNaDataBase: number): boolean {
  return mesesNaDataBase < 84;
}
