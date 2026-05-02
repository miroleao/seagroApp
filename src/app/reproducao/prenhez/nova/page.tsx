import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import PrenheZForm from "./PrenheZForm";

export default function NovaPrenheZPage() {
  return (
    <div className="p-6 max-w-6xl space-y-6">
      <Link href="/reproducao" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
        <ArrowLeft className="w-4 h-4" /> Voltar para Reprodução
      </Link>

      <div>
        <h1 className="text-2xl font-bold text-gray-900">Registrar Prenhezes</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Registre uma ou várias prenhezes compradas de uma vez. Use os botões "+ 5 linhas" ou "+ 10 linhas" para adicionar rapidamente.
        </p>
      </div>

      <PrenheZForm />
    </div>
  );
}
