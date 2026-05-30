"use client";

import Link from "next/link";
import { Link2 } from "lucide-react";
import { VincularDropdown } from "./VincularDropdown";

interface AnimalLite {
  id: string;
  nome: string;
  rgn: string | null;
}

interface Props {
  txId: string;
  animais: AnimalLite[];        // já vinculados
  doadoras: AnimalLite[];       // catálogo de doadoras para o picker
}

export function VinculoCell({ txId, animais, doadoras }: Props) {
  const selecionadas = animais.map(a => a.id);

  // Mostra até 2 chips inline e o restante como "+N" tooltip
  const visiveis = animais.slice(0, 2);
  const restante = animais.length - visiveis.length;

  return (
    <span className="inline-flex flex-wrap items-center gap-1 justify-end">
      {visiveis.map(a => (
        <Link
          key={a.id}
          href={`/doadoras/${a.id}`}
          title={a.rgn ? `${a.nome} · ${a.rgn}` : a.nome}
          className="inline-flex items-center gap-1 text-[11px] text-green-700 bg-green-50 border border-green-200 hover:bg-green-100 hover:border-green-300 px-2 py-0.5 rounded-full transition-colors max-w-[140px]"
        >
          <Link2 className="w-3 h-3 shrink-0" />
          <span className="truncate">{a.nome.split(" ").slice(0, 2).join(" ")}</span>
        </Link>
      ))}
      {restante > 0 && (
        <span
          title={animais.slice(2).map(a => a.nome).join("\n")}
          className="inline-flex items-center text-[10px] text-green-700 bg-green-50 border border-green-200 px-1.5 py-0.5 rounded-full"
        >
          +{restante}
        </span>
      )}
      <VincularDropdown
        txId={txId}
        doadoras={doadoras}
        selecionadas={selecionadas}
        buttonLabel={animais.length > 0 ? "editar" : "vincular"}
      />
    </span>
  );
}
