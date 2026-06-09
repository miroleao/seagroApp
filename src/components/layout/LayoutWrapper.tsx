"use client";

import { usePathname } from "next/navigation";
import { Sidebar } from "./Sidebar";

export function LayoutWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLoginPage = pathname === "/login";

  if (isLoginPage) {
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 overflow-auto pt-12 pb-16 md:pt-0 md:pb-0 min-w-0">
        {children}
      </main>
    </div>
  );
}
