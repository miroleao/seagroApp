"use client";

import React, { useState } from "react";
import Link from "next/link";
import { FlaskConical, Plus, Dna, Beef, Calendar, ChevronDown, ChevronRight } from "lucide-react";
import { TabelaEmbrioes } from "./TabelaEmbrioes";
import { EditarAspiracao } from "./EditarAspiracao";
import { BotaoExcluirAsp } from "./BotaoExcluirAsp";
import { BotaoExcluirSessao } from "./BotaoExcluirSessao";

// ── Helpers ────────────────────────────────────────────────────────────────────
const MESES = [
  "Janeiro","Fevereiro","Março","Abril","Maio","Junho",
  "Julho","Agosto","Setembro","Outubro","Novembro","Dezembro",
];

function mesAno(dateStr: string | null): string {
  if (!dateStr) return "—";
  const [year, month] = dateStr.split("-");
  return `${MESES[parseInt(month) - 1]} ${year}`;
}

function diaLabel(dateStr: string | null): string {
  if (!dateStr) return "—";
  const [year, month, day] = dateStr.split("-");
  return `${parseInt(day)} de ${MESES[parseInt(month) - 1]} de ${year}`;
}

// ── Tipos ──────────────────────────────────────────────────────────────────────
export type DayGroup = { dayKey: string; sessions: any[]; events: string[] };
export type MonthGroup = {
  monthKey: string;
  monthLabel: string;
  days: DayGroup[];
  totalOocitos: number;
  totalEmbrioes: number;
  totalPositivos: number;
  totalSessoes: number;
};

export type ReceptoraBasica = {
  id: string;
  brinco: string | null;
  nome: string | null;
  status_rebanho: string | null;
};

interface Props {
  monthGroups: MonthGroup[];
  totalSessoesOPU: number;
  totalEmbrioes: number;
  totalPositivos: number;
  erro: string | null;
  receptoras: ReceptoraBasica[];
}

// ── Badge de evento ────────────────────────────────────────────────────────────
const EVENT_STYLES: Record<string, string> = {
  "OPU":  "bg-violet-100 text-violet-700",
  "FIV":  "bg-blue-100   text-blue-700",
  "T.E.": "bg-green-100  text-green-700",
  "DG":   "bg-amber-100  text-amber-700",
  "SEX":  "bg-pink-100   text-pink-700",
};
const EVENT_ORDER = ["OPU", "FIV", "T.E.", "DG", "SEX"];

