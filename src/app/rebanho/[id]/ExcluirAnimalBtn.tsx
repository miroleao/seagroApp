"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2, AlertTriangle, Loader2 } from "lucide-react";
import { verificarExclusaoAnimal, excluirAnimalRebanho } from "./actions";

interface Props {
  id:     string;
  brinco: string;
}

type Item = { rotulo: string; total: number };

export function ExcluirAnimalBtn({ id, brinco }: Props) {
  const router = useRouter();
  const [aberto, setAberto]       = useState(false);
  const [checando, setChecando]   = useState(false);
  const [bloqueios, setBloqueios] = useState<Item[]>([]);
  const [cascatas, setCascatas]   = useState<Item[]>([]);
  const [erro, setErro]           = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  async function abrir() {
    setAberto(true);
    setChecando(true);
    setErro(null);
    try {
      const r = await verificarExclusaoAnimal(id);
      if (r.erro) setErro(r.erro);
      setBloqueios(r.bloqueios ?? []);
      setCascatas(r.cascatas ?? []);
    } catch (e: any) {
      setErro(e?.message ?? "Erro ao verificar vínculos.");
    } finally {
      setChecando(false);
    }
  }

  function confirmar() {
    setErro(null);
    startTransition(async () => {
      const fd = new FormData();
      fd.set("animal_id", id);
      const r = await excluirAnimalRebanho(fd);
      if (r.ok) {
        router.push("/rebanho");
        router.refresh();
      } else {
        setErro(r.erro ?? "Erro ao excluir.");
      }
    });
  }

  if (!aberto) {
    return (
      <button
        type="button"
        onClick={abrir}
        className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-red-600 hover:bg-red-50 px-2 py-1 rounded transition-colors"
      >
        <Trash2 className="w-3.5 h-3.5" /> Excluir cadastro
      </button>
    );
  }

  const impedido = bloqueios.length > 0 || !!erro;

  return (
    <div className="border border-red-200 bg-red-50 rounded-lg p-3 text-xs max-w-sm">
      {checando ? (
        <p className="flex items-center gap-1.5 text-gray-500">
          <Loader2 className="w-3.5 h-3.5 animate-spin" /> Verificando vínculos…
        </p>
      ) : (
        <>
          <p className="flex items-start gap-1.5 font-semibold text-red-700">
            <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            {impedido ? "Não é possível excluir" : `Excluir ${brinco} permanentemente?`}
          </p>

          {erro && <p className="mt-1.5 text-red-600">{erro}</p>}

          {bloqueios.length > 0 && (
            <div className="mt-1.5 text-red-600">
              <p>Este animal tem histórico vinculado:</p>
              <ul className="list-disc ml-4 mt-0.5">
                {bloqueios.map(b => (
                  <li key={b.rotulo}>{b.total} {b.rotulo}</li>
                ))}
              </ul>
              <p className="mt-1.5 text-red-500">
                Registre um desfecho em vez de excluir — assim o histórico é preservado.
              </p>
            </div>
          )}

          {!impedido && (
            <>
              <p className="mt-1 text-gray-600">
                Ação irreversível. Use apenas para cadastro errado ou duplicado.
              </p>
              {cascatas.length > 0 && (
                <p className="mt-1 text-gray-500">
                  Também serão apagados: {cascatas.map(c => `${c.total} ${c.rotulo}`).join(", ")}.
                </p>
              )}
            </>
          )}

          <div className="flex items-center gap-2 mt-2.5">
            {!impedido && (
              <button
                type="button"
                onClick={confirmar}
                disabled={pending}
                className="bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white px-2.5 py-1 rounded font-medium"
              >
                {pending ? "Excluindo…" : "Confirmar exclusão"}
              </button>
            )}
            <button
              type="button"
              onClick={() => setAberto(false)}
              className="border border-gray-200 bg-white text-gray-500 hover:bg-gray-50 px-2.5 py-1 rounded"
            >
              {impedido ? "Fechar" : "Cancelar"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
