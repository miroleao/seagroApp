"use client";

import { useState, useRef, useEffect } from "react";
import { Send, Sparkles } from "lucide-react";
import { perguntarElitIA } from "./actions";

type Mensagem = {
  id: string;
  tipo: "usuario" | "elitia";
  conteudo: string;
  timestamp: Date;
};

export default function ElitiaChat() {
  const [mensagens, setMensagens] = useState<Mensagem[]>([
    {
      id: "0",
      tipo: "elitia",
      conteudo: "Olá! Sou a ElitIA, sua assistente especializada em manejo de gado Nelore. Posso responder perguntas sobre suas prenhezes, investimentos em leilões, desempenho dos animais e muito mais. O que você gostaria de saber?",
      timestamp: new Date(),
    },
  ]);

  const [input, setInput] = useState("");
  const [carregando, setCarregando] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollParaBaixo = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollParaBaixo();
  }, [mensagens]);

  const enviarPergunta = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || carregando) return;

    const pergunta = input.trim();
    setInput("");

    // Adiciona mensagem do usuário
    const novaMsg = {
      id: Date.now().toString(),
      tipo: "usuario" as const,
      conteudo: pergunta,
      timestamp: new Date(),
    };

    setMensagens((prev) => [...prev, novaMsg]);
    setCarregando(true);

    try {
      const resposta = await perguntarElitIA(pergunta);

      const respostaMsg = {
        id: (Date.now() + 1).toString(),
        tipo: "elitia" as const,
        conteudo: resposta,
        timestamp: new Date(),
      };

      setMensagens((prev) => [...prev, respostaMsg]);
    } catch (erro) {
      const erroMsg = {
        id: (Date.now() + 1).toString(),
        tipo: "elitia" as const,
        conteudo: `Desculpe, tive um problema ao processar sua pergunta: ${erro instanceof Error ? erro.message : "Erro desconhecido"}`,
        timestamp: new Date(),
      };

      setMensagens((prev) => [...prev, erroMsg]);
    } finally {
      setCarregando(false);
    }
  };

  return (
    <div className="flex flex-col h-full max-h-[calc(100vh-200px)] bg-white rounded-lg border border-gray-200 overflow-hidden">
      {/* ── Header ────────────────────────────────────────────────── */}
      <div className="px-5 py-4 border-b border-gray-100 bg-gradient-to-r from-brand-50 to-brand-100">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-brand-600" />
          <div>
            <h3 className="font-semibold text-gray-900">ElitIA</h3>
            <p className="text-xs text-gray-500">Assistente especializada em Nelore</p>
          </div>
        </div>
      </div>

      {/* ── Mensagens ────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto p-5 space-y-4">
        {mensagens.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.tipo === "usuario" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-xs lg:max-w-md px-4 py-3 rounded-lg ${
                msg.tipo === "usuario"
                  ? "bg-brand-600 text-white rounded-br-none"
                  : "bg-gray-100 text-gray-900 rounded-bl-none border border-gray-200"
              }`}
            >
              <p className="text-sm whitespace-pre-wrap leading-relaxed">
                {msg.conteudo}
              </p>
              <p
                className={`text-xs mt-1.5 ${
                  msg.tipo === "usuario" ? "text-brand-100" : "text-gray-500"
                }`}
              >
                {msg.timestamp.toLocaleTimeString("pt-BR", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            </div>
          </div>
        ))}

        {carregando && (
          <div className="flex justify-start">
            <div className="bg-gray-100 text-gray-900 px-4 py-3 rounded-lg rounded-bl-none border border-gray-200">
              <div className="flex gap-1">
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
                <div
                  className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                  style={{ animationDelay: "0.1s" }}
                />
                <div
                  className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                  style={{ animationDelay: "0.2s" }}
                />
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* ── Input ────────────────────────────────────────────────── */}
      <div className="border-t border-gray-100 bg-gray-50 p-4">
        <form onSubmit={enviarPergunta} className="flex gap-3">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Faça uma pergunta sobre suas prenhezes, investimentos, animais..."
            disabled={carregando}
            className="flex-1 border border-gray-200 rounded-lg px-4 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-300 disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={carregando || !input.trim()}
            className="flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white px-4 py-2.5 rounded-lg font-medium text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            <Send className="w-4 h-4" />
            <span className="hidden sm:inline">Enviar</span>
          </button>
        </form>

        <div className="mt-3 flex flex-wrap gap-2">
          <p className="text-xs text-gray-500 w-full">Tente perguntar:</p>
          <button
            type="button"
            onClick={() =>
              setInput("Quantas prenhezes eu tenho? E qual é a distribuição por sexo?")
            }
            className="text-xs bg-white border border-gray-200 text-gray-700 px-3 py-1 rounded hover:bg-gray-50 transition-colors cursor-pointer"
          >
            Prenhezes por sexo
          </button>
          <button
            type="button"
            onClick={() =>
              setInput("Quanto investir em leilões no mês de março de 2026?")
            }
            className="text-xs bg-white border border-gray-200 text-gray-700 px-3 py-1 rounded hover:bg-gray-50 transition-colors cursor-pointer"
          >
            Investimentos
          </button>
          <button
            type="button"
            onClick={() => setInput("Quais são as minhas doadoras cadastradas?")}
            className="text-xs bg-white border border-gray-200 text-gray-700 px-3 py-1 rounded hover:bg-gray-50 transition-colors cursor-pointer"
          >
            Minhas doadoras
          </button>
        </div>
      </div>
    </div>
  );
}
