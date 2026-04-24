"use server";

import { createClient } from "@/lib/supabase/server";
import { FARM_ID } from "@/lib/utils";
import Anthropic from "@anthropic-ai/sdk";

export async function perguntarElitIA(pergunta: string) {
  const supabase = await createClient();

  // ── Busca dados contextuais do BD ────────────────────────────────
  const { data: prenhezes } = await supabase
    .from("aspirations")
    .select(`
      id, animal_id, data_coleta,
      embryos (id, numero_cdc_fiv, numero_adt_te, sexo, observacoes),
      animal:animals (id, nome, rgn)
    `)
    .eq("farm_id", FARM_ID)
    .order("data_coleta", { ascending: false });

  const { data: animals } = await supabase
    .from("animals")
    .select("id, nome, rgn, tipo, status_reprodutivo, data_status")
    .eq("farm_id", FARM_ID)
    .order("nome");

  const { data: transactions } = await supabase
    .from("transactions")
    .select(`
      id, tipo, animal_nome, valor_total, n_parcelas, data, contraparte,
      auction:auctions (id, nome, data, local)
    `)
    .eq("farm_id", FARM_ID)
    .order("data", { ascending: false });

  // ── Monta contexto estruturado ──────────────────────────────────
  const contexto = {
    fazenda: {
      nome: "SE Agropecuária Nelore de Elite",
      farm_id: FARM_ID,
    },
    animais: {
      doadoras: animals?.filter((a) => a.tipo === "DOADORA") ?? [],
      machos: animals?.filter((a) => a.tipo === "MACHO") ?? [],
      total: animals?.length ?? 0,
    },
    prenhezes: {
      total: prenhezes?.length ?? 0,
      registros: prenhezes?.map((p: any) => ({
        id: p.id,
        data: p.data_coleta,
        doadora: p.animal?.nome,
        doadora_rgn: p.animal?.rgn,
        embrioes: p.embryos?.length ?? 0,
        embrioes_detalhe: p.embryos?.map((e: any) => ({
          id: e.id,
          sexo: e.sexo || "não determinado",
          cdc_fiv: e.numero_cdc_fiv ? "sim" : "não",
          adt_te: e.numero_adt_te ? "sim" : "não",
        })) ?? [],
      })) ?? [],
    },
    financeiro: {
      total_transacoes: transactions?.length ?? 0,
      transacoes: transactions?.map((t: any) => ({
        id: t.id,
        tipo: t.tipo,
        animal: t.animal_nome,
        valor: t.valor_total,
        parcelas: t.n_parcelas,
        data: t.data,
        comprador_vendedor: t.contraparte,
        leilao: t.auction?.nome ?? "sem leilão",
      })) ?? [],
    },
  };

  // ── Chama Claude com contexto ───────────────────────────────────
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY não configurada. Adicione a chave no arquivo .env.local.");
  }

  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const message = await client.messages.create({
      model: "claude-3-5-sonnet-20241022",
      max_tokens: 1024,
      system: `Você é ElitIA, um assistente especialista em manejo de gado Nelore de elite.
Tem acesso a todos os dados da SE Agropecuária Nelore de Elite e ajuda a tomar decisões com base em análises de dados.

Você responde em português, de forma clara e objetiva.
- Quando perguntado sobre prenhezes, sexagem, embriões: consulte os dados de aspirações e embriões
- Quando perguntado sobre investimentos/vendas: analise as transações financeiras
- Quando perguntado sobre animais: use os dados de doadoras e machos

Sempre cite números exatos dos dados. Se não encontrar informação, seja honesto e diga que não há registro daquele tipo de informação.`,
      messages: [
        {
          role: "user",
          content: `Contexto atual da fazenda:
${JSON.stringify(contexto, null, 2)}

Pergunta: "${pergunta}"

Responda de forma concisa e útil, usando os dados reais acima.`,
        },
      ],
    });

    const resposta =
      message.content[0].type === "text" ? message.content[0].text : "Erro ao processar resposta";

    return resposta;
  } catch (error: any) {
    console.error("Erro ElitIA:", error?.message ?? error);
    const msg = error?.message ?? "Erro desconhecido";
    throw new Error(msg);
  }
}
