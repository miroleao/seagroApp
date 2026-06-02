"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Camera, Trash2, Upload } from "lucide-react";

interface Props {
  animalId: string;
  fotoAtual?: string | null;
  nomeAnimal: string;
}

export default function AnimalFotoUpload({ animalId, fotoAtual, nomeAnimal }: Props) {
  const router    = useRouter();
  const fileRef   = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(fotoAtual ?? null);
  const [isPending, startTransition] = useTransition();
  const [error, setError]   = useState<string | null>(null);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Preview local imediato
    const localUrl = URL.createObjectURL(file);
    setPreview(localUrl);
    setError(null);

    const fd = new FormData();
    fd.append("tipo",      "foto");
    fd.append("animal_id", animalId);
    fd.append("file",      file);

    startTransition(async () => {
      const res = await fetch("/api/animal-media", { method: "POST", body: fd });
      const json = await res.json();

      if (!res.ok) {
        setError(json.error ?? "Erro ao fazer upload.");
        setPreview(fotoAtual ?? null);
        return;
      }

      setPreview(json.photo_url);
      router.refresh();
    });
  }

  async function handleRemover() {
    if (!confirm("Remover a foto deste animal?")) return;
    setError(null);

    startTransition(async () => {
      const res = await fetch("/api/animal-media", {
        method:  "DELETE",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ tipo: "foto", animal_id: animalId }),
      });

      if (!res.ok) {
        const json = await res.json();
        setError(json.error ?? "Erro ao remover foto.");
        return;
      }

      setPreview(null);
      if (fileRef.current) fileRef.current.value = "";
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col items-center gap-2">
      {/* Foto ou placeholder */}
      <div
        onClick={() => !isPending && fileRef.current?.click()}
        className={`relative group w-28 h-28 md:w-36 md:h-36 rounded-xl overflow-hidden border-2 cursor-pointer transition-all
          ${preview
            ? "border-brand-200 hover:border-brand-400"
            : "border-dashed border-gray-200 hover:border-brand-300 bg-gray-50"
          }
          ${isPending ? "opacity-60 cursor-wait" : ""}
        `}
      >
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={preview}
            alt={nomeAnimal}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="flex flex-col items-center justify-center h-full gap-2 text-gray-300">
            <Camera className="w-8 h-8" />
            <span className="text-xs text-center leading-tight px-2">Adicionar foto</span>
          </div>
        )}

        {/* Overlay de upload */}
        {!isPending && (
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all flex items-center justify-center opacity-0 group-hover:opacity-100">
            <Upload className="w-6 h-6 text-white drop-shadow" />
          </div>
        )}

        {/* Spinner */}
        {isPending && (
          <div className="absolute inset-0 bg-white/70 flex items-center justify-center">
            <div className="w-6 h-6 border-2 border-brand-400 border-t-transparent rounded-full animate-spin" />
          </div>
        )}
      </div>

      {/* Input oculto */}
      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic"
        className="hidden"
        onChange={handleFile}
      />

      {/* Ações */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={isPending}
          onClick={() => fileRef.current?.click()}
          className="inline-flex items-center gap-1.5 text-xs text-brand-600 hover:text-brand-800 font-medium px-3 py-1.5 border border-brand-200 rounded-lg hover:bg-brand-50 transition-colors disabled:opacity-50"
        >
          <Camera className="w-3.5 h-3.5" />
          {preview ? "Trocar foto" : "Escolher foto"}
        </button>

        {preview && (
          <button
            type="button"
            disabled={isPending}
            onClick={handleRemover}
            className="inline-flex items-center gap-1 text-xs text-red-400 hover:text-red-600 px-2 py-1.5 border border-red-100 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50"
          >
            <Trash2 className="w-3 h-3" />
            Remover
          </button>
        )}
      </div>

      {error && (
        <p className="text-xs text-red-500 text-center max-w-[160px]">{error}</p>
      )}

      <p className="text-[10px] text-gray-400 text-center">JPG, PNG, WEBP · máx 5 MB</p>
    </div>
  );
}
