"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { ChevronDown, ChevronUp } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { EditReprodutivoInline } from "./EditReprodutivoInline";

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
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-left">
                  <th className="px-4 py-2 text-xs font-medium text-gray-500 w-32">Brinco</th>
                  <th className="px-4 py-2 text-xs font-medium text-gray-500 w-32">Data Saída</th>
                  <th className="px-4 py-2 text-xs font-medium text-gray-500">Comprador</th>
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
                    <td className="px-4 py-2.5 text-xs text-gray-600">
                      {a.dataSaida ? formatDate(a.dataSaida) : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-gray-700">
                      {a.comprador ?? <span className="text-gray-300">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
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
