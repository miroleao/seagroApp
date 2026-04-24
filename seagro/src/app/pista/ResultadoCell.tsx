"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trophy, Plus, X } from "lucide-react";
import { criarPremiacao } from "./actions";

type Exposicao = { id: string; nome: string; data_base: string | null };
type Premio    = { id: string; tipo_premio: string; grupo_nelore: string | null; observacoes: string | null };

type Props = {
  animalId:   string;
  grupoAtual: string | null;
  exposicoes: Exposicao[];
  premios:    Premio[];
};

// Agrupados por optgroup conforme regulamento ACNB
const TIPOS_PREMIO_GRUPOS = [
  {
    label: "♀ Fêmeas — Categoria",
    opcoes: [
      { value: "1_LUGAR",  label: "1ª da Categoria"  },
      { value: "2_LUGAR",  label: "2ª da Categoria"  },
      { value: "3_LUGAR",  label: "3ª da Categoria"  },
      { value: "4_LUGAR",  label: "4ª da Categoria"  },
      { value: "5_LUGAR",  label: "5ª da Categoria"  },
      { value: "6_LUGAR",  label: "6ª da Categoria"  },
      { value: "7_LUGAR",  label: "7ª da Categoria"  },
      { value: "8_LUGAR",  label: "8ª da Categoria"  },
      { value: "9_LUGAR",  label: "9ª da Categoria"  },
      { value: "10_LUGAR", label: "10ª da Categoria" },
      { value: "11_LUGAR", label: "11ª da Categoria" },
      { value: "12_LUGAR", label: "12ª da Categoria" },
    ],
  },
  {
    label: "♀ Fêmeas — Campeonato",
    opcoes: [
      { value: "CAMPEA",           label: "Campeã da Categoria"    },
      { value: "RESERVADA_CAMPEA", label: "Reservada Campeã"       },
      { value: "3_MELHOR",         label: "3ª Melhor da Categoria" },
    ],
  },
  {
    label: "♀ Fêmeas — Grande Campeonato",
    opcoes: [
      { value: "GRANDE_CAMPEA",           label: "Grande Campeã"           },
      { value: "RESERVADA_GRANDE_CAMPEA", label: "Reservada Grande Campeã" },
      { value: "3_GRANDE_CAMPEA",         label: "3ª Grande Campeã"        },
    ],
  },
  {
    label: "♂ Machos — Categoria",
    opcoes: [
      { value: "1_LUGAR",  label: "1º da Categoria"  },
      { value: "2_LUGAR",  label: "2º da Categoria"  },
      { value: "3_LUGAR",  label: "3º da Categoria"  },
      { value: "4_LUGAR",  label: "4º da Categoria"  },
      { value: "5_LUGAR",  label: "5º da Categoria"  },
      { value: "6_LUGAR",  label: "6º da Categoria"  },
      { value: "7_LUGAR",  label: "7º da Categoria"  },
      { value: "8_LUGAR",  label: "8º da Categoria"  },
      { value: "9_LUGAR",  label: "9º da Categoria"  },
      { value: "10_LUGAR", label: "10º da Categoria" },
      { value: "11_LUGAR", label: "11º da Categoria" },
      { value: "12_LUGAR", label: "12º da Categoria" },
    ],
  },
  {
    label: "♂ Machos — Campeonato",
    opcoes: [
      { value: "CAMPEAO",           label: "Campeão da Categoria"   },
      { value: "RESERVADO_CAMPEAO", label: "Reservado Campeão"      },
      { value: "3_MELHOR_MACHO",    label: "3º Melhor da Categoria" },
    ],
  },
  {
    label: "♂ Machos — Grande Campeonato",
    opcoes: [
      { value: "GRANDE_CAMPEAO",           label: "Grande Campeão"           },
      { value: "RESERVADO_GRANDE_CAMPEAO", label: "Reservado Grande Campeão" },
      { value: "3_GRANDE_CAMPEAO",         label: "3º Grande Campeão"        },
    ],
  },
  {
    label: "Outros",
    opcoes: [
      { value: "OUTRO", label: "Outro" },
    ],
  },
];

// Mapa flat para lookup no badge
const TIPOS_PREMIO_MAP: Record<string, string> = Object.fromEntries(
  TIPOS_PREMIO_GRUPOS.flatMap(g => g.opcoes.map(o => [o.value, o.label]))
);

const GRUPOS_NELORE = [
  { value: "NELORE",          label: "Nelore" },
  { value: "NELORE_MOCHO",    label: "Nelore Mocho" },
  { value: "NELORE_PELAGENS", label: "Nelore Pelagens" },
];

const isTop = (tipo: string) =>
  tipo.includes("CAMPEA") || tipo.includes("CAMPEAO") || tipo.includes("GRANDE");

