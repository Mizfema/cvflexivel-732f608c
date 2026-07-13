import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/admin/auditoria")({
  head: () => ({
    meta: [{ title: "Auditoria — Admin — CV Flexível" }],
  }),
  component: AdminAuditoriaPlaceholder,
});

function AdminAuditoriaPlaceholder() {
  return (
    <div className="mx-auto max-w-6xl px-4 pb-12 sm:px-6">
      <p className="text-sm text-muted-foreground">
        O visualizador de auditoria chega na Fase A5.
      </p>
    </div>
  );
}