function EventBadge({ event }: { event: string }) {
  const cls = EVENT_STYLES[event] ?? "bg-gray-100 text-gray-600";
  return (
    <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold tracking-wide ${cls}`}>
      {event}
    </span>
  );
}

// ── Seção de mês (accordion controlado via state) ──────────────────────────────
function MonthSection({ mg, receptoras }: { mg: MonthGroup; receptoras: ReceptoraBasica[] }) {
  const [open, setOpen] = useState(true);

  const taxa = mg.totalOocitos > 0
    ? Math.round((mg.totalEmbrioes / mg.totalOocitos) * 100)
    : null;

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      {/* Header clicável */}
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors text-left"
      >
        <div className="flex items-center gap-3">
          <Calendar className="w-4 h-4 text-violet-500 shrink-0" />
          <span className="font-bold text-gray-900 capitalize">{mg.monthLabel}</span>
          <span className="text-xs bg-violet-100 text-violet-700 font-medium px-2 py-0.5 rounded-full">
            {mg.totalSessoes} {mg.totalSessoes === 1 ? "sessão" : "sessões"}
          </span>
        </div>
        <div className="flex items-center gap-4 text-right">
          <div className="hidden sm:block text-center">
            <p className="text-[10px] text-gray-400 uppercase">Oócitos</p>
            <p className="text-sm font-semibold text-gray-700">{mg.totalOocitos || "—"}</p>
          </div>
          <div className="hidden sm:block text-center">
            <p className="text-[10px] text-gray-400 uppercase">Embriões</p>
            <p className="text-sm font-semibold text-gray-700">{mg.totalEmbrioes || "—"}</p>
          </div>
          {taxa !== null && (
            <div className="hidden sm:block text-center">
              <p className="text-[10px] text-gray-400 uppercase">Taxa</p>
              <p className="text-sm font-semibold text-violet-600">{taxa}%</p>
            </div>
          )}
          <div className="text-center">
            <p className="text-[10px] text-gray-400 uppercase">P+</p>
            <p className="text-sm font-semibold text-green-600">{mg.totalPositivos || "—"}</p>
          </div>
          <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${open ? "rotate-180" : ""}`} />
        </div>
      </button>

      {/* Conteúdo */}
      {open && (
        <div className="border-t border-gray-100 divide-y divide-gray-100">
          {mg.days.map((dg) => (
            <div key={dg.dayKey}>
              {/* Sub-header de dia */}
              <div className="px-5 py-2 bg-gray-50 flex items-center gap-2 border-b border-gray-100">
                <span className="text-xs font-semibold text-gray-500 capitalize">
                  {diaLabel(dg.dayKey)}
                </span>
                <div className="flex items-center gap-1">
                  {EVENT_ORDER.filter(ev => dg.events.includes(ev)).map(ev => (
                    <EventBadge key={ev} event={ev} />
                  ))}
                </div>
                <span className="text-[11px] text-gray-400">
                  · {dg.sessions.reduce((n: number, s: any) => n + (s.aspirations?.length ?? 0), 0)} doadoras
                </span>
                <div className="ml-auto">
                  <BotaoExcluirSessao
                    sessionIds={dg.sessions.map((s: any) => s.id)}
                    label={diaLabel(dg.dayKey)}
                  />
                </div>
              </div>

              {/* Cards das doadoras */}
              <div className="divide-y divide-gray-50">
                {dg.sessions.flatMap((session: any) =>
                  (session.aspirations ?? []).map((asp: any) => (
                    <AspCard key={asp.id} asp={asp} session={session} receptoras={receptoras} />
                  ))
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Card por aspiração/doadora (accordion controlado via state) ────────────────
function AspCard({ asp, session, receptoras }: { asp: any; session: any; receptoras: ReceptoraBasica[] }) {
  const [open, setOpen] = useState(true);

  const doadoraAnimal = asp.doadora as any;
  const nome    = doadoraAnimal?.nome ?? asp.doadora_nome ?? "—";
  const dbId    = doadoraAnimal?.id ?? null;
  const embryos: any[] = asp.embryos ?? [];

  const taxa = asp.oocitos_viaveis && asp.embryos_congelados
    ? Math.round((asp.embryos_congelados / asp.oocitos_viaveis) * 100)
    : null;

  const positivos = embryos
    .flatMap((e: any) => (e.transfers ?? []).flatMap((t: any) => t.pregnancy_diagnoses ?? []))
    .filter((d: any) => d.resultado === "POSITIVO").length;

  return (
    <div className="bg-white">
      {/* Header clicável da doadora */}
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-5 py-3 hover:bg-gray-50/80 transition-colors text-left gap-3"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-7 h-7 rounded-full bg-violet-100 flex items-center justify-center shrink-0">
            <span className="text-violet-700 font-bold text-[11px]">{nome.charAt(0)}</span>
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p className="font-semibold text-gray-900 text-sm truncate">{nome}</p>
              {session.tipo === "COMPRADA" && (
                <span className="shrink-0 text-[10px] font-semibold bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full">
                  Adquirida
                </span>
              )}
            </div>
            <p className="text-[11px] text-gray-400">
              {session.local ? `${session.local}` : ""}
              {session.laboratorio ? ` · Lab: ${session.laboratorio}` : ""}
              {asp.touro_nome ? ` · Touro: ${asp.touro_nome}` : ""}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0 text-right">
          {asp.oocitos_viaveis != null && (
            <div className="hidden sm:block text-center">
              <p className="text-[10px] text-gray-400">Oócitos</p>
              <p className="text-xs font-semibold text-gray-700">{asp.oocitos_viaveis}</p>
            </div>
          )}
          {asp.embryos_congelados != null && (
            <div className="hidden sm:block text-center">
              <p className="text-[10px] text-gray-400">Embriões</p>
              <p className="text-xs font-semibold text-gray-700">{asp.embryos_congelados}</p>
            </div>
          )}
          {taxa !== null && (
            <div className="hidden sm:block text-center">
              <p className="text-[10px] text-gray-400">Taxa</p>
              <p className="text-xs font-semibold text-violet-600">{taxa}%</p>
            </div>
          )}
          <div className="text-center">
            <p className="text-[10px] text-gray-400">P+</p>
            <p className="text-xs font-semibold text-green-600">{positivos || "—"}</p>
          </div>
          {open
            ? <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
            : <ChevronRight className="w-3.5 h-3.5 text-gray-400" />
          }
        </div>
      </button>

      {/* Conteúdo expandido */}
      {open && (
        <>
          {/* Barra de ações */}
          <div className="px-5 py-2 border-t border-gray-50 bg-white flex flex-wrap items-center gap-2">
            {dbId && (
              <Link
                href={`/doadoras/${dbId}`}
                className="text-xs text-violet-600 hover:underline whitespace-nowrap"
              >
                Ver ficha →
              </Link>
            )}
            <div className="ml-auto flex items-center gap-2">
              <EditarAspiracao
                aspId={asp.id}
                touro_nome={asp.touro_nome ?? null}
                touro_rgn={asp.touro_rgn ?? null}
                oocitos_viaveis={asp.oocitos_viaveis ?? null}
                embryos_congelados={asp.embryos_congelados ?? null}
                implantados={asp.implantados ?? null}
                prenhezes_count={asp.prenhezes_count ?? null}
                custo_total={asp.custo_total ?? null}
                observacoes={asp.observacoes ?? null}
              />
              <BotaoExcluirAsp aspId={asp.id} nomeDoadora={nome} />
            </div>
          </div>

          {/* Tabela de embriões */}
          {embryos.length > 0 ? (
            <TabelaEmbrioes
              embryos={embryos}
              dataFiv={session.data_fiv ?? null}
              dataDgSessao={session.data_dg ?? null}
              receptoras={receptoras}
            />
          ) : (
            <p className="px-5 pb-3 text-xs text-gray-400 italic border-t border-gray-50 pt-2">
              Nenhum embrião registrado.
            </p>
          )}
        </>
      )}
    </div>
  );
}

// ── Componente principal ───────────────────────────────────────────────────────
export function ReproducaoUI({ monthGroups, totalSessoesOPU, totalEmbrioes, totalPositivos, erro, receptoras }: Props) {
  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Reprodução</h1>
        <p className="text-sm text-gray-500 mt-0.5">Sessões de OPU‑FIV organizadas por data</p>
      </div>

      {erro && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
          Erro ao carregar dados: {erro}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {[
          { label: "Sessões OPU", value: totalSessoesOPU, Icon: FlaskConical, color: "text-violet-600" },
          { label: "Embriões",    value: totalEmbrioes,   Icon: Dna,          color: "text-blue-600"   },
          { label: "P+",          value: totalPositivos,  Icon: Beef,         color: "text-green-600"  },
        ].map(({ label, value, Icon, color }) => (
          <div key={label} className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3">
            <div className={`p-2 rounded-lg bg-gray-50 ${color}`}>
              <Icon className="w-5 h-5" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{value}</p>
              <p className="text-xs text-gray-500">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Botão nova sessão */}
      <div className="flex items-center gap-3">
        <Link
          href="/reproducao/opu/nova"
          className="inline-flex items-center gap-2 bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium px-4 py-2.5 rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" />
          Nova Sessão OPU
        </Link>
        <p className="text-xs text-gray-400">Registre uma sessão com múltiplas doadoras de uma vez.</p>
      </div>

      {/* Grupos por mês */}
      {monthGroups.length === 0 ? (
        <p className="text-sm text-gray-400 py-10 text-center">Nenhuma aspiração registrada.</p>
      ) : (
        <div className="space-y-4">
          {monthGroups.map((mg) => (
            <MonthSection key={mg.monthKey} mg={mg} receptoras={receptoras} />
          ))}
        </div>
      )}
    </div>
  );
}
