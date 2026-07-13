import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/admin/users/")({
  head: () => ({
    meta: [{ title: "Utilizadores — Admin — CV Flexível" }],
  }),
  component: AdminUsersPlaceholder,
});

function AdminUsersPlaceholder() {
  return (
    <div className="mx-auto max-w-6xl px-4 pb-12 sm:px-6">
      <p className="text-sm text-muted-foreground">
        Lista e detalhe de utilizadores chegam na Fase A2.
      </p>
    </div>
  );
}
