"use client";

import { useRef } from "react";
import { Edit2 } from "lucide-react";
import GenealogyForm from "./GenealogyForm";

interface Props {
  animalId: string;
  // valores atuais do animal
  pai_nome?: string | null;
  mae_nome?: string | null;
  avo_paterno?: string | null;
  avo_paterna?: string | null;
  avo_materno?: string | null;
  avo_materna?: string | null;
  bisavo_pat_pat?: string | null;
  bisava_pat_pat?: string | null;
  bisavo_pat_mat?: string | null;
  bisava_pat_mat?: string | null;
  bisavo_materno?: string | null;
  bisava_mat_pat?: string | null;
  bisavo_materna?: string | null;
  bisavo?: string | null;
  // server action para salvar
  action: (formData: FormData) => Promise<void>;
}

export default function EditarGenealogyForm({
  animalId,
  action,
  ...initial
}: Props) {
  const detailsRef = useRef<HTMLDetailsElement>(null);

  const initialValues = {
    pai_nome:       initial.pai_nome       ?? "",
    mae_nome:       initial.mae_nome       ?? "",
    avo_paterno:    initial.avo_paterno    ?? "",
    avo_paterna:    initial.avo_paterna    ?? "",
    avo_materno:    initial.avo_materno    ?? "",
    avo_materna:    initial.avo_materna    ?? "",
    bisavo_pat_pat: initial.bisavo_pat_pat ?? "",
    bisava_pat_pat: initial.bisava_pat_pat ?? "",
    bisavo_pat_mat: initial.bisavo_pat_mat ?? "",
    bisava_pat_mat: initial.bisava_pat_mat ?? "",
    bisavo_materno: initial.bisavo_materno ?? "",
    bisava_mat_pat: initial.bisava_mat_pat ?? "",
    bisavo_materna: initial.bisavo_materna ?? "",
    bisavo:         initial.bisavo         ?? "",
  };

  return (
    <details ref={detailsRef} className="group">
      <summary className="list-none flex items-center gap-2 px-5 py-3 border-t border-gray-100 cursor-pointer bg-gray-50 hover:bg-brand-50 transition-colors select-none">
        <div className="p-1 rounded-md bg-brand-100 text-brand-600 group-open:bg-brand-600 group-open:text-white transition-colors">
          <Edit2 className="w-3.5 h-3.5" />
        </div>
        <span className="text-xs font-semibold text-brand-700 group-open:text-brand-800">Editar Genealogia</span>
        <span className="ml-auto text-xs text-gray-400 group-open:hidden">▸</span>
        <span className="ml-auto text-xs text-gray-400 hidden group-open:inline">▾ Fechar</span>
      </summary>

      <div className="px-5 pt-4 pb-5 bg-gray-50/50 border-t border-brand-100">
        <form action={action} className="space-y-1">
          <input type="hidden" name="id" value={animalId} />
          <GenealogyForm initialValues={initialValues} />
          <div className="pt-4">
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 bg-brand-600 text-white text-sm px-5 py-2 rounded-lg hover:bg-brand-700 transition-colors font-medium"
            >
              Salvar Genealogia
            </button>
          </div>
        </form>
      </div>
    </details>
  );
}
