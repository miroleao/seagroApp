"use client";

import { useState } from "react";

interface Auction {
  id: string;
  nome: string;
  data?: string | null;
  organizador?: string | null;
}

interface Props {
  auctions: Auction[];
}

type TipoAquisicao = "LEILAO" | "COMPRA_DIRETA" | "PRODUCAO_PROPRIA";

function fmt(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default function FinanceiroFormSection({ auctions }: Props) {
  const [tipo, setTipo]           = useState<TipoAquisicao>("COMPRA_DIRETA");
  const [auctionId, setAuctionId] = useState("");
  const [valorParcela, setValorParcela] = useState("");
  const [nParcelas, setNParcelas] = useState("30");
  const [percProprio, setPercProprio]   = useState("100");

  const isLeilao     = tipo === "LEILAO";
  const isCompra     = tipo !== "PRODUCAO_PROPRIA";
  const isNovoLeilao = auctionId === "__novo__";

  const parcelaNum = parseFloat(valorParcela.replace(",", ".")) || 0;
  const parcNum    = parseInt(nParcelas) || 1;
  const percNum    = parseFloat(percProprio) || 100;

  // Valor total = parcela × nº parcelas
  const totalCompra    = parcelaNum > 0 ? parcelaNum * parcNum : null;
  // Valorização = total ÷ % próprio → equivalente a 100% do animal
  const valorizacao    = totalCompra && percNum > 0 && percNum < 100
    ? totalCompra / (percNum / 100)
    : null;

  return (
    <section className="space-y-4">
      <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide border-b border-gray-100 pb-2">
        Financeiro
      </h2>

      <input type="hidden" name="tipo_aquisicao" value={tipo} />

      {/* ── Forma de Aquisição ── */}
      <div>
        <label className="text-xs text-gray-500 mb-2 block">Forma de Aquisição</label>
        <div className="flex flex-wrap gap-2">
          {(
            [
              { value: "LEILAO",           label: "🔨 Leilão"           },
              { value: "COMPRA_DIRETA",    label: "🤝 Compra Direta"    },
              { value: "PRODUCAO_PROPRIA", label: "🐄 Produção Própria" },
            ] as { value: TipoAquisicao; label: string }[]
          ).map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setTipo(opt.value)}
              className={`px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
                tipo === opt.value
                  ? "border-brand-500 bg-brand-50 text-brand-700"
                  : "border-gray-200 text-gray-600 hover:border-gray-300 bg-white"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Campos de Leilão ── */}
      {isLeilao && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 space-y-3">
          <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide">Dados do Leilão</p>

          <div>
            <label className="text-xs text-gray-500 mb-1 block">Leilão</label>
            <select
              name="auction_id"
              value={auctionId}
              onChange={(e) => setAuctionId(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-300"
            >
              <option value="">— Selecionar leilão existente —</option>
              {auctions.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.nome}
                  {a.data ? ` (${new Date(a.data + "T12:00:00").toLocaleDateString("pt-BR")})` : ""}
                </option>
              ))}
              <option value="__novo__">+ Cadastrar novo leilão…</option>
            </select>
          </div>

          {isNovoLeilao && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="md:col-span-2">
                <label className="text-xs text-gray-500 mb-1 block">Nome do Leilão *</label>
                <input
                  name="novo_leilao_nome"
                  type="text"
                  placeholder="Ex: ExpoZebu 2025 — 1ª Praça"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Casa Leiloeira / Organizador</label>
                <input
                  name="novo_leilao_organizador"
                  type="text"
                  placeholder="Ex: Nelore do Brasil"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Local</label>
                <input
                  name="novo_leilao_local"
                  type="text"
                  placeholder="Ex: Uberaba, MG"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300"
                />
              </div>
            </div>
          )}

          <div>
            <label className="text-xs text-gray-500 mb-1 block">Data do Leilão</label>
            <input
              name="data_leilao"
              type="date"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300"
            />
          </div>
        </div>
      )}

      {/* ── Valores da Compra ── */}
      {isCompra && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Vendedor(es) */}
          <div className="md:col-span-2">
            <label className="text-xs text-gray-500 mb-1 block">
              {isLeilao ? "Vendedor(es) / Fazenda(s) de Origem" : "Contraparte (quem vendeu)"}
            </label>
            <input
              name="contraparte"
              type="text"
              placeholder="Ex: Fazenda Boa Vista; Haras Primavera"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300"
            />
            <p className="mt-1 text-xs text-gray-400">Para múltiplos vendedores, separe com ponto e vírgula ( ; )</p>
          </div>

          {/* Valor da Parcela — input principal */}
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Valor da Parcela (R$)</label>
            <input
              name="valor_parcela"
              type="number"
              min="0"
              step="0.01"
              placeholder="Ex: 10333.33"
              value={valorParcela}
              onChange={(e) => setValorParcela(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300"
            />
          </div>

          {/* Nº de Parcelas */}
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Nº de Parcelas</label>
            <input
              name="n_parcelas_compra"
              type="number"
              min="1"
              max="360"
              step="1"
              placeholder="Ex: 30"
              value={nParcelas}
              onChange={(e) => setNParcelas(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300"
            />
          </div>

          {/* Faixa cinza: valor total calculado */}
          {totalCompra && (
            <div className="md:col-span-2 bg-gray-50 border border-gray-100 rounded-lg px-4 py-2.5 text-sm flex flex-wrap items-center gap-x-4 gap-y-1">
              <span className="text-gray-500">
                Valor total da compra:{" "}
                <span className="font-semibold text-gray-900">{fmt(totalCompra)}</span>
                <span className="text-gray-400 ml-1">({nParcelas}× {fmt(parcelaNum)})</span>
              </span>
              {valorizacao && (
                <>
                  <span className="text-gray-300 hidden md:inline">|</span>
                  <span className="text-gray-500">
                    Valorização 100%:{" "}
                    <span className="font-semibold text-brand-700">{fmt(valorizacao)}</span>
                  </span>
                </>
              )}
            </div>
          )}

          {/* Hidden: valor_total_compra para o Server Action */}
          <input type="hidden" name="valor_total_compra" value={totalCompra?.toFixed(2) ?? ""} />
        </div>
      )}

      {/* ── % Próprio da Fazenda ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="text-xs text-gray-500 mb-1 block">% Próprio da Fazenda</label>
          <div className="flex items-center gap-2">
            <input
              name="percentual_proprio"
              type="number"
              min="0"
              max="100"
              step="1"
              placeholder="Ex: 33"
              value={percProprio}
              onChange={(e) => setPercProprio(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300"
            />
            <span className="text-sm text-gray-400">%</span>
          </div>
          {valorizacao && (
            <p className="mt-1 text-xs text-gray-400">
              {percNum}% de {fmt(valorizacao)} = {fmt(totalCompra!)}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
