-- ─────────────────────────────────────────────────────────────────────────────
-- add_cascade_transfers.sql
--
-- Adiciona ON DELETE CASCADE na FK transfers.embryo_id → embryos(id).
--
-- Antes: sem cascade — o código TypeScript deletava manualmente em 4 arquivos:
--   DG → transfers → embryos → aspirations → opu_sessions
--
-- Depois: PostgreSQL cuida do cascade automaticamente. Ao deletar uma
--   opu_session, todo o grafo descendente é removido pelo banco.
--
-- Rodar em: Supabase Dashboard → SQL Editor → New Query → Execute
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE transfers
  DROP CONSTRAINT IF EXISTS transfers_embryo_id_fkey;

ALTER TABLE transfers
  ADD CONSTRAINT transfers_embryo_id_fkey
    FOREIGN KEY (embryo_id)
    REFERENCES embryos(id)
    ON DELETE CASCADE;
