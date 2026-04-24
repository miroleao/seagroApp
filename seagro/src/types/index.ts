// ─── Tipos principais do banco de dados ──────────────────────────────────────

export type AnimalTipo = "DOADORA" | "TOURO" | "RECEPTORA" | "NASCIDO" | "DESCARTE";
export type EmbryoStatus = "DISPONIVEL" | "IMPLANTADO" | "DESCARTADO";
export type DGResultado = "POSITIVO" | "VAZIO" | "ABSORVEU" | "ABORTOU";
export type TransactionTipo = "COMPRA" | "VENDA";
export type InstallmentStatus = "PENDENTE" | "PAGO" | "ATRASADO";

export interface Animal {
  id: string;
  farm_id: string;
  nome: string;
  rgn?: string;
  rgd?: string;                          // Registro Genealógico Definitivo (touros aprovados)
  brinco?: string;
  tipo: AnimalTipo;
  sexo?: "F" | "M";
  nascimento?: string;
  pai_nome?: string;
  mae_nome?: string;
  // ── Avós ──────────────────────────────────────────────────
  avo_paterno?: string;                  // Avô Paterno (pai do pai)
  avo_paterna?: string;                  // Avó Paterna (mãe do pai)
  avo_materno?: string;                  // Avô Materno (pai da mãe)
  avo_materna?: string;                  // Avó Materna (mãe da mãe)
  // ── Bisavós do lado paterno ───────────────────────────────
  bisavo_pat_pat?: string;              // Bisavô Avô Pat. (pai do avô paterno)
  bisava_pat_pat?: string;              // Bisavó Avô Pat. (mãe do avô paterno)
  bisavo_pat_mat?: string;              // Bisavô Avó Pat. (pai da avó paterna)
  bisava_pat_mat?: string;              // Bisavó Avó Pat. (mãe da avó paterna)
  // ── Bisavós do lado materno ───────────────────────────────
  bisavo_materno?: string;              // Bisavô Avô Mat. (pai do avô materno)
  bisava_mat_pat?: string;              // Bisavó Avô Mat. (mãe do avô materno)
  bisavo_materna?: string;              // Bisavô Avó Mat. (pai da avó materna)
  bisavo?: string;                       // Bisavó Avó Mat. (mãe da avó materna)
  localizacao?: string;
  situacao?: string;
  status_reprodutivo?: string;
  percentual_proprio?: number;
  valor_parcela?: number;
  observacoes?: string;
  // Reprodução — touros (machos)
  exame_andrologico?: "APTO" | "INAPTO";
  data_exame_andrologico?: string;
  veterinario_andrologico?: string;
  laudo_andrologico?: string;
  circunferencia_escrotal?: number;      // em cm
  data_ce?: string;
  criado_em: string;
}

export interface OPUSession {
  id: string;
  farm_id: string;
  data: string;
  tipo: "REALIZADA" | "COMPRADA";
  laboratorio?: string;
  responsavel?: string;
  local?: string;
  observacoes?: string;
}

export interface Aspiration {
  id: string;
  farm_id: string;
  session_id: string;
  doadora_id?: string;
  doadora_nome?: string;
  touro_nome?: string;
  oocitos_viaveis?: number;
  embryos_congelados?: number;
  custo_total?: number;
  observacoes?: string;
  // joins
  animal?: Animal;
  opu_session?: OPUSession;
}

export interface Embryo {
  id: string;
  farm_id: string;
  aspiration_id: string;
  numero_cdc_fiv?: string;
  numero_adt_te?: string;
  sexagem: "FEMEA" | "MACHO" | "NAO_SEXADO";
  status: EmbryoStatus;
  observacoes?: string;
}

export interface Transfer {
  id: string;
  farm_id: string;
  embryo_id: string;
  receptora_id?: string;
  receptora_brinco?: string;
  sessao_nome?: string;
  data_te: string;
  responsavel?: string;
  protocolo?: string;
  peso_receptora?: number;
  observacoes?: string;
  // joins
  receptora?: Animal;
}

export interface PregnancyDiagnosis {
  id: string;
  farm_id: string;
  transfer_id: string;
  data_dg: string;
  resultado: DGResultado;
  data_previsao_parto?: string;
  observacoes?: string;
}

export interface WeightRecord {
  id: string;
  animal_id: string;
  data: string;
  peso_kg: number;
}

export interface Auction {
  id: string;
  farm_id: string;
  nome: string;
  data?: string;
  local?: string;
  organizador?: string;
}

export interface Transaction {
  id: string;
  farm_id: string;
  auction_id?: string;
  tipo: TransactionTipo;
  animal_nome?: string;
  contraparte?: string;
  valor_total: number;
  n_parcelas?: number;
  observacoes?: string;
  auction?: Auction;
}

export interface Installment {
  id: string;
  farm_id: string;
  transaction_id: string;
  numero: number;
  vencimento: string;
  valor: number;
  status: InstallmentStatus;
  data_pagamento?: string;
  transaction?: Transaction;
}

// ─── Tipos das views ──────────────────────────────────────────────────────────

export interface UpcomingBirth {
  transfer_id: string;
  receptora_id?: string;
  receptora_nome?: string;
  doadora_nome?: string;
  touro_nome?: string;
  data_previsao_parto: string;
  dias_restantes: number;
}

export interface EmbryoStock {
  doadora: string;
  doadora_rgn?: string;
  touro: string;
  total_disponivel: number;
  femeas: number;
  machos: number;
  nao_sexados: number;
}
