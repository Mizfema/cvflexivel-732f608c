import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { Eye, EyeOff } from "lucide-react";
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

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.64-.06-1.25-.17-1.84H9v3.49h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.63Z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18Z"
      />
      <path
        fill="#FBBC05"
        d="M3.97 10.72A5.4 5.4 0 0 1 3.68 9c0-.6.1-1.18.29-1.72V4.95H.96A9 9 0 0 0 0 9c0 1.45.35 2.83.96 4.05l3.01-2.33Z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58Z"
      />
    </svg>
  );
}

function CvWatermark({
  className,
  delay = "0s",
  rot = "0deg",
  accent = false,
}: {
  className?: string;
  delay?: string;
  rot?: string;
  accent?: boolean;
}) {
  return (
    <div
      className={`absolute w-56 rounded-lg border border-navy-rule/40 bg-card/90 p-4 shadow-2xl backdrop-blur-sm animate-auth-float ${className ?? ""}`}
      style={
        {
          ["--rot" as string]: rot,
          animationDelay: delay,
          transform: `rotate(${rot})`,
        } as React.CSSProperties
      }
    >
      <div className="flex items-center gap-2">
        <div
          className={`h-8 w-8 rounded-full ${accent ? "bg-navy-mid" : "bg-navy-rule/60"}`}
        />
        <div className="flex-1 space-y-1.5">
          <div className="h-2 w-3/4 rounded bg-navy-rule/70" />
          <div className="h-1.5 w-1/2 rounded bg-navy-rule/40" />
        </div>
      </div>
      <div className="mt-3 space-y-1.5">
        <div className="h-1.5 w-full rounded bg-navy-rule/30" />
        <div className="h-1.5 w-5/6 rounded bg-navy-rule/30" />
        <div className="h-1.5 w-2/3 rounded bg-navy-rule/30" />
      </div>
      <div className="mt-3 space-y-1">
        <div className="h-1.5 w-1/3 rounded bg-navy-mid/60" />
        <div className="h-1.5 w-full rounded bg-navy-rule/30" />
        <div className="h-1.5 w-4/5 rounded bg-navy-rule/30" />
      </div>
      <div className="mt-3 flex gap-1">
        <div className="h-1.5 w-10 rounded-full bg-navy-mid/40" />
        <div className="h-1.5 w-8 rounded-full bg-navy-mid/40" />
        <div className="h-1.5 w-12 rounded-full bg-navy-mid/40" />
      </div>
    </div>
  );
}

function AuthPage() {
  const { next } = Route.useSearch();
  const navigate = useNavigate();
  const { session, ready } = useAuth();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  useEffect(() => {
    if (ready && session) {
      const target = next && next.startsWith("/") ? next : "/editor";
      navigate({ to: target });
    }
  }, [ready, session, next, navigate]);

  async function handleGoogle() {
    setError(null);
    setGoogleLoading(true);
    try {
      const target = next && next.startsWith("/") ? next : "/editor";
      const redirectUrl = new URL("/auth", window.location.origin);
      redirectUrl.searchParams.set("next", target);
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: redirectUrl.toString() },
      });
      if (error) throw error;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao entrar com Google.");
      setGoogleLoading(false);
    }
  }

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
        const emailRedirectUrl = new URL("/auth", window.location.origin);
        if (next && next.startsWith("/")) {
          emailRedirectUrl.searchParams.set("next", next);
        }
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: emailRedirectUrl.toString() },
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
    <div className="relative grid min-h-[calc(100vh-4rem)] overflow-hidden lg:grid-cols-2">
      {/* Coluna visual */}
      <div className="relative hidden overflow-hidden bg-gradient-to-br from-navy-deep via-navy-mid to-navy-deep lg:block">
        {/* blobs */}
        <div className="absolute -left-20 -top-20 h-96 w-96 rounded-full bg-navy-mid/60 blur-3xl" />
        <div className="absolute -bottom-24 -right-16 h-[28rem] w-[28rem] rounded-full bg-cream/10 blur-3xl" />
        {/* grid pattern */}
        <div
          className="absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              "linear-gradient(to right, white 1px, transparent 1px), linear-gradient(to bottom, white 1px, transparent 1px)",
            backgroundSize: "32px 32px",
          }}
        />

        {/* watermarks de CV */}
        <CvWatermark
          className="left-10 top-20"
          rot="-8deg"
          delay="0s"
          accent
        />
        <CvWatermark
          className="right-12 top-32"
          rot="6deg"
          delay="1.2s"
        />
        <CvWatermark
          className="bottom-24 left-24"
          rot="4deg"
          delay="2.4s"
        />
        <CvWatermark
          className="bottom-16 right-20"
          rot="-5deg"
          delay="0.6s"
          accent
        />

        {/* tagline */}
        <div className="absolute bottom-10 left-10 right-10 z-10">
          <p className="text-xs font-medium uppercase tracking-[0.32em] text-cream/70">
            CV Flexível
          </p>
          <h2 className="mt-3 font-serif text-4xl leading-tight text-cream">
            O teu CV,
            <br />
            adaptado a cada vaga.
          </h2>
          <p className="mt-3 max-w-md text-sm text-cream/70">
            Guarda, alinha e exporta em PDF ou DOCX em segundos.
          </p>
        </div>
      </div>

      {/* Coluna formulário */}
      <div className="relative flex items-center justify-center px-4 py-12">
        {/* fundo mobile */}
        <div className="absolute inset-0 -z-10 lg:hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-cream via-background to-cream" />
          <div className="absolute -right-20 top-10 h-72 w-72 rounded-full bg-navy-mid/10 blur-3xl" />
          <div className="absolute -left-16 bottom-10 h-72 w-72 rounded-full bg-navy-mid/10 blur-3xl" />
        </div>

        <div className="w-full max-w-md rounded-xl border border-navy-rule bg-card p-7 shadow-card">
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

          <Button
            type="button"
            variant="outline"
            className="mt-6 w-full gap-2"
            onClick={handleGoogle}
            disabled={googleLoading || loading}
          >
            <GoogleIcon />
            {googleLoading ? "A redirecionar…" : "Continuar com Google"}
          </Button>

          <div className="my-5 flex items-center gap-3 text-xs uppercase tracking-wider text-muted-foreground">
            <div className="h-px flex-1 bg-navy-rule" />
            ou
            <div className="h-px flex-1 bg-navy-rule" />
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
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
              <div className="relative">
                <Input
                  id="password"
                  type={showPwd ? "text" : "password"}
                  autoComplete={
                    mode === "signin" ? "current-password" : "new-password"
                  }
                  minLength={6}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPwd((s) => !s)}
                  aria-label={
                    showPwd ? "Ocultar palavra-passe" : "Mostrar palavra-passe"
                  }
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground"
                >
                  {showPwd ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
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
    </div>
  );
}
