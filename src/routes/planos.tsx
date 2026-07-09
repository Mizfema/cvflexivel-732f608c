import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { CheckCircle2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { track } from "@/lib/analytics";

export const Route = createFileRoute("/planos")({
  head: () => ({
    meta: [
      { title: "Planos — CV Flexível" },
      {
        name: "description",
        content: "O plano pago do CV Flexível está a chegar. Deixa o teu email para seres avisado.",
      },
    ],
  }),
  component: PlanosPage,
});

const BENEFICIOS = [
  "Download ilimitado, com qualquer template (incluindo os premium)",
  "Análise de cobertura de vaga sem limite de uso",
  "Cartas de apresentação completas geradas por IA",
  "Preparação de entrevista específica para cada vaga",
];

function PlanosPage() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    track("cta_click", { source: "planos_waitlist", email: email.trim() });
    setSubmitted(true);
  }

  return (
    <div className="mx-auto max-w-2xl px-6 py-16 text-center">
      <p className="text-xs font-medium uppercase tracking-[0.22em] text-navy-mid">Plano pago</p>
      <h1 className="mt-4 font-serif text-4xl text-foreground">
        O plano CV Flexível está a chegar
      </h1>
      <p className="mt-4 text-base text-ink-soft">
        Estamos a finalizar os preços e os métodos de pagamento (cartão, M-Pesa, e-Mola). Deixa o
        teu email e avisamos-te assim que estiver disponível.
      </p>

      <ul className="mt-10 space-y-3 text-left">
        {BENEFICIOS.map((b) => (
          <li key={b} className="flex items-start gap-3 text-sm text-foreground">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
            {b}
          </li>
        ))}
      </ul>

      <div className="mt-10 rounded-lg border border-navy-rule bg-card p-6">
        {submitted ? (
          <p className="flex items-center justify-center gap-2 text-sm font-medium text-foreground">
            <Sparkles className="h-4 w-4 text-emerald-600" />
            Obrigado! Avisamos-te por email assim que o plano estiver disponível.
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-3 sm:flex-row">
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="o-teu-email@exemplo.com"
              className="h-10 flex-1 rounded-md border border-navy-rule bg-background px-3 text-sm outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
            <Button type="submit" disabled={!email.trim()}>
              Avisa-me quando lançar
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
