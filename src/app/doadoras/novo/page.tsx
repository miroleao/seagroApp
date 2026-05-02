import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { FARM_ID } from "@/lib/utils";
import { criarDoadora } from "./actions";

export default async function NovaDoadoraPage() {
  const supabase = await createClient();
  const { data: parceiros } = await supabase
    .from("partners")
    .select("id, nome")
    .eq("farm_id", FARM_ID)
    .order("nome", { ascending: true });

  return (
    <div className="p-6 max-w-2xl space-y-6">
      <Link href="/doadoras" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
        <ArrowLeft className="w-4 h-4" /> Voltar para Doadoras
      </Link>

      <div>
        <h1 className="text-2xl font-bold text-gray-900">Nova Doadora</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Cadastre os dados básicos. Aspirações e embriões podem ser adicionados na ficha individual.
        </p>
      </div>

      <form action={criarDoadora} className="card p-6 space-y-6">

        {/* ── Identificação ── */}
        <section className="space-y-4">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide border-b border-gray-100 pb-2">Identificação</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="text-xs text-gray-500 mb-1 block">Nome *</label>
              <input name="nome" type="text" required placeholder="Ex: SE Beleza"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300" />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">RGN (Nascimento)</label>
              <input name="rgn" type="text" placeholder="Número do RGN ABCZ"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-brand-300" />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Data de Nascimento</label>
              <input name="nascimento" type="date"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300" />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Localização</label>
              <input name="localizacao" type="text" placeholder="Ex: Pasto 2, Curral A…"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300" />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Status Reprodutivo</label>
              <select name="status_reprodutivo"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-300">
                <option value="">— Selecionar —</option>
                <option value="VAZIA">Vazia</option>
                <option value="COLETANDO">Coletando</option>
                <option value="INSEMINADA">Inseminada</option>
                <option value="GESTANTE">Gestante</option>
                <option value="PARIDA">Parida</option>
                <option value="SECA">Seca</option>
                <option value="DESCARTADA">Descartada</option>
                <option value="VENDIDA">Vendida</option>
              </select>
            </div>
          </div>
        </section>

        {/* ── Genealogia ── */}
        <section className="space-y-5">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide border-b border-gray-100 pb-2">Genealogia</h2>

          {/* Pais */}
          <div>
            <p className="text-xs font-medium text-gray-500 mb-2">Pais</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Pai</label>
                <input name="pai_nome" type="text" placeholder="Nome do pai"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300" />
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Mãe</label>
                <input name="mae_nome" type="text" placeholder="Nome da mãe"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300" />
              </div>
            </div>
          </div>

          {/* Avós Paternos */}
          <div>
            <p className="text-xs font-medium text-gray-500 mb-2">Avós Paternos <span className="text-gray-300 font-normal">(pais do Pai)</span></p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Avô Paterno</label>
                <input name="avo_paterno" type="text" placeholder="Pai do pai"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300" />
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Avó Paterna</label>
                <input name="avo_paterna" type="text" placeholder="Mãe do pai"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300" />
              </div>
            </div>
          </div>

          {/* Avós Maternos */}
          <div>
            <p className="text-xs font-medium text-gray-500 mb-2">Avós Maternos <span className="text-gray-300 font-normal">(pais da Mãe)</span></p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Avô Materno</label>
                <input name="avo_materno" type="text" placeholder="Pai da mãe"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300" />
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Avó Materna</label>
                <input name="avo_materna" type="text" placeholder="Mãe da mãe"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300" />
              </div>
            </div>
          </div>

          {/* Bisavós Paternos */}
          <div>
            <p className="text-xs font-medium text-gray-500 mb-2">Bisavós Paternos <span className="text-gray-300 font-normal">(avós do Pai)</span></p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Pai do Avô Paterno</label>
                <input name="bisavo_pat_pat" type="text" placeholder="Bisavô — pai do avô paterno"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300" />
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Mãe do Avô Paterno</label>
                <input name="bisava_pat_pat" type="text" placeholder="Bisavó — mãe do avô paterno"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300" />
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Pai da Avó Paterna</label>
                <input name="bisavo_pat_mat" type="text" placeholder="Bisavô — pai da avó paterna"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300" />
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Mãe da Avó Paterna</label>
                <input name="bisava_pat_mat" type="text" placeholder="Bisavó — mãe da avó paterna"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300" />
              </div>
            </div>
          </div>

          {/* Bisavós Maternos */}
          <div>
            <p className="text-xs font-medium text-gray-500 mb-2">Bisavós Maternos <span className="text-gray-300 font-normal">(avós da Mãe)</span></p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Pai do Avô Materno</label>
                <input name="bisavo_materno" type="text" placeholder="Bisavô — pai do avô materno"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300" />
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Mãe do Avô Materno</label>
                <input name="bisava_mat_pat" type="text" placeholder="Bisavó — mãe do avô materno"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300" />
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Pai da Avó Materna</label>
                <input name="bisavo_materna" type="text" placeholder="Bisavô — pai da avó materna"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300" />
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Mãe da Avó Materna</label>
                <input name="bisavo" type="text" placeholder="Bisavó — mãe da avó materna"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300" />
              </div>
            </div>
          </div>
        </section>

        {/* ── Financeiro ── */}
        <section className="space-y-4">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide border-b border-gray-100 pb-2">Financeiro</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">% Próprio da Fazenda</label>
              <div className="flex items-center gap-2">
                <input name="percentual_proprio" type="number" min="0" max="100" step="1" placeholder="Ex: 50"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300" />
                <span className="text-sm text-gray-400">%</span>
              </div>
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Valor da Parcela (R$)</label>
              <input name="valor_parcela" type="number" min="0" step="0.01" placeholder="Ex: 800.00"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300" />
            </div>
          </div>
        </section>

        {/* ── Sócios ── */}
        {parceiros && parceiros.length > 0 && (
          <section className="space-y-4">
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide border-b border-gray-100 pb-2">
              Sócios <span className="text-gray-400 font-normal normal-case">(opcional — até 3)</span>
            </h2>
            <p className="text-xs text-gray-400">Vincule sócios já cadastrados. Mais sócios podem ser adicionados depois na ficha individual.</p>
            {[1, 2, 3].map((n) => (
              <div key={n} className="grid grid-cols-1 md:grid-cols-3 gap-3 bg-gray-50 border border-dashed border-gray-200 rounded-lg px-4 py-3">
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Sócio {n}</label>
                  <select name={`partner_id_${n}`}
                    className="w-full border border-gray-200 rounded-lg px-2 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-300">
                    <option value="">— Nenhum —</option>
                    {parceiros.map((p: any) => (
                      <option key={p.id} value={p.id}>{p.nome}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">% Participação</label>
                  <div className="flex items-center gap-1">
                    <input name={`percentual_${n}`} type="number" min="1" max="100" step="1" placeholder="Ex: 25"
                      className="w-full border border-gray-200 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300" />
                    <span className="text-sm text-gray-400">%</span>
                  </div>
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Parcela (R$)</label>
                  <input name={`parcela_${n}`} type="number" min="0" step="0.01" placeholder="Opcional"
                    className="w-full border border-gray-200 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300" />
                </div>
              </div>
            ))}
          </section>
        )}

        {/* ── Observações ── */}
        <section className="space-y-2">
          <label className="text-xs text-gray-500 uppercase tracking-wide block">Observações</label>
          <textarea name="observacoes" rows={3} placeholder="Informações adicionais…"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300 resize-none" />
        </section>

        <div className="flex items-center gap-3 pt-2">
          <button type="submit"
            className="bg-brand-600 text-white text-sm font-medium px-6 py-2.5 rounded-lg hover:bg-brand-700 transition-colors">
            Cadastrar Doadora
          </button>
          <Link href="/doadoras" className="text-sm text-gray-500 hover:text-gray-700">Cancelar</Link>
        </div>
      </form>
    </div>
  );
}
