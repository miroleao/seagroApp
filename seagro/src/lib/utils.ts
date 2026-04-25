import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: string | null | undefined): string {
  if (!date) return "—";
  return new Date(date + "T12:00:00").toLocaleDateString("pt-BR");
}

export function formatCurrency(value: number | null | undefined): string {
  if (value == null) return "—";
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

export function diasParaParto(previsao: string | null | undefined): number | null {
  if (!previsao) return null;
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const parto = new Date(previsao + "T12:00:00");
  return Math.round((parto.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
}

export const FARM_ID = process.env.NEXT_PUBLIC_FARM_ID ?? "aaaaaaaa-0000-0000-0000-000000000001";

/** Calcula meses inteiros entre uma data ISO e hoje (ex: "2024-03-15" → 14). */
export function idadeEmMeses(nascimento: string | null | undefined): number | null {
  if (!nascimento) return null;
  const inicio = new Date(nascimento);
  const hoje   = new Date();
  return (hoje.getFullYear() - inicio.getFullYear()) * 12
       + (hoje.getMonth()   - inicio.getMonth());
}

/** Duração da gestação Nelore em dias — base para cálculo de previsão de parto (FIV ou TE). */
export const DIAS_GESTACAO = 293;

/**
 * Calcula a data prevista de parto a partir de uma data base (FIV ou TE).
 * Retorna string no formato ISO "YYYY-MM-DD".
 */
export function calcularPrevisaoParto(dataBase: string): string {
  const d = new Date(dataBase + "T12:00:00");
  d.setDate(d.getDate() + DIAS_GESTACAO);
  return d.toISOString().split("T")[0];
}
