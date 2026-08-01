"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { FARM_ID } from "@/lib/utils";

// ─── Atualizar status reprodutivo ─────────────────────────────────────────────
export async function atualizarStatusRebanho(formData: FormData): Promise<{ ok: boolean; erro?: string }> {
  const supabase     = await createClient();
  const animal_id    = formData.get("animal_id") as string;
  const status       = formData.get("status_rebanho") as string;
  const observacoes  = (formData.get("observacoes") as string)?.trim() || null;
  const data_parto   = (formData.get("data_parto") as string)?.trim() || null;

  if (!animal_id || !status) return { ok: false, erro: "Dados incompletos" };

  const { error } = await supabase
    .from("animals")
    .update({ status_rebanho: status, situacao: observacoes })
    .eq("id", animal_id)
    .eq("farm_id", FARM_ID);

  if (error) return { ok: false, erro: error.message };

  // ── Registra no log de movimentação ──────────────────────────────────────────
  await supabase.from("animal_status_log").insert({
    farm_id:     FARM_ID,
    animal_id,
    status,
    observacoes,
    data_evento: new Date().toISOString().split("T")[0],
  });

  // ── Se PARIDA com data, registra o desfecho no pregnancy_diagnoses mais recente ──
  let aviso: string | undefined;

  if (status === "PARIDA" && data_parto) {
    // Lê o brinco da receptora para buscar também por receptora_brinco
    const { data: animalData } = await supabase
      .from("animals")
      .select("brinco")
      .eq("id", animal_id)
      .single();
    const brinco = (animalData as any)?.brinco as string | null;

    // Tenta encontrar por receptora_id primeiro, depois por brinco
    let tf: { id: string } | null = null;
    const { data: tfPorId } = await supabase
      .from("transfers")
      .select("id")
      .eq("farm_id", FARM_ID)
      .eq("receptora_id", animal_id)
      .order("data_te", { ascending: false })
      .limit(1)
      .maybeSingle();
    tf = tfPorId ?? null;

    if (!tf && brinco) {
      const { data: tfPorBrinco } = await supabase
        .from("transfers")
        .select("id")
        .eq("farm_id", FARM_ID)
        .eq("receptora_brinco", brinco)
        .order("data_te", { ascending: false })
        .limit(1)
        .maybeSingle();
      tf = tfPorBrinco ?? null;
    }

    if (tf) {
      // Tenta atualizar o DG existente (busca qualquer DG, com ou sem data_dg)
      const { data: dg } = await supabase
        .from("pregnancy_diagnoses")
        .select("id")
        .eq("farm_id", FARM_ID)
        .eq("transfer_id", tf.id)
        .order("data_dg", { ascending: false, nullsFirst: false })
        .limit(1)
        .maybeSingle();

      if (dg) {
        const { error: errUpd } = await supabase
          .from("pregnancy_diagnoses")
          .update({ tipo_desfecho: "PARIDA", data_desfecho: data_parto })
          .eq("id", dg.id)
          .eq("farm_id", FARM_ID);
        if (errUpd) aviso = `Status salvo, mas erro ao registrar parto no histórico: ${errUpd.message}`;
      } else {
        // Sem DG — cria um registro de desfecho direto
        const { error: errIns } = await supabase.from("pregnancy_diagnoses").insert({
          farm_id:       FARM_ID,
          transfer_id:   tf.id,
          resultado:     "POSITIVO",
          tipo_desfecho: "PARIDA",
          data_desfecho: data_parto,
          data_dg:       data_parto,   // usa a data do parto como data do DG
        });
        if (errIns) aviso = `Status salvo, mas erro ao criar registro de parto: ${errIns.message}`;
      }
    } else {
      // Transfer não encontrado: status foi salvo mas não há TE vinculada
      aviso = `Status atualizado para Parida, mas nenhuma implantação foi encontrada para esta receptora (brinco: ${brinco ?? animal_id}). A data do parto não foi registrada no histórico.`;
    }
  }

  revalidatePath(`/rebanho/${animal_id}`);
  revalidatePath("/rebanho");

  // Se houve aviso (DG não atualizado), retorna ok: false com a mensagem
  // para que o usuário saiba que precisa verificar
  if (aviso) return { ok: false, erro: aviso };
  return { ok: true };
}

