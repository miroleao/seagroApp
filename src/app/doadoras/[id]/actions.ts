"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { FARM_ID } from "@/lib/utils";

export async function atualizarRgn(formData: FormData) {
  const id  = formData.get("id") as string;
  const rgn = (formData.get("rgn") as string)?.trim() || null;
  if (!id) return;
  const supabase = await createClient();
  await supabase.from("animals").update({ rgn }).eq("id", id).eq("farm_id", FARM_ID);
  revalidatePath(`/doadoras/${id}`);
  redirect(`/doadoras/${id}`);
}

// ── Correção manual de partos (número, datas) ────────────────────────────────

export async function corrigirPartos(formData: FormData) {
  const id                  = (formData.get("id")                   as string)?.trim();
  const numero_partos_raw   = (formData.get("numero_partos")        as string)?.trim();
  const data_primeiro_parto = (formData.get("data_primeiro_parto")  as string)?.trim() || null;
  const data_ultimo_parto   = (formData.get("data_ultimo_parto")    as string)?.trim() || null;

  if (!id) return;

  const numero_partos = numero_partos_raw !== "" ? parseInt(numero_partos_raw) : null;

  const supabase = await createClient();

  // 1. Atualiza campos de resumo no animal
  await supabase.from("animals").update({
    numero_partos:       isNaN(numero_partos as number) ? null : numero_partos,
    data_primeiro_parto: data_primeiro_parto || null,
    data_ultimo_parto:   data_ultimo_parto   || null,
  }).eq("id", id).eq("farm_id", FARM_ID);

  // 2. Para cada data de parto informada, garante um registro em prenhezes_naturais
  //    (evita duplicata checando se já existe um PARIDA nessa data)
  const datasPartos = [data_primeiro_parto, data_ultimo_parto]
    .filter(Boolean)
    .filter((v, i, arr) => arr.indexOf(v) === i) as string[]; // únicas

  for (const data_parto of datasPartos) {
    const { data: existente } = await supabase
      .from("prenhezes_naturais")
      .select("id")
      .eq("doadora_id", id)
      .eq("data_parto", data_parto)
      .maybeSingle();

    if (!existente) {
      await supabase.from("prenhezes_naturais").insert({
        farm_id:    FARM_ID,
        doadora_id: id,
        data_parto,
        resultado:  "PARIDA",
      });
    }
  }

  revalidatePath(`/doadoras/${id}`);
  redirect(`/doadoras/${id}`);
}

export async function atualizarValorParcela(formData: FormData) {
  const id      = formData.get("id") as string;
  const parcela = parseFloat(formData.get("valor_parcela") as string);
  if (!id) return;
  const supabase = await createClient();
  await supabase
    .from("animals")
    .update({ valor_parcela: isNaN(parcela) ? null : parcela })
    .eq("id", id)
    .eq("farm_id", FARM_ID);
  revalidatePath(`/doadoras/${id}`);
  redirect(`/doadoras/${id}`);
}

export async function toggleParaPista(formData: FormData) {
  const id    = formData.get("id") as string;
  const valor = formData.get("para_pista") === "true";

  const supabase = await createClient();
  await supabase
    .from("animals")
    .update({ para_pista: valor })
    .eq("id", id);

  revalidatePath(`/doadoras/${id}`);
  revalidatePath("/pista");
  redirect(`/doadoras/${id}`);
}

export async function toggleParaLeilao(formData: FormData) {
  const id    = formData.get("id") as string;
  const valor = formData.get("para_leilao") === "true";

  const supabase = await createClient();
  await supabase
    .from("animals")
    .update({ para_leilao: valor })
    .eq("id", id)
    .eq("farm_id", FARM_ID);

  revalidatePath(`/doadoras/${id}`);
  revalidatePath("/doadoras");
  redirect(`/doadoras/${id}`);
}

