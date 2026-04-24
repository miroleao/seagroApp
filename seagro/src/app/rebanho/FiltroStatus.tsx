"use client";

import { useRouter } from "next/navigation";

const STATUS_MAP: Record<string, string> = {
  PROTOCOLADA:    "Protocolada",
  INSEMINADA:     "Inseminada",
  IMPLANTADA:     "Implantada c/ Embrião",
  PRENHA:         "Prenha",
  PRENHA_EMBRIAO: "Prenha de Embrião",
  VAZIA:          "Vazia",
  DESCARTE:       "Descarte",
};

export function FiltroStatus({ q, cls, st }: { q?: string; cls?: string; st?: string }) {
  const router = useRouter();

  function handleChange(value: string) {
    const params = new URLSearchParams();
    if (q)     params.set("q", q);
    if (cls)   params.set("cls", cls);
    if (value) params.set("st", value);
    router.push(`/rebanho?${params.toString()}`);
  }

  return (
    <select
      value={st ?? ""}
      onChange={(e) => handleChange(e.target.value)}
      className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-brand-300 bg-white"
    >
      <option value="">Todos os status</option>
      {Object.entries(STATUS_MAP).map(([v, label]) => (
        <option key={v} value={v}>{label}</option>
      ))}
    </select>
  );
}