// ─── Adicionar pesagem ────────────────────────────────────────────────────────
export async function adicionarPesagem(formData: FormData): Promise<{ ok: boolean; erro?: string }> {
  const supabase    = await createClient();
  const animal_id   = formData.get("animal_id") as string;
  const data        = formData.get("data") as string;
  const peso_kg_raw = formData.get("peso_kg") as string;
  const observacoes = (formData.get("observacoes") as string)?.trim() || null;

  if (!animal_id || !data || !peso_kg_raw) return { ok: false, erro: "Preencha data e peso" };

  const peso_kg = parseFloat(peso_kg_raw);
  if (isNaN(peso_kg) || peso_kg <= 0) return { ok: false, erro: "Peso inválido" };

  // weight_records é a tabela canônica de pesagens — a mesma lida por
  // /pesagens, /doadoras/[id], /machos/[id] e /relatorios.
  const { error } = await supabase.from("weight_records").insert({
    farm_id: FARM_ID, animal_id, data, peso_kg, observacoes,
  });

  if (error) return { ok: false, erro: error.message };

  // Atualiza peso_atual com a pesagem MAIS RECENTE (não necessariamente esta —
  // o usuário pode estar lançando uma pesagem retroativa).
  const { data: maisRecente } = await supabase
    .from("weight_records")
    .select("peso_kg")
    .eq("animal_id", animal_id)
    .eq("farm_id", FARM_ID)
    .order("data", { ascending: false })
    .limit(1)
    .maybeSingle();

  await supabase
    .from("animals")
    .update({ peso_atual: (maisRecente as any)?.peso_kg ?? peso_kg })
    .eq("id", animal_id)
    .eq("farm_id", FARM_ID);

  revalidatePath(`/rebanho/${animal_id}`);
  revalidatePath("/rebanho");
  revalidatePath("/pesagens");
  return { ok: true };
}

// ─── Registrar nascimento ─────────────────────────────────────────────────────
export async function registrarNascimento(formData: FormData) {
  const supabase       = await createClient();
  const receptora_id   = formData.get("receptora_id") as string;
  const transfer_id    = formData.get("transfer_id")  as string;
  const data_nascimento = formData.get("data_nascimento") as string;
  const sexo_nascido   = (formData.get("sexo_nascido") as string) || "F";
  const peso_nascimento = formData.get("peso_nascimento") as string;
  const obs_nascimento  = (formData.get("obs_nascimento") as string)?.trim() || null;

  // Busca o transfer para obter dados do embrião (doadora/touro)
  const { data: transfer } = await supabase
    .from("transfers")
    .select(`
      id, receptora_brinco,
      embryo:embryos (
        aspiration:aspirations ( doadora_id, doadora_nome, touro_nome )
      )
    `)
    .eq("id", transfer_id)
    .single();

  const asp       = (transfer?.embryo as any)?.aspiration;
  const doadora_id = asp?.doadora_id   ?? null;
  const doadora_nome = asp?.doadora_nome ?? null;
  const touro_nome   = asp?.touro_nome   ?? null;

  // 1. Cria o animal NASCIDO
  const { data: nascido } = await supabase
    .from("animals")
    .insert({
      farm_id:      FARM_ID,
      tipo:         "NASCIDO",
      sexo:         sexo_nascido,
      nome:         `Nascido ${data_nascimento}`,
      nascimento:   data_nascimento,
      mae_id:       doadora_id,
      mae_nome:     doadora_nome,
      pai_nome:     touro_nome,
      peso_atual:      peso_nascimento ? parseFloat(peso_nascimento) : null,
      // Persiste também como peso AO NASCER — base do cálculo de ganho ponderal.
      peso_nascimento: peso_nascimento ? parseFloat(peso_nascimento) : null,
      observacoes:  obs_nascimento,
    })
    .select("id")
    .single();

  // 2. Atualiza o diagnóstico de prenhez para PARIDA
  await supabase
    .from("pregnancy_diagnoses")
    .update({ resultado: "PARIDA", tipo_desfecho: "PARIDA", data_desfecho: data_nascimento })
    .eq("transfer_id", transfer_id)
    .eq("farm_id", FARM_ID);

  // 3. Zera a receptora: status VAZIA
  if (receptora_id) {
    await supabase
      .from("animals")
      .update({ status_rebanho: "VAZIA" })
      .eq("id", receptora_id)
      .eq("farm_id", FARM_ID);

    // Log da movimentação: parição → VAZIA
    await supabase.from("animal_status_log").insert({
      farm_id:     FARM_ID,
      animal_id:   receptora_id,
      status:      "VAZIA",
      observacoes: `Parição em ${data_nascimento}`,
      data_evento: data_nascimento,
    });
  }

  revalidatePath(`/rebanho/${receptora_id}`);
  revalidatePath("/rebanho");
  revalidatePath("/reproducao/prenhezes");

  if (nascido?.id && sexo_nascido === "F") redirect(`/doadoras`);
  else redirect(`/rebanho/${receptora_id}`);
}

