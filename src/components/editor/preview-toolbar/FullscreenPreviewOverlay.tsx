import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import type { CvDraft } from "@/lib/cv-types";
import { CvPagedPreview } from "@/components/editor/CvPagedPreview";
import { CvPreviewToolbar } from "./CvPreviewToolbar";

type Updater = (updater: (prev: CvDraft) => CvDraft) => void;

export function FullscreenPreviewOverlay({
  draft,
  update,
  onClose,
}: {
  draft: CvDraft;
  update: Updater;
  onClose: () => void;
}) {
  return (
    <DialogPrimitive.Root open onOpenChange={(open) => !open && onClose()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/55 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          className="fixed inset-0 z-50 flex flex-col outline-none"
          style={{ backgroundColor: "#EFEDE7" }}
        >
          <DialogPrimitive.Title className="sr-only">
            Pré-visualização em ecrã cheio
          </DialogPrimitive.Title>
          <DialogPrimitive.Close
            className="absolute right-4 top-4 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-[#FBFAF7] text-[#4A4740] shadow-md transition-colors hover:text-[#2C2C2A] focus:outline-none focus:ring-2 focus:ring-[#1D9E75]/25"
            aria-label="Fechar ecrã cheio"
          >
            <X className="h-4 w-4" />
          </DialogPrimitive.Close>

          <div className="flex-1 overflow-y-auto px-6 py-10">
            <div className="mx-auto w-full max-w-3xl">
              <CvPagedPreview draft={draft} printable={false} />
            </div>
          </div>

          <div className="pointer-events-none absolute inset-x-0 bottom-6 flex justify-center">
            <div className="pointer-events-auto">
              <CvPreviewToolbar
                draft={draft}
                update={update}
                fullscreen
                onToggleFullscreen={onClose}
              />
            </div>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
