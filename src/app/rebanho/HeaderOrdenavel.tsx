"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowUp, ArrowDown, ChevronsUpDown } from "lucide-react";

/**
 * Cabeçalho de coluna clicável. A ordenação vive na URL (`?sort=&dir=`) e é
 * aplicada no servidor — assim a tabela continua sendo Server Component e os
 * editores inline de cada linha seguem funcionando sem alteração.
 *
 * Ciclo: sem ordem → crescente → decrescente → sem ordem.
 */
export function HeaderOrdenavel({
  campo,
  children,
  alinhamento = "left",
}: {
  campo: string;
  children: React.ReactNode;
  alinhamento?: "left" | "center" | "right";
}) {
  const params = useSearchParams();
  const sortAtual = params.get("sort");
  const dirAtual  = params.get("dir") === "desc" ? "desc" : "asc";
  const ativo     = sortAtual === campo;

  const próximo = !ativo
    ? { sort: campo, dir: "asc" }
    : dirAtual === "asc"
      ? { sort: campo, dir: "desc" }
      : { sort: null, dir: null };

  const novos = new URLSearchParams(params.toString());
  if (próximo.sort) { novos.set("sort", próximo.sort); novos.set("dir", próximo.dir!); }
  else              { novos.delete("sort"); novos.delete("dir"); }

  const just = alinhamento === "right"  ? "justify-end"
             : alinhamento === "center" ? "justify-center"
             : "justify-start";

  return (
    <Link
      href={`/rebanho?${novos.toString()}`}
      scroll={false}
      title={
        !ativo ? "Ordenar por esta coluna"
        : dirAtual === "asc" ? "Inverter para decrescente"
        : "Remover ordenação"
      }
      className={`group flex items-center gap-1 ${just} hover:text-gray-700 transition-colors ${
        ativo ? "text-brand-700 font-semibold" : ""
      }`}
    >
      {children}
      {ativo
        ? (dirAtual === "asc"
            ? <ArrowUp   className="w-3 h-3 shrink-0" />
            : <ArrowDown className="w-3 h-3 shrink-0" />)
        : <ChevronsUpDown className="w-3 h-3 shrink-0 text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity" />}
    </Link>
  );
}
