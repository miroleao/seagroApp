// Tipos compartilhados entre a UI de pesagens e o Server Action.
// Ficam fora de `actions.ts` porque arquivos "use server" só podem exportar
// funções assíncronas.

export type PesagemInput = {
  animal_id: string;
  data: string;      // ISO yyyy-mm-dd
  peso_kg: number;
  observacoes?: string | null;
};

export type ResultadoPesagens = {
  ok: boolean;
  erro?: string;
  salvas?: number;
  ignoradas?: number;   // duplicatas exatas (mesmo animal + data + peso)
};
