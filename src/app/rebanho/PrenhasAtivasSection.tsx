"use client";

import { useState } from "react";
import Link from "next/link";
import { Baby, ChevronDown, ChevronUp } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { DesfechoUnificadoInline } from "./DesfechoUnificadoInline";
import { EditLocalizacaoRebanho } from "./EditLocalizacaoRebanho";
import { EditPrenheInline } from "./EditPrenheInline";

const STATUS_MAP: Record<string, { label: string; cls: string }> = {
  PRENHA:         { label: "Prenha",            cls: "bg-green-100 text-green-700" },
  PRENHA_EMBRIAO: { label: "Prenha de Embrião", cls: "bg-teal-100 text-teal-700"  },
};

function StatusBadge({ st }: { st: string | null }) {
  const m = STATUS_MAP[st ?? ""] ?? { label: st ?? "—", cls: "bg-gray-100 text-gray-400" };
  return <span className={`badge text-[11px] ${m.cls}`}>{m.label}</span>;
}

function SexagemBadge({ sexagem }: { sexagem: string | null }) {
  if (!sexagem || sexagem === "NAO_SEXADO")
    return <span className="text-gray-300 text-[11px]">—</span>;
  if (sexagem === "MACHO")
    return (
      <span className="inline-flex items-center gap-0.5 text-[11px] font-semibold text-blue-600 bg-blue-50 border border-blue-200 rounded px-1.5 py-0.5">
        ♂ M
      </span>
    );
  if (sexagem === "FEMEA")
    return (
      <span className="inline-flex items-center gap-0.5 text-[11px] font-semibold text-pink-600 bg-pink-50 border border-pink-200 rounded px-1.5 py-0.5">
        ♀ F
      </span>
    );
  return <span className="text-gray-300 text-[11px]">—</span>;
}

export type PrenhaAnimal = {
  id: string;
  brinco: string | null;
  nome: string | null;
  rgn: string | null;
  status_rebanho: string | null;
  localizacao: string | null;
  prenheInfo: {
    transferId: string;
    previsao: string | null;
    dataTe: string | null;
    doadoraNome: string | null;
    doadoraId: string | null;
    touroNome: string | null;
    sexagem: string | null;
    tipoDesfecho: string | null;
  } | null;
};

interface Props {
  prenhas: PrenhaAnimal[];
}

export function PrenhasAtivasSection({ prenhas }: Props) {
  const [expandido, setExpandido] = useState(false);

  if (prenhas.length === 0) return null;

  return (
    <section className="card overflow-hidden border-green-200">
      {/* Header clicável */}
      <button
        type="button"
        onClick={() => setExpandido(v => !v)}
        className="w-full px-5 py-3 bg-green-50 border-b border-green-100 flex items-center gap-2 hover:bg-green-100/60 transition-colors text-left"
      >
        <Baby className="w-4 h-4 text-green-600 shrink-0" />
        <h2 className="font-semibold text-green-800 text-sm flex-1">Prenhes Ativas</h2>
        <span className="badge bg-green-100 text-green-700">{prenhas.length}</span>
        {expandido
          ? <ChevronUp className="w-4 h-4 text-green-600 shrink-0" />
          : <ChevronDown className="w-4 h-4 text-green-600 shrink-0" />
        }
      </button>

      {/* Tabela — só quando expandido */}
      {expandido && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-left">
                <th className="px-4 py-2 text-xs font-medium text-gray-500">Brinco</th>
                <th className="px-4 py-2 text-xs font-medium text-gray-500">Status</th>
                <th className="px-4 py-2 text-xs font-medium text-gray-500">Doadora</th>
                <th className="px-4 py-2 text-xs font-medium text-gray-500">Touro</th>
                <th className="px-4 py-2 text-xs font-medium text-gray-500">Sexagem</th>
                <th className="px-4 py-2 text-xs font-medium text-gray-500">Data T.E.</th>
                <th className="px-4 py-2 text-xs font-medium text-gray-500">Prev. Parto</th>
                <th className="px-4 py-2 text-xs font-medium text-gray-500">Desfecho</th>
                <th className="px-4 py-2 text-xs font-medium text-gray-500">Local</th>
                <th className="px-4 py-2 text-xs font-medium text-gray-500"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {prenhas.map((a) => {
                const p = a.prenheInfo;
                return (
                  <tr key={a.id} className="table-row-hover">
                    <td className="px-4 py-2.5 font-mono font-semibold">
                      <Link
                        href={`/rebanho/${a.id}`}
                        className="text-brand-700 hover:text-brand-900 hover:underline"
                      >
                        {a.brinco ?? a.nome}
                      </Link>
                      {a.rgn && (
                        <span className="block text-[10px] font-normal text-gray-400 font-mono mt-0.5">
                          #{a.rgn}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      <StatusBadge st={a.status_rebanho} />
                    </td>
                    <td className="px-4 py-2.5 text-xs">
                      {p?.doadoraId ? (
                        <Link
                          href={`/doadoras/${p.doadoraId}`}
                          className="text-brand-600 hover:underline font-medium"
                        >
                          {p.doadoraNome}
                        </Link>
                      ) : (
                        p?.doadoraNome ?? <span className="text-gray-300">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-gray-600">
                      {p?.touroNome ?? "—"}
                    </td>
                    <td className="px-4 py-2.5">
                      <SexagemBadge sexagem={p?.sexagem ?? null} />
                    </td>
                    <td className="px-4 py-2.5 text-xs text-gray-600">
                      {formatDate(p?.dataTe ?? null)}
                    </td>
                    <td className="px-4 py-2.5 text-xs font-semibold text-green-700">
                      {formatDate(p?.previsao ?? null)}
                    </td>
                    <td className="px-4 py-2.5">
                      <DesfechoUnificadoInline
                        animalId={a.id}
                        brinco={a.brinco ?? a.nome ?? ""}
                        isPrenha={true}
                        transferId={p?.transferId ?? null}
                        tipoDesfechoAtual={p?.tipoDesfecho ?? null}
                        statusRebanho={a.status_rebanho ?? null}
                      />
                    </td>
                    <td className="px-4 py-2.5">
                      <EditLocalizacaoRebanho
                        animalId={a.id}
                        localizacao={a.localizacao ?? null}
                      />
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/rebanho/${a.id}`}
                          className="inline-flex items-center gap-1 text-xs text-brand-600 hover:underline"
                        >
                          Ficha
                        </Link>
                        <EditPrenheInline
                          receptoraId={a.id}
                          brinco={a.brinco ?? a.nome ?? ""}
                          doadoraNome={p?.doadoraNome ?? null}
                          touroNome={p?.touroNome ?? null}
                          dataTe={p?.dataTe ?? null}
                          previsao={p?.previsao ?? null}
                        />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
