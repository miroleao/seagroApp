"use client";

import { useState, useEffect, useTransition } from "react";
import { TrendingUp, TrendingDown, Minus, ShoppingCart, Loader2, Check, LogOut, Handshake } from "lucide-react";
import { useRouter } from "next/navigation";
import { registrarVendaAnimal } from "@/lib/actions/venda";
import { useVendaSync } from "./VendaSyncContext";

interface Props {
  metaParcela: number | null;
  defaultComprador?: string;
  defaultParcela?: number;
  defaultNParcelas?: number;
  defaultPercentual?: number;
  /** Habilita o botão que grava a venda de verdade (financeiro + saída). */
  animalId?: string;
  /** Participação atual da fazenda, em % (0–100). */
  percentualProprioAtual?: number;
}

function fmt(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default function VendaLeilaoSection({
  metaParcela,
  defaultComprador = "",
  defaultParcela,
  defaultNParcelas,
  defaultPercentual,
  animalId,
  percentualProprioAtual = 100,
}: Props) {
  const [comprador, setComprador]   = useState(defaultComprador);
  const [parcela, setParcela]       = useState(defaultParcela?.toString() ?? "");
  const [nParcelas, setNParcelas]   = useState(defaultNParcelas?.toString() ?? "30");
  const [percentual, setPercentual] = useState(defaultPercentual?.toString() ?? "100");

  const parcelaNum  = parseFloat(parcela.replace(",", ".")) || 0;
  const nParcelasNum = parseInt(nParcelas) || 1;
  const percentualNum = parseFloat(percentual.replace(",", ".")) || 100;

  const vendaTotal  = parcelaNum > 0 ? parcelaNum * nParcelasNum : null;
  const metaTotal   = metaParcela ? metaParcela * 30 : null;

  // ── Publica o valor de venda definitivo para o form "Registrar Venda" ──
  const vendaSync = useVendaSync();
  useEffect(() => {
    vendaSync?.setData({
      comprador,
      valorParcela: parcelaNum > 0 ? parcelaNum : null,
      nParcelas: nParcelasNum,
      valorTotal: vendaTotal,
      percentual: percentualNum,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [comprador, parcelaNum, nParcelasNum, percentualNum, vendaTotal]);

  // ── Registro efetivo ───────────────────────────────────────────────────
  const [dataVenda, setDataVenda] = useState(() => new Date().toISOString().split("T")[0]);
  const [obsVenda,  setObsVenda]  = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null);
  const [pendente, iniciar] = useTransition();
  const router = useRouter();

  // Regra: saída só quando a participação própria zera
  const restante    = Math.max(0, parseFloat((percentualProprioAtual - percentualNum).toFixed(2)));
  const vaiDarSaida = restante <= 0.01;

  function registrar() {
    if (!animalId || !vendaTotal) return;
    setMsg(null);
    const fd = new FormData();
    fd.set("animal_id",           animalId);
    fd.set("venda_comprador",     comprador);
    fd.set("venda_valor_parcela", String(parcelaNum));
    fd.set("venda_n_parcelas",    String(nParcelasNum));
    fd.set("venda_percentual",    String(percentualNum));
    fd.set("venda_data",          dataVenda);
    fd.set("venda_observacoes",   obsVenda);

    iniciar(async () => {
      const res = await registrarVendaAnimal(fd);
      if (!res.ok) { setMsg({ ok: false, texto: res.erro ?? "Erro ao registrar" }); return; }
      setMsg({
        ok: true,
        texto: res.deuSaida
          ? "Venda registrada. Animal recebeu saída."
          : `Venda registrada. Participação restante: ${res.percentualRestante}%.`,
      });
      router.refresh();
    });
  }

  // Comparativo
  type Status = "acima" | "abaixo" | "meta" | null;
  let status: Status = null;
  let diff = 0;
  if (vendaTotal && metaTotal) {
    diff = vendaTotal - metaTotal;
    if (diff > 0.005)        status = "acima";
    else if (diff < -0.005)  status = "abaixo";
    else                     status = "meta";
  }

  return (
    <div>
      <p className="text-[11px] font-semibold text-amber-700 uppercase tracking-wide mb-3">
        Realização da Venda
      </p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* Comprador(es) */}
        <div className="md:col-span-3">
          <label className="text-xs text-gray-500 mb-1 block">Comprador(es)</label>
          <input
            name="venda_comprador"
            type="text"
            value={comprador}
            onChange={(e) => setComprador(e.target.value)}
            placeholder="Ex: Fazenda Boa Vista; João Silva"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300"
          />
          <p className="mt-0.5 text-xs text-gray-400">Para múltiplos compradores, separe com ; (ponto e vírgula)</p>
        </div>

        {/* Parcela de venda */}
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Parcela de Venda (R$)</label>
          <input
            name="venda_valor_parcela"
            type="number"
            step="0.01"
            min="0"
            value={parcela}
            onChange={(e) => setParcela(e.target.value)}
            placeholder="Ex: 1800.00"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300"
          />
        </div>

        {/* Nº de parcelas */}
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Nº de Parcelas</label>
          <input
            name="venda_n_parcelas"
            type="number"
            min="1"
            max="360"
            step="1"
            value={nParcelas}
            onChange={(e) => setNParcelas(e.target.value)}
            placeholder="Ex: 30"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300"
          />
        </div>

        {/* % Vendido */}
        <div>
          <label className="text-xs text-gray-500 mb-1 block">% Vendido</label>
          <div className="relative">
            <input
              name="venda_percentual"
              type="number"
              min="1"
              max="100"
              step="1"
              value={percentual}
              onChange={(e) => setPercentual(e.target.value)}
              placeholder="Ex: 100, 50, 33"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 pr-7 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">%</span>
          </div>
          <p className="mt-0.5 text-xs text-gray-400">% do animal vendido nesta negociação</p>
        </div>

        {/* Total calculado */}
        <div className="flex items-end pb-0.5">
          {vendaTotal ? (
            <p className="text-sm text-gray-700">
              Total:{" "}
              <span className="font-bold text-gray-900">{fmt(vendaTotal)}</span>
              <span className="text-xs text-gray-400 ml-1">(× {nParcelas})</span>
              {percentualNum !== 100 && (
                <span className="text-xs text-amber-600 ml-1">· {percentualNum}% vendido</span>
              )}
            </p>
          ) : (
            <p className="text-xs text-gray-400 italic">Total = parcela × nº parcelas</p>
          )}
        </div>
      </div>

      {/* ── Registro efetivo da venda ─────────────────────────────────── */}
      {animalId && (
        <div className="mt-4 rounded-lg border border-amber-200 bg-white p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Data da venda</label>
              <input
                type="date"
                value={dataVenda}
                onChange={(e) => setDataVenda(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Observações</label>
              <input
                type="text"
                value={obsVenda}
                onChange={(e) => setObsVenda(e.target.value)}
                placeholder="Leilão, condições…"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300"
              />
            </div>
          </div>

          {/* Prévia do efeito — deixa claro o que muda antes de gravar */}
          {vendaTotal && (
            <div className="rounded-lg bg-gray-50 border border-gray-100 px-3 py-2.5 text-xs space-y-1">
              <p className="text-gray-600">
                Registra <span className="font-semibold text-green-700">{fmt(vendaTotal)}</span> no
                financeiro em {nParcelasNum}× de {fmt(parcelaNum)}.
              </p>
              {vaiDarSaida ? (
                <p className="flex items-center gap-1.5 text-red-700 font-medium">
                  <LogOut className="w-3 h-3 shrink-0" />
                  Participação zera — o animal recebe saída (status Vendida).
                </p>
              ) : (
                <p className="flex items-center gap-1.5 text-amber-700">
                  <Handshake className="w-3 h-3 shrink-0" />
                  Participação cai de {percentualProprioAtual}% para {restante}% — o animal
                  continua ativo, sem saída.
                </p>
              )}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={registrar}
              disabled={!vendaTotal || pendente}
              className="inline-flex items-center gap-2 bg-amber-600 hover:bg-amber-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm px-4 py-2 rounded-lg transition-colors font-medium"
            >
              {pendente
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : <ShoppingCart className="w-4 h-4" />}
              Registrar venda
            </button>
            {msg && (
              <p className={`text-xs flex items-center gap-1 ${msg.ok ? "text-green-700" : "text-red-600"}`}>
                {msg.ok && <Check className="w-3.5 h-3.5 shrink-0" />}
                {msg.texto}
              </p>
            )}
          </div>

          <p className="text-[10px] text-gray-400 leading-relaxed">
            Grava de uma vez: transação e parcelas no Financeiro, os dados aqui no card
            e a participação da fazenda. Saída só é aplicada quando a participação chega a zero.
          </p>
        </div>
      )}

      {/* ── Comparativo com Meta ── */}
      {(vendaTotal || metaTotal) && (
        <div className="mt-4">
          {!metaTotal ? (
            <p className="text-xs text-gray-400 italic">
              Defina uma meta de valor acima para ver o comparativo.
            </p>
          ) : !vendaTotal ? (
            <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 text-sm text-gray-500">
              Meta definida em <span className="font-semibold text-gray-700 ml-1">{fmt(metaTotal)}</span>
              <span className="text-xs text-gray-400 ml-1">(× 30 parcelas de {fmt(metaParcela!)})</span>
              — preencha a venda para ver o comparativo.
            </div>
          ) : status === "meta" ? (
            <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg px-4 py-3 text-sm text-green-800">
              <Minus className="w-4 h-4 shrink-0" />
              <span className="font-semibold">Meta exatamente atingida!</span>
              <span className="text-green-600 text-xs">Venda = {fmt(vendaTotal)} = Meta</span>
            </div>
          ) : status === "acima" ? (
            <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg px-4 py-3 text-sm text-green-800">
              <TrendingUp className="w-4 h-4 shrink-0 text-green-600" />
              <div>
                <span className="font-semibold">{fmt(diff)} acima da meta</span>
                <span className="text-green-600 text-xs ml-2">
                  Venda {fmt(vendaTotal)} vs Meta {fmt(metaTotal)}
                </span>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-800">
              <TrendingDown className="w-4 h-4 shrink-0 text-red-500" />
              <div>
                <span className="font-semibold">{fmt(Math.abs(diff))} abaixo da meta</span>
                <span className="text-red-500 text-xs ml-2">
                  Venda {fmt(vendaTotal)} vs Meta {fmt(metaTotal)}
                </span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
