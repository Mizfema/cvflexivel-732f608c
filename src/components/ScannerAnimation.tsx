import { useEffect, useState } from "react";

const DEFAULT_MESSAGES = [
  "A ler o teu CV…",
  "A extrair competências e experiência…",
  "A comparar com os requisitos da vaga…",
  "A identificar palavras-chave…",
  "A calcular cobertura por secção…",
  "A verificar requisitos eliminatórios…",
  "A preparar o relatório…",
];

export function ScannerAnimation({
  title = "A analisar o teu CV",
  messages = DEFAULT_MESSAGES,
}: {
  title?: string;
  messages?: string[];
} = {}) {
  const [msgIndex, setMsgIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setMsgIndex((prev) => (prev + 1) % messages.length);
    }, 3000);
    return () => clearInterval(interval);
  }, [messages.length]);

  return (
    <div className="flex flex-col items-center py-8 px-4">
      <div className="relative w-[200px] h-[280px] rounded-lg border border-navy-rule bg-white shadow-elevated overflow-hidden animate-scanner-pulse">
        <div className="absolute left-0 right-0 h-[2px] animate-scanner-sweep z-20">
          <div className="h-full bg-navy-mid animate-scanner-glow" />
          <div className="absolute inset-x-0 -top-6 h-12 bg-gradient-to-b from-transparent via-navy-mid/10 to-transparent" />
        </div>

        <div className="flex h-full">
          <div className="w-[56px] shrink-0 bg-navy-deep flex flex-col items-center pt-5 pb-3">
            <div className="w-8 h-8 rounded-full bg-white/15 flex items-center justify-center text-[9px] font-bold text-white/70">
              CV
            </div>
            <div className="mt-4 w-full px-2 space-y-[4px]">
              {[100, 75, 85, 55, 90].map((w, i) => (
                <div key={i}>
                  <div className="h-[2px] bg-white/10 rounded-full" />
                  <div className="h-[2px] bg-white/30 rounded-full -mt-[2px]" style={{ width: `${w}%` }} />
                </div>
              ))}
            </div>
            <div className="mt-auto w-full px-2 space-y-[3px]">
              {[1, 2, 3].map((_, i) => (
                <div key={i} className="h-[2px] bg-white/15 rounded-full" style={{ width: `${80 - i * 15}%` }} />
              ))}
            </div>
          </div>

          <div className="flex-1 p-3 pt-4 space-y-3">
            <div>
              <div className="h-[8px] bg-gray-300 rounded w-[70%]" />
              <div className="h-[5px] bg-gray-200 rounded w-[50%] mt-1.5" />
            </div>
            <div className="h-[1px] bg-gray-200" />
            <div className="space-y-[3px]">
              <div className="h-[4px] bg-navy-deep/10 rounded w-[40%]" />
              <div className="h-[3px] bg-gray-200 rounded w-full" />
              <div className="h-[3px] bg-gray-200 rounded w-[90%]" />
              <div className="h-[3px] bg-gray-200 rounded w-[80%]" />
            </div>
            <div className="space-y-[3px]">
              <div className="h-[4px] bg-navy-deep/10 rounded w-[55%]" />
              <div className="h-[3px] bg-gray-200 rounded w-full" />
              <div className="h-[3px] bg-gray-200 rounded w-[85%]" />
            </div>
            <div className="space-y-[3px]">
              <div className="h-[4px] bg-navy-deep/10 rounded w-[45%]" />
              <div className="h-[3px] bg-gray-200 rounded w-[75%]" />
              <div className="h-[3px] bg-gray-200 rounded w-full" />
              <div className="h-[3px] bg-gray-200 rounded w-[60%]" />
            </div>
            <div className="space-y-[3px]">
              <div className="h-[4px] bg-navy-deep/10 rounded w-[35%]" />
              <div className="h-[3px] bg-gray-200 rounded w-[90%]" />
              <div className="h-[3px] bg-gray-200 rounded w-[70%]" />
            </div>
          </div>
        </div>
      </div>

      <div className="mt-8 text-center">
        <p className="font-serif text-lg text-foreground">{title}</p>
        <p key={msgIndex} className="mt-2 text-sm text-navy-mid animate-result-fade-up">
          {messages[msgIndex]}
        </p>
        <div className="mt-4 flex justify-center gap-1.5">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="w-1.5 h-1.5 rounded-full bg-navy-mid animate-scanner-glow"
              style={{ animationDelay: `${i * 0.3}s` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
