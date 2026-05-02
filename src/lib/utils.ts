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
