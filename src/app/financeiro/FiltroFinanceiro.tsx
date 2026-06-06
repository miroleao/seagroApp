"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

type FiltroOpt = { value: string; label: string; group: "neutro" | "compra" | "venda" };

const OPCOES: FiltroOpt[] = [
  { value: "",                  label: "Tudo",               group: "neutro" },
  { value: "compras",           label: "Compras",            group: "compra" },
  { value: "compras-animal",    label: "Animal",             group: "compra" },
  { value: "compras-prenhez",   label: "Prenhez",            group: "compra" },
  { value: "compras-aspiracao", label: "Aspiração",          group: "compra" },
  { value: "vendas",            label: "Vendas",             group: "venda"  },
  { value: "vendas-animal",     label: "Animal",             group: "venda"  },
  { value: "vendas-prenhez",    label: "Prenhez",            group: "venda"  },
  { value: "vendas-aspiracao",  label: "Aspiração",          group: "venda"  },
  { value: "vendas-rebanho",    label: "Rebanho",            group: "venda"  },
];

export default function FiltroFinanceiro({ active }: { active: string }) {
  const pathname = usePathname();
  const sp = useSearchParams();

  function buildHref(v: string) {
    const params = new URLSearchParams(sp?.toString() ?? "");
    if (v) params.set("filtro", v);
    else params.delete("filtro");
    const qs = params.toString();
    return qs ? `${pathname}?${qs}` : pathname;
  }

  const compraOpts = OPCOES.filter(o => o.group === "compra");
  const vendaOpts  = OPCOES.filter(o => o.group === "venda");
  const neutroOpts = OPCOES.filter(o => o.group === "neutro");

  function pillCls(o: FiltroOpt) {
    const isActive = active === o.value;
    if (isActive) {
      if (o.group === "compra") return "bg-red-600 text-white border-red-600";
      if (o.group === "venda")  return "bg-green-600 text-white border-green-600";
      return "bg-gray-800 text-white border-gray-800";
    }
    if (o.group === "compra") return "bg-white text-red-600 border-red-200 hover:bg-red-50";
    if (o.group === "venda")  return "bg-white text-green-700 border-green-200 hover:bg-green-50";
    return "bg-white text-gray-600 border-gray-200 hover:bg-gray-50";
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Tudo */}
      {neutroOpts.map(o => (
        <Link key={o.value} href={buildHref(o.value)}
          className={`px-3 py-1 rounded-full text-xs font-semibold border transition-colors ${pillCls(o)}`}>
          {o.label}
        </Link>
      ))}

      {/* Separador visual */}
      <span className="h-5 border-l border-gray-200 mx-1" />

      {/* Compras */}
      <span className="text-[10px] font-bold text-red-400 uppercase tracking-wide">Compras</span>
      {compraOpts.map(o => (
        <Link key={o.value} href={buildHref(o.value)}
          className={`px-3 py-1 rounded-full text-xs font-semibold border transition-colors ${pillCls(o)}`}>
          {o.label}
        </Link>
      ))}

      {/* Separador visual */}
      <span className="h-5 border-l border-gray-200 mx-1" />

      {/* Vendas */}
      <span className="text-[10px] font-bold text-green-500 uppercase tracking-wide">Vendas</span>
      {vendaOpts.map(o => (
        <Link key={o.value} href={buildHref(o.value)}
          className={`px-3 py-1 rounded-full text-xs font-semibold border transition-colors ${pillCls(o)}`}>
          {o.label}
        </Link>
      ))}
    </div>
  );
}
