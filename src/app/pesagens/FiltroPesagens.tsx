"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";

const opcoes = [
  { value: "todos",     label: "Todos" },
  { value: "DOADORA",   label: "Doadoras" },
  { value: "TOURO",     label: "Touros" },
  { value: "RECEPTORA", label: "Receptoras" },
  { value: "NASCIDO",   label: "Nascidos" },
];

export default function FiltroPesagens({ active }: { active: string }) {
  const router       = useRouter();
  const searchParams = useSearchParams();

  const set = useCallback(
    (value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value === "todos") params.delete("tipo");
      else params.set("tipo", value);
      params.delete("q");
      router.push(`/pesagens?${params.toString()}`);
    },
    [router, searchParams],
  );

  return (
    <div className="flex flex-wrap gap-1.5">
      {opcoes.map((op) => (
        <button
          key={op.value}
          type="button"
          onClick={() => set(op.value)}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            active === op.value
              ? "bg-brand-600 text-white"
              : "bg-gray-100 text-gray-600 hover:bg-brand-50 hover:text-brand-700"
          }`}
        >
          {op.label}
        </button>
      ))}
    </div>
  );
}
