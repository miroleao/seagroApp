import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { FARM_ID } from "@/lib/utils";

/**
 * POST /api/registrar-implantacoes
 *
 * Registra implantações pendentes de uma aspiração: para cada receptora
 * informada cria embryo (status IMPLANTADO) + transfer + pregnancy_diagnoses
 * e atualiza status_rebanho da receptora para PRENHA_EMBRIAO.
 *
 * Body:
 *   aspId: string
 *   dataTE: string (yyyy-mm-dd)
 *   receptoras: Array<{ receptoraId?: string|null; receptoraBrinco?: string|null }>
 */
function calcParto(dataBase: string, dias: number): string {
  const d = new Date(dataBase + "T12:00:00");
  d.setDate(d.getDate() + dias);
  return d.toISOString().split("T")[0];
}

export async function POST(req: NextRequest) {
  try {
    const { aspId, dataTE, receptoras } = await req.json();

    if (!aspId)                       return NextResponse.json({ ok: false, erro: "aspId obrigatório" });
    if (!dataTE)                      return NextResponse.json({ ok: false, erro: "Data da T.E. obrigatória" });
    if (!Array.isArray(receptoras))   return NextResponse.json({ ok: false, erro: "Lista de receptoras inválida" });
    if (receptoras.length === 0)      return NextResponse.json({ ok: false, erro: "Informe ao menos uma receptora" });

    const supabase = await createClient();

    // Confirma que a aspiração existe e pega o session_id para revalidar caches
    const { data: asp, error: aspErr } = await supabase
      .from("aspirations")
      .select("id, session_id, farm_id")
      .eq("id", aspId)
      .eq("farm_id", FARM_ID)
      .single();
    if (aspErr || !asp) {
      return NextResponse.json({ ok: false, erro: aspErr?.message ?? "Aspiração não encontrada" });
    }

    const previsao = calcParto(dataTE, 285);
    const criadas: { embryoId: string; transferId: string; receptoraId: string | null }[] = [];

    for (let idx = 0; idx < receptoras.length; idx++) {
      const r = receptoras[idx] ?? {};
      const receptoraIdInput  = (r.receptoraId  as string | null | undefined)?.trim?.() || null;
      const receptoraBrinco   = (r.receptoraBrinco as string | null | undefined)?.trim?.() || null;

      // Pelo menos um identificador é necessário
      if (!receptoraIdInput && !receptoraBrinco) {
        return NextResponse.json({
          ok: false,
          erro: `Receptora #${idx + 1}: selecione na lista ou informe o brinco.`,
        });
      }

      // Resolve receptora: id existente ou brinco → busca/cria
      let finalReceptoraId: string | null = receptoraIdInput;
      if (!finalReceptoraId && receptoraBrinco) {
        const { data: existente } = await supabase
          .from("animals")
          .select("id")
          .eq("farm_id", FARM_ID)
          .eq("brinco", receptoraBrinco)
          .eq("tipo", "RECEPTORA")
          .maybeSingle();

        if (existente?.id) {
          finalReceptoraId = existente.id;
        } else {
          const { data: nova, error: novaErr } = await supabase
            .from("animals")
            .insert({
              farm_id:        FARM_ID,
              tipo:           "RECEPTORA",
              classificacao:  "RECEPTORA",
              nome:           `Receptora ${receptoraBrinco}`,
              brinco:         receptoraBrinco,
              status_rebanho: "PRENHA_EMBRIAO",
            })
            .select("id")
            .single();
          if (novaErr) {
            return NextResponse.json({
              ok: false,
              erro: `Receptora #${idx + 1}: erro ao criar — ${novaErr.message}`,
            });
          }
          finalReceptoraId = nova?.id ?? null;
        }
      }

      // Cria embrião IMPLANTADO vinculado à aspiração
      const { data: embriao, error: embErr } = await supabase
        .from("embryos")
        .insert({
          farm_id:       FARM_ID,
          aspiration_id: aspId,
          sexagem:       "NAO_SEXADO",
          status:        "IMPLANTADO",
        })
        .select("id")
        .single();
      if (embErr || !embriao) {
        return NextResponse.json({
          ok: false,
          erro: `Receptora #${idx + 1}: erro ao criar embrião — ${embErr?.message ?? "desconhecido"}`,
        });
      }

      // Cria transfer
      const { data: transfer, error: trErr } = await supabase
        .from("transfers")
        .insert({
          farm_id:          FARM_ID,
          embryo_id:        embriao.id,
          receptora_id:     finalReceptoraId,
          receptora_brinco: receptoraBrinco,
          data_te:          dataTE,
        })
        .select("id")
        .single();
      if (trErr || !transfer) {
        return NextResponse.json({
          ok: false,
          erro: `Receptora #${idx + 1}: erro ao criar T.E. — ${trErr?.message ?? "desconhecido"}`,
        });
      }

      // Cria DG inicial AGUARDANDO com previsão de parto
      await supabase.from("pregnancy_diagnoses").insert({
        farm_id:             FARM_ID,
        transfer_id:         transfer.id,
        resultado:           "AGUARDANDO",
        data_dg:             dataTE,
        data_previsao_parto: previsao,
      });

      // Atualiza status da receptora
      if (finalReceptoraId) {
        await supabase
          .from("animals")
          .update({ status_rebanho: "PRENHA_EMBRIAO" })
          .eq("id", finalReceptoraId);
      }

      criadas.push({
        embryoId:    embriao.id,
        transferId:  transfer.id,
        receptoraId: finalReceptoraId,
      });
    }

    revalidatePath("/reproducao");
    revalidatePath("/rebanho");
    return NextResponse.json({ ok: true, criadas: criadas.length, dataPrevisaoParto: previsao });
  } catch (e: any) {
    console.error("❌ registrar-implantacoes:", e);
    return NextResponse.json({ ok: false, erro: e?.message ?? "Erro interno" }, { status: 500 });
  }
}
