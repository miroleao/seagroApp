import { Sparkles, AlertCircle } from "lucide-react";
import { Suspense } from "react";
import ElitiaChat from "./ElitiaChat";

export default function ElitiaPage() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <div className="flex items-center gap-3 mb-2">
          <Sparkles className="w-6 h-6 text-brand-600" />
          <h1 className="text-3xl font-bold text-gray-900">ElitIA</h1>
          <span className="badge bg-amber-100 text-amber-700 text-xs">BETA</span>
        </div>
        <p className="text-gray-500">
          Assistente de IA especializada em análise de dados da sua fazenda Nelore
        </p>
      </div>

      {/* ── Aviso Beta ────────────────────────────────────────────── */}
      <div className="flex gap-3 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <AlertCircle className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
        <div className="text-sm text-blue-900">
          <p className="font-semibold mb-1">Em fase beta</p>
          <p>
            A ElitIA está em desenvolvimento. Suas respostas se baseiam nos dados do seu banco
            de dados. Sempre revise as informações críticas.
          </p>
        </div>
      </div>

      {/* ── Chat ────────────────────────────────────────────────── */}
      <Suspense
        fallback={
          <div className="h-96 bg-gray-50 border border-gray-200 rounded-lg flex items-center justify-center">
            <p className="text-gray-400">Carregando ElitIA...</p>
          </div>
        }
      >
        <ElitiaChat />
      </Suspense>

      {/* ── Capacidades ────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8">
        <div className="p-4 border border-gray-200 rounded-lg">
          <p className="font-semibold text-sm text-gray-900 mb-2">📊 Análise de Prenhezes</p>
          <p className="text-xs text-gray-600">
            Consulte quantidade, distribuição por sexo, status de embriões e histórico de
            aspirações
          </p>
        </div>
        <div className="p-4 border border-gray-200 rounded-lg">
          <p className="font-semibold text-sm text-gray-900 mb-2">💰 Financeiro & Leilões</p>
          <p className="text-xs text-gray-600">
            Analise investimentos, vendas, médias por período e retorno sobre investimento
          </p>
        </div>
        <div className="p-4 border border-gray-200 rounded-lg">
          <p className="font-semibold text-sm text-gray-900 mb-2">🐂 Dados de Animais</p>
          <p className="text-xs text-gray-600">
            Consulte informações sobre doadoras, machos e status reprodutivo
          </p>
        </div>
      </div>
    </div>
  );
}
