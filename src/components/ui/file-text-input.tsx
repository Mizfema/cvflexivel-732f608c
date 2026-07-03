import { useRef, useState, type ChangeEvent } from "react";
import { Upload, X, FileText, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface FileTextInputProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
  accept?: string;
  fileName?: string | null;
  onFileLoad?: (text: string, fileName: string) => void;
  onFileClear?: () => void;
  onError?: (msg: string) => void;
  onLoadingChange?: (loading: boolean) => void;
  disabled?: boolean;
  className?: string;
}

export function FileTextInput({
  label,
  value,
  onChange,
  placeholder,
  rows = 6,
  accept = ".txt,.docx,.pdf",
  fileName,
  onFileLoad,
  onFileClear,
  onError,
  onLoadingChange,
  disabled,
  className,
}: FileTextInputProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);

  function setLoadingState(v: boolean) {
    setLoading(v);
    onLoadingChange?.(v);
  }

  async function handleFile(file: File) {
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
    setLoadingState(true);
    try {
      let text: string;
      if (ext === "docx") {
        const mammoth = await import("mammoth");
        const arrayBuffer = await file.arrayBuffer();
        const result = await mammoth.extractRawText({ arrayBuffer });
        text = result.value;
      } else if (ext === "pdf") {
        const pdfjsLib = await import("pdfjs-dist");
        pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        const pages: string[] = [];
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const content = await page.getTextContent();
          pages.push(content.items.map((it: unknown) => (it as { str: string }).str).join(" "));
        }
        text = pages.join("\n\n");
      } else {
        text = await file.text();
      }

      if (text.startsWith("PK") || text.includes("[Content_Types].xml")) {
        onError?.(`O ficheiro "${file.name}" contém dados binários. Tenta .txt ou .docx.`);
        return;
      }
      const trimmed = text.trim();
      if (!trimmed) {
        onError?.(`O ficheiro "${file.name}" está vazio.`);
        return;
      }
      onFileLoad?.(trimmed, file.name);
    } catch (err) {
      onError?.(`Erro ao ler "${file.name}": ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setLoadingState(false);
    }
  }

  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="flex min-h-[28px] items-center justify-between">
        <label className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#8E8B84]">
          {label}
        </label>
        <div className="flex items-center gap-2">
          {fileName && (
            <span className="flex items-center gap-1 text-xs text-[#5F5E5A]">
              <FileText className="h-3 w-3 shrink-0" />
              <span className="max-w-[130px] truncate">{fileName}</span>
              <button
                type="button"
                onClick={() => onFileClear?.()}
                className="hover:text-[#2C2C2A]"
                aria-label="Remover ficheiro"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          )}
          {onFileLoad && (
            <>
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={disabled || loading}
                className="inline-flex items-center gap-1.5 rounded-full border border-[#9FE1CB] bg-transparent px-2.5 py-1.5 text-[11px] font-medium text-[#0F6E56] transition-colors hover:bg-[#1D9E75]/8 hover:border-[#7DD4B8] disabled:pointer-events-none disabled:opacity-50"
              >
                {loading ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Upload className="h-3 w-3" />
                )}
                {loading ? "A ler…" : "Carregar ficheiro"}
              </button>
              <input
                ref={fileRef}
                type="file"
                accept={accept}
                className="hidden"
                onChange={(e: ChangeEvent<HTMLInputElement>) => {
                  const f = e.target.files?.[0];
                  if (f) handleFile(f);
                  e.target.value = "";
                }}
              />
            </>
          )}
        </div>
      </div>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        placeholder={placeholder}
        disabled={disabled || loading}
        className={cn(
          "w-full resize-none rounded-[10px] border border-[#E3DFD7] bg-white px-[13px] py-[13px]",
          "font-sans text-[13.5px] text-[#2C2C2A] placeholder:text-[#C5C0B8]",
          "transition-colors focus:border-[#1D9E75] focus:outline-none focus:ring-2 focus:ring-[#1D9E75]/15",
          "disabled:cursor-not-allowed disabled:opacity-60",
        )}
      />
      <p className="text-right text-[11px] text-[#B8B4AC]">{value.length} caracteres</p>
    </div>
  );
}
