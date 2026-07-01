"use client";

import { createContext, useContext, useState, useCallback, ReactNode } from "react";

/**
 * Ponte de estado entre a seção "Realização da Venda" (dentro do card Leilão)
 * e o formulário "Registrar Venda" — que ficam em pontos distintos da página
 * (Server Components), mas precisam compartilhar o valor de venda definitivo,
 * o comprador e o % do animal vendido nesta transação.
 *
 * Uso: envolva o trecho da página que contém as duas seções com
 * <VendaSyncProvider>...</VendaSyncProvider> (os filhos continuam sendo
 * renderizados no servidor normalmente — só o Provider roda no cliente).
 */

export interface VendaSyncData {
  comprador: string;
  /** Valor da parcela definida em "Realização da Venda" (Leilão) */
  valorParcela: number | null;
  nParcelas: number;
  /** Valor total = valorParcela × nParcelas (o "valor de venda definitivo") */
  valorTotal: number | null;
  /** % do animal vendido nesta transação (100, 50, 33, etc.) — apenas informativo */
  percentual: number;
}

const defaultData: VendaSyncData = {
  comprador: "",
  valorParcela: null,
  nParcelas: 30,
  valorTotal: null,
  percentual: 100,
};

interface VendaSyncContextType {
  data: VendaSyncData;
  setData: (partial: Partial<VendaSyncData>) => void;
}

const VendaSyncContext = createContext<VendaSyncContextType | null>(null);

export function VendaSyncProvider({ children }: { children: ReactNode }) {
  const [data, setDataState] = useState<VendaSyncData>(defaultData);

  const setData = useCallback((partial: Partial<VendaSyncData>) => {
    setDataState((prev) => ({ ...prev, ...partial }));
  }, []);

  return (
    <VendaSyncContext.Provider value={{ data, setData }}>
      {children}
    </VendaSyncContext.Provider>
  );
}

/** Retorna null se usado fora do Provider — consumidores devem lidar com isso. */
export function useVendaSync() {
  return useContext(VendaSyncContext);
}
