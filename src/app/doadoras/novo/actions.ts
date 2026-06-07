"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { FARM_ID } from "@/lib/utils";

export async function criarDoadora(formData: FormData) {
  const nome                   = formData.get("nome") as string;
  const rgn                    = formData.get("rgn") as string || null;
  const nascimento             = formData.get("nascimento") as string || null;
  const pai_nome               = formData.get("pai_nome") as string || null;
  const mae_nome               = formData.get("mae_nome") as string || null;
  const avo_paterno            = formData.get("avo_paterno") as string || null;
  const avo_paterna            = formData.get("avo_paterna") as string || null;
  const avo_materno            = formData.get("avo_materno") as string || null;
  const avo_materna            = formData.get("avo_materna") as string || null;
  const bisavo_pat_pat         = formData.get("bisavo_pat_pat") as string || null;
  const bisava_pat_pat         = formData.get("bisava_pat_pat") as string || null;
  const bisavo_pat_mat         = formData.get("bisavo_pat_mat") as string || null;
  const bisava_pat_mat         = formData.get("bisava_pat_mat") as string || null;
  const bisavo_materno         = formData.get("bisavo_materno") as string || null;
  const bisava_mat_pat         = formData.get("bisava_mat_pat") as string || null;
  const bisavo_materna         = formData.get("bisavo_materna") as string || null;
  const bisavo                 = formData.get("bisavo") as string || null;
  const localizacao            = formData.get("localizacao") as string || null;
  const percentual_proprio_raw = formData.get("percentual_proprio") as string || null;
  const valor_parcela_raw      = formData.get("valor_parcela") as string || null;
  const status_reprodutivo     = formData.get("status_reprodutivo") as string || null;
  const observacoes            = formData.get("observacoes") as string || null;

  // ── Financeiro: aquisição ──────────────────────────────────────────────────
  const tipo_aquisicao          = formData.get("tipo_aquisicao") as string || "COMPRA_DIRETA";
  const auction_id_raw          = (formData.get("auction_id") as string || "").trim();
  const novo_leilao_nome        = (formData.get("novo_leilao_nome") as string || "").trim() || null;
  const novo_leilao_organizador = (formData.get("novo_leilao_organizador") as string || "").trim() || null;
  const novo_leilao_local       = (formData.get("novo_leilao_local") as string || "").trim() || null;
  const data_leilao             = (formData.get("data_leilao") as string || "").trim() || null;
  const contraparte             = (formData.get("contraparte") as string || "").trim() || null;
  const valor_total_compra_raw  = formData.get("valor_total_compra") as string || null;
  const n_parcelas_compra_raw   = formData.get("n_parcelas_compra") as string || null;

  if (!nome) return;

  const supabase = await createClient();

  // ── Checar duplicidade de RGN ─────────────────────────────────────────────
  if (rgn?.trim()) {
    const { data: dup } = await supabase
      .from("animals")
      .select("id, nome, tipo")
      .eq("farm_id", FARM_ID)
      .eq("rgn", rgn.trim())
      .maybeSingle();
    if (dup) {
      const tipoLabel: Record<string, string> = {
        DOADORA: "Doadora", TOURO: "Touro", RECEPTORA: "Receptora",
      };
      redirect(
        `/doadoras/novo?erro=${encodeURIComponent(
          `RGN "${rgn}" já cadastrado para: ${tipoLabel[dup.tipo] ?? dup.tipo} ${dup.nome}`
        )}`
      );
    }
  }

  const percentual_proprio = percentual_proprio_raw
    ? parseFloat(percentual_proprio_raw) / 100
    : null;
  const valor_parcela = valor_parcela_raw ? parseFloat(valor_parcela_raw) : null;

  const { data, error } = await supabase
    .from("animals")
    .insert({
      farm_id: FARM_ID,
      nome: nome.trim(),
      rgn: rgn || null,
      tipo: "DOADORA",
      sexo: "F",
      nascimento: nascimento || null,
      pai_nome: pai_nome || null,
      mae_nome: mae_nome || null,
      avo_paterno: avo_paterno || null,
      avo_paterna: avo_paterna || null,
      avo_materno: avo_materno || null,
      avo_materna: avo_materna || null,
      bisavo_pat_pat: bisavo_pat_pat || null,
      bisava_pat_pat: bisava_pat_pat || null,
      bisavo_pat_mat: bisavo_pat_mat || null,
      bisava_pat_mat: bisava_pat_mat || null,
      bisavo_materno: bisavo_materno || null,
      bisava_mat_pat: bisava_mat_pat || null,
      bisavo_materna: bisavo_materna || null,
      bisavo: bisavo || null,
      localizacao: localizacao || null,
      percentual_proprio: percentual_proprio,
      valor_parcela: isNaN(valor_parcela as any) ? null : valor_parcela,
      status_reprodutivo: status_reprodutivo || null,
      observacoes: observacoes || null,
    })
    .select("id")
    .single();

  if (error || !data) redirect("/doadoras");

  // Vincular sócios (slots 1–3)
  for (const n of [1, 2, 3]) {
    const pid   = formData.get(`partner_id_${n}`) as string || null;
    const perc  = formData.get(`percentual_${n}`) as string || null;
    const parc  = formData.get(`parcela_${n}`) as string || null;
    if (!pid || !perc) continue;
    const percVal = parseFloat(perc) / 100;
    const parcVal = parc ? parseFloat(parc) : null;
    if (isNaN(percVal) || percVal <= 0) continue;
    await supabase.from("animal_partners").insert({
      animal_id: data.id,
      partner_id: pid,
      percentual: percVal,
      valor_parcela: isNaN(parcVal as any) ? null : parcVal,
    }).select();
  }

  // ── Criar Transação de Compra (se informado valor) ────────────────────────
  if (tipo_aquisicao !== "PRODUCAO_PROPRIA" && valor_total_compra_raw) {
    const valor_total = parseFloat(valor_total_compra_raw);
    const n_parcelas  = parseInt(n_parcelas_compra_raw || "1") || 1;

    if (!isNaN(valor_total) && valor_total > 0) {
      // Resolver leilão
      let finalAuctionId: string | null = null;
      if (tipo_aquisicao === "LEILAO") {
        if (auction_id_raw === "__novo__" && novo_leilao_nome) {
          const { data: novo } = await supabase
            .from("auctions")
            .insert({
              farm_id:     FARM_ID,
              nome:        novo_leilao_nome,
              data:        data_leilao || null,
              organizador: novo_leilao_organizador || null,
              local:       novo_leilao_local || null,
            })
            .select("id")
            .single();
          finalAuctionId = novo?.id ?? null;
        } else if (auction_id_raw && auction_id_raw !== "__novo__") {
          finalAuctionId = auction_id_raw;
          // Atualiza a data do leilão se informada
          if (data_leilao) {
            await supabase
              .from("auctions")
              .update({ data: data_leilao })
              .eq("id", finalAuctionId);
          }
        }
      }

      // Inserir transação
      const dataBase = data_leilao || new Date().toISOString().split("T")[0];
      const { data: tx } = await supabase
        .from("transactions")
        .insert({
          farm_id:     FARM_ID,
          tipo:        "COMPRA",
          categoria:   "DOADORA",
          animal_nome: nome.trim(),
          doadora_id:  data.id,
          contraparte: contraparte || null,
          valor_total,
          n_parcelas,
          data:        dataBase,
          auction_id:  finalAuctionId,
        })
        .select("id")
        .single();

      if (tx) {
        // Vincular animal à transação
        await supabase.from("transaction_animals").insert({
          transaction_id: tx.id,
          animal_id:      data.id,
        });

        // Gerar parcelas mensais
        const valorParcela = valor_total / n_parcelas;
        const inicio = new Date(dataBase + "T12:00:00");
        const parcelas = Array.from({ length: n_parcelas }, (_, i) => {
          const venc = new Date(inicio);
          venc.setMonth(venc.getMonth() + i + 1);
          return {
            farm_id:        FARM_ID,
            transaction_id: tx.id,
            numero:         i + 1,
            vencimento:     venc.toISOString().split("T")[0],
            valor:          parseFloat(valorParcela.toFixed(2)),
            status:         "PENDENTE" as const,
          };
        });
        await supabase.from("installments").insert(parcelas);
      }
    }
  }

  redirect(`/doadoras/${data.id}`);
}
