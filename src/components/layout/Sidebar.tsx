"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, Heart, FlaskConical,
  DollarSign, Trophy, Beef, ChevronRight, ChevronDown, Menu, X, Dna, Baby, Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";

type SubItem = { href: string; label: string; icon?: React.ElementType };
type NavItem = {
  href?: string;
  label: string;
  icon: React.ElementType;
  children?: SubItem[];
};

const navItems: NavItem[] = [
  { href: "/dashboard",  label: "Visão Geral",         icon: LayoutDashboard },
  { href: "/doadoras",   label: "Fêmeas",             icon: Heart },
  { href: "/machos",     label: "Machos",             icon: Dna },
  { href: "/rebanho",    label: "Rebanho",            icon: Beef },
  {
    label: "Reprodução",
    icon: FlaskConical,
    children: [
      { href: "/reproducao/prenhezes", label: "Prenhezes",     icon: Baby },
      { href: "/reproducao",           label: "Aspirações OPU", icon: FlaskConical },
    ],
  },
  { href: "/pista",      label: "Pista / Exposições", icon: Trophy },
  { href: "/financeiro", label: "Financeiro/Leilões", icon: DollarSign },
  { href: "/elitia",     label: "ElitIA (beta)",      icon: Sparkles },
];

function NavLinks({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
  // Reprodução group starts expanded if we're on any /reproducao route
  const [reproOpen, setReproOpen] = useState(true);

  return (
    <nav className="flex-1 px-3 py-4 space-y-0.5">
      {navItems.map((item) => {
        // ── Group item (Reprodução) ──────────────────────────────────────
        if (item.children) {
          const isGroupActive = pathname.startsWith("/reproducao");
          return (
            <div key={item.label}>
              {/* Group toggle button */}
              <button
                type="button"
                onClick={() => setReproOpen((v) => !v)}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                  isGroupActive
                    ? "bg-brand-50 text-brand-700"
                    : "text-gray-500 hover:bg-brand-50 hover:text-brand-700"
                )}
              >
                <item.icon className="w-4 h-4 shrink-0" />
                <span className="flex-1 text-left">{item.label}</span>
                {reproOpen
                  ? <ChevronDown className="w-3 h-3 opacity-60" />
                  : <ChevronRight className="w-3 h-3 opacity-60" />
                }
              </button>

              {/* Sub-items */}
              {reproOpen && (
                <div className="ml-4 mt-0.5 space-y-0.5 border-l border-brand-100 pl-3">
                  {item.children.map((sub) => {
                    const isSubActive =
                      sub.href === "/reproducao"
                        ? pathname === "/reproducao" || pathname.startsWith("/reproducao/opu")
                        : pathname === sub.href || pathname.startsWith(sub.href + "/");

                    const SubIcon = sub.icon;
                    return (
                      <Link
                        key={sub.href}
                        href={sub.href}
                        onClick={onNavigate}
                        className={cn(
                          "flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                          isSubActive
                            ? "bg-brand-50 text-brand-700"
                            : "text-gray-500 hover:bg-brand-50 hover:text-brand-700"
                        )}
                      >
                        {SubIcon && <SubIcon className="w-3.5 h-3.5 shrink-0" />}
                        <span>{sub.label}</span>
                        {isSubActive && <ChevronRight className="w-3 h-3 opacity-60 ml-auto" />}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        }

        // ── Regular item ─────────────────────────────────────────────────
        const isActive = pathname === item.href || pathname.startsWith(item.href! + "/");
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href!}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
              isActive
                ? "bg-brand-50 text-brand-700 font-semibold"
                : "text-gray-500 hover:bg-brand-50 hover:text-brand-700"
            )}
          >
            <Icon className="w-4 h-4 shrink-0" />
            <span className="flex-1">{item.label}</span>
            {isActive && <ChevronRight className="w-3 h-3 opacity-60" />}
          </Link>
        );
      })}
    </nav>
  );
}

function Logo() {
  return (
    <div className="flex items-center gap-3">
      <div className="w-9 h-9 rounded-lg bg-brand-600 flex items-center justify-center shrink-0">
        <span className="text-white font-bold text-sm">SE</span>
      </div>
      <div>
        <p className="font-semibold text-sm leading-tight">SE Agro Elite</p>
        <p className="text-xs text-brand-300 leading-tight">Nelore de Elite</p>
      </div>
    </div>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Desktop sidebar — oculto abaixo de 768px via globals.css */}
      <aside className="sidebar-desktop flex w-60 min-h-screen bg-white border-r border-gray-200 flex-col shrink-0">
        <div className="px-5 py-6 border-b border-gray-100">
          <Logo />
        </div>
        <NavLinks pathname={pathname} />
        <div className="px-5 py-4 border-t border-gray-100">
          <p className="text-xs text-gray-400">v0.1.0 — 2026</p>
        </div>
      </aside>

      {/* Mobile top bar — oculta acima de 768px via globals.css */}
      <header className="sidebar-mobile-bar fixed top-0 left-0 right-0 z-40 h-14 bg-white border-b border-gray-200 text-gray-800 flex items-center px-4 gap-3 shadow-sm">
        <button onClick={() => setOpen(true)} aria-label="Abrir menu"
          className="p-1.5 rounded-lg hover:bg-brand-50 transition-colors text-gray-500">
          <Menu className="w-5 h-5" />
        </button>
        <Logo />
      </header>

      {/* Overlay + gaveta mobile — ocultos acima de 768px via globals.css */}
      {open && (
        <div className="sidebar-mobile-overlay fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/60" onClick={() => setOpen(false)} />
          <aside className="relative w-72 max-w-[85vw] bg-white flex flex-col h-full z-10 shadow-2xl">
            <div className="px-5 py-5 border-b border-gray-100 flex items-center justify-between">
              <Logo />
              <button onClick={() => setOpen(false)} aria-label="Fechar menu"
                className="p-1.5 rounded-lg hover:bg-brand-50 transition-colors text-gray-400">
                <X className="w-5 h-5" />
              </button>
            </div>
            <NavLinks pathname={pathname} onNavigate={() => setOpen(false)} />
            <div className="px-5 py-4 border-t border-gray-100">
              <p className="text-xs text-gray-400">v0.1.0 — 2026</p>
            </div>
          </aside>
        </div>
      )}
    </>
  );
}
