"use client";

import { useRouter, useSearchParams } from "next/navigation";

const CLS_OPTIONS = [
  { value: "RECEPTORA", label: "Receptoras" },
  { value: "RECRIA",    label: "Recria"     },
  { value: "DESCARTE",  label: "Descarte"   },
  { value: "OUTRO",     label: "Outros"     },
];

export function FiltroClassificacao() {
  const router = useRouter();
  const params = useSearchParams();

  // Preserva todos os demais parâmetros (ordenação, período de T.E., doadora…).
  // A versão anterior remontava a URL do zero e apagava tudo que não fosse q/cls/st.
  function handleChange(value: string) {
    const p = new URLSearchParams(params.toString());
    value ? p.set("cls", value) : p.delete("cls");
    router.push(`/rebanho?${p.toString()}`, { scroll: false });
  }

  return (
    <select
      value={params.get("cls") ?? ""}
      onChange={(e) => handleChange(e.target.value)}
      className="text-xs border border-gray-200 rounded-md px-1.5 py-1 focus:outline-none focus:ring-1 focus:ring-brand-300 bg-white mt-1 w-full font-normal"
    >
      <option value="">Todas</option>
      {CLS_OPTIONS.map(({ value, label }) => (
        <option key={value} value={value}>{label}</option>
      ))}
    </select>
  );
}
