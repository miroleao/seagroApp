-- ──────────────────────────────────────────────────────────────────────────────
-- Migration: Foto e Documentos por Animal
-- Rodar no Supabase SQL Editor
-- ──────────────────────────────────────────────────────────────────────────────

-- 1. Colunas na tabela animals
ALTER TABLE animals
  ADD COLUMN IF NOT EXISTS photo_url    TEXT,
  ADD COLUMN IF NOT EXISTS documents    JSONB DEFAULT '[]'::jsonb;

-- 2. Buckets de Storage
-- (executar separadamente na interface do Supabase Storage ou via SQL abaixo)
-- Bucket para fotos (público para simplificar exibição)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'animal-photos',
  'animal-photos',
  true,
  5242880,  -- 5 MB
  ARRAY['image/jpeg','image/png','image/webp','image/heic']
)
ON CONFLICT (id) DO NOTHING;

-- Bucket para documentos (privado — acesso via signed URL)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'animal-documents',
  'animal-documents',
  false,
  10485760,  -- 10 MB
  ARRAY['application/pdf','image/jpeg','image/png','image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- 3. Políticas RLS de Storage — animal-photos (público: qualquer um lê, autenticado escreve)
CREATE POLICY "animal_photos_select"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'animal-photos');

CREATE POLICY "animal_photos_insert"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'animal-photos' AND auth.role() = 'authenticated');

CREATE POLICY "animal_photos_delete"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'animal-photos' AND auth.role() = 'authenticated');

-- 4. Políticas RLS de Storage — animal-documents (privado: autenticado lê e escreve)
CREATE POLICY "animal_documents_select"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'animal-documents' AND auth.role() = 'authenticated');

CREATE POLICY "animal_documents_insert"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'animal-documents' AND auth.role() = 'authenticated');

CREATE POLICY "animal_documents_delete"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'animal-documents' AND auth.role() = 'authenticated');
