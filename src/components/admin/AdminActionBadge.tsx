import { Badge } from "@/components/ui/badge";
import type { AdminActionType } from "@/lib/admin-audit.functions";

const ACTION_LABELS: Record<AdminActionType, string> = {
  grant_plan: "Plano concedido",
  revoke_plan: "Plano revogado",
  adjust_credits: "Créditos ajustados",
  suspend_user: "Conta suspensa",
  reactivate_user: "Conta reativada",
  create_plan: "Plano criado",
  update_plan: "Plano editado",
  archive_plan: "Plano arquivado",
};

const ACTION_CLASSES: Record<AdminActionType, string> = {
  grant_plan: "border-emerald-400/30 text-emerald-300",
  revoke_plan: "border-rose-400/30 text-rose-300",
  adjust_credits: "border-amber-400/30 text-amber-300",
  suspend_user: "border-rose-400/30 text-rose-300",
  reactivate_user: "border-emerald-400/30 text-emerald-300",
  create_plan: "border-emerald-400/30 text-emerald-300",
  update_plan: "border-amber-400/30 text-amber-300",
  archive_plan: "border-rose-400/30 text-rose-300",
};

export function AdminActionBadge({ actionType }: { actionType: AdminActionType }) {
  return (
    <Badge variant="outline" className={ACTION_CLASSES[actionType]}>
      {ACTION_LABELS[actionType]}
    </Badge>
  );
}
