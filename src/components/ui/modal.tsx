import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

interface ModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
  className?: string;
}

export function Modal({ open, onOpenChange, children, className }: ModalProps) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/45 backdrop-blur-[1.5px] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          className={cn(
            "fixed left-1/2 top-1/2 z-50 w-full max-w-[520px] -translate-x-1/2 -translate-y-1/2",
            "max-h-[90vh] overflow-y-auto rounded-[14px] p-7",
            "shadow-[0_12px_60px_rgba(0,0,0,0.14),0_2px_12px_rgba(0,0,0,0.08)]",
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
            "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
            className,
          )}
          style={{ backgroundColor: "#FBFAF7" }}
        >
          <DialogPrimitive.Close
            className="absolute right-4 top-4 flex h-7 w-7 items-center justify-center rounded-full text-[#9E9A94] transition-colors hover:bg-black/6 hover:text-[#2C2C2A] focus:outline-none focus:ring-2 focus:ring-[#1D9E75]/25"
            aria-label="Fechar"
          >
            <X className="h-3.5 w-3.5" />
          </DialogPrimitive.Close>
          {children}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

export const ModalTitle = DialogPrimitive.Title;
