"use client";

import { useState } from "react";
import { Baby } from "lucide-react";
import { registrarNascimentoNatural, vincularNascimentoNatural } from "./actions";

interface Props {
  doadoraId: string;
  animaisParaVincular: { id: string; nome: string }[];
}

export function NascimentoDoadoraForm({ doadoraId, animaisParaVincular }: Props) {
  const [modo, setModo] = useState<"novo" | "vincular" | null>(null);
  const [busca, setBusca] = useState("");
  const [animalSelecionado, setAnimalSelecionado] = useState<{ id: string; nome: string } | null>(null);

  const animaisFiltrados =
    busca.trim().length >= 2 && !animalSelecionado
      ? animaisParaVincular
          .filter(a => a.nome.toLowerCase().includes(busca.toLowerCase()))
          .slice(0, 8)
      : [];

  function resetar() {
    setModo(null);
    setBusca("");
    setAnimalSelecionado(null);
  }

  return (
    <div className="mt-4 border border-green-200 bg-green-50 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <Baby className="w-4 h-4 text-green-600" />
        <span className="text-sm font-semibold text-green-800">Registrar Nascimento</span>
        <span className="text-xs text-green-500">— filhote desta prenhez</span>
      </div>

      {!modo && (
        <div className="flex gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setModo("novo")}
            className="text-xs px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
          >
            + Registrar novo animal
          </button>
          <button
            type="button"
            onClick={() => setModo("vincular")}
            className="text-xs px-3 py-1.5 bg-white text-green-700 border border-green-300 rounded-lg hover:bg-green-100 transition-colors font-medium"
          >
            🔗 Vincular animal já cadastrado
          </button>
        </div>
      )}

      {modo && (
        <button
          type="button"
          onClick={resetar}
          className="text-xs text-gray-400 hover:text-gray-600 mb-3 block transition-colors"
        >
          ← Voltar
        </button>
      )}

      {/* ── Modo: registrar novo animal ── */}
      {modo === "novo" && (
        <form action={registrarNascimentoNatural} className="space-y-3">
          <input type="hidden" name="doadora_id" value={doadoraId} />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <div className="col-span-2">
              <label className="text-[10px] uppercase text-gray-500 tracking-wide">Nome *</label>
              <input
                name="nome"
                type="text"
                required
                placeholder="Nome do filhote..."
                className="w-full mt-0.5 border border-gray-200 rounded-lg px-2 py-1.5 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-green-300"
              />
            </div>
            <div>
              <label className="text-[10px] uppercase text-gray-500 tracking-wide">Data nasc. *</label>
              <input
                name="nascimento"
                type="date"
                required
                className="w-full mt-0.5 border border-gray-200 rounded-lg px-2 py-1.5 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-green-300"
              />
            </div>
            <div>
              <label className="text-[10px] uppercase text-gray-500 tracking-wide">Sexo *</label>
              <select
                name="sexo"
                required
                className="w-full mt-0.5 border border-gray-200 rounded-lg px-2 py-1.5 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-green-300"
              >
                <option value="">—</option>
                <option value="F">Fêmea → Doadora</option>
                <option value="M">Macho → Touro</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] uppercase text-gray-500 tracking-wide">RGN</label>
              <input
                name="rgn"
                type="text"
                placeholder="Opcional"
                className="w-full mt-0.5 border border-gray-200 rounded-lg px-2 py-1.5 text-xs font-mono bg-white focus:outline-none focus:ring-2 focus:ring-green-300"
              />
            </div>
            <div>
              <label className="text-[10px] uppercase text-gray-500 tracking-wide">% Próprio</label>
              <input
                name="percentual_proprio"
                type="number"
                min="0"
                max="100"
                step="1"
                defaultValue="100"
                className="w-full mt-0.5 border border-gray-200 rounded-lg px-2 py-1.5 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-green-300"
              />
            </div>
            <div className="flex items-end pb-2">
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input type="checkbox" name="nascido_se_agro" className="w-3.5 h-3.5 rounded" />
                <span className="text-xs text-gray-600">Nascido SE Agro</span>
              </label>
            </div>
          </div>
          <p className="text-[11px] text-green-700 bg-green-100 rounded px-2 py-1">
            Pai e mãe preenchidos automaticamente. A doadora será marcada como <strong>Parida</strong>.
          </p>
          <button
            type="submit"
            className="text-xs px-4 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
          >
            Salvar nascimento
          </button>
        </form>
      )}

      {/* ── Modo: vincular animal existente ── */}
      {modo === "vincular" && (
        <form action={vincularNascimentoNatural} className="space-y-3">
          <input type="hidden" name="doadora_id" value={doadoraId} />
          <input type="hidden" name="animal_id" value={animalSelecionado?.id ?? ""} />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="relative">
              <label className="text-[10px] uppercase text-gray-500 tracking-wide">Buscar animal *</label>
              <input
                type="text"
                value={animalSelecionado ? animalSelecionado.nome : busca}
                onChange={e => {
                  setBusca(e.target.value);
                  setAnimalSelecionado(null);
                }}
                placeholder="Digite o nome (mín. 2 caracteres)..."
                className="w-full mt-0.5 border border-gray-200 rounded-lg px-2 py-1.5 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-green-300"
              />
              {animaisFiltrados.length > 0 && (
                <div className="absolute top-full left-0 right-0 z-10 mt-0.5 bg-white border border-gray-200 rounded-lg shadow-lg max-h-40 overflow-y-auto">
                  {animaisFiltrados.map(a => (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => { setAnimalSelecionado(a); setBusca(""); }}
                      className="w-full text-left px-3 py-1.5 text-xs hover:bg-green-50 transition-colors border-b border-gray-50 last:border-0"
                    >
                      {a.nome}
                    </button>
                  ))}
                </div>
              )}
              {animalSelecionado && (
                <p className="text-[11px] text-green-700 mt-1 font-medium">
                  ✓ {animalSelecionado.nome}
                  <button
                    type="button"
                    onClick={() => setAnimalSelecionado(null)}
                    className="ml-2 text-gray-400 hover:text-gray-600"
                  >
                    ×
                  </button>
                </p>
              )}
            </div>
            <div>
              <label className="text-[10px] uppercase text-gray-500 tracking-wide">Data do nascimento *</label>
              <input
                name="nascimento"
                type="date"
                required
                className="w-full mt-0.5 border border-gray-200 rounded-lg px-2 py-1.5 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-green-300"
              />
            </div>
          </div>
          <p className="text-[11px] text-blue-700 bg-blue-50 rounded px-2 py-1">
            O animal será vinculado como filho desta doadora. Ela será marcada como <strong>Parida</strong>.
          </p>
          <button
            type="submit"
            disabled={!animalSelecionado}
            className="text-xs px-4 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Vincular animal
          </button>
        </form>
      )}
    </div>
  );
}