// ─── Vincular bezerro nascido a um diagnóstico de prenhez (PARIDA) ────────────
export async function vincularBezerroReceptora(formData: FormData): Promise<{ ok: boolean; erro?: string }> {
  const supabase  = await createClient();
  const dg_id     = (formData.get("dg_id")     as string)?.trim();
  const animal_id = (formData.get("animal_id") as string)?.trim();
  const receptora_id = (formData.get("receptora_id") as string)?.trim();

  if (!dg_id || !animal_id) return { ok: false, erro: "Dados incompletos" };

  const { error } = await supabase
    .from("pregnancy_diagnoses")
    .update({ animal_nascido_id: animal_id })
    .eq("id", dg_id)
    .eq("farm_id", FARM_ID);

  if (error) return { ok: false, erro: error.message };

  revalidatePath(`/rebanho/${receptora_id}`);
  return { ok: true };
}

// ─── Vincular cria manualmente (receptoras sem TE no sistema) ─────────────────
export async function vincularCriaManual(formData: FormData): Promise<{ ok: boolean; erro?: string }> {
  const supabase    = await createClient();
  const animal_id   = (formData.get("animal_id") as string)?.trim();
  const cria_id     = (formData.get("cria_id")   as string)?.trim();

  if (!animal_id || !cria_id) return { ok: false, erro: "Dados incompletos" };

  const { error } = await supabase
    .from("animals")
    .update({ cria_id })
    .eq("id", animal_id)
    .eq("farm_id", FARM_ID);

  if (error) return { ok: false, erro: error.message };

  revalidatePath(`/rebanho/${animal_id}`);
  return { ok: true };
}

// ─── Atualizar dados gerais do animal ─────────────────────────────────────────
export async function atualizarDadosAnimal(formData: FormData): Promise<{ ok: boolean; erro?: string }> {
  const supabase      = await createClient();
  const animal_id     = formData.get("animal_id") as string;
  const classificacao = formData.get("classificacao") as string;
  const localizacao   = (formData.get("localizacao") as string)?.trim() || null;
  const data_entrada  = (formData.get("data_entrada") as string) || null;
  const forma_entrada = (formData.get("forma_entrada") as string) || null;
  const observacoes   = (formData.get("observacoes") as string)?.trim() || null;

  const { error } = await supabase
    .from("animals")
    .update({ classificacao, localizacao, data_entrada, forma_entrada, observacoes })
    .eq("id", animal_id)
    .eq("farm_id", FARM_ID);

  if (error) return { ok: false, erro: error.message };

  revalidatePath(`/rebanho/${animal_id}`);
  return { ok: true };
}

