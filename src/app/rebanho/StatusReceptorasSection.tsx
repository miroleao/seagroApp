"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { ChevronDown, ChevronUp } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { EditReprodutivoInline } from "./EditReprodutivoInline";

// ── Grupo de vendas por data+comprador ────────────────────────────────────────
function GrupoVenda({ data, comprador, animais }: {
  data: string | null;
  comprador: string | null;
  animais: { id: string; brinco: string | null; nome: string | null }[];
}) {
  const [aberto, setAberto] = useState(false);
  return (
    <div className="border-b border-gray-100 last:border-0">
      <button
        type="button"
        onClick={() => setAberto(v => !v)}
        className="w-full px-4 py-2.5 flex items-center gap-3 hover:bg-gray-50 text-left transition-colors"
      >
        <span className="text-xs font-semibold text-gray-700 w-24 shrink-0">
          {data ? formatDate(data) : <span className="text-gray-300">—</span>}
        </span>
        <span className="text-xs text-gray-600 flex-1">{comprador ?? <span className="text-gray-300">—</span>}</span>
        <span className="text-[10px] font-bold bg-gray-100 text-gray-500 rounded-full px-2 py-0.5 shrink-0">
          {animais.length} cab.
        </span>
        {aberto
          ? <ChevronUp   className="w-3.5 h-3.5 text-gray-400 shrink-0" />
          : <ChevronDown className="w-3.5 h-3.5 text-gray-400 shrink-0" />}
      </button>
      {aberto && (
        <div className="px-4 pb-3 flex flex-wrap gap-2">
          {animais.map(a => (
            <Link
              key={a.id}
              href={`/rebanho/${a.id}`}
              className="text-xs font-mono font-semibold text-brand-700 hover:underline bg-brand-50 px-2 py-0.5 rounded"
            >
              {a.brinco ?? a.nome}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export type StatusItem = {
  id: string;
  brinco: string | null;
  nome: string | null;
  localizacao: string | null;
  peso_atual: number | null;
  numeroPartos: number;
  statusRebanho?: string | null;
  // Paridas — campos extras
  doadoraNome?: string | null;
  doadoraId?: string | null;
  touroNome?: string | null;
  dataDesfecho?: string | null;
  // Vendidas — campos extras
  dataSaida?: string | null;
  comprador?: string | null;
};

interface Props {
  titulo: string;
  animais: StatusItem[];
  tipo: "simples" | "paridas" | "vendidas";
  mostrarReproductivo?: boolean;
  // Estilo
  headerBg:  string;
  tituloCls: string;
  badgeCls:  string;
  dotCls:    string;
  icono:     ReactNode;
}

export function StatusReceptorasSection({
  titulo, animais, tipo,
  mostrarReproductivo = false,
  headerBg, tituloCls, badgeCls, dotCls, icono,
}: Props) {
  const [expandido, setExpandido] = useState(false);

  if (animais.length === 0) return null;

  return (
    <section className="card overflow-hidden">
      <button
        type="button"
        onClick={() => setExpandido(v => !v)}
        className={`w-full px-5 py-3 border-b flex items-center gap-2 hover:brightness-95 transition-all text-left ${headerBg}`}
      >
        <span className={`shrink-0 ${dotCls}`}>{icono}</span>
        <h2 className={`font-semibold text-sm flex-1 ${tituloCls}`}>{titulo}</h2>
        <span className={`badge ${badgeCls}`}>{animais.length}</span>
        {expandido
          ? <ChevronUp   className={`w-4 h-4 shrink-0 ${dotCls}`} />
          : <ChevronDown className={`w-4 h-4 shrink-0 ${dotCls}`} />}
      </button>

      {expandido && (
        <div className="overflow-x-auto">
          {tipo === "vendidas" ? (
            <div className="divide-y divide-gray-100">
              {/* Cabeçalho */}
              <div className="px-4 py-2 flex items-center gap-3 bg-gray-50">
                <span className="text-[10px] font-medium text-gray-400 uppercase tracking-wide w-24 shrink-0">Data Saída</span>
                <span className="text-[10px] font-medium text-gray-400 uppercase tracking-wide flex-1">Comprador</span>
                <span className="text-[10px] font-medium text-gray-400 uppercase tracking-wide w-16 text-right pr-6">Qtd</span>
              </div>
              {(() => {
                // Agrupa por dataSaida + comprador
                const grupos = new Map<string, { data: string | null; comprador: string | null; animais: typeof animais }>();
                for (const a of animais) {
                  const key = `${a.dataSaida ?? ""}||${a.comprador ?? ""}`;
                  if (!grupos.has(key)) grupos.set(key, { data: a.dataSaida ?? null, comprador: a.comprador ?? null, animais: [] });
                  grupos.get(key)!.animais.push(a);
                }
                return Array.from(grupos.values()).map((g, i) => (
                  <GrupoVenda key={i} data={g.data} comprador={g.comprador} animais={g.animais} />
                ));
              })()}
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-left">
                  <th className="px-4 py-2 text-xs font-medium text-gray-500">Brinco</th>
                  {mostrarReproductivo && (
                    <th className="px-4 py-2 text-xs font-medium text-gray-500 w-44">Reprodutivo</th>
                  )}
                  {tipo === "paridas" && <>
                    <th className="px-4 py-2 text-xs font-medium text-gray-500">Doadora</th>
                    <th className="px-4 py-2 text-xs font-medium text-gray-500">Touro</th>
                    <th className="px-4 py-2 text-xs font-medium text-gray-500">Data Parto</th>
                  </>}
                  <th className="px-4 py-2 text-xs font-medium text-gray-500">Peso</th>
                  <th className="px-4 py-2 text-xs font-medium text-gray-500 text-center">Partos</th>
                  <th className="px-4 py-2 text-xs font-medium text-gray-500">Localização</th>
                  <th className="px-4 py-2 text-xs font-medium text-gray-500"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {animais.map(a => (
                  <tr key={a.id} className="table-row-hover">
                    <td className="px-4 py-2.5 font-mono font-semibold">
                      <Link href={`/rebanho/${a.id}`} className="text-brand-700 hover:underline text-xs">
                        {a.brinco ?? a.nome}
                      </Link>
                    </td>
                    {mostrarReproductivo && (
                      <td className="px-4 py-2.5">
                        <EditReprodutivoInline animalId={a.id} statusAtual={a.statusRebanho ?? null} />
                      </td>
                    )}
                    {tipo === "paridas" && <>
                      <td className="px-4 py-2.5 text-xs">
                        {a.doadoraId ? (
                          <Link href={`/doadoras/${a.doadoraId}`} className="text-brand-600 hover:underline font-medium">
                            {a.doadoraNome}
                          </Link>
                        ) : a.doadoraNome ? (
                          <span className="text-gray-700 font-medium">{a.doadoraNome}</span>
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-xs text-gray-600">{a.touroNome ?? "—"}</td>
                      <td className="px-4 py-2.5 text-xs font-semibold text-green-700">
                        {formatDate(a.dataDesfecho ?? null)}
                      </td>
                    </>}
                    <td className="px-4 py-2.5 text-xs text-gray-600">
                      {a.peso_atual != null ? `${a.peso_atual} kg` : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      {a.numeroPartos > 0 ? (
                        <span className="text-xs font-bold text-gray-700 bg-gray-100 rounded-full px-2 py-0.5">
                          {a.numeroPartos}
                        </span>
                      ) : (
                        <span className="text-gray-300 text-xs">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-gray-500">{a.localizacao ?? "—"}</td>
                    <td className="px-4 py-2.5">
                      <Link href={`/rebanho/${a.id}`} className="text-xs text-brand-600 hover:underline font-medium">
                        Ficha →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </section>
  );
}
