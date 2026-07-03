import { useState, useEffect } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { Home, FileText, FileSignature, MessageSquare, X, Menu } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { label: "Início", icon: Home, to: "/", exact: true, auth: false },
  { label: "CV", icon: FileText, to: "/meus-cvs", exact: false, auth: true },
  { label: "Carta", icon: FileSignature, to: "/cartas", exact: false, auth: true },
  { label: "Preparar entrevista", icon: MessageSquare, to: "/entrevistas", exact: false, auth: true },
] as const;

function useProfile(userId: string | undefined) {
  const [fullName, setFullName] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;
    supabase
      .from("profiles")
      .select("full_name")
      .eq("id", userId)
      .single()
      .then(({ data }) => setFullName(data?.full_name ?? null));
  }, [userId]);

  return fullName;
}

function getInitials(name: string | null, email: string | null | undefined): string {
  if (name) {
    return name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase() ?? "")
      .join("");
  }
  if (email) return email[0]?.toUpperCase() ?? "?";
  return "?";
}

interface SidebarContentProps {
  onClose?: () => void;
}

function SidebarContent({ onClose }: SidebarContentProps) {
  const { session, user, ready } = useAuth();
  const fullName = useProfile(user?.id);
  const router = useRouterState();
  const pathname = router.location.pathname;

  function isActive(to: string, exact: boolean) {
    if (exact) return pathname === to;
    return pathname === to || pathname.startsWith(to + "/");
  }

  return (
    <div className="flex h-full flex-col">
      {/* Logo */}
      <div className="flex h-[60px] shrink-0 items-center gap-2.5 px-5">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[6px] bg-[#1D9E75] font-serif text-[13px] font-bold text-white">
          CV
        </span>
        <span className="font-serif text-[16px] tracking-tight text-[#F1EFE8]">
          CV Flexível
        </span>
        {onClose && (
          <button
            onClick={onClose}
            className="ml-auto flex h-7 w-7 items-center justify-center rounded-md text-[#B4B2A9] transition-colors hover:bg-white/8 hover:text-[#F1EFE8] md:hidden"
            aria-label="Fechar menu"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-2 py-3">
        <ul className="space-y-0.5">
          {NAV_ITEMS.map((item) => {
            const active = isActive(item.to, item.exact);
            const Icon = item.icon;
            return (
              <li key={item.to}>
                <Link
                  to={item.to as string}
                  onClick={onClose}
                  className={cn(
                    "relative flex items-center gap-3 rounded-md px-3 py-2.5 text-[13.5px] font-medium transition-colors",
                    active
                      ? "bg-[#2a2a27] text-[#F1EFE8] before:absolute before:inset-y-[6px] before:left-0 before:w-[3px] before:rounded-r-full before:bg-[#1D9E75]"
                      : "text-[#B4B2A9] hover:bg-white/6 hover:text-[#DDD9D1]",
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" strokeWidth={1.75} />
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Footer */}
      <div className="shrink-0 border-t border-white/10 px-3 py-4">
        {!ready ? null : session ? (
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#1D9E75]/25 text-[11px] font-bold text-[#1D9E75]">
              {getInitials(fullName, user?.email)}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-medium text-[#DDD9D1]">
                {fullName ?? user?.email?.split("@")[0] ?? "Utilizador"}
              </p>
              <p className="truncate text-[11px] text-[#6B6966]">
                {user?.email}
              </p>
            </div>
          </div>
        ) : (
          <Link
            to="/auth"
            onClick={onClose}
            className="flex w-full items-center justify-center rounded-[10px] border border-white/15 px-3 py-2 text-[13px] font-medium text-[#B4B2A9] transition-colors hover:border-white/25 hover:text-[#F1EFE8]"
          >
            Entrar
          </Link>
        )}
      </div>
    </div>
  );
}

export function AppSidebar() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[210px] flex-col bg-[#1b1b19] md:flex">
        <SidebarContent />
      </aside>

      {/* Mobile: hamburger button */}
      <button
        onClick={() => setMobileOpen(true)}
        className="fixed left-4 top-4 z-30 flex h-9 w-9 items-center justify-center rounded-md bg-[#1b1b19] text-[#B4B2A9] shadow-md transition-colors hover:text-white md:hidden"
        aria-label="Abrir menu"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Mobile: overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile: drawer */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-[210px] flex-col bg-[#1b1b19] transition-transform duration-300 md:hidden",
          mobileOpen ? "flex translate-x-0" : "flex -translate-x-full",
        )}
      >
        <SidebarContent onClose={() => setMobileOpen(false)} />
      </aside>
    </>
  );
}
