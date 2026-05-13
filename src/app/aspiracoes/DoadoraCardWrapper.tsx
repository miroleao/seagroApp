"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";

interface Props {
  doadoraNome: string;
  summaryContent: React.ReactNode;
  children: React.ReactNode;
}

export function DoadoraCardWrapper({ doadoraNome, summaryContent, children }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <div className="card overflow-hidden">
      {/* Header clicável */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full px-5 py-4 cursor-pointer select-none hover:bg-gray-50 transition-colors text-left"
        aria-expanded={open}
      >
        <div className="flex flex-wrap items-center gap-3">
          {summaryContent}
          <div className="ml-auto shrink-0">
            <ChevronDown
              className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
            />
          </div>
        </div>
      </button>

      {/* Corpo expansível */}
      {open && (
        <div className="border-t border-gray-100 divide-y divide-gray-50">
          {children}
        </div>
      )}
    </div>
  );
}
