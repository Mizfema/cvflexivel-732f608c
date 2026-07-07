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
import { AppSidebar } from "@/components/AppSidebar";

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
      { name: "twitter:title", content: "CV Flexível — Alinha o teu CV à vaga" },
      {
        name: "twitter:description",
        content:
          "Análise de cobertura, modo entrevista guiada e exportação ATS. Para profissionais do setor de desenvolvimento.",
      },
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
      { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
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


function SiteFooter() {
  return (
    <footer className="border-t border-navy-rule py-4 text-center">
      <p className="text-xs text-muted-foreground">
        &copy; 2026 CV Flexível. Todos os direitos reservados. contacto:{" "}
        <a href="mailto:cvflexivel@gmail.com" className="hover:text-foreground">
          cvflexivel@gmail.com
        </a>
      </p>
    </footer>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      <div className="flex min-h-screen bg-background">
        <AppSidebar />
        <div className="flex min-w-0 flex-1 flex-col md:pl-[210px]">
          <main className="flex-1 pt-14 md:pt-0">
            <Outlet />
          </main>
          <SiteFooter />
        </div>
      </div>
    </QueryClientProvider>
  );
}
