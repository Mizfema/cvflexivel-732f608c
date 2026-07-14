import { Link, Outlet, createFileRoute, redirect } from "@tanstack/react-router";
import { getIsAdmin } from "@/lib/admin.functions";

/** O _authenticated/route.tsx pai já garante que este beforeLoad só corre no
 * cliente (SSR redireciona para /auth antes de chegar aqui) — por isso
 * getIsAdmin() já tem o bearer token anexado pelo attachSupabaseAuth. Fecha o
 * buraco anterior em que /admin renderizava antes da server function falhar. */
export const Route = createFileRoute("/_authenticated/admin")({
  beforeLoad: async () => {
    const { isAdmin } = await getIsAdmin();
    if (!isAdmin) {
      throw redirect({ to: "/" });
    }
  },
  component: AdminLayout,
});

const TABS = [
  { to: "/admin", label: "Visão geral" },
  { to: "/admin/users", label: "Utilizadores" },
  { to: "/admin/planos", label: "Planos" },
  { to: "/admin/auditoria", label: "Auditoria" },
] as const;

function AdminLayout() {
  return (
    <div className="dark min-h-screen bg-background">
      <div className="mx-auto max-w-6xl px-4 pt-8 sm:px-6 lg:pt-12">
        <nav className="mb-6 inline-flex h-9 items-center justify-center gap-1 rounded-lg bg-muted p-1 text-muted-foreground">
          {TABS.map((tab) => (
            <Link
              key={tab.to}
              to={tab.to}
              activeOptions={{ exact: tab.to === "/admin" }}
              className="inline-flex items-center justify-center rounded-md px-3 py-1 text-sm font-medium transition-all"
              activeProps={{ className: "bg-background text-foreground shadow" }}
            >
              {tab.label}
            </Link>
          ))}
        </nav>
      </div>
      <Outlet />
    </div>
  );
}
