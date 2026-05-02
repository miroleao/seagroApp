"use client";

import { useRouter } from "next/navigation";

const CLS_OPTIONS = [
  { value: "RECEPTORA", label: "Receptoras" },
  { value: "RECRIA",    label: "Recria"     },
  { value: "DESCARTE",  label: "Descarte"   },
  { value: "OUTRO",     label: "Outros"     },
];

export function FiltroClassificacao({ q, cls, st }: { q?: string; cls?: string; st?: string }) {
  const router = useRouter();

  function handleChange(value: string) {
    const params = new URLSearchParams();
    if (q)     params.set("q", q);
    if (value) params.set("cls", value);
    if (st)    params.set("st", st);
    router.push(`/rebanho?${params.toString()}`);
  }

  return (
    <select
      value={cls ?? ""}
      onChange={(e) => handleChange(e.target.value)}
      className="text-xs border border-gray-200 rounded-md px-1.5 py-1 focus:outline-none focus:ring-1 focus:ring-brand-300 bg-white mt-1 w-full"
    >
      <option value="">Todas</option>
      {CLS_OPTIONS.map(({ value, label }) => (
        <option key={value} value={value}>{label}</option>
      ))}
    </select>
  );
}
