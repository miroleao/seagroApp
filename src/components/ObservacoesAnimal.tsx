"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { NotebookPen, Check, Loader2, RotateCcw } from "lucide-react";
import { salvarDescricaoAnimal } from "@/lib/actions/descricao";

/**
 * Bloco de texto livre da ficha do animal.
 *
 * Salva sozinho ~2s depois que você para de digitar, e também no blur —
 * assim não há risco de perder o texto ao sair da página. O botão manual
 * fica para quem prefere confirmar.
 */
export function ObservacoesAnimal({
  animalId,
  valorInicial,
  titulo = "Observações",
}: {
  animalId: string;
  valorInicial: string | null;
  titulo?: string;
}) {
  const [texto, setTexto]   = useState(valorInicial ?? "");
  const [salvo, setSalvo]   = useState(true);
  const [erro, setErro]     = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ultimoSalvo = useRef(valorInicial ?? "");

  function persistir() {
    if (texto === ultimoSalvo.current) return;
    setErro(null);
    iniciar(async () => {
      const res = await salvarDescricaoAnimal(animalId, texto);
      if (!res.ok) { setErro(res.erro ?? "Erro ao salvar"); return; }
      ultimoSalvo.current = texto;
      setSalvo(true);
    });
  }

  // Autosave com debounce
  useEffect(() => {
    if (texto === ultimoSalvo.current) { setSalvo(true); return; }
    setSalvo(false);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(persistir, 2000);
    return () => { if (timer.current) clearTimeout(timer.current); };
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [texto]);

  const alterado = texto !== ultimoSalvo.current;

  return (
    <section className="card overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
        <NotebookPen className="w-4 h-4 text-brand-600 shrink-0" />
        <h2 className="font-semibold text-gray-900">{titulo}</h2>

        <span className="ml-auto text-[11px] flex items-center gap-1.5">
          {pendente ? (
            <span className="text-gray-400 flex items-center gap-1">
              <Loader2 className="w-3 h-3 animate-spin" /> salvando…
            </span>
          ) : erro ? (
            <span className="text-red-600">{erro}</span>
          ) : salvo && !alterado ? (
            <span className="text-green-600 flex items-center gap-1">
              <Check className="w-3 h-3" /> salvo
            </span>
          ) : (
            <span className="text-amber-600">alterações não salvas</span>
          )}
        </span>
      </div>

      <div className="p-5 space-y-2">
        <textarea
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onBlur={() => { if (timer.current) clearTimeout(timer.current); persistir(); }}
          rows={8}
          placeholder="Escreva sobre este animal — origem e genealogia, resultados de pista, prêmios, produção, histórico comercial, o que for útil na hora de apresentá-lo…"
          className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-brand-300 resize-y min-h-[160px]"
        />

        <div className="flex flex-wrap items-center gap-3">
          <p className="text-[10px] text-gray-400">
            Salva sozinho enquanto você escreve. Este texto sai na seção Observações
            do PDF da ficha.
          </p>

          <div className="ml-auto flex items-center gap-2">
            {alterado && (
              <button
                type="button"
                onClick={() => { setTexto(ultimoSalvo.current); setErro(null); }}
                className="inline-flex items-center gap-1 text-[11px] text-gray-400 hover:text-gray-600"
              >
                <RotateCcw className="w-3 h-3" /> desfazer
              </button>
            )}
            <button
              type="button"
              onClick={() => { if (timer.current) clearTimeout(timer.current); persistir(); }}
              disabled={pendente || !alterado}
              className="text-xs bg-brand-600 hover:bg-brand-700 disabled:opacity-40 disabled:cursor-not-allowed text-white px-4 py-1.5 rounded-lg transition-colors font-medium"
            >
              Salvar
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
