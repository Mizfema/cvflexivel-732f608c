import { useState, useEffect } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import {
  Home,
  FileText,
  FileSignature,
  MessageSquare,
  LogOut,
  X,
  Menu,
  ShieldCheck,
  Gem,
  User,
  ChevronRight,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { getIsAdmin } from "@/lib/admin.functions";
import { getSidebarStatus } from "@/lib/subscription.functions";
import { formatPlanTimeLeft } from "@/lib/plan-time-format";
import { UserAvatar } from "@/components/UserAvatar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useSidebarCollapse } from "@/hooks/use-sidebar-collapse";

const NAV_ITEMS = [
  { label: "Início", icon: Home, to: "/", exact: true, auth: false },
  { label: "CV", icon: FileText, to: "/meus-cvs", exact: false, auth: true },
  { label: "Carta", icon: FileSignature, to: "/cartas", exact: false, auth: true },
  {
    label: "Preparar entrevista",
    icon: MessageSquare,
    to: "/entrevistas",
    exact: false,
    auth: true,
  },
  { label: "Planos", icon: Gem, to: "/planos", exact: false, auth: false },
] as const;

type SidebarStatus = Awaited<ReturnType<typeof getSidebarStatus>>;
type UsageSummaryItem = Extract<SidebarStatus, { tier: "free" }>["usageSummary"][number];

/** Chave partilhada com quem consome saldo (ex.: AnaliseModal, /analise) para
 * invalidar o indicador logo após o consumo — sem isto o número só atualiza
 * ao recarregar a página, porque o valor vem de uma leitura no servidor. */
export const SIDEBAR_STATUS_QUERY_KEY = ["sidebar-status"] as const;

/** Indicador de plano (Fase 2 da Proposta V3 §8; minutos desde a Fase B4 do
 * Guia B0-B5) — tempo restante para premium, análises restantes no mês para
 * grátis. Nunca mostra nada para anónimo (ainda não tem conta). */
function useSidebarStatus(userId: string | undefined): SidebarStatus | null {
  const fetchStatus = useServerFn(getSidebarStatus);

  const { data } = useQuery({
    queryKey: SIDEBAR_STATUS_QUERY_KEY,
    queryFn: () => fetchStatus(),
    enabled: !!userId,
  });

  return userId ? (data ?? null) : null;
}

/** Formata "quando renova" a partir de um ISO de reset — sem tick ao segundo
 * (ao contrário do Countdown do UsageLimitNotice): esta leitura é só um
 * instantâneo mostrado num popover, não um bloqueio a acompanhar em tempo
 * real. */
function formatResetIn(resetAt: string): string {
  const ms = new Date(resetAt).getTime() - Date.now();
  if (ms <= 0) return "já disponível";
  const hours = ms / (60 * 60 * 1000);
  if (hours < 24) return `${Math.ceil(hours)}h`;
  const days = Math.ceil(hours / 24);
  return `${days} ${days === 1 ? "dia" : "dias"}`;
}

function UsageRow({ item }: { item: UsageSummaryItem }) {
  return (
    <div className="space-y-0.5">
      <p className="text-xs font-medium text-foreground">{item.label}</p>
      {item.today && (
        <p className="text-[11px] text-muted-foreground">
          Hoje: {item.today.remaining} restante{item.today.remaining === 1 ? "" : "s"}
          {item.today.remaining === 0 &&
            item.today.resetAt &&
            ` · renova em ${formatResetIn(item.today.resetAt)}`}
        </p>
      )}
      {item.month && (
        <p className="text-[11px] text-muted-foreground">
          Este mês: {item.month.remaining} restante{item.month.remaining === 1 ? "" : "s"}
          {item.month.remaining === 0 &&
            item.month.resetAt &&
            ` · renova em ${formatResetIn(item.month.resetAt)}`}
        </p>
      )}
    </div>
  );
}

/** Painel de uso do tier grátis (Popover na sidebar) — uma linha por
 * funcionalidade em vez de um único "X análises restantes" que só refletia a
 * feature cv_analysis e confundia quem batia no limite de outra (Carta,
 * Alinhamento CV↔TdR, etc.). */
function UsagePanel({ items }: { items: UsageSummaryItem[] }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className="mt-0.5 flex w-full items-center gap-0.5 text-[10.5px] text-[#8A8883] transition-colors hover:text-[#DDD9D1]">
          Ver saldo de uso
          <ChevronRight className="h-3 w-3 shrink-0" />
        </button>
      </PopoverTrigger>
      <PopoverContent side="right" align="end" className="w-64 space-y-3">
        {items.length === 0 ? (
          <p className="text-xs text-muted-foreground">Sem limites configurados.</p>
        ) : (
          items.map((item) => <UsageRow key={item.key} item={item} />)
        )}
      </PopoverContent>
    </Popover>
  );
}

