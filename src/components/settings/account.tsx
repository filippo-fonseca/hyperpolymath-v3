"use client";

import { useActionState, useRef, useState, useTransition, type FormEvent } from "react";
import { signOut, updatePassword, type PasswordState } from "@/app/actions/auth";
import { removeAvatarAction, setDisplayNameAction, uploadAvatarAction } from "@/app/actions/profile";
import { AVATAR_MAX_BYTES, AVATAR_TYPES } from "@/lib/avatar";
import { ProfileAvatar } from "@/components/ui/bot-avatar";
import { useDashboard } from "@/components/dashboard/context";
import { PASSWORD_MIN, passwordProblem } from "@/lib/auth-errors";
import { Button, fieldClass } from "@/components/ui/primitives";
import { IconSignOut } from "@/components/ui/icons";
import { KiwiLoader } from "@/components/ui/kiwi-loader";
import { useToast } from "@/components/ui/toast";
import { Section, cardClass, type SectionProps } from "./shared";

export function AccountSection({ overview }: SectionProps) {
  const toast = useToast();
  const [pending, startTransition] = useTransition();

  const leave = () =>
    startTransition(async () => {
      try {
        await signOut();
      } catch {
        toast.error(navigator.onLine === false ? "You're offline. Sign out once you're back." : "Couldn't sign out. Try again.");
      }
    });

  return (
    <div className="flex flex-col gap-8">
      <Section id="settings-account" title="Signed in as" hint="Everything here belongs to this account. Nobody else can see it.">
        <div className={`${cardClass} flex items-center gap-3 py-3`}>
          {overview ? (
            <span className="min-w-0 flex-1 truncate text-[14px] font-medium">{overview.email ?? "Unknown"}</span>
          ) : (
            <span className="skeleton h-4 flex-1 rounded-full" aria-label="Loading" />
          )}
          <Button size="sm" variant="ghost" onClick={leave} disabled={pending} className="text-ink-2">
            {pending ? <KiwiLoader size={18} label="Signing out" /> : <IconSignOut size={15} />}
            Sign out
          </Button>
        </div>
      </Section>
      <ProfileSection />
      <PasswordSection email={overview?.email ?? null} />
    </div>
  );
}

/** Your name and photo, shown on your captures and replies. */
function ProfileSection() {
  const { data, run } = useDashboard();
  const toast = useToast();
  const { profile } = data;
  const [name, setName] = useState(profile.display_name ?? "");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const changed = name.trim() !== (profile.display_name ?? "");

  const saveName = async (e: FormEvent) => {
    e.preventDefault();
    if (!changed) return;
    setSaving(true);
    await run(setDisplayNameAction(name.trim()), { success: name.trim() ? "Name saved" : "Name cleared" });
    setSaving(false);
  };

  const pick = async (file: File | undefined) => {
    if (fileRef.current) fileRef.current.value = "";
    if (!file) return;
    if (file.size > AVATAR_MAX_BYTES) {
      toast.error("That photo is over 2 MB. Try a smaller one.");
      return;
    }
    const form = new FormData();
    form.set("avatar", file);
    setUploading(true);
    await run(uploadAvatarAction(form), { success: "Photo updated" });
    setUploading(false);
  };
  return (
    <Section title="Profile" hint="Your name and photo appear on your captures and replies.">
      <div className="flex items-center gap-3">
        <ProfileAvatar profile={profile} size={56} />
        <div className="flex flex-wrap items-center gap-1.5">
          <Button size="sm" variant="soft" onClick={() => fileRef.current?.click()} disabled={uploading}>
            {uploading ? <KiwiLoader size={16} label="Uploading" /> : null}
            {profile.avatar_url ? "Change photo" : "Upload photo"}
          </Button>
          {profile.avatar_url && (
            <Button size="sm" variant="ghost" className="text-ink-2" onClick={() => run(removeAvatarAction(), { success: "Photo removed" })} disabled={uploading}>
              Remove
            </Button>
          )}
          <input
            ref={fileRef}
            type="file"
            accept={AVATAR_TYPES.join(",")}
            className="hidden"
            aria-label="Profile photo"
            onChange={(e) => pick(e.target.files?.[0])}
          />
        </div>
      </div>
      <p className="mt-2 text-[12.5px] text-ink-3">JPG, PNG, WebP or GIF, up to 2 MB.</p>
      <form onSubmit={saveName} className="mt-3 flex flex-col gap-2 sm:flex-row">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={80}
          aria-label="Display name"
          placeholder="Your name"
          autoComplete="name"
          className={`${fieldClass} min-w-0 flex-1`}
        />
        <Button type="submit" variant="dark" disabled={saving || !changed}>
          {saving ? <KiwiLoader size={18} label="Saving" /> : null}
          Save name
        </Button>
      </form>
    </Section>
  );
}

async function changePassword(prev: PasswordState, form: FormData): Promise<PasswordState> {
  const problem = passwordProblem(String(form.get("password") ?? ""));
  if (problem) return { status: "error", field: "password", message: problem };
  try {
    return await updatePassword(prev, form);
  } catch {
    return { status: "error", message: "Couldn't reach the server. Try again." };
  }
}

function PasswordSection({ email }: { email: string | null }) {
  const [state, action, pending] = useActionState<PasswordState, FormData>(changePassword, { status: "idle" });

  return (
    <Section title="Password" hint={`Pick a new one. At least ${PASSWORD_MIN} characters.`}>
      <form action={action} className="flex flex-col gap-2 sm:flex-row">
        {email && <input type="email" name="username" value={email} autoComplete="username" readOnly hidden />}
        <input
          name="password"
          type="password"
          aria-label="New password"
          placeholder="New password"
          autoComplete="new-password"
          required
          aria-invalid={state.status === "error" ? true : undefined}
          className={`${fieldClass} min-w-0 flex-1`}
        />
        <Button type="submit" variant="dark" disabled={pending}>
          {pending ? <KiwiLoader size={18} label="Saving" /> : null}
          Change password
        </Button>
      </form>
      <div aria-live="polite">
        {state.status === "error" && <p className="mt-2 text-[13px] text-[#c4182b]">{state.message}</p>}
        {state.status === "done" && !pending && <p className="mt-2 text-[13px] text-ink-2">Password changed.</p>}
      </div>
    </Section>
  );
}
