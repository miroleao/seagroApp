/**
 * SE Agropecuária Nelore de Elite
 * Componente: ConsanguinidadeTag
 *
 * Exibe a observação de consanguinidade abaixo da seção de genealogia
 * na ficha individual de qualquer animal (doadora, touro ou nascido).
 *
 * Uso básico (Server Component — busca o dado internamente):
 *   <ConsanguinidadeTag animalId="uuid-do-animal" />
 *
 * Uso com resultado pré-calculado (evita chamada duplicada):
 *   <ConsanguinidadeTag resultado={resultado} />
 */

import { Suspense } from "react";
import {
  calcularConsanguinidade,
  CORES_NIVEL,
  DESCRICAO_NIVEL,
  type ResultadoConsanguinidade,
  type NivelConsanguinidade,
} from "@/lib/consanguinidade";

// ─────────────────────────────────────────────────────────
// Tipos de props
// ─────────────────────────────────────────────────────────

interface PropsComId {
  animalId: string;
  resultado?: never;
  /** Mostra o card detalhado com lista de ancestrais? (default: false) */
  expandido?: boolean;
}

interface PropsComResultado {
  animalId?: never;
  resultado: ResultadoConsanguinidade;
  expandido?: boolean;
}

type Props = PropsComId | PropsComResultado;

// ─────────────────────────────────────────────────────────
// Sub-componente: Badge principal
// ─────────────────────────────────────────────────────────

function BadgeConsanguinidade({
  nivel,
  label,
  modoFallback,
}: {
  nivel: NivelConsanguinidade;
  label: string;
  modoFallback: boolean;
}) {
  const cor = CORES_NIVEL[nivel];

  return (
    <span
      className={`
        inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium
        border ${cor.bg} ${cor.text} ${cor.border}
        ${modoFallback ? "italic" : ""}
      `}
      title={DESCRICAO_NIVEL[nivel]}
    >
      <span aria-hidden>{cor.icon}</span>
      {label}
    </span>
  );
}

// ─────────────────────────────────────────────────────────
// Sub-componente: Tabela de ancestrais comuns (modo expandido)
// ─────────────────────────────────────────────────────────

function TabelaAncestral({
  ancestrais,
  nivel,
}: {
  ancestrais: ResultadoConsanguinidade["ancestraisComuns"];
  nivel: NivelConsanguinidade;
}) {
  if (!ancestrais.length) return null;

  const cor = CORES_NIVEL[nivel];

  return (
    <div className={`mt-2 rounded-md border ${cor.border} overflow-hidden`}>
      <table className="w-full text-xs">
        <thead className={`${cor.bg}`}>
          <tr>
            <th className={`text-left px-3 py-1.5 font-medium ${cor.text}`}>
              Ancestral comum
            </th>
            <th className={`text-center px-3 py-1.5 font-medium ${cor.text}`}>
              Geração (♂)
            </th>
            <th className={`text-center px-3 py-1.5 font-medium ${cor.text}`}>
              Geração (♀)
            </th>
            <th className={`text-right px-3 py-1.5 font-medium ${cor.text}`}>
              Contribuição
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 bg-white">
          {ancestrais.map((a, i) => (
            <tr key={a.id || i}>
              <td className="px-3 py-1.5 font-medium text-gray-800">
                {a.nome}
              </td>
              <td className="px-3 py-1.5 text-center text-gray-600">
                {a.n1 > 0 ? `${a.n1}ª` : "—"}
              </td>
              <td className="px-3 py-1.5 text-center text-gray-600">
                {a.n2 > 0 ? `${a.n2}ª` : "—"}
              </td>
              <td className="px-3 py-1.5 text-right text-gray-700">
                {a.percentual_contribuicao > 0
                  ? `${a.percentual_contribuicao.toLocaleString("pt-BR", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 4,
                    })}%`
                  : "Ver nomes"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// Renderizador central
// ─────────────────────────────────────────────────────────

function Render({
  resultado,
  expandido = false,
}: {
  resultado: ResultadoConsanguinidade;
  expandido?: boolean;
}) {
  // Se não há nada relevante para mostrar (sem consanguinidade e calculável)
  if (resultado.nivel === "ZERO" && resultado.calculavel) {
    return (
      <p className="text-xs text-gray-400 italic mt-1">
        ✓ Sem consanguinidade no pedigree cadastrado
      </p>
    );
  }

  return (
    <div className="mt-2 space-y-1">
      <BadgeConsanguinidade
        nivel={resultado.nivel}
        label={resultado.label}
        modoFallback={resultado.modoFallback}
      />

      {expandido && resultado.ancestraisComuns.length > 0 && (
        <TabelaAncestral
          ancestrais={resultado.ancestraisComuns}
          nivel={resultado.nivel}
        />
      )}

      {!resultado.calculavel && !resultado.modoFallback && (
        <p className="text-xs text-gray-400 italic">
          Cadastre pai e mãe por código (FK) para calcular o coeficiente exato.
        </p>
      )}

      {resultado.modoFallback && resultado.ancestraisComuns.length > 0 && (
        <p className="text-xs text-gray-400 italic">
          Estimativa por nome — cadastre pai/mãe por código para cálculo preciso.
        </p>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// Versão assíncrona (busca o dado no servidor)
// ─────────────────────────────────────────────────────────

async function ConsanguinidadeTagAsync({
  animalId,
  expandido,
}: {
  animalId: string;
  expandido?: boolean;
}) {
  const resultado = await calcularConsanguinidade(animalId);
  return <Render resultado={resultado} expandido={expandido} />;
}

// ─────────────────────────────────────────────────────────
// Skeleton de carregamento
// ─────────────────────────────────────────────────────────

function Skeleton() {
  return (
    <div className="mt-2 animate-pulse">
      <div className="h-6 w-64 rounded-md bg-gray-100" />
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// Exportação principal
// ─────────────────────────────────────────────────────────

/**
 * Componente de consanguinidade para usar na ficha do animal.
 *
 * Cole abaixo da seção de genealogia:
 *
 *   <ConsanguinidadeTag animalId={animal.id} />
 *
 * Para versão expandida com tabela de ancestrais:
 *
 *   <ConsanguinidadeTag animalId={animal.id} expandido />
 */
export function ConsanguinidadeTag(props: Props) {
  // Se o resultado já foi calculado fora, apenas renderiza
  if (props.resultado) {
    return <Render resultado={props.resultado} expandido={props.expandido} />;
  }

  // Se não, busca o dado no servidor com Suspense para não bloquear a página
  return (
    <Suspense fallback={<Skeleton />}>
      <ConsanguinidadeTagAsync
        animalId={props.animalId}
        expandido={props.expandido}
      />
    </Suspense>
  );
}

export default ConsanguinidadeTag;
