"use client";

import { useState } from "react";
import { atualizarStatusReprodutivo } from "@/app/doadoras/[id]/actions";

interface ReproStatusFormProps {
  doadoraId: string;
  statusAtual: string | null;
  dataStatus: string | null;
  touroPrenhez: string | null;
  rgdTouroPrenhez: string | null;
  touroUltimoParto: string | null;
  rgdTouroUltimoParto: string | null;
  dataUltimoParto: string | null;
  numeroParto: number;
}

const STATUS_LABELS: Record<string, string> = {
  COLETANDO:  "Coletando",
  INSEMINADA: "Inseminada",
  GESTANTE:   "Gestante",
  PARIDA:     "Parida",
  ABORTOU:    "Abortou",
  VAZIA:      "Vazia",
  SECA:       "Seca",
  DESCARTADA: "Descartada",
  VENDIDA:    "Vendida",
};

export function ReproStatusForm({
  doadoraId,
  statusAtual,
  dataStatus,
  touroPrenhez,
  rgdTouroPrenhez,
  touroUltimoParto,
  rgdTouroUltimoParto,
  dataUltimoParto,
  numeroParto,
}: ReproStatusFormProps) {
  const [selectedStatus, setSelectedStatus] = useState(statusAtual ?? "");

  const showTouro = selectedStatus === "INSEMINADA" || selectedStatus === "GESTANTE";
  const showParto = selectedStatus === "PARIDA";

  // Para PARIDA, pré-preenche o touro da inseminação atual
  const touroDefault = showParto ? (touroPrenhez ?? touroUltimoParto ?? "") : (touroPrenhez ?? "");
  const rgdDefault   = showParto ? (rgdTouroPrenhez ?? rgdTouroUltimoParto ?? "") : (rgdTouroPrenhez ?? "");

  return (
    <form action={atualizarStatusReprodutivo} className="space-y-3">
      <input type="hidden" name="id" value={doadoraId} />

      {/* Linha principal: Status + Data */}
      <div className="flex flex-wrap items-end gap-2">
        <div className="flex flex-col gap-0.5">
          <label className="text-[10px] uppercase text-gray-400 tracking-wide">Novo status</label>
          <select
            name="status_reprodutivo"
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-brand-300 bg-white"
          >
            <option value="">— Selecionar —</option>
            <option value="VAZIA">Vazia</option>
            <option value="COLETANDO">Coletando</option>
            <option value="INSEMINADA">Inseminada</option>
            <option value="GESTANTE">Gestante</option>
            <option value="PARIDA">Parida</option>
            <option value="ABORTOU">Abortou</option>
            <option value="SECA">Seca</option>
            <option value="DESCARTADA">Descartada</option>
            <option value="VENDIDA">Vendida</option>
          </select>
        </div>

        <div className="flex flex-col gap-0.5">
          <label className="text-[10px] uppercase text-gray-400 tracking-wide">
            {showParto ? "Data do parto" : showTouro ? "Data da inseminação" : "Data do evento"}
          </label>
          <input
            name="data_status"
            type="date"
            defaultValue={dataStatus ?? ""}
            className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-brand-300 bg-white"
          />
        </div>

        {/* Touro — só aparece para INSEMINADA / GESTANTE / PARIDA */}
        {(showTouro || showParto) && (
          <>
            <div className="flex flex-col gap-0.5">
              <label className="text-[10px] uppercase text-gray-400 tracking-wide">
                {showParto ? "Touro do parto" : "Touro (nome)"}
              </label>
              <input
                name="touro_nome"
                type="text"
                defaultValue={touroDefault}
                placeholder="Nome do touro…"
                className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-brand-300 bg-white w-44"
              />
            </div>
            <div className="flex flex-col gap-0.5">
              <label className="text-[10px] uppercase text-gray-400 tracking-wide">RGD / RGN</label>
              <input
                name="touro_rgd"
                type="text"
                defaultValue={rgdDefault}
                placeholder="RGD ou RGN…"
                className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs text-gray-700 font-mono focus:outline-none focus:ring-2 focus:ring-brand-300 bg-white w-32"
              />
            </div>
          </>
        )}

        <button
          type="submit"
          className="text-xs text-brand-600 hover:text-brand-800 font-medium px-3 py-1.5 border border-brand-200 rounded-lg hover:bg-brand-50 transition-colors self-end"
        >
          ✓ Salvar
        </button>
      </div>

      {/* Dica contextual */}
      {showParto && (
        <p className="text-[11px] text-indigo-500 bg-indigo-50 border border-indigo-100 rounded-lg px-3 py-1.5">
          🐄 Ao salvar como <strong>Parida</strong>, o número de partos será incrementado automaticamente
          {numeroParto > 0 ? ` (atual: ${numeroParto}º parto)` : " (será o 1º parto)"} e o touro da prenhez será registrado.
        </p>
      )}
      {showTouro && (
        <p className="text-[11px] text-amber-500 bg-amber-50 border border-amber-100 rounded-lg px-3 py-1.5">
          🐂 Informe o touro utilizado na inseminação/cobertura para rastrear a prenhez.
        </p>
      )}
    </form>
  );
}
