"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useCallback } from "react";
import { X } from "lucide-react";

export type ChipFiltro = {
  param:  string;          // URL search param key
  value:  string;          // valor que ativa o filtro ("1", "APTO", "6-9", …)
  label:  string;          // texto exibido no chip
  icon?:  React.ReactNode;
  cor?:   string;          // classes tailwind para estado ativo (ex: "bg-yellow-100 text-yellow-800 border-yellow-300")
};

export type GrupoFiltro = {
  rotulo?: string;
  chips:   ChipFiltro[];
  unico?:  boolean;        // true = só um ativo por vez (como radio)
};

type Props = {
  grupos: GrupoFiltro[];
  totalFiltrado: number;
  totalGeral:    number;
};

export function FiltrosRapidos({ grupos, totalFiltrado, totalGeral }: Props) {
  const router        = useRouter();
  const pathname      = usePathname();
  const searchParams  = useSearchParams();

  /** Retorna nova URL com o param modificado */
  const buildUrl = useCallback(
    (param: string, value: string | null) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value === null || value === "") {
        params.delete(param);
      } else {
        params.set(param, value);
      }
      const str = params.toString();
      return str ? `${pathname}?${str}` : pathname;
    },
    [pathname, searchParams]
  );

  function toggleChip(chip: ChipFiltro, unico: boolean) {
    const current = searchParams.get(chip.param);
    const isActive = current === chip.value;

    if (unico) {
      // radio: clicando no ativo desativa; clicando em outro ativa
      router.push(buildUrl(chip.param, isActive ? null : chip.value));
    } else {
      // toggle: desativa se já ativo, ativa se não
      router.push(buildUrl(chip.param, isActive ? null : chip.value));
    }
  }

  // Verifica se há algum filtro ativo
  const algumFiltroAtivo = grupos.some(g =>
    g.chips.some(c => searchParams.get(c.param) === c.value)
  );

  function limparTudo() {
    const params = new URLSearchParams(searchParams.toString());
    for (const g of grupos) {
      for (const c of g.chips) {
        params.delete(c.param);
      }
    }
    const str = params.toString();
    router.push(str ? `${pathname}?${str}` : pathname);
  }

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      {grupos.map((grupo, gi) => (
        <div key={gi} className="flex items-center gap-1.5 flex-wrap">
          {grupo.rotulo && (
            <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 shrink-0">
              {grupo.rotulo}
            </span>
          )}
          {grupo.chips.map((chip) => {
            const isActive = searchParams.get(chip.param) === chip.value;
            const corAtiva = chip.cor ?? "bg-brand-100 text-brand-800 border-brand-300";
            return (
              <button
                key={`${chip.param}-${chip.value}`}
                onClick={() => toggleChip(chip, grupo.unico ?? false)}
                className={`inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full border transition-all
                  ${isActive
                    ? `${corAtiva} shadow-sm`
                    : "bg-white text-gray-600 border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                  }`}
              >
                {chip.icon && <span className="shrink-0">{chip.icon}</span>}
                {chip.label}
              </button>
            );
          })}
        </div>
      ))}

      {/* Limpar filtros */}
      {algumFiltroAtivo && (
        <button
          onClick={limparTudo}
          className="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-gray-700 ml-1 transition-colors"
        >
          <X className="w-3 h-3" />
          Limpar filtros
          {totalFiltrado < totalGeral && (
            <span className="ml-1 text-gray-300">({totalFiltrado}/{totalGeral})</span>
          )}
        </button>
      )}
    </div>
  );
}
