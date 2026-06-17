import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Erro 404</p>
        <h1 className="mt-3 font-serif text-5xl text-foreground">Página não encontrada</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          A página que procuras não existe ou foi movida.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-navy-deep"
          >
            Voltar ao início
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Algo correu mal</p>
        <h1 className="mt-3 font-serif text-3xl text-foreground">Esta página não carregou</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Tenta de novo ou regressa ao início.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-navy-deep"
          >
            Tentar de novo
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-border bg-background px-5 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-surface"
          >
            Início
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "CV Flexível — Alinha o teu CV à vaga" },
      {
        name: "description",
        content:
          "Descobre o que a vaga realmente avalia e alinha o teu CV. Para vagas de ONGs, desenvolvimento, consultoria e administração pública. Em português.",
      },
      { name: "author", content: "CV Flexível" },
      { property: "og:title", content: "CV Flexível — Alinha o teu CV à vaga" },
      {
        property: "og:description",
        content:
          "Análise de cobertura, modo entrevista guiada e exportação ATS. Para profissionais do setor de desenvolvimento.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      {
        rel: "preconnect",
        href: "https://fonts.gstatic.com",
        crossOrigin: "anonymous",
      },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Lato:wght@400;700&family=Source+Serif+4:wght@400;600&display=swap",
      },
    ],

  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-PT">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-navy-rule bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
        <Link to="/" className="flex items-center gap-2.5 group">
          <span className="flex h-8 w-8 items-center justify-center rounded-sm bg-navy-deep font-serif text-sm font-bold text-paper">
            CV
          </span>
          <span className="font-serif text-lg tracking-tight text-foreground">
            CV Flexível
          </span>
        </Link>
        <nav className="flex items-center gap-1 text-sm">
          <Link
            to="/vagas"
            className="rounded-md px-3 py-2 text-muted-foreground transition-colors hover:text-foreground hover:bg-surface"
            activeProps={{ className: "text-foreground" }}
          >
            Vagas
          </Link>
          <Link
            to="/analise"
            className="rounded-md px-3 py-2 text-muted-foreground transition-colors hover:text-foreground hover:bg-surface"
            activeProps={{ className: "text-foreground" }}
          >
            Análise
          </Link>
          <Link
            to="/editor"
            className="ml-2 inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-navy-deep"
          >
            Abrir editor
          </Link>
        </nav>
      </div>
    </header>
  );
}

function SiteFooter() {
  return (
    <footer className="border-t border-navy-rule bg-surface/40">
      <div className="mx-auto flex max-w-7xl flex-col gap-4 px-6 py-10 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <p className="font-serif text-base text-foreground">CV Flexível</p>
        <p>
          Para profissionais do setor de desenvolvimento — Moçambique e PALOP.
        </p>
        <p className="text-xs uppercase tracking-[0.2em]">
          Em português · 2026
        </p>
      </div>
    </footer>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      <div className="flex min-h-screen flex-col bg-background">
        <SiteHeader />
        <main className="flex-1">
          <Outlet />
        </main>
        <SiteFooter />
      </div>
    </QueryClientProvider>
  );
}
