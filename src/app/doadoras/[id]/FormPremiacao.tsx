"use client";

import { useActionState } from "react";
import { Plus } from "lucide-react";
import { adicionarPremiacao } from "./actions";

interface Props {
  animalId: string;
  exposicoes: { id: string; nome: string; data_base?: string | null }[];
}

export function FormPremiacao({ animalId, exposicoes }: Props) {
  const [state, formAction, pending] = useActionState(
    async (_prev: { erro?: string } | null, formData: FormData) => {
      const result = await adicionarPremiacao(formData);
      return result ?? null;
    },
    null,
  );

  return (
    <form action={formAction} className="px-5 py-4 bg-gray-50 border-b border-gray-100">
      <input type="hidden" name="animal_id" value={animalId} />
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Registrar prêmio</p>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Tipo de Prêmio *</label>
          <select name="tipo_premio" required
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300">
            <option value="">Selecione…</option>
            <option value="GRANDE_CAMPEAO">Grande Campeão</option>
            <option value="GRANDE_CAMPEA">Grande Campeã</option>
            <option value="RESERVADO_GRANDE_CAMPEAO">Reservado Grande Campeão</option>
            <option value="RESERVADA_GRANDE_CAMPEA">Reservada Grande Campeã</option>
            <option value="CAMPEAO">Campeão</option>
            <option value="CAMPEA">Campeã</option>
            <option value="RESERVADO_CAMPEAO">Reservado Campeão</option>
            <option value="RESERVADA_CAMPEA">Reservada Campeã</option>
            <option value="3_LUGAR_CAMPEONATO">3° Lugar no Campeonato</option>
            <option value="1_LUGAR">1° Lugar na Categoria</option>
            <option value="2_LUGAR">2° Lugar na Categoria</option>
            <option value="3_LUGAR">3° Lugar na Categoria</option>
            <option value="MELHOR_DO_EVENTO">Melhor do Evento</option>
          </select>
        </div>
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Grupo ACNB</label>
          <input name="grupo_nelore" placeholder="Ex: Vaca Jovem"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300" />
        </div>
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Exposição</label>
          <select name="exhibition_id"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300">
            <option value="">— sem vínculo —</option>
            {exposicoes.map((e) => (
              <option key={e.id} value={e.id}>{e.nome}{e.data_base ? ` (${e.data_base})` : ""}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Observações</label>
          <input name="observacoes" placeholder="Opcional"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300" />
        </div>
      </div>
      {state?.erro && (
        <p className="mt-2 text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          ⚠ {state.erro}
        </p>
      )}
      <button type="submit" disabled={pending}
        className="mt-3 inline-flex items-center gap-1.5 bg-yellow-500 text-white text-sm px-4 py-2 rounded-lg hover:bg-yellow-600 disabled:opacity-50 transition-colors">
        <Plus className="w-4 h-4" /> {pending ? "Salvando…" : "Registrar Premiação"}
      </button>
    </form>
  );
}
