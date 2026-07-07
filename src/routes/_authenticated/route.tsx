import { useEffect } from "react";
import { Outlet, createFileRoute, useNavigate, useRouterState } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/_authenticated")({
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const navigate = useNavigate();
  const { ready, session } = useAuth();
  const next = useRouterState({
    select: (state) => state.location.href,
  });

  useEffect(() => {
    if (ready && !session) {
      navigate({ to: "/auth", search: { next }, replace: true });
    }
  }, [navigate, next, ready, session]);

  if (!ready || !session) {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 text-sm text-muted-foreground">
        A verificar sessão…
      </div>
    );
  }

  return <Outlet />;
}
