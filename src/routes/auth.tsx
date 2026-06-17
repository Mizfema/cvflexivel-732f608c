import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const searchSchema = z.object({
  next: z.string().optional(),
});

export const Route = createFileRoute("/auth")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Entrar — CV Flexível" },
      {
        name: "description",
        content:
          "Entra ou cria conta para guardar o teu CV e exportar em PDF ou DOCX.",
      },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const { next } = Route.useSearch();
  const navigate = useNavigate();
  const { session, ready } = useAuth();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  // Já autenticado → voltar para destino
  useEffect(() => {
    if (ready && session) {
      const target = next && next.startsWith("/") ? next : "/editor";
      navigate({ to: target });
    }
  }, [ready, session, next, navigate]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setLoading(true);
    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
      } else {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin + "/auth" },
        });
        if (error) throw error;
        if (!data.session) {
          setInfo(
            "Conta criada. Verifica o teu email para confirmar e depois entra.",
          );
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-md flex-col justify-center px-4 py-12">
      <div className="rounded-lg border border-navy-rule bg-card p-6 shadow-card">
        <p className="text-xs font-medium uppercase tracking-[0.22em] text-navy-mid">
          CV Flexível
        </p>
        <h1 className="mt-2 font-serif text-3xl text-foreground">
          {mode === "signin" ? "Entrar" : "Criar conta"}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {mode === "signin"
            ? "Acede ao teu CV guardado e exporta em PDF/DOCX."
            : "Cria uma conta para guardar o teu CV e exportar."}
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password">Palavra-passe</Label>
            <Input
              id="password"
              type="password"
              autoComplete={
                mode === "signin" ? "current-password" : "new-password"
              }
              minLength={6}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}
          {info && <p className="text-sm text-muted-foreground">{info}</p>}

          <Button type="submit" disabled={loading} className="w-full">
            {loading
              ? "A processar…"
              : mode === "signin"
                ? "Entrar"
                : "Criar conta"}
          </Button>
        </form>

        <div className="mt-4 text-center text-sm text-muted-foreground">
          {mode === "signin" ? (
            <>
              Não tens conta?{" "}
              <button
                className="font-medium text-foreground underline-offset-4 hover:underline"
                onClick={() => setMode("signup")}
                type="button"
              >
                Criar conta
              </button>
            </>
          ) : (
            <>
              Já tens conta?{" "}
              <button
                className="font-medium text-foreground underline-offset-4 hover:underline"
                onClick={() => setMode("signin")}
                type="button"
              >
                Entrar
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