export async function salvarInfoLeilao(formData: FormData) {
  const animal_id           = formData.get("animal_id") as string;
  const convite_nome        = (formData.get("convite_nome") as string)?.trim() || null;
  const convite_data        = (formData.get("convite_data") as string) || null;
  const convite_promotores  = (formData.get("convite_promotores") as string)?.trim() || null;
  const compra_leilao_nome  = (formData.get("compra_leilao_nome") as string)?.trim() || null;
  const compra_leilao_data  = (formData.get("compra_leilao_data") as string) || null;
  const compra_parcela_raw    = formData.get("compra_valor_parcela") as string;
  const meta_parcela_raw      = formData.get("meta_valor_parcela") as string;
  const venda_comprador       = (formData.get("venda_comprador") as string)?.trim() || null;
  const venda_parcela_raw     = formData.get("venda_valor_parcela") as string;
  const venda_n_parcelas_raw  = formData.get("venda_n_parcelas") as string;

  const compra_valor_parcela  = compra_parcela_raw   ? parseFloat(compra_parcela_raw)   : null;
  const meta_valor_parcela    = meta_parcela_raw     ? parseFloat(meta_parcela_raw)     : null;
  const venda_valor_parcela   = venda_parcela_raw    ? parseFloat(venda_parcela_raw)    : null;
  const venda_n_parcelas      = venda_n_parcelas_raw ? parseInt(venda_n_parcelas_raw)   : null;

  if (!animal_id) return;

  const supabase = await createClient();
  await supabase
    .from("animal_leilao_info")
    .upsert(
      {
        animal_id,
        farm_id: FARM_ID,
        convite_nome,
        convite_data,
        convite_promotores,
        compra_leilao_nome,
        compra_leilao_data,
        compra_valor_parcela: compra_valor_parcela && !isNaN(compra_valor_parcela) ? compra_valor_parcela : null,
        meta_valor_parcela:   meta_valor_parcela   && !isNaN(meta_valor_parcela)   ? meta_valor_parcela   : null,
        venda_comprador,
        venda_valor_parcela:  venda_valor_parcela  && !isNaN(venda_valor_parcela)  ? venda_valor_parcela  : null,
        venda_n_parcelas:     venda_n_parcelas     && !isNaN(venda_n_parcelas)     ? venda_n_parcelas     : null,
        atualizado_em: new Date().toISOString(),
      },
      { onConflict: "animal_id,farm_id" }
    );

  revalidatePath(`/doadoras/${animal_id}`);
  redirect(`/doadoras/${animal_id}`);
}

export async function toggleNascidoSeAgro(formData: FormData) {
  const id    = formData.get("id") as string;
  const valor = formData.get("nascido_se_agro") === "true";

  const supabase = await createClient();
  await supabase
    .from("animals")
    .update({ nascido_se_agro: valor })
    .eq("id", id)
    .eq("farm_id", FARM_ID);

  revalidatePath(`/doadoras/${id}`);
  revalidatePath("/doadoras");
  redirect(`/doadoras/${id}`);
}

export async function atualizarPeso(formData: FormData) {
  const id   = formData.get("id") as string;
  const peso = parseFloat(formData.get("peso_atual") as string);

  if (!id || isNaN(peso)) return;

  const supabase = await createClient();

  // Atualiza peso_atual no animal
  await supabase
    .from("animals")
    .update({ peso_atual: peso })
    .eq("id", id)
    .eq("farm_id", FARM_ID);

  // Registra no histórico de pesagens (weight_records)
  const hoje = new Date().toISOString().split("T")[0];
  await supabase
    .from("weight_records")
    .insert({ animal_id: id, farm_id: FARM_ID, data: hoje, peso_kg: peso });

  revalidatePath(`/doadoras/${id}`);
  revalidatePath("/pista");
  redirect(`/doadoras/${id}`);
}

export async function registrarPesagem(formData: FormData) {
  const animal_id = formData.get("animal_id") as string;
  const data      = formData.get("data") as string;
  const peso_kg   = parseFloat(formData.get("peso_kg") as string);

  if (!animal_id || !data || isNaN(peso_kg)) return;

  const supabase = await createClient();

  const { error } = await supabase
    .from("weight_records")
    .insert({ animal_id, farm_id: FARM_ID, data, peso_kg });

  if (error) throw new Error(`Erro ao registrar pesagem: ${error.message}`);

  // Atualiza peso_atual se a data registrada for a mais recente
  const { data: ultima } = await supabase
    .from("weight_records")
    .select("data")
    .eq("animal_id", animal_id)
    .order("data", { ascending: false })
    .limit(1)
    .single();

  if (!ultima || data >= ultima.data) {
    await supabase
      .from("animals")
      .update({ peso_atual: peso_kg })
      .eq("id", animal_id)
      .eq("farm_id", FARM_ID);
  }

  revalidatePath(`/doadoras/${animal_id}`);
  revalidatePath("/pista");
  redirect(`/doadoras/${animal_id}`);
}

/** Toggle CDC-FIV do embrião (redireciona de volta para a ficha da doadora) */
export async function toggleEmbrioCdc(formData: FormData) {
  const embryo_id  = formData.get("embryo_id") as string;
  const atual       = formData.get("atual") as string;
  const doadora_id  = formData.get("doadora_id") as string;

  const supabase = await createClient();
  await supabase
    .from("embryos")
    .update({ numero_cdc_fiv: atual === "sim" ? null : "✓" })
    .eq("id", embryo_id);

  revalidatePath(`/doadoras/${doadora_id}`);
  redirect(`/doadoras/${doadora_id}`);
}

