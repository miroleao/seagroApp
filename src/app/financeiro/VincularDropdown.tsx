"use client";

import { useRef, useState, useEffect } from "react";
import { Link2 } from "lucide-react";
import { vincularDoadora } from "./actions";

interface Doadora {
  id: string;
  nome: string;
  rgn?: string | null;
}

interface Props {
  txId: string;
  doadoras: Doadora[];
}

export function VincularDropdown({ txId, doadoras }: Props) {
  const [open, setOpen]   = useState(false);
  const [pos,  setPos]    = useState({ top: 0, right: 0 });
  const btnRef            = useRef<HTMLButtonElement>(null);

  // Calcula posição fixed na abertura
  function handleOpen() {
    if (btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      setPos({
        top:   rect.bottom + 6,
        right: window.innerWidth - rect.right,
      });
    }
    setOpen(o => !o);
  }

  // Fecha ao clicar fora
  useEffect(() => {
    if (!open) return;
    function onClickOutside(e: MouseEvent) {
      if (btnRef.current && !btnRef.current.closest("[data-vincular-root]")?.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  return (
    <span data-vincular-root="">
      <button
        ref={btnRef}
        type="button"
        onClick={handleOpen}
        className="cursor-pointer inline-flex items-center gap-1 text-xs text-gray-400 hover:text-brand-600 border border-dashed border-gray-300 hover:border-brand-400 px-2 py-0.5 rounded-full transition-colors"
      >
        <Link2 className="w-3 h-3" /> vincular
      </button>

      {open && (
        <div
          style={{ position: "fixed", top: pos.top, right: pos.right, zIndex: 9999 }}
          className="bg-white border border-gray-200 rounded-xl shadow-lg p-3 min-w-[280px]"
        >
          <p className="text-xs text-gray-500 mb-2">Vincular ao ROI de qual doadora?</p>
          <form
            action={async (fd) => {
              await vincularDoadora(fd);
              setOpen(false);
            }}
            className="flex gap-2"
          >
            <input type="hidden" name="tx_id" value={txId} />
            <select
              name="doadora_id"
              required
              className="flex-1 border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-brand-300 bg-white"
            >
              <option value="">— selecione —</option>
              {doadoras.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.nome}{d.rgn ? ` (${d.rgn})` : ""}
                </option>
              ))}
            </select>
            <button
              type="submit"
              className="bg-brand-600 hover:bg-brand-700 text-white text-xs font-medium px-3 py-1.5 rounded-lg transition-colors"
            >
              OK
            </button>
          </form>
        </div>
      )}
    </span>
  );
}
