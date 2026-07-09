import { useRef, useState } from "react";
import { Camera, Lock, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { CvPhoto } from "@/lib/cv-types";
import { photoFrameStyle, photoImgStyle } from "@/lib/photo-style";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";

const MAX_PHOTO_BYTES = 8 * 1024 * 1024;
const ALLOWED_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};
const MAX_DIMENSION = 1000;
const OFFSET_LIMIT = 50;

function downscaleToJpeg(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const scale = Math.min(1, MAX_DIMENSION / Math.max(img.width, img.height));
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        URL.revokeObjectURL(url);
        reject(new Error("Canvas indisponível"));
        return;
      }
      ctx.drawImage(img, 0, 0, w, h);
      canvas.toBlob(
        (blob) => {
          URL.revokeObjectURL(url);
          if (blob) resolve(blob);
          else reject(new Error("Falha ao processar a imagem"));
        },
        "image/jpeg",
        0.85,
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Imagem inválida"));
    };
    img.src = url;
  });
}

export function PhotoField({
  photo,
  onChange,
  userId,
  gated = false,
  onGatedClick,
  size = 96,
}: {
  photo: CvPhoto | null | undefined;
  onChange: (photo: CvPhoto | null) => void;
  userId: string | undefined;
  gated?: boolean;
  onGatedClick?: () => void;
  size?: number;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragRef = useRef<{
    startX: number;
    startY: number;
    offsetX: number;
    offsetY: number;
  } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !userId) return;

    setError(null);
    const ext = ALLOWED_TYPES[file.type];
    if (!ext) {
      setError("Formato inválido. Usa JPG, PNG ou WEBP.");
      return;
    }
    if (file.size > MAX_PHOTO_BYTES) {
      setError("A imagem tem de ter menos de 8MB.");
      return;
    }

    setUploading(true);
    try {
      const blob = await downscaleToJpeg(file);
      const path = `${userId}/photo-${crypto.randomUUID()}.jpg`;
      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(path, blob, { upsert: true, contentType: "image/jpeg" });
      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage.from("avatars").getPublicUrl(path);
      onChange({
        url: `${publicUrlData.publicUrl}?t=${Date.now()}`,
        zoom: 1,
        offsetX: 0,
        offsetY: 0,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar a foto.");
    } finally {
      setUploading(false);
    }
  }

  function handlePointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (!photo) return;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      offsetX: photo.offsetX,
      offsetY: photo.offsetY,
    };
  }

  function handlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!photo || !dragRef.current) return;
    const { startX, startY, offsetX, offsetY } = dragRef.current;
    const dxPct = ((e.clientX - startX) / size) * 100;
    const dyPct = ((e.clientY - startY) / size) * 100;
    onChange({
      ...photo,
      offsetX: Math.max(-OFFSET_LIMIT, Math.min(OFFSET_LIMIT, offsetX + dxPct)),
      offsetY: Math.max(-OFFSET_LIMIT, Math.min(OFFSET_LIMIT, offsetY + dyPct)),
    });
  }

  function handlePointerUp() {
    dragRef.current = null;
  }

  if (gated) {
    return (
      <button
        type="button"
        onClick={onGatedClick}
        className="flex flex-col items-center gap-1.5 text-xs text-muted-foreground"
        style={{ width: size }}
      >
        <span
          style={photoFrameStyle(size)}
          className="flex items-center justify-center border border-dashed border-navy-rule bg-surface"
        >
          <Lock className="h-5 w-5 text-muted-foreground" />
        </span>
        Entra para adicionar foto
      </button>
    );
  }

  return (
    <div className="flex items-start gap-4">
      <div
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        style={{
          ...photoFrameStyle(size),
          cursor: photo ? "grab" : "default",
          border: "1px solid var(--navy-rule, #E3DFD7)",
        }}
        className="flex items-center justify-center bg-surface"
      >
        {photo ? (
          <img
            src={photo.url}
            alt="Foto do candidato"
            style={photoImgStyle(photo)}
            draggable={false}
          />
        ) : (
          <Camera className="h-6 w-6 text-muted-foreground" />
        )}
      </div>

      <div className="min-w-0 flex-1 space-y-2">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={handleFileChange}
        />
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={uploading}
            onClick={() => fileInputRef.current?.click()}
          >
            {uploading ? "A carregar…" : photo ? "Alterar foto" : "Adicionar foto"}
          </Button>
          {photo && (
            <Button type="button" variant="ghost" size="sm" onClick={() => onChange(null)}>
              <X className="mr-1 h-3.5 w-3.5" />
              Remover
            </Button>
          )}
        </div>
        {photo && (
          <div className="max-w-[220px]">
            <Slider
              min={1}
              max={3}
              step={0.05}
              value={[photo.zoom]}
              onValueChange={([zoom]) => onChange({ ...photo, zoom })}
            />
            <p className="mt-1 text-[11px] text-muted-foreground">
              Arrasta a foto para ajustar a posição.
            </p>
          </div>
        )}
        {!photo && <p className="text-xs text-muted-foreground">JPG, PNG ou WEBP, até 8MB.</p>}
        {error && (
          <p className="text-xs text-destructive" role="alert">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