export function ResultadoCell({ animalId, grupoAtual, exposicoes, premios }: Props) {
  const [open, setOpen] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  const router = useRouter();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErro(null);
    const fd = new FormData(formRef.current!);
    console.log("[ResultadoCell] submit animal_id=", fd.get("animal_id"), "tipo=", fd.get("tipo_premio"));
    startTransition(async () => {
      const res = await criarPremiacao(fd);
      if (res.ok) {
        setOpen(false);
        router.refresh();
      } else {
        setErro(res.erro ?? "Erro ao salvar");
      }
    });
  }

  return (
    <div className="space-y-1.5 min-w-[180px]">
      {/* Prêmios já registrados */}
      {premios.map((p) => (
        <div key={p.id} className="flex items-center gap-1">
          <span className={`badge text-[10px] ${isTop(p.tipo_premio) ? "bg-yellow-100 text-yellow-700" : "bg-gray-100 text-gray-600"}`}>
            {isTop(p.tipo_premio) && "🏆 "}
            {TIPOS_PREMIO_MAP[p.tipo_premio] ?? p.tipo_premio.replace(/_/g, " ")}
          </span>
        </div>
      ))}

      {/* Toggle form */}
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-1 text-[10px] text-gray-400 hover:text-brand-600 border border-dashed border-gray-300 hover:border-brand-400 px-2 py-0.5 rounded transition-colors cursor-pointer"
        >
          <Plus className="w-3 h-3" /> Registrar resultado
        </button>
      ) : (
        <div className="bg-white border border-brand-200 rounded-lg p-2.5 shadow-sm space-y-2 w-64">
          <div className="flex items-center justify-between mb-1">
            <p className="text-[10px] font-semibold text-gray-600 uppercase tracking-wide">Novo resultado</p>
            <button type="button" onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600 cursor-pointer">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <form ref={formRef} onSubmit={handleSubmit} className="space-y-2">
            <input type="hidden" name="animal_id" value={animalId} />

            {/* Exposição */}
            <div>
              <label className="text-[10px] text-gray-500 block mb-0.5">Exposição</label>
              <select name="exhibition_id"
                className="w-full border border-gray-200 rounded px-2 py-1 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-brand-300">
                <option value="">— Avulso —</option>
                {exposicoes.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.nome}{e.data_base ? ` (${e.data_base.substring(0, 7)})` : ""}
                  </option>
                ))}
              </select>
            </div>

            {/* Tipo do prêmio */}
            <div>
              <label className="text-[10px] text-gray-500 block mb-0.5">Resultado *</label>
              <select name="tipo_premio" required
                className="w-full border border-gray-200 rounded px-2 py-1 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-brand-300">
                <option value="">Selecione…</option>
                {TIPOS_PREMIO_GRUPOS.map((g) => (
                  <optgroup key={g.label} label={g.label}>
                    {g.opcoes.map((o) => (
                      <option key={`${g.label}-${o.value}`} value={o.value}>{o.label}</option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>

            {/* Grupo de Raça (constraint: NELORE | NELORE_MOCHO | NELORE_PELAGENS) */}
            <div>
              <label className="text-[10px] text-gray-500 block mb-0.5">Grupo de Raça</label>
              <select name="grupo_nelore"
                className="w-full border border-gray-200 rounded px-2 py-1 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-brand-300">
                {GRUPOS_NELORE.map((g) => (
                  <option key={g.value} value={g.value}>{g.label}</option>
                ))}
              </select>
            </div>

            {/* Descrição / categoria de idade — campo livre */}
            <div>
              <label className="text-[10px] text-gray-500 block mb-0.5">
                Categoria / Descrição
                {grupoAtual && <span className="ml-1 text-brand-500">(auto)</span>}
              </label>
              <input
                name="descricao_premio"
                defaultValue={grupoAtual ?? ""}
                placeholder="Ex: Novilha Maior, Absoluto…"
                className="w-full border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-brand-300"
              />
            </div>

            {/* Obs */}
            <div>
              <label className="text-[10px] text-gray-500 block mb-0.5">Observações</label>
              <input name="observacoes" placeholder="Opcional"
                className="w-full border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-brand-300" />
            </div>

            {erro && (
              <p className="text-[10px] text-red-600 bg-red-50 rounded px-2 py-1">{erro}</p>
            )}

            <button type="submit" disabled={isPending}
              className="w-full flex items-center justify-center gap-1.5 bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white text-xs font-medium py-1.5 rounded transition-colors cursor-pointer">
              <Trophy className="w-3.5 h-3.5" /> {isPending ? "Salvando…" : "Salvar resultado"}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
