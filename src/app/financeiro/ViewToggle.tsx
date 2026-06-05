"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { LayoutGrid, Table2 } from "lucide-react";

interface Props {
  active: "cards" | "tabela";
}

export function ViewToggle({ active }: Props) {
  const pathname = usePathname();
  const sp       = useSearchParams();

  function buildHref(v: "cards" | "tabela"): string {
    const params = new URLSearchParams(sp?.toString() ?? "");
    // "tabela" é o padrão — sem param. "cards" precisa de ?view=cards
    if (v === "tabela") params.delete("view");
    else params.set("view", v);
    const qs = params.toString();
    return qs ? `${pathname}?${qs}` : pathname;
  }

  const base = "inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap";
  const on   = "bg-violet-600 text-white";
  const off  = "bg-white text-gray-600 hover:bg-gray-50";

  return (
    <div className="inline-flex shrink-0 rounded-md border border-gray-200 overflow-hidden">
      <Link href={buildHref("cards")}  className={`${base} ${active === "cards"  ? on : off} border-r border-gray-200`}>
        <LayoutGrid className="w-3.5 h-3.5" />
        Cards
      </Link>
      <Link href={buildHref("tabela")} className={`${base} ${active === "tabela" ? on : off}`}>
        <Table2 className="w-3.5 h-3.5" />
        Tabela
      </Link>
    </div>
  );
}
