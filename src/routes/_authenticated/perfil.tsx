import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Camera } from "lucide-react";
import { getProfile, updateProfile } from "@/lib/profile.functions";
import { getMyActivePlan } from "@/lib/subscription.functions";
import { ActivePlanCard } from "@/components/perfil/ActivePlanCard";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { UserAvatar } from "@/components/UserAvatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const MAX_AVATAR_BYTES = 2 * 1024 * 1024;
const ALLOWED_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

type ProfileForm = {
  full_name: string;
  headline: string;
  phone: string;
  city: string;
  country: string;
  linkedin: string;
  website: string;
};

const EMPTY_FORM: ProfileForm = {
  full_name: "",
  headline: "",
  phone: "",
  city: "",
  country: "",
  linkedin: "",
  website: "",
};

export const Route = createFileRoute("/_authenticated/perfil")({
  head: () => ({
    meta: [
      { title: "O meu perfil — CVelite" },
      { name: "description", content: "Edita os teus dados de perfil e foto." },
    ],
  }),
  component: PerfilPage,
});

function PerfilPage() {
  const { user } = useAuth();
  const fetchProfile = useServerFn(getProfile);
  const saveProfile = useServerFn(updateProfile);
  const fetchActivePlan = useServerFn(getMyActivePlan);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState<ProfileForm>(EMPTY_FORM);
  const [email, setEmail] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [activePlan, setActivePlan] = useState<Awaited<ReturnType<typeof getMyActivePlan>> | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);


  useEffect(() => {
    fetchProfile()
      .then((data) => {
        setForm({
          full_name: data.full_name ?? "",
          headline: data.headline ?? "",
          phone: data.phone ?? "",
          city: data.city ?? "",
          country: data.country ?? "",
          linkedin: data.linkedin ?? "",
          website: data.website ?? "",
        });
        setEmail(data.email);
        setAvatarUrl(data.avatar_url);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Erro ao carregar perfil."))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function updateField<K extends keyof ProfileForm>(key: K, value: ProfileForm[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setSaving(true);
    try {
      await saveProfile({ data: form });
      setSuccess("Perfil guardado.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao guardar perfil.");
    } finally {
      setSaving(false);
    }
  }

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !user) return;

    setError(null);
    setSuccess(null);
    const ext = ALLOWED_TYPES[file.type];
    if (!ext) {
      setError("Formato inválido. Usa JPG, PNG ou WEBP.");
      return;
    }
    if (file.size > MAX_AVATAR_BYTES) {
      setError("A imagem tem de ter menos de 2MB.");
      return;
    }

    const previewUrl = URL.createObjectURL(file);
    const previousUrl = avatarUrl;
    setAvatarUrl(previewUrl);
    setUploading(true);
    try {
      const path = `${user.id}/avatar.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(path, file, { upsert: true, contentType: file.type });
      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage.from("avatars").getPublicUrl(path);
      const bustedUrl = `${publicUrlData.publicUrl}?t=${Date.now()}`;
      await saveProfile({ data: { ...form, avatar_url: bustedUrl } });
      setAvatarUrl(bustedUrl);
      setSuccess("Foto atualizada.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar a foto.");
      setAvatarUrl(previousUrl);
    } finally {
      URL.revokeObjectURL(previewUrl);
      setUploading(false);
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12 text-center text-sm text-muted-foreground">
        A carregar…
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6 lg:py-12">
      <header className="mb-8">
        <p className="text-xs font-medium uppercase tracking-[0.22em] text-navy-mid">A tua conta</p>
        <h1 className="mt-2 font-serif text-3xl text-foreground sm:text-4xl">O meu perfil</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Estes dados aparecem no teu CV e na tua conta.
        </p>
      </header>

      <div className="mb-8 flex items-center gap-5">
        <UserAvatar fullName={form.full_name} avatarUrl={avatarUrl} size="lg" />
        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={handleAvatarChange}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={uploading}
            onClick={() => fileInputRef.current?.click()}
          >
            <Camera className="mr-2 h-4 w-4" />
            {uploading ? "A carregar…" : "Alterar foto"}
          </Button>
          <p className="mt-1.5 text-xs text-muted-foreground">JPG, PNG ou WEBP, até 2MB.</p>
        </div>
      </div>

      <form
        onSubmit={handleSubmit}
        className="space-y-4 rounded-xl border border-navy-rule bg-card p-6 shadow-card"
      >
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" value={email ?? ""} disabled readOnly />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="full_name">Nome completo</Label>
          <Input
            id="full_name"
            required
            value={form.full_name}
            onChange={(e) => updateField("full_name", e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="headline">Título profissional</Label>
          <Input
            id="headline"
            value={form.headline}
            onChange={(e) => updateField("headline", e.target.value)}
          />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="phone">Telefone</Label>
            <Input
              id="phone"
              value={form.phone}
              onChange={(e) => updateField("phone", e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="city">Cidade</Label>
            <Input
              id="city"
              value={form.city}
              onChange={(e) => updateField("city", e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="country">País</Label>
            <Input
              id="country"
              value={form.country}
              onChange={(e) => updateField("country", e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="linkedin">LinkedIn</Label>
            <Input
              id="linkedin"
              value={form.linkedin}
              onChange={(e) => updateField("linkedin", e.target.value)}
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="website">Website</Label>
          <Input
            id="website"
            value={form.website}
            onChange={(e) => updateField("website", e.target.value)}
          />
        </div>

        {error && (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        )}
        {success && <p className="text-sm text-muted-foreground">{success}</p>}

        <Button type="submit" disabled={saving}>
          {saving ? "A guardar…" : "Guardar alterações"}
        </Button>
      </form>
    </div>
  );
}
