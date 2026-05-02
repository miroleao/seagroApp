import type { Metadata } from "next";
import "./globals.css";
import { Sidebar } from "@/components/layout/Sidebar";

export const metadata: Metadata = {
  title: "SE Agro Elite — Gestão Nelore",
  description: "Sistema de gestão para SE Agropecuária Nelore de Elite",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <body>
        <div className="flex min-h-screen">
          <Sidebar />
          {/*
            pt-14 = espaço para a barra fixa no mobile (h-14)
            md:pt-0 = no desktop, sem padding (sidebar fica à esquerda)
          */}
          <main className="flex-1 overflow-auto pt-14 md:pt-0 min-w-0">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
