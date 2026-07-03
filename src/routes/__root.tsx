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
      { name: "description", content: "Your App Blueprint plans and designs the best implementation path for your app idea." },
      { property: "og:description", content: "Your App Blueprint plans and designs the best implementation path for your app idea." },
      { name: "twitter:description", content: "Your App Blueprint plans and designs the best implementation path for your app idea." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/d5b23ef7-7e73-40dc-8efb-062991b6c276/id-preview-68854c0b--90ee89ac-51e8-496c-81d3-34bda88c4830.lovable.app-1781874850960.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/d5b23ef7-7e73-40dc-8efb-062991b6c276/id-preview-68854c0b--90ee89ac-51e8-496c-81d3-34bda88c4830.lovable.app-1781874850960.png" },
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


function SiteFooter() {
  return (
    <footer className="border-t border-navy-rule bg-navy-deep text-paper/80">
      <div className="mx-auto max-w-7xl px-6 py-14">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          {/* Brand */}
          <div className="lg:col-span-1">
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-sm bg-white/10 font-serif text-sm font-bold text-paper ring-1 ring-white/10">
                CV
              </span>
              <span className="font-serif text-lg tracking-tight text-paper">
                CV Flexível
              </span>
            </div>
            <p className="mt-4 text-sm leading-relaxed text-paper/60 max-w-[260px]">
              Plataforma para profissionais do setor de desenvolvimento, cooperação
              internacional e administração pública em Moçambique e PALOP.
            </p>
          </div>

          {/* Produto */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-paper/40 mb-4">
              Produto
            </p>
            <ul className="space-y-2.5 text-sm">
              <li>
                <Link to="/editor" className="text-paper/65 transition-colors hover:text-paper">
                  Editor de CV
                </Link>
              </li>
              <li>
                <Link to="/analise" className="text-paper/65 transition-colors hover:text-paper">
                  Análise de CV
                </Link>
              </li>
              <li>
                <Link to="/vagas" className="text-paper/65 transition-colors hover:text-paper">
                  Vagas ReliefWeb
                </Link>
              </li>
            </ul>
          </div>

          {/* Recursos */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-paper/40 mb-4">
              Recursos
            </p>
            <ul className="space-y-2.5 text-sm">
              <li>
                <span className="text-paper/65">Exportação PDF & DOCX</span>
              </li>
              <li>
                <span className="text-paper/65">Formato compatível ATS</span>
              </li>
              <li>
                <span className="text-paper/65">Interface em Português</span>
              </li>
            </ul>
          </div>

          {/* Contacto */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-paper/40 mb-4">
              Contacto
            </p>
            <ul className="space-y-2.5 text-sm">
              <li className="text-paper/65">
                Maputo, Moçambique
              </li>
              <li>
                <a href="mailto:info@cvflexivel.com" className="text-paper/65 transition-colors hover:text-paper">
                  info@cvflexivel.com
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-12 flex flex-col items-center gap-3 border-t border-white/10 pt-8 sm:flex-row sm:justify-between">
          <p className="text-xs text-paper/40">
            &copy; 2026 CV Flexível. Todos os direitos reservados.
          </p>
          <p className="text-xs text-paper/40 uppercase tracking-[0.15em]">
            Feito em Moçambique · Para profissionais de desenvolvimento
          </p>
        </div>
      </div>
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