/** Toggle ADT-TE do embrião */
export async function toggleEmbrioAdt(formData: FormData) {
  const embryo_id  = formData.get("embryo_id") as string;
  const atual       = formData.get("atual") as string;
  const doadora_id  = formData.get("doadora_id") as string;

  const supabase = await createClient();
  await supabase
    .from("embryos")
    .update({ numero_adt_te: atual === "sim" ? null : "✓" })
    .eq("id", embryo_id);

  revalidatePath(`/doadoras/${doadora_id}`);
  redirect(`/doadoras/${doadora_id}`);
}

/** Toggle DNA do embrião (armazena em observacoes) */
export async function toggleEmbrioDna(formData: FormData) {
  const embryo_id  = formData.get("embryo_id") as string;
  const atual       = formData.get("atual") as string;
  const obs_base    = (formData.get("obs_base") as string) || "";
  const doadora_id  = formData.get("doadora_id") as string;

  const supabase = await createClient();
  let novaObs: string | null;
  if (atual === "sim") {
    novaObs = obs_base.replace(/DNA:1\s*\|?\s*/g, "").trim() || null;
  } else {
    novaObs = obs_base ? `DNA:1 | ${obs_base}` : "DNA:1";
  }

  await supabase
    .from("embryos")
    .update({ observacoes: novaObs })
    .eq("id", embryo_id);

  revalidatePath(`/doadoras/${doadora_id}`);
  redirect(`/doadoras/${doadora_id}`);
}

export async function atualizarLocalizacao(formData: FormData) {
  const id          = formData.get("id") as string;
  const localizacao = (formData.get("localizacao") as string).trim() || null;

  if (!id) return;

  const supabase = await createClient();
  await supabase.from("animals").update({ localizacao }).eq("id", id);

  revalidatePath(`/doadoras/${id}`);
  revalidatePath("/doadoras");
  redirect(`/doadoras/${id}`);
}

export async function adicionarSocio(formData: FormData) {
  const animal_id   = formData.get("animal_id") as string;
  const partner_id  = formData.get("partner_id") as string;
  const pct         = parseFloat(formData.get("percentual") as string);
  const parcela     = formData.get("valor_parcela") as string;

  if (!animal_id || !partner_id || isNaN(pct) || pct <= 0) return;

  const supabase = await createClient();
  await supabase.from("animal_partners").upsert(
    {
      animal_id,
      partner_id,
      percentual:    pct / 100,          // converte % para decimal (25 → 0.25)
      valor_parcela: parcela ? parseFloat(parcela) : null,
    },
    { onConflict: "animal_id,partner_id" }
  );

  revalidatePath(`/doadoras/${animal_id}`);
  revalidatePath("/doadoras");
  redirect(`/doadoras/${animal_id}`);
}

export async function removerSocio(formData: FormData) {
  const animal_id  = formData.get("animal_id") as string;
  const partner_id = formData.get("partner_id") as string;

  if (!animal_id || !partner_id) return;

  const supabase = await createClient();
  await supabase
    .from("animal_partners")
    .delete()
    .eq("animal_id", animal_id)
    .eq("partner_id", partner_id);

  revalidatePath(`/doadoras/${animal_id}`);
  revalidatePath("/doadoras");
  redirect(`/doadoras/${animal_id}`);
}

/** Cria um novo parceiro na tabela partners E já vincula ao animal */
export async function criarESocio(formData: FormData) {
  const animal_id   = formData.get("animal_id") as string;
  const nome        = ((formData.get("novo_nome") ?? "") as string).trim();
  const telefone    = ((formData.get("novo_telefone") ?? "") as string).trim() || null;
  const email       = ((formData.get("novo_email") ?? "") as string).trim() || null;
  const pct         = parseFloat(formData.get("novo_percentual") as string);
  const parcela     = (formData.get("novo_parcela") ?? "") as string;

  if (!animal_id || !nome || isNaN(pct) || pct <= 0) return;

  const supabase = await createClient();

  // 1. Insere o parceiro na tabela partners
  const { data: partner, error } = await supabase
    .from("partners")
    .insert({ farm_id: FARM_ID, nome, telefone, email })
    .select("id")
    .single();

  if (error || !partner) {
    console.error("Erro ao criar parceiro:", error);
    redirect(`/doadoras/${animal_id}`);
  }

  // 2. Vincula o parceiro ao animal
  await supabase.from("animal_partners").insert({
    animal_id,
    partner_id:   partner!.id,
    percentual:   pct / 100,
    valor_parcela: parcela ? parseFloat(parcela) : null,
  });

  revalidatePath(`/doadoras/${animal_id}`);
  revalidatePath("/doadoras");
  redirect(`/doadoras/${animal_id}`);
}

export async function atualizarTouroPrenhez(formData: FormData) {
  const id            = formData.get("id") as string;
  const touro_prenhez = (formData.get("touro_prenhez") as string).trim() || null;

  if (!id) return;

  const supabase = await createClient();
  await supabase.from("animals").update({ touro_prenhez }).eq("id", id);

  revalidatePath(`/doadoras/${id}`);
  redirect(`/doadoras/${id}`);
}