function useIsAdmin(userId: string | undefined) {
  const fetchIsAdmin = useServerFn(getIsAdmin);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    if (!userId) {
      setIsAdmin(false);
      return;
    }
    fetchIsAdmin()
      .then(({ isAdmin }) => setIsAdmin(isAdmin))
      .catch(() => setIsAdmin(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  return isAdmin;
}

function useProfile(userId: string | undefined) {
  const [profile, setProfile] = useState<{
    full_name: string | null;
    avatar_url: string | null;
  } | null>(null);

  useEffect(() => {
    if (!userId) return;
    supabase
      .from("profiles")
      .select("full_name, avatar_url")
      .eq("id", userId)
      .single()
      .then(({ data }) => setProfile(data ?? null));
  }, [userId]);

  return profile;
}

interface SidebarContentProps {
  onClose?: () => void;
}

function SidebarContent({ onClose }: SidebarContentProps) {
  const { session, user, ready } = useAuth();
  const profile = useProfile(user?.id);
  const isAdmin = useIsAdmin(user?.id);
  const sidebarStatus = useSidebarStatus(user?.id);
  const fullName = profile?.full_name ?? null;
  const router = useRouterState();
  const navigate = useNavigate();
  const pathname = router.location.pathname;

  const navItems = isAdmin
    ? [...NAV_ITEMS, { label: "Admin", icon: ShieldCheck, to: "/admin", exact: false, auth: true }]
    : NAV_ITEMS;

  function isActive(to: string, exact: boolean) {
    if (exact) return pathname === to;
    return pathname === to || pathname.startsWith(to + "/");
  }

  async function handleLogout() {
    onClose?.();
    await supabase.auth.signOut();
    navigate({ to: "/auth" });
  }

  return (
    <div className="flex h-full flex-col">
      {/* Logo */}
      <div className="flex h-[60px] shrink-0 items-center gap-2.5 px-5">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[6px] bg-[#1D9E75] font-serif text-[13px] font-bold text-white">
          CV
        </span>
        <span className="font-serif text-[16px] tracking-tight text-[#F1EFE8]">CVelite</span>
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
          {navItems.map((item) => {
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
        {session && sidebarStatus && sidebarStatus.tier !== "anonymous" && (
          <div className="mb-2 rounded-md bg-[#1D9E75]/10 px-2.5 py-2">
            <p className="flex items-center gap-1 text-[11px] font-semibold text-[#1D9E75]">
              <User className="h-3 w-3 shrink-0" strokeWidth={2} />
              {sidebarStatus.tier === "premium"
                ? "Premium"
                : sidebarStatus.tier === "avulso"
                  ? "Pacote avulso"
                  : "Conta grátis"}
            </p>
            {sidebarStatus.tier === "free" ? (
              <UsagePanel items={sidebarStatus.usageSummary} />
            ) : (
              <p className="mt-0.5 text-[10.5px] text-[#8A8883]">
                {sidebarStatus.tier === "premium"
                  ? sidebarStatus.minutesLeft != null
                    ? `${formatPlanTimeLeft(sidebarStatus.minutesLeft)} restantes`
                    : "Ilimitado"
                  : `${sidebarStatus.balance} créditos · expira em ${sidebarStatus.daysLeft} ${sidebarStatus.daysLeft === 1 ? "dia" : "dias"}`}
              </p>
            )}
          </div>
        )}
        {!ready ? null : session ? (
          <div className="space-y-2">
            <Link
              to="/perfil"
              onClick={onClose}
              className="-m-1 flex items-center gap-2.5 rounded-md p-1 transition-colors hover:bg-white/6"
            >
              <UserAvatar fullName={fullName} avatarUrl={profile?.avatar_url} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-medium text-[#DDD9D1]">
                  {fullName ?? user?.email?.split("@")[0] ?? "Utilizador"}
                </p>
                <p className="truncate text-[11px] text-[#6B6966]">{user?.email}</p>
              </div>
            </Link>
            <button
              onClick={handleLogout}
              className="flex w-full items-center gap-2 rounded-md px-1 py-1.5 text-[12.5px] text-[#B4B2A9] transition-colors hover:bg-white/6 hover:text-[#F1EFE8]"
            >
              <LogOut className="h-3.5 w-3.5" strokeWidth={1.75} />
              Terminar sessão
            </button>
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
  const { collapsed, setCollapsed } = useSidebarCollapse();

  return (
    <>
      {/* Desktop sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 hidden w-[210px] flex-col bg-[#1b1b19] transition-transform duration-200 md:flex",
          collapsed && "md:-translate-x-full",
        )}
      >
        <SidebarContent />
      </aside>

      {/* Desktop: reabrir menu recolhido (ex.: ao entrar no /editor) */}
      {collapsed && (
        <button
          onClick={() => setCollapsed(false)}
          className="fixed left-4 top-4 z-30 hidden h-9 w-9 items-center justify-center rounded-md bg-[#1b1b19] text-[#B4B2A9] shadow-md transition-colors hover:text-white md:flex"
          aria-label="Abrir menu"
        >
          <Menu className="h-5 w-5" />
        </button>
      )}

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