// ─── Registrar desfecho de implantação passada (sem DG ativo) ─────────────────
// Usado quando a receptora já pariu de uma TE anterior mas não tinha desfecho registrado
export async function registrarDesfechoTransfer(
  formData: FormData
): Promise<{ ok: boolean; erro?: string }> {
  const supabase      = await createClient();
  const transfer_id   = (formData.get("transfer_id")   as string)?.trim();
  const receptora_id  = (formData.get("receptora_id")  as string)?.trim();
  const tipo_desfecho = (formData.get("tipo_desfecho") as string)?.trim();
  const data_desfecho = (formData.get("data_desfecho") as string)?.trim() || null;
  const animal_nascido_id = (formData.get("animal_nascido_id") as string)?.trim() || null;

  if (!transfer_id || !tipo_desfecho) return { ok: false, erro: "Dados incompletos" };

  // Busca DG existente para este transfer
  const { data: dgExistente } = await supabase
    .from("pregnancy_diagnoses")
    .select("id")
    .eq("farm_id", FARM_ID)
    .eq("transfer_id", transfer_id)
    .order("data_dg", { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();

  if (dgExistente) {
    const { error } = await supabase
      .from("pregnancy_diagnoses")
      .update({
        tipo_desfecho,
        data_desfecho,
        ...(animal_nascido_id ? { animal_nascido_id } : {}),
      })
      .eq("id", dgExistente.id)
      .eq("farm_id", FARM_ID);
    if (error) return { ok: false, erro: error.message };
  } else {
    // Sem DG — cria registro de desfecho direto
    const { error } = await supabase
      .from("pregnancy_diagnoses")
      .insert({
        farm_id:      FARM_ID,
        transfer_id,
        resultado:    "POSITIVO",
        tipo_desfecho,
        data_desfecho,
        data_dg:      data_desfecho,
        ...(animal_nascido_id ? { animal_nascido_id } : {}),
      });
    if (error) return { ok: false, erro: error.message };
  }

  revalidatePath(`/rebanho/${receptora_id}`);
  revalidatePath("/rebanho");
  return { ok: true };
}

// ─── Excluir animal do rebanho ───────────────────────────────────────────────
// Para cadastros errados (brinco digitado errado, duplicata). NÃO é desfecho:
// desfecho preserva o histórico, exclusão apaga o registro.
//
// Só permite excluir quando não há histórico produtivo vinculado. Pesagens,
// sócios e log de status caem em CASCADE e somem junto — o resto (T.E.,
// nascimento, prêmio, transação, genealogia) bloqueia a exclusão, porque
// apagar apontaria para um animal inexistente.

type Bloqueio = { rotulo: string; total: number };

export async function verificarExclusaoAnimal(
  animalId: string
): Promise<{ ok: boolean; erro?: string; bloqueios?: Bloqueio[]; cascatas?: Bloqueio[] }> {
  const supabase = await createClient();

  const { data: animal } = await supabase
    .from("animals")
    .select("id, tipo")
    .eq("id", animalId)
    .eq("farm_id", FARM_ID)
    .maybeSingle();

  if (!animal) return { ok: false, erro: "Animal não encontrado." };

  // Trava de segurança: esta action serve só ao rebanho. Doadora e touro têm
  // fluxo próprio e muito mais histórico agregado.
  if (!["RECEPTORA", "DESCARTE"].includes(animal.tipo)) {
    return { ok: false, erro: "Use a ficha de doadoras ou machos para excluir este animal." };
  }

  async function contar(tabela: string, coluna: string) {
    const { count } = await supabase
      .from(tabela)
      .select("id", { count: "exact", head: true })
      .eq(coluna, animalId);
    return count ?? 0;
  }

  const [tes, nascimentos, premios, transacoes, pesagens, socios] = await Promise.all([
    contar("transfers",    "receptora_id"),
    contar("births",       "animal_id"),
    contar("awards",       "animal_id"),
    contar("transactions", "animal_id"),
    contar("weight_records",  "animal_id"),
    contar("animal_partners", "animal_id"),
  ]);

  // Genealogia: alguém aponta para este animal como mãe, pai ou cria.
  // cria_id depende de migration — se ela não rodou, cai para mãe/pai só.
  async function contarGenealogia() {
    const comCria = await supabase
      .from("animals")
      .select("id", { count: "exact", head: true })
      .eq("farm_id", FARM_ID)
      .or(`mae_id.eq.${animalId},pai_id.eq.${animalId},cria_id.eq.${animalId}`);

    if (!comCria.error) return comCria.count ?? 0;

    const semCria = await supabase
      .from("animals")
      .select("id", { count: "exact", head: true })
      .eq("farm_id", FARM_ID)
      .or(`mae_id.eq.${animalId},pai_id.eq.${animalId}`);
    return semCria.count ?? 0;
  }

  const filhos = await contarGenealogia();

  const bloqueios: Bloqueio[] = [
    { rotulo: "transferência(s) de embrião", total: tes },
    { rotulo: "registro(s) de nascimento",   total: nascimentos },
    { rotulo: "premiação(ões)",              total: premios },
    { rotulo: "transação(ões) financeira(s)", total: transacoes },
    { rotulo: "vínculo(s) de genealogia",    total: filhos },
  ].filter(b => b.total > 0);

  const cascatas: Bloqueio[] = [
    { rotulo: "pesagem(ns)", total: pesagens },
    { rotulo: "sócio(s)",    total: socios },
  ].filter(c => c.total > 0);

  return { ok: bloqueios.length === 0, bloqueios, cascatas };
}

export async function excluirAnimalRebanho(
  formData: FormData
): Promise<{ ok: boolean; erro?: string }> {
  const animalId = (formData.get("animal_id") as string)?.trim();
  if (!animalId) return { ok: false, erro: "ID do animal ausente." };

  // Revalida no servidor — o cliente pode ter a tela desatualizada
  const check = await verificarExclusaoAnimal(animalId);
  if (check.erro) return { ok: false, erro: check.erro };

  if (!check.ok) {
    const lista = (check.bloqueios ?? [])
      .map(b => `${b.total} ${b.rotulo}`)
      .join(", ");
    return {
      ok: false,
      erro: `Não é possível excluir: o animal tem ${lista}. Registre um desfecho ou desvincule esses registros antes.`,
    };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("animals")
    .delete()
    .eq("id", animalId)
    .eq("farm_id", FARM_ID);

  if (error) return { ok: false, erro: error.message };

  revalidatePath("/rebanho");
  revalidatePath("/dashboard");
  return { ok: true };
}
