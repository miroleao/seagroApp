"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { ChevronDown } from "lucide-react";

interface ColumnFilterProps {
  /** Nome do query-param que será atualizado na URL */
  param: string;
  /** Opções disponíveis no dropdown */
  options: { value: string; label: string }[];
  /** Texto do placeholder ("Todas", "Qualquer", etc.) */
  placeholder?: string;
}

/**
 * Dropdown de filtro para cabeçalho de tabela.
 * Atualiza o query-param `param` na URL sem fazer full-reload.
 */
export function ColumnFilter({ param, options, placeholder = "Todos" }: ColumnFilterProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const current = searchParams.get(param) ?? "";

  function handleChange(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(param, value);
    else params.delete(param);
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <span className="inline-flex items-center ml-1">
      <select
        value={current}
        onChange={(e) => handleChange(e.target.value)}
        className={`text-xs border rounded px-1.5 py-0.5 cursor-pointer focus:outline-none focus:ring-1 focus:ring-brand-400 transition-colors ${
          current
            ? "bg-brand-50 border-brand-300 text-brand-700 font-semibold"
            : "bg-white border-gray-200 text-gray-500"
        }`}
      >
        <option value="">{placeholder}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </span>
  );
}
