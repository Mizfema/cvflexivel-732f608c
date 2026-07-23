// Grelha de cartões com miniatura, partilhada pelas páginas "Os meus CVs" e
// "Cartas de Motivação" — só muda o documento renderizado dentro da
// miniatura (CvThumbnail vs CartaThumbnail).
//
// DocumentListRow/DocumentListStack são a vista alternativa (Fase 2): mesmos
// dados (título, badge, data, ações), sem miniatura renderizada — poupa o
// custo de render de N documentos completos quando o utilizador só quer ver
// a lista.

import type { ReactNode } from "react";

export function DocumentCardGrid({ children }: { children: ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {children}
    </div>
  );
}

export function DocumentCard({
  thumbnail,
  thumbnailWidth,
  title,
  badge,
  date,
  actions,
}: {
  thumbnail: ReactNode;
  thumbnailWidth: number;
  title: string;
  badge: string;
  date: string;
  actions: ReactNode;
}) {
  return (
    <div className="flex flex-col overflow-hidden rounded-lg border border-navy-rule bg-card">
      <div className="flex justify-center border-b border-navy-rule bg-[#F4F2EC] p-4">
        <div
          className="overflow-hidden rounded shadow-sm ring-1 ring-black/5"
          style={{ width: thumbnailWidth }}
        >
          {thumbnail}
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-1 p-4">
        <p className="truncate font-serif text-base text-foreground">{title}</p>
        <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
          {badge} · {date}
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">{actions}</div>
      </div>
    </div>
  );
}

export function DocumentListStack({ children }: { children: ReactNode }) {
  return <div className="space-y-2">{children}</div>;
}

export function DocumentListRow({
  title,
  badge,
  date,
  actions,
}: {
  title: string;
  badge: string;
  date: string;
  actions: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-navy-rule bg-card px-4 py-3 sm:px-6">
      <div className="min-w-0">
        <p className="truncate font-serif text-base text-foreground">{title}</p>
        <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
          {badge} · {date}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">{actions}</div>
    </div>
  );
}
