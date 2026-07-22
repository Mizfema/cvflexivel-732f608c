import { createContext, useContext, useState, type ReactNode } from "react";

interface SidebarCollapseContextValue {
  collapsed: boolean;
  setCollapsed: (collapsed: boolean) => void;
}

const SidebarCollapseContext = createContext<SidebarCollapseContextValue | null>(null);

/** Estado em memória (nunca persistido) de o menu lateral principal estar
 * recolhido — usado pelo /editor para libertar largura ao entrar na rota e
 * repor ao sair. Vive no root para que tanto o AppSidebar (que se esconde)
 * como o wrapper de layout (que remove o padding-left reservado) reajam. */
export function SidebarCollapseProvider({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  return (
    <SidebarCollapseContext.Provider value={{ collapsed, setCollapsed }}>
      {children}
    </SidebarCollapseContext.Provider>
  );
}

export function useSidebarCollapse() {
  const ctx = useContext(SidebarCollapseContext);
  if (!ctx) throw new Error("useSidebarCollapse must be used within SidebarCollapseProvider");
  return ctx;
}
