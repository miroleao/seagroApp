"use client";

import { useSearchParams } from "next/navigation";
import { useRef } from "react";
import { Search } from "lucide-react";

interface SearchInputProps {
  placeholder?: string;
  paramName?: string;
}

/**
 * SearchInput — usa <form method="get"> nativo para máxima compatibilidade.
 * O submit é disparado automaticamente 400ms após o usuário parar de digitar.
 * Preserva todos os outros query params (sit, status, etc.) como hidden inputs.
 */
export function SearchInput({ placeholder = "Buscar...", paramName = "q" }: SearchInputProps) {
  const searchParams = useSearchParams();
  const formRef = useRef<HTMLFormElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function handleChange() {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      formRef.current?.submit();
    }, 400);
  }

  // Outros params que precisam ser preservados
  const otherParams = Array.from(searchParams.entries()).filter(
    ([key]) => key !== paramName
  );

  return (
    <form ref={formRef} method="get" className="flex items-center">
      {/* Preserva outros query params */}
      {otherParams.map(([key, val]) => (
        <input key={key} type="hidden" name={key} value={val} />
      ))}

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
        <input
          type="search"
          name={paramName}
          defaultValue={searchParams.get(paramName) ?? ""}
          onChange={handleChange}
          placeholder={placeholder}
          className="pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-brand-300 w-full md:w-64"
        />
      </div>
    </form>
  );
}
