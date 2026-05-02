"use client";

import { useState, useRef } from "react";
import { MapPin, X, Check } from "lucide-react";
import { editarLocalizacaoRebanho } from "./actions";

interface Props {
  animalId:     string;
  localizacao:  string | null;
}

const RAPIDOS = [
  { label: "🏠 Fazenda",  valor: "Fazenda" },
  { label: "🏢 Central",  valor: "Central: " },
  { label: "📤 Saiu",     valor: "Saiu: "   },
];

export function EditLocalizacaoRebanho({ animalId, localizacao }: Props) {
  const [open,  setOpen]  = useState(false);
  const [valor, setValor] = useState(localizacao ?? "");
  const [pos,   setPos]   = useState({ top: 0, right: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);

  function handleOpen() {
    if (!open && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      setPos({ top: r.bottom + 6, right: window.innerWidth - r.right });
    }
    setValor(localizacao ?? "");
    setOpen(o => !o);
  }

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={handleOpen}
        className="flex items-center gap-1 group"
        title="Editar localização"
      >
        {localizacao ? (
          <span className="text-xs text-gray-600 group-hover:text-brand-600 transition-colors truncate max-w-[90px]">
            {localizacao}
          </span>
        ) : (
          <span className="text-gray-300 text-xs group-hover:text-brand-400 transition-colors">—</span>
        )}
        <MapPin className={`w-3 h-3 shrink-0 ${localizacao ? "text-gray-300 group-hover:text-brand-400" : "text-gray-200 group-hover:text-brand-400"} transition-colors`} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />

          <div
            style={{ top: pos.top, right: pos.right }}
            className="fixed z-50 w-64 bg-white border border-gray-200 rounded-xl shadow-2xl p-4"
          >
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold text-gray-800">Localização</p>
              <button type="button" onClick={() => setOpen(false)}
                className="text-gray-400 hover:text-gray-600 p-0.5">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Atalhos rápidos */}
            <div className="flex flex-wrap gap-1.5 mb-3">
              {RAPIDOS.map(r => (
                <button key={r.label} type="button"
                  onClick={() => setValor(r.valor)}
                  className="text-[11px] px-2 py-1 rounded-md border border-gray-200 text-gray-600 hover:bg-brand-50 hover:border-brand-300 transition-colors">
                  {r.label}
                </button>
              ))}
            </div>

            <form action={editarLocalizacaoRebanho} onSubmit={() => setOpen(false)}>
              <input type="hidden" name="animal_id" value={animalId} />
              <input
                name="localizacao"
                value={valor}
                onChange={e => setValor(e.target.value)}
                placeholder="Ex: Curral 3, Central Mogiana…"
                className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-brand-300 mb-2"
                autoFocus
              />
              <div className="flex gap-2">
                <button type="button" onClick={() => setOpen(false)}
                  className="flex-1 text-xs border border-gray-200 rounded-lg py-1.5 hover:bg-gray-50 text-gray-500">
                  Cancelar
                </button>
                <button type="submit"
                  className="flex-1 text-xs bg-brand-600 text-white rounded-lg py-1.5 font-medium hover:bg-brand-700 flex items-center justify-center gap-1">
                  <Check className="w-3 h-3" /> Salvar
                </button>
              </div>
            </form>
          </div>
        </>
      )}
    </>
  );
}