export async function atualizarStatusReprodutivo(formData: FormData) {
  const id          = formData.get("id") as string;
  const status      = (formData.get("status_reprodutivo") as string) || null;
  const dataEvento  = (formData.get("data_status") as string) || null;
  const touroNome   = ((formData.get("touro_nome") ?? "") as string).trim() || null;
  const touroRgd    = ((formData.get("touro_rgd")  ?? "") as string).trim() || null;

  if (!id || !status) {
    if (id) redirect(`/doadoras/${id}`);
    return;
  }

  const supabase = await createClient();

  // ── 1. Sempre salva o status (coluna original, sempre existe) ────────────────
  await supabase
    .from("animals")
    .update({ status_reprodutivo: status })
    .eq("id", id);

  // ── 2. Campos extras que requerem a migração SQL (falham silenciosamente) ────

  if (status === "INSEMINADA" || status === "GESTANTE") {
    // Salva touro + data de inseminação no animal
    await supabase.from("animals").update({
      touro_prenhez:    touroNome,
      rgd_touro_prenhez: touroRgd,
      data_inseminacao:  dataEvento,
      data_status:       dataEvento,
    }).eq("id", id);

    // ── Histórico: GESTANTE cria (ou edita) um registro de prenhez natural ──
    if (status === "GESTANTE") {
      const { data: ativa } = await supabase
        .from("prenhezes_naturais")
        .select("id")
        .eq("doadora_id", id)
        .eq("resultado", "ATIVA")
        .order("criado_em", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (ativa) {
        // Atualiza a prenhez ativa existente (pode ser edição da data/touro)
        await supabase.from("prenhezes_naturais").update({
          data_inseminacao: dataEvento,
          touro_nome:       touroNome,
          touro_rgd:        touroRgd,
        }).eq("id", ativa.id);
      } else {
        // Nova prenhez
        await supabase.from("prenhezes_naturais").insert({
          farm_id:          FARM_ID,
          doadora_id:       id,
          data_inseminacao: dataEvento,
          touro_nome:       touroNome,
          touro_rgd:        touroRgd,
          resultado:        "ATIVA",
        });
      }
    }
  }

  else if (status === "PARIDA" && dataEvento) {
    // Lê dados atuais para calcular ordinal e comparar datas
    const { data: animal } = await supabase
      .from("animals")
      .select("numero_partos, data_primeiro_parto, data_ultimo_parto, touro_prenhez, rgd_touro_prenhez")
      .eq("id", id)
      .single();

    const numAtual      = ((animal as any)?.numero_partos ?? 0) as number;
    const novoNumero    = numAtual + 1;
    const touroPrenhez  = touroNome || (animal as any)?.touro_prenhez || null;
    const rgdPrenhez    = touroRgd  || (animal as any)?.rgd_touro_prenhez || null;
    const dataUltimo    = (animal as any)?.data_ultimo_parto as string | null;

    // Só sobrescreve touro_ultimo_parto/data_ultimo_parto se este for o parto mais recente
    const ehMaisRecente = !dataUltimo || dataEvento >= dataUltimo;

    const partoPayload: Record<string, unknown> = {
      numero_partos:    novoNumero,
      // Limpa campos de prenhez ativa
      touro_prenhez:    null,
      rgd_touro_prenhez: null,
      data_inseminacao:  null,
    };

    if (ehMaisRecente) {
      partoPayload.data_status            = dataEvento;
      partoPayload.data_ultimo_parto      = dataEvento;
      partoPayload.touro_ultimo_parto     = touroPrenhez;
      partoPayload.rgd_touro_ultimo_parto = rgdPrenhez;
    }

    const primeiroPartoAtual = (animal as any)?.data_primeiro_parto as string | null;
    if (!primeiroPartoAtual || dataEvento < primeiroPartoAtual) {
      partoPayload.data_primeiro_parto = dataEvento;
    }

    await supabase.from("animals").update(partoPayload).eq("id", id);

    // ── Histórico: fecha prenhez ATIVA se existir; senão cria diretamente como PARIDA ──
    const { data: ativa } = await supabase
      .from("prenhezes_naturais")
      .select("id")
      .eq("doadora_id", id)
      .eq("resultado", "ATIVA")
      .order("criado_em", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (ativa) {
      await supabase.from("prenhezes_naturais")
        .update({ resultado: "PARIDA", data_parto: dataEvento })
        .eq("id", ativa.id);
    } else {
      // Parto histórico sem prenhez ativa — cria direto como PARIDA
      await supabase.from("prenhezes_naturais").insert({
        farm_id:    FARM_ID,
        doadora_id: id,
        touro_nome: touroPrenhez,
        touro_rgd:  rgdPrenhez,
        data_parto: dataEvento,
        resultado:  "PARIDA",
      });
    }
  }

  else if (status === "ABORTOU") {
    await supabase.from("animals").update({
      data_status:      dataEvento,
      // Limpa prenhez ativa
      touro_prenhez:    null,
      rgd_touro_prenhez: null,
      data_inseminacao: null,
    }).eq("id", id);

    // ── Histórico: fecha a prenhez ativa como ABORTOU ──
    const { data: ativa } = await supabase
      .from("prenhezes_naturais")
      .select("id")
      .eq("doadora_id", id)
      .eq("resultado", "ATIVA")
      .order("criado_em", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (ativa) {
      await supabase.from("prenhezes_naturais")
        .update({ resultado: "ABORTOU", data_parto: dataEvento })
        .eq("id", ativa.id);
    }
  }

  else {
    // Para os demais status, só salva a data
    if (dataEvento) {
      await supabase.from("animals").update({ data_status: dataEvento }).eq("id", id);
    }
  }

  revalidatePath(`/doadoras/${id}`);
  revalidatePath("/doadoras");
  redirect(`/doadoras/${id}`);
}

// ── Registrar nascimento natural a partir da ficha da doadora ─────────────────

export async function registrarNascimentoNatural(formData: FormData) {
  const doadora_id      = (formData.get("doadora_id")         as string)?.trim();
  const nome            = (formData.get("nome")               as string)?.trim();
  const nascimento      = (formData.get("nascimento")         as string);
  const sexo            = (formData.get("sexo")               as string);
  const rgn             = (formData.get("rgn")                as string)?.trim() || null;
  const percentual_raw  = (formData.get("percentual_proprio") as string)?.trim();
  const percentual_proprio = percentual_raw ? parseFloat(percentual_raw) / 100 : 1.0;
  const nascido_se_agro = formData.get("nascido_se_agro") === "on";

  if (!doadora_id || !nome || !nascimento || !sexo) return;

  const tipo = sexo === "F" ? "DOADORA" : "TOURO";
  const supabase = await createClient();

  const { data: doadora } = await supabase
    .from("animals")
    .select("nome, touro_prenhez, rgd_touro_prenhez, numero_partos, data_primeiro_parto")
    .eq("id", doadora_id)
    .eq("farm_id", FARM_ID)
    .single();

  if (!doadora) return;

  const { data: animal, error } = await supabase
    .from("animals")
    .insert({
      farm_id: FARM_ID,
      tipo,
      nome,
      nascimento,
      sexo,
      rgn,
      mae_nome: doadora.nome,
      pai_nome: (doadora as any).touro_prenhez ?? null,
      situacao: "ATIVA",
      percentual_proprio: isNaN(percentual_proprio) ? 1.0 : percentual_proprio,
      nascido_se_agro,
    })
    .select("id")
    .single();

  if (error || !animal) {
    revalidatePath(`/doadoras/${doadora_id}`);
    return;
  }

  // Marca doadora como PARIDA e incrementa partos
  const numAtual = ((doadora as any).numero_partos ?? 0) as number;
  const partoPayload: Record<string, unknown> = {
    status_reprodutivo:    "PARIDA",
    data_status:           nascimento,
    data_ultimo_parto:     nascimento,
    numero_partos:         numAtual + 1,
    touro_ultimo_parto:    (doadora as any).touro_prenhez    ?? null,
    rgd_touro_ultimo_parto: (doadora as any).rgd_touro_prenhez ?? null,
    touro_prenhez:         null,
    rgd_touro_prenhez:     null,
    data_inseminacao:      null,
  };
  if (!(doadora as any).data_primeiro_parto) {
    partoPayload.data_primeiro_parto = nascimento;
  }
  await supabase.from("animals").update(partoPayload).eq("id", doadora_id).eq("farm_id", FARM_ID);

  // ── Histórico: atualiza/cria a prenhez natural com filhote vinculado ──
  const { data: pnAtiva } = await supabase
    .from("prenhezes_naturais")
    .select("id")
    .eq("doadora_id", doadora_id)
    .eq("resultado", "ATIVA")
    .order("criado_em", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (pnAtiva) {
    await supabase.from("prenhezes_naturais").update({
      resultado: "PARIDA",
      data_parto: nascimento,
      animal_nascido_id: animal.id,
    }).eq("id", pnAtiva.id);
  } else {
    // Cria registro histórico mesmo que prenhez não tenha sido lançada antes
    await supabase.from("prenhezes_naturais").insert({
      farm_id:          FARM_ID,
      doadora_id:       doadora_id,
      touro_nome:       (doadora as any).touro_prenhez ?? null,
      touro_rgd:        (doadora as any).rgd_touro_prenhez ?? null,
      data_parto:       nascimento,
      resultado:        "PARIDA",
      animal_nascido_id: animal.id,
    });
  }

  revalidatePath(`/doadoras/${doadora_id}`);
  revalidatePath("/doadoras");
  revalidatePath("/machos");
  revalidatePath("/dashboard");

  redirect(sexo === "F" ? `/doadoras/${animal.id}` : `/machos/${animal.id}`);
}

// ── Vincular animal já cadastrado como nascido desta doadora ──────────────────

export async function vincularNascimentoNatural(formData: FormData) {
  const doadora_id  = (formData.get("doadora_id")  as string)?.trim();
  const animal_id   = (formData.get("animal_id")   as string)?.trim();
  const nascimento  = (formData.get("nascimento")  as string) || new Date().toISOString().split("T")[0];

  if (!doadora_id || !animal_id) return;

  const supabase = await createClient();

  const [{ data: doadora }, { data: animal }] = await Promise.all([
    supabase.from("animals")
      .select("nome, touro_prenhez, rgd_touro_prenhez, numero_partos, data_primeiro_parto")
      .eq("id", doadora_id).eq("farm_id", FARM_ID).single(),
    supabase.from("animals")
      .select("tipo, mae_nome, pai_nome")
      .eq("id", animal_id).eq("farm_id", FARM_ID).single(),
  ]);

  if (!doadora) return;

  // Preenche mae/pai no filho se estiverem vazios
  const animalUpdate: Record<string, unknown> = {};
  if (!(animal as any)?.mae_nome && doadora.nome)
    animalUpdate.mae_nome = doadora.nome;
  if (!(animal as any)?.pai_nome && (doadora as any).touro_prenhez)
    animalUpdate.pai_nome = (doadora as any).touro_prenhez;
  if (Object.keys(animalUpdate).length > 0)
    await supabase.from("animals").update(animalUpdate).eq("id", animal_id).eq("farm_id", FARM_ID);

  // Marca doadora como PARIDA
  const numAtual = ((doadora as any).numero_partos ?? 0) as number;
  const partoPayload: Record<string, unknown> = {
    status_reprodutivo:    "PARIDA",
    data_status:           nascimento,
    data_ultimo_parto:     nascimento,
    numero_partos:         numAtual + 1,
    touro_ultimo_parto:    (doadora as any).touro_prenhez    ?? null,
    rgd_touro_ultimo_parto: (doadora as any).rgd_touro_prenhez ?? null,
    touro_prenhez:         null,
    rgd_touro_prenhez:     null,
    data_inseminacao:      null,
  };
  if (!(doadora as any).data_primeiro_parto) {
    partoPayload.data_primeiro_parto = nascimento;
  }
  await supabase.from("animals").update(partoPayload).eq("id", doadora_id).eq("farm_id", FARM_ID);

  // ── Histórico: atualiza/cria a prenhez natural com filhote vinculado ──
  const { data: pnAtiva } = await supabase
    .from("prenhezes_naturais")
    .select("id")
    .eq("doadora_id", doadora_id)
    .eq("resultado", "ATIVA")
    .order("criado_em", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (pnAtiva) {
    await supabase.from("prenhezes_naturais").update({
      resultado: "PARIDA",
      data_parto: nascimento,
      animal_nascido_id: animal_id,
    }).eq("id", pnAtiva.id);
  } else {
    await supabase.from("prenhezes_naturais").insert({
      farm_id:          FARM_ID,
      doadora_id:       doadora_id,
      touro_nome:       (doadora as any).touro_prenhez ?? null,
      touro_rgd:        (doadora as any).rgd_touro_prenhez ?? null,
      data_parto:       nascimento,
      resultado:        "PARIDA",
      animal_nascido_id: animal_id,
    });
  }

  revalidatePath(`/doadoras/${doadora_id}`);
  revalidatePath("/doadoras");
  revalidatePath("/machos");
  revalidatePath("/dashboard");

  const rota = (animal as any)?.tipo === "TOURO" ? `/machos/${animal_id}` : `/doadoras/${animal_id}`;
  redirect(rota);
}

/**
 * Vincula um animal já cadastrado como filhote de uma doadora que já está PARIDA.
 * Não altera status nem incrementa partos — só faz o link no prenhezes_naturais.
 */
export async function vincularFilhoteParida(formData: FormData) {
  const doadora_id = (formData.get("doadora_id") as string)?.trim();
  const animal_id  = (formData.get("animal_id")  as string)?.trim();
  const prenhez_id = (formData.get("prenhez_id") as string)?.trim() || null;

  if (!doadora_id || !animal_id) return;

  const supabase = await createClient();

  const { data: doadora } = await supabase
    .from("animals")
    .select("nome, touro_ultimo_parto, rgd_touro_ultimo_parto, data_ultimo_parto")
    .eq("id", doadora_id)
    .eq("farm_id", FARM_ID)
    .single();

  if (!doadora) return;

  // Preenche mae/pai no filho se estiverem vazios
  const { data: filhote } = await supabase
    .from("animals")
    .select("mae_nome, pai_nome")
    .eq("id", animal_id)
    .eq("farm_id", FARM_ID)
    .single();

  const filhoteUpdate: Record<string, unknown> = {};
  if (filhote && !(filhote as any).mae_nome) filhoteUpdate.mae_nome = doadora.nome;
  if (filhote && !(filhote as any).pai_nome && (doadora as any).touro_ultimo_parto)
    filhoteUpdate.pai_nome = (doadora as any).touro_ultimo_parto;
  if (Object.keys(filhoteUpdate).length > 0)
    await supabase.from("animals").update(filhoteUpdate).eq("id", animal_id).eq("farm_id", FARM_ID);

  if (prenhez_id) {
    // Vincula ao registro específico informado
    await supabase.from("prenhezes_naturais")
      .update({ animal_nascido_id: animal_id })
      .eq("id", prenhez_id)
      .eq("doadora_id", doadora_id);
  } else {
    // Fallback: encontra o PARIDA mais antigo sem filhote vinculado
    const { data: pnParida } = await supabase
      .from("prenhezes_naturais")
      .select("id")
      .eq("doadora_id", doadora_id)
      .eq("resultado", "PARIDA")
      .is("animal_nascido_id", null)
      .order("data_parto", { ascending: true, nullsFirst: false })
      .limit(1)
      .maybeSingle();

    if (pnParida) {
      await supabase.from("prenhezes_naturais")
        .update({ animal_nascido_id: animal_id })
        .eq("id", pnParida.id);
    } else {
      // Cria registro retroativo se não existir nenhum
      await supabase.from("prenhezes_naturais").insert({
        farm_id:           FARM_ID,
        doadora_id,
        touro_nome:        (doadora as any).touro_ultimo_parto    ?? null,
        touro_rgd:         (doadora as any).rgd_touro_ultimo_parto ?? null,
        data_parto:        (doadora as any).data_ultimo_parto     ?? null,
        resultado:         "PARIDA",
        animal_nascido_id: animal_id,
      });
    }
  }

  revalidatePath(`/doadoras/${doadora_id}`);
  redirect(`/doadoras/${doadora_id}`);
}

/** Registra uma venda na tabela transactions, pré-vinculando esta doadora */
export async function registrarVendaDoadora(formData: FormData) {
  const doadora_id     = (formData.get("doadora_id")     as string)?.trim();
  const tipo_detalhado = (formData.get("tipo_detalhado") as string) || "VENDA_ANIMAL";
  const contraparte    = (formData.get("contraparte")    as string) || null;
  const valorRaw       = formData.get("valor_total")     as string;
  const nParcelasRaw   = formData.get("n_parcelas")      as string;
  const dataRaw        = (formData.get("data")           as string) || null;
  const observacoes    = (formData.get("observacoes")    as string) || null;

  if (!doadora_id) redirect("/doadoras");

  const valor_total = parseFloat(valorRaw);
  const n_parcelas  = parseInt(nParcelasRaw) || 30;

  if (isNaN(valor_total) || valor_total <= 0) redirect(`/doadoras/${doadora_id}`);

  const supabase = await createClient();

  const prefixoMap: Record<string, string> = {
    VENDA_ANIMAL:    "",
    VENDA_PRENHEZ:   "Prenhez ",
    VENDA_ASPIRACAO: "Aspiração ",
  };
  const prefixo = prefixoMap[tipo_detalhado] ?? "";

  // Nome canônico da doadora
  const { data: animal } = await supabase
    .from("animals")
    .select("nome")
    .eq("id", doadora_id)
    .single();

  const animal_nome = animal?.nome
    ? `${prefixo}${animal.nome}`.trim()
    : null;

  const { data: tx, error: txErr } = await supabase
    .from("transactions")
    .insert({
      farm_id: FARM_ID,
      tipo: "VENDA",
      categoria: "DOADORA",
      animal_nome,
      doadora_id,
      contraparte,
      valor_total,
      n_parcelas,
      data: dataRaw || new Date().toISOString().split("T")[0],
      observacoes,
    })
    .select("id")
    .single();

  if (txErr || !tx) {
    console.error("Erro ao registrar venda:", txErr);
    redirect(`/doadoras/${doadora_id}`);
  }

  // Gera parcelas mensais
  const valorParcela = valor_total / n_parcelas;
  const hoje = dataRaw ? new Date(dataRaw + "T12:00:00") : new Date();
  const parcelas = Array.from({ length: n_parcelas }, (_, i) => {
    const venc = new Date(hoje);
    venc.setMonth(venc.getMonth() + i + 1);
    return {
      farm_id: FARM_ID,
      transaction_id: tx.id,
      numero: i + 1,
      vencimento: venc.toISOString().split("T")[0],
      valor: parseFloat(valorParcela.toFixed(2)),
      status: "PENDENTE" as const,
    };
  });

  await supabase.from("installments").insert(parcelas);

  revalidatePath(`/doadoras/${doadora_id}`);
  revalidatePath("/financeiro");
  redirect(`/doadoras/${doadora_id}`);
}

export async function atualizarGenealogia(formData: FormData) {
  const id = formData.get("id") as string;
  if (!id) return;

  const get = (nome: string) =>
    (formData.get(nome) as string | null)?.trim() || null;

  const supabase = await createClient();

  // ── Grupo 1: campos que existem desde o início (pai, mãe, avós maternos, bisavó) ──
  // Esses campos existem com certeza. Se der erro aqui, algo mais grave está errado.
  await supabase.from("animals").update({
    pai_nome:     get("pai_nome"),
    mae_nome:     get("mae_nome"),
    avo_materno:  get("avo_materno"),
    avo_materna:  get("avo_materna"),
    bisavo:       get("bisavo"),         // bisavó materna (mãe da avó materna)
  }).eq("id", id).eq("farm_id", FARM_ID);

  // ── Grupo 2: campos da migração add_genealogy_complete.sql ──
  // Atualizados individualmente para não cancelar tudo se uma coluna faltar.
  const camposExtras: Record<string, string | null> = {
    avo_paterno:    get("avo_paterno"),
    avo_paterna:    get("avo_paterna"),
    bisavo_pat_pat: get("bisavo_pat_pat"),
    bisava_pat_pat: get("bisava_pat_pat"),
    bisavo_pat_mat: get("bisavo_pat_mat"),
    bisava_pat_mat: get("bisava_pat_mat"),
    bisavo_materno: get("bisavo_materno"),
    bisava_mat_pat: get("bisava_mat_pat"),
    bisavo_materna: get("bisavo_materna"),
  };

  // Tenta atualizar todos juntos; se falhar (coluna ausente), atualiza um a um.
  const { error: extErr } = await supabase
    .from("animals")
    .update(camposExtras)
    .eq("id", id)
    .eq("farm_id", FARM_ID);

  if (extErr) {
    // Fallback: atualiza campo por campo ignorando erros individuais
    for (const [col, val] of Object.entries(camposExtras)) {
      await supabase
        .from("animals")
        .update({ [col]: val })
        .eq("id", id)
        .eq("farm_id", FARM_ID);
    }
  }

  revalidatePath(`/doadoras/${id}`);
  redirect(`/doadoras/${id}`);
}

export async function excluirDoadora(formData: FormData) {
  const id = formData.get("id") as string;
  if (!id) return;

  const supabase = await createClient();
  await supabase.from("animals").delete().eq("id", id).eq("farm_id", FARM_ID);

  revalidatePath("/doadoras");
  redirect("/doadoras");
}

export async function atualizarPercentualProprio(formData: FormData) {
  const id  = formData.get("id") as string;
  const pct = parseFloat(formData.get("percentual_proprio") as string);

  if (!id || isNaN(pct)) return;

  const supabase = await createClient();
  await supabase
    .from("animals")
    .update({ percentual_proprio: pct / 100 })  // converte % para decimal (75 → 0.75)
    .eq("id", id)
    .eq("farm_id", FARM_ID);

  revalidatePath(`/doadoras/${id}`);
  revalidatePath("/doadoras");
  redirect(`/doadoras/${id}`);
}

export async function adicionarPremiacao(formData: FormData): Promise<{ erro?: string } | void> {
  const animal_id     = formData.get("animal_id") as string;
  const exhibition_id = (formData.get("exhibition_id") as string)?.trim() || null;
  const tipo_premio   = (formData.get("tipo_premio") as string)?.trim();
  const grupo_nelore  = (formData.get("grupo_nelore") as string)?.trim() || null;
  const observacoes   = (formData.get("observacoes") as string)?.trim() || null;

  if (!animal_id || !tipo_premio) return { erro: "Tipo de prêmio é obrigatório." };

  const supabase = await createClient();
  const { error } = await supabase.from("awards").insert({
    farm_id: FARM_ID,
    animal_id,
    exhibition_id: exhibition_id || null,
    tipo_premio,
    grupo_nelore,
    observacoes,
  });

  if (error) {
    console.error("Erro ao salvar premiação:", error);
    return { erro: `Erro ao salvar: ${error.message}` };
  }

  revalidatePath(`/doadoras/${animal_id}`);
  revalidatePath("/doadoras");
  revalidatePath("/pista");
  revalidatePath("/machos");
  redirect(`/doadoras/${animal_id}`);
}
