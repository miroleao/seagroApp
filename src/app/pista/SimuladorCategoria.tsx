"use client";

import { useMemo, useState } from "react";
import { Calculator, Scale, CalendarDays, ArrowRight, Info } from "lucide-react";
import { simularCategoria } from "@/lib/acnb";

type ExposicaoOpt = { id: string; nome: string; data_base: string | null };

const inputCls =
  "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-300";
const labelCls =
  "text-[10px] font-semibold text-gray-500 mb-1 block uppercase tracking-wide";

function fmtBR(iso: string) {
  return new Date(iso + "T12:00:00").toLocaleDateString("pt-BR");
}

export function SimuladorCategoria({ exposicoes }: { exposicoes: ExposicaoOpt[] }) {
  const comData = exposicoes.filter((e) => e.data_base);

  const [dataBase, setDataBase]     = useState("");
  const [nascimento, setNascimento] = useState("");
  const [sexo, setSexo]             = useState<"M" | "F">("F");

  const sim = useMemo(() => {
    if (!dataBase || !nascimento) return null;
    if (nascimento > dataBase) return "INVALIDO" as const;
    return simularCategoria(nascimento, sexo, dataBase);
  }, [dataBase, nascimento, sexo]);

  return (
    <div className="card p-5 space-y-4">
      <div className="flex items-center gap-2">
        <Calculator className="w-4 h-4 text-brand-600 shrink-0" />
        <h2 className="font-semibold text-gray-900">Simulador de Categoria</h2>
        <span className="text-[10px] text-gray-400 font-normal">
          Regulamento ExpoZebu — grupos ABCZ
        </span>
      </div>

      {/* ── Entradas ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Data base do evento */}
        <div>
          <label className={labelCls}>Data base do evento</label>
          <input
            type="date"
            value={dataBase}
            onChange={(e) => setDataBase(e.target.value)}
            className={inputCls}
          />
          {comData.length > 0 && (
            <select
              value=""
              onChange={(e) => e.target.value && setDataBase(e.target.value)}
              className="mt-1.5 w-full border border-gray-100 rounded-lg px-2 py-1.5 text-[11px] text-gray-500 bg-gray-50 focus:outline-none focus:ring-1 focus:ring-brand-200"
            >
              <option value="">— usar data de uma exposição —</option>
              {comData.map((e) => (
                <option key={e.id} value={e.data_base!}>
                  {e.nome} ({fmtBR(e.data_base!)})
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Data de nascimento */}
        <div>
          <label className={labelCls}>Data de nascimento</label>
          <input
            type="date"
            value={nascimento}
            onChange={(e) => setNascimento(e.target.value)}
            className={inputCls}
          />
        </div>

        {/* Sexo */}
        <div>
          <label className={labelCls}>Sexo</label>
          <div className="flex gap-2">
            {([
              { v: "F" as const, label: "Fêmea" },
              { v: "M" as const, label: "Macho" },
            ]).map((o) => (
              <button
                key={o.v}
                type="button"
                onClick={() => setSexo(o.v)}
                className={`flex-1 px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${
                  sexo === o.v
                    ? "border-brand-500 bg-brand-50 text-brand-700"
                    : "border-gray-200 text-gray-500 hover:border-gray-300 bg-white"
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>

        {/* Idade calculada */}
        <div>
          <label className={labelCls}>Idade na data base</label>
          <div className="rounded-lg px-3 py-2 text-sm font-semibold border bg-gray-50 border-gray-200 text-gray-700 min-h-[38px] flex items-center">
            {sim && sim !== "INVALIDO"
              ? <span>{sim.meses}m <span className="text-gray-400 font-normal">+ {sim.dias}d</span></span>
              : <span className="text-gray-300 font-normal">—</span>}
          </div>
        </div>
      </div>

      {/* ── Resultado ────────────────────────────────────────────────── */}
      {sim === "INVALIDO" && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          A data de nascimento é posterior à data base do evento.
        </div>
      )}

      {sim && sim !== "INVALIDO" && (
        <div className="rounded-lg border border-gray-100 bg-gray-50 p-4 space-y-3">
          {sim.grupo ? (
            <>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="text-[10px] text-gray-400 uppercase tracking-wide font-semibold">
                  Categoria
                </span>
                <span className="text-lg font-bold text-brand-700">{sim.grupo.nome}</span>
                <span className="text-[11px] text-gray-400">
                  faixa {sim.grupo.min}–{sim.grupo.max}m
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="bg-white rounded-lg border border-gray-100 px-3 py-2">
                  <p className="text-[10px] text-gray-400 uppercase tracking-wide flex items-center gap-1">
                    <Scale className="w-3 h-3" /> Peso mínimo
                  </p>
                  <p className="text-base font-bold text-gray-900">
                    {sim.pesoMin != null
                      ? <>{sim.pesoMin} <span className="text-[11px] font-normal text-gray-400">kg</span></>
                      : <span className="text-gray-300 text-sm font-normal">sem tabela</span>}
                  </p>
                </div>
                <div className="bg-white rounded-lg border border-gray-100 px-3 py-2">
                  <p className="text-[10px] text-gray-400 uppercase tracking-wide flex items-center gap-1">
                    <Scale className="w-3 h-3" /> Peso máximo
                  </p>
                  <p className="text-base font-bold text-gray-900">
                    {sim.pesoMax != null
                      ? <>{sim.pesoMax} <span className="text-[11px] font-normal text-gray-400">kg</span></>
                      : <span className="text-gray-300 text-sm font-normal">sem limite</span>}
                  </p>
                </div>
                <div className="bg-white rounded-lg border border-gray-100 px-3 py-2 col-span-2 sm:col-span-1">
                  <p className="text-[10px] text-gray-400 uppercase tracking-wide flex items-center gap-1">
                    <CalendarDays className="w-3 h-3" /> Sai da categoria em
                  </p>
                  <p className="text-base font-bold text-gray-900">
                    {sim.proximoGrupo
                      ? fmtBR(sim.proximoGrupo.entraEm)
                      : <span className="text-gray-300 text-sm font-normal">—</span>}
                  </p>
                </div>
              </div>

              {sim.proximoGrupo && (
                <p className="text-[11px] text-gray-500 flex items-center gap-1.5">
                  <ArrowRight className="w-3 h-3 text-gray-400 shrink-0" />
                  A partir de {fmtBR(sim.proximoGrupo.entraEm)} passa para{" "}
                  <span className="font-semibold text-gray-700">{sim.proximoGrupo.nome}</span>
                </p>
              )}

              {sim.pesoMax == null && sim.pesoMin != null && (
                <p className="text-[11px] text-gray-400 flex items-start gap-1.5">
                  <Info className="w-3 h-3 mt-0.5 shrink-0" />
                  A tabela oficial de peso máximo cobre apenas 6 a 20 meses. Acima disso
                  vale só o mínimo.
                </p>
              )}
            </>
          ) : (
            <div className="flex items-start gap-2 text-sm text-amber-700">
              <Info className="w-4 h-4 mt-0.5 shrink-0" />
              <div>
                <p className="font-medium">Fora das categorias de pista</p>
                <p className="text-[12px] text-amber-600 mt-0.5">{sim.motivoForaDeGrupo}</p>
                {sim.proximoGrupo && (
                  <p className="text-[12px] text-amber-600 mt-1">
                    Entra em <span className="font-semibold">{sim.proximoGrupo.nome}</span> a
                    partir de {fmtBR(sim.proximoGrupo.entraEm)}.
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {!sim && (
        <p className="text-xs text-gray-400">
          Informe a data base do evento e a data de nascimento para simular.
        </p>
      )}
    </div>
  );
}
