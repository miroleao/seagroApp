import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { FARM_ID } from "@/lib/utils";
import type { AnimalDocument, AnimalDocTipo } from "@/types";

// Usa service role para operações de storage (bypassa RLS)
function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

// ── POST — upload de foto ou documento ──────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const tipo      = formData.get("tipo") as "foto" | "documento";
    const animalId  = formData.get("animal_id") as string;
    const file      = formData.get("file") as File | null;

    if (!tipo || !animalId || !file) {
      return NextResponse.json({ error: "Campos obrigatórios ausentes." }, { status: 400 });
    }

    const supabase = adminClient();
    const ext      = file.name.split(".").pop()?.toLowerCase() ?? "bin";
    const buffer   = Buffer.from(await file.arrayBuffer());

    if (tipo === "foto") {
      // ── Foto principal ────────────────────────────────────────────
      const path = `${FARM_ID}/${animalId}/foto.${ext}`;

      // Remove foto anterior (ignora erro se não existia)
      await supabase.storage.from("animal-photos").remove([path]);

      const { error: upErr } = await supabase.storage
        .from("animal-photos")
        .upload(path, buffer, {
          contentType: file.type,
          upsert: true,
        });

      if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });

      const { data: urlData } = supabase.storage
        .from("animal-photos")
        .getPublicUrl(path);

      // Adiciona cache-buster para forçar re-fetch após troca
      const photoUrl = `${urlData.publicUrl}?t=${Date.now()}`;

      const { error: dbErr } = await supabase
        .from("animals")
        .update({ photo_url: photoUrl })
        .eq("id", animalId)
        .eq("farm_id", FARM_ID);

      if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 });

      return NextResponse.json({ ok: true, photo_url: photoUrl });
    }

    if (tipo === "documento") {
      // ── Documento (RGN, DNA, OUTRO) ───────────────────────────────
      const docTipo  = (formData.get("doc_tipo") as AnimalDocTipo) ?? "OUTRO";
      const docLabel = (formData.get("doc_label") as string) ?? file.name;
      const fileId   = crypto.randomUUID();
      const path     = `${FARM_ID}/${animalId}/docs/${fileId}.${ext}`;

      const { error: upErr } = await supabase.storage
        .from("animal-documents")
        .upload(path, buffer, { contentType: file.type });

      if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });

      const novoDoc: AnimalDocument = {
        tipo:      docTipo,
        label:     docLabel,
        path,
        mime:      file.type,
        criado_em: new Date().toISOString(),
      };

      // Appenda no array JSONB via SQL para evitar race condition
      const { error: dbErr } = await supabase.rpc("append_animal_document", {
        p_animal_id: animalId,
        p_farm_id:   FARM_ID,
        p_document:  novoDoc,
      });

      if (dbErr) {
        // Fallback: lê array atual e faz update manual
        const { data: animal } = await supabase
          .from("animals")
          .select("documents")
          .eq("id", animalId)
          .single();

        const docs: AnimalDocument[] = animal?.documents ?? [];
        docs.push(novoDoc);

        const { error: updErr } = await supabase
          .from("animals")
          .update({ documents: docs })
          .eq("id", animalId)
          .eq("farm_id", FARM_ID);

        if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });
      }

      return NextResponse.json({ ok: true, document: novoDoc });
    }

    return NextResponse.json({ error: "Tipo inválido." }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Erro interno" }, { status: 500 });
  }
}

// ── DELETE — remover foto ou documento ──────────────────────────────────────
export async function DELETE(req: NextRequest) {
  try {
    const { tipo, animal_id, path } = await req.json() as {
      tipo: "foto" | "documento";
      animal_id: string;
      path?: string;
    };

    if (!tipo || !animal_id) {
      return NextResponse.json({ error: "Campos obrigatórios ausentes." }, { status: 400 });
    }

    const supabase = adminClient();

    if (tipo === "foto") {
      // Busca a URL atual para extrair o path no bucket
      const { data: animal } = await supabase
        .from("animals")
        .select("photo_url")
        .eq("id", animal_id)
        .single();

      if (animal?.photo_url) {
        // Extrai o path do bucket a partir da URL pública
        const url   = new URL(animal.photo_url.split("?")[0]);
        const parts = url.pathname.split("/storage/v1/object/public/animal-photos/");
        if (parts[1]) {
          await supabase.storage.from("animal-photos").remove([parts[1]]);
        }
      }

      await supabase
        .from("animals")
        .update({ photo_url: null })
        .eq("id", animal_id)
        .eq("farm_id", FARM_ID);

      return NextResponse.json({ ok: true });
    }

    if (tipo === "documento" && path) {
      // Remove do storage
      await supabase.storage.from("animal-documents").remove([path]);

      // Remove do array JSONB
      const { data: animal } = await supabase
        .from("animals")
        .select("documents")
        .eq("id", animal_id)
        .single();

      const docs: AnimalDocument[] = (animal?.documents ?? []).filter(
        (d: AnimalDocument) => d.path !== path
      );

      await supabase
        .from("animals")
        .update({ documents: docs })
        .eq("id", animal_id)
        .eq("farm_id", FARM_ID);

      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Parâmetros inválidos." }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Erro interno" }, { status: 500 });
  }
}

// ── GET — gerar signed URL para documento privado ───────────────────────────
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const path = searchParams.get("path");

    if (!path) return NextResponse.json({ error: "path obrigatório" }, { status: 400 });

    const supabase = adminClient();
    const { data, error } = await supabase.storage
      .from("animal-documents")
      .createSignedUrl(path, 300); // 5 minutos

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ url: data.signedUrl });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Erro interno" }, { status: 500 });
  }
}
