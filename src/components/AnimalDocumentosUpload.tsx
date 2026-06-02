"use client";

import React, { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FileText, Upload, Trash2, ExternalLink, FileScan, Dna, FileQuestion, Plus, X } from "lucide-react";
import type { AnimalDocument, AnimalDocTipo } from "@/types";

// ── Configuração por tipo de documento ─────────────────────────────────────
const DOC_CONFIG: Record<AnimalDocTipo, { label: string; icon: () => React.ReactElement; cls: string }> = {
  RGN: {
    label: "Registro Genealógico (RGN)",
    icon:  () => <FileScan className="w-3.5 h-3.5" />,
    cls:   "bg-blue-50 text-blue-700 border-blue-200",
  },
  DNA: {
    label: "Teste de DNA",
    icon:  () => <Dna className="w-3.5 h-3.5" />,
    cls:   "bg-purple-50 text-purple-700 border-purple-200",
  },
  OUTRO: {
    label: "Outro Documento",
    icon:  () => <FileQuestion className="w-3.5 h-3.5" />,
    cls:   "bg-gray-50 text-gray-600 border-gray-200",
  },
};

interface Props {
  animalId: string;
  documentos: AnimalDocument[];
}

export default function AnimalDocumentosUpload({ animalId, documentos: docsInit }: Props) {
  const router           = useRouter();
  const fileRef          = useRef<HTMLInputElement>(null);
  const [docs, setDocs]  = useState<AnimalDocument[]>(docsInit);
  const [isPending, startTransition] = useTransition();
  const [error, setError]   = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);

  // Formulário de novo documento
  const [docTipo,  setDocTipo]  = useState<AnimalDocTipo>("RGN");
  const [docLabel, setDocLabel] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);

  // Abre modal de visualização via signed URL
  const [loadingPath, setLoadingPath] = useState<string | null>(null);

  async function handleUpload(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const file = fileRef.current?.files?.[0];
    if (!file) { setError("Selecione um arquivo."); return; }
    setError(null);

    const fd = new FormData();
    fd.append("tipo",      "documento");
    fd.append("animal_id", animalId);
    fd.append("file",      file);
    fd.append("doc_tipo",  docTipo);
    fd.append("doc_label", docLabel || file.name);

    startTransition(async () => {
      const res  = await fetch("/api/animal-media", { method: "POST", body: fd });
      const json = await res.json();

      if (!res.ok) {
        setError(json.error ?? "Erro ao fazer upload.");
        return;
      }

      setDocs(prev => [...prev, json.document]);
      setFormOpen(false);
      setDocLabel("");
      setFileName(null);
      if (fileRef.current) fileRef.current.value = "";
      router.refresh();
    });
  }

  async function handleRemover(path: string) {
    if (!confirm("Remover este documento?")) return;
    setError(null);

    startTransition(async () => {
      const res = await fetch("/api/animal-media", {
        method:  "DELETE",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ tipo: "documento", animal_id: animalId, path }),
      });

      if (!res.ok) {
        const json = await res.json();
        setError(json.error ?? "Erro ao remover documento.");
        return;
      }

      setDocs(prev => prev.filter(d => d.path !== path));
      router.refresh();
    });
  }

  async function handleVisualizar(path: string) {
    setLoadingPath(path);
    const res  = await fetch(`/api/animal-media?path=${encodeURIComponent(path)}`);
    const json = await res.json();
    setLoadingPath(null);
    if (json.url) {
      window.open(json.url, "_blank", "noopener,noreferrer");
    } else {
      setError("Não foi possível gerar o link do documento.");
    }
  }

  function formatData(iso: string) {
    return new Date(iso).toLocaleDateString("pt-BR");
  }

  return (
    <div className="space-y-3">
      {/* Lista de documentos existentes */}
      {docs.length === 0 ? (
        <p className="text-sm text-gray-400 italic">Nenhum documento cadastrado.</p>
      ) : (
        <div className="space-y-2">
          {docs.map((doc) => {
            const cfg     = DOC_CONFIG[doc.tipo] ?? DOC_CONFIG.OUTRO;
            const isLoading = loadingPath === doc.path;

            return (
              <div
                key={doc.path}
                className={`flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5 ${cfg.cls}`}
              >
                {/* Ícone + info */}
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="shrink-0">{cfg.icon()}</span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate leading-tight">{doc.label}</p>
                    <p className="text-[10px] opacity-60 mt-0.5">
                      {cfg.label.split(" ")[0]} · {formatData(doc.criado_em)} ·{" "}
                      {doc.mime === "application/pdf" ? "PDF" : doc.mime.split("/")[1]?.toUpperCase()}
                    </p>
                  </div>
                </div>

                {/* Ações */}
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleVisualizar(doc.path)}
                    disabled={isLoading || isPending}
                    title="Visualizar / baixar"
                    className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-lg border border-current/30 hover:bg-white/60 transition-colors disabled:opacity-50 cursor-pointer"
                  >
                    {isLoading
                      ? <div className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" />
                      : <ExternalLink className="w-3 h-3" />
                    }
                    <span className="hidden sm:inline">Abrir</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleRemover(doc.path)}
                    disabled={isPending}
                    title="Remover documento"
                    className="inline-flex items-center p-1.5 rounded-lg hover:bg-red-50 hover:text-red-600 transition-colors disabled:opacity-50 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Botão para abrir formulário de upload */}
      {!formOpen && (
        <button
          type="button"
          onClick={() => setFormOpen(true)}
          className="inline-flex items-center gap-1.5 text-xs text-brand-600 hover:text-brand-800 font-medium px-3 py-1.5 border border-brand-200 rounded-lg hover:bg-brand-50 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          Adicionar documento
        </button>
      )}

      {/* Formulário de upload ─────────────────────────────────── */}
      {formOpen && (
        <form
          onSubmit={handleUpload}
          className="space-y-3 bg-gray-50 border border-dashed border-gray-300 rounded-xl p-4"
        >
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Novo documento
            </p>
            <button
              type="button"
              onClick={() => { setFormOpen(false); setError(null); }}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Tipo */}
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Tipo *</label>
            <div className="flex flex-wrap gap-2">
              {(["RGN", "DNA", "OUTRO"] as AnimalDocTipo[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setDocTipo(t)}
                  className={`inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border font-medium transition-colors ${
                    docTipo === t
                      ? DOC_CONFIG[t].cls + " ring-2 ring-offset-1 ring-brand-300"
                      : "bg-white border-gray-200 text-gray-500 hover:border-gray-300"
                  }`}
                >
                  {DOC_CONFIG[t].icon()}
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Label */}
          <div>
            <label className="text-xs text-gray-500 mb-1 block">
              Descrição <span className="text-gray-300">(opcional)</span>
            </label>
            <input
              type="text"
              value={docLabel}
              onChange={e => setDocLabel(e.target.value)}
              placeholder={
                docTipo === "RGN" ? "Ex: RGN ABCZ nº 12345" :
                docTipo === "DNA" ? "Ex: Teste DNA GenSys 2025" :
                "Descrição do documento…"
              }
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-300"
            />
          </div>

          {/* Arquivo */}
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Arquivo *</label>
            <div
              onClick={() => fileRef.current?.click()}
              className={`flex items-center gap-2 border rounded-lg px-3 py-2.5 cursor-pointer transition-colors ${
                fileName
                  ? "border-brand-300 bg-brand-50"
                  : "border-dashed border-gray-300 bg-white hover:border-brand-300"
              }`}
            >
              <FileText className={`w-4 h-4 shrink-0 ${fileName ? "text-brand-500" : "text-gray-300"}`} />
              <span className={`text-sm truncate ${fileName ? "text-brand-700 font-medium" : "text-gray-400"}`}>
                {fileName ?? "Clique para selecionar…"}
              </span>
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="application/pdf,image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={e => setFileName(e.target.files?.[0]?.name ?? null)}
              required
            />
            <p className="text-[10px] text-gray-400 mt-1">PDF, JPG, PNG · máx 10 MB</p>
          </div>

          {error && <p className="text-xs text-red-500">{error}</p>}

          <div className="flex items-center gap-2 pt-1">
            <button
              type="submit"
              disabled={isPending}
              className="inline-flex items-center gap-1.5 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors disabled:opacity-60"
            >
              {isPending
                ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                : <Upload className="w-3.5 h-3.5" />
              }
              {isPending ? "Enviando…" : "Salvar documento"}
            </button>
            <button
              type="button"
              onClick={() => { setFormOpen(false); setError(null); }}
              className="text-sm text-gray-500 hover:text-gray-700 px-3 py-2"
            >
              Cancelar
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
