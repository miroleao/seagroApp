"use client";

import { useRef, useState, useEffect, useTransition } from "react";
import { Link2, Check, X, Search } from "lucide-react";
import { vincularAnimaisMultiplos } from "./actions";

interface Doadora {
  id: string;
  nome: string;
  rgn?: string | null;
}

interface Props {
  txId: string;
  doadoras: Doadora[];
  selecionadas?: string[];     // ids já vinculados a esta transação
  buttonLabel?: string;        // texto do botão (default "vincular")
}

export function VincularDropdown({ txId, doadoras, selecionadas = [], buttonLabel }: Props) {
  const [open, setOpen]     = useState(false);
  const [pos,  setPos]      = useState({ top: 0, right: 0 });
  const [busca, setBusca]   = useState("");
  const [ids, setIds]       = useState<string[]>(selecionadas);
  const [erro, setErro]     = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const btnRef              = useRef<HTMLButtonElement>(null);

  // Sincroniza ids quando os props mudam (ex: após revalidate)
  useEffect(() => { setIds(selecionadas); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [selecionadas.join(",")]);

  function handleOpen() {
    if (btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      setPos({
        top:   rect.bottom + 6,
        right: window.innerWidth - rect.right,
      });
    }
    setOpen(o => !o);
    setErro(null);
  }

  // Fecha ao clicar fora
  useEffect(() => {
    if (!open) return;
    function onClickOutside(e: MouseEvent) {
      const root = btnRef.current?.closest("[data-vincular-root]");
      if (!root || !root.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  function toggle(id: string) {
    setIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }

  function salvar() {
    setErro(null);
    const fd = new FormData();
    fd.set("tx_id", txId);
    ids.forEach(id => fd.append("animal_ids", id));
    startTransition(async () => {
      const res = await vincularAnimaisMultiplos(fd);
      if (res.ok) setOpen(false);
      else setErro(res.erro ?? "Erro ao salvar");
    });
  }

  function limpar() {
    setIds([]);
  }

  const filtradas = busca.trim()
    ? doadoras.filter(d => {
        const t = busca.toLowerCase();
        return d.nome.toLowerCase().includes(t) || (d.rgn ?? "").toLowerCase().includes(t);
      })
    : doadoras;

  const label = buttonLabel ?? (selecionadas.length > 0 ? `${selecionadas.length} vinculado${selecionadas.length === 1 ? "" : "s"}` : "vincular");

  return (
    <span data-vincular-root="">
      <button
        ref={btnRef}
        type="button"
        onClick={handleOpen}
        className={`cursor-pointer inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border border-dashed transition-colors ${
          selecionadas.length > 0
            ? "text-green-700 border-green-300 hover:border-green-500 bg-green-50"
            : "text-gray-400 hover:text-brand-600 border-gray-300 hover:border-brand-400"
        }`}
      >
        <Link2 className="w-3 h-3" /> {label}
      </button>

      {open && (
        <div
          style={{ position: "fixed", top: pos.top, right: pos.right, zIndex: 9999 }}
          className="bg-white border border-gray-200 rounded-xl shadow-lg p-3 w-80 max-h-[420px] flex flex-col"
        >
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-gray-700">Vincular animais ({ids.length})</p>
            <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="relative mb-2">
            <Search className="w-3 h-3 text-gray-400 absolute left-2 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={busca}
              onChange={e => setBusca(e.target.value)}
              placeholder="Buscar por nome ou RGN…"
              className="w-full border border-gray-200 rounded-md pl-7 pr-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-brand-300"
            />
          </div>

          <div className="flex-1 overflow-y-auto border border-gray-100 rounded-md">
            {filtradas.length === 0 ? (
              <p className="text-[11px] text-gray-400 italic p-3 text-center">Nenhuma doadora encontrada.</p>
            ) : (
              filtradas.map(d => {
                const checked = ids.includes(d.id);
                return (
                  <label
                    key={d.id}
                    className={`flex items-center gap-2 px-2 py-1.5 text-xs cursor-pointer border-b border-gray-50 last:border-b-0 ${
                      checked ? "bg-brand-50" : "hover:bg-gray-50"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggle(d.id)}
                      className="accent-violet-600 w-3.5 h-3.5"
                    />
                    <span className="flex-1 min-w-0">
                      <span className="font-medium text-gray-800 truncate block">{d.nome}</span>
                      {d.rgn && <span className="text-[10px] text-gray-400 font-mono">{d.rgn}</span>}
                    </span>
                    {checked && <Check className="w-3 h-3 text-brand-600 shrink-0" />}
                  </label>
                );
              })
            )}
          </div>

          {erro && (
            <p className="text-[11px] text-red-600 mt-2">{erro}</p>
          )}

          <div className="flex items-center justify-between gap-2 mt-2">
            <button
              type="button"
              onClick={limpar}
              className="text-[11px] text-gray-500 hover:text-red-600 underline"
            >
              Limpar
            </button>
            <button
              type="button"
              onClick={salvar}
              disabled={pending}
              className="bg-brand-600 hover:bg-brand-700 text-white text-xs font-medium px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
            >
              {pending ? "Salvando..." : `Salvar (${ids.length})`}
            </button>
          </div>
        </div>
      )}
    </span>
  );
}
