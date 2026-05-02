"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useRef } from "react";
import { Search, X } from "lucide-react";

export default function BuscaFinanceiro() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const q            = searchParams.get("q") ?? "";
  const timerRef     = useRef<ReturnType<typeof setTimeout> | null>(null);

  const update = useCallback(
    (value: string) => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        const params = new URLSearchParams(searchParams.toString());
        if (value.trim()) params.set("q", value.trim());
        else params.delete("q");
        router.push(`/financeiro?${params.toString()}`);
      }, 350);
    },
    [router, searchParams],
  );

  const clear = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    const params = new URLSearchParams(searchParams.toString());
    params.delete("q");
    router.push(`/financeiro?${params.toString()}`);
  }, [router, searchParams]);

  return (
    <div className="relative w-full max-w-sm">
      <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
      <input
        type="text"
        defaultValue={q}
        onChange={(e) => update(e.target.value)}
        placeholder="Buscar leilão, animal, comprador…"
        className="w-full border border-gray-200 rounded-lg pl-9 pr-8 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-300"
      />
      {q && (
        <button
          type="button"
          onClick={clear}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}
