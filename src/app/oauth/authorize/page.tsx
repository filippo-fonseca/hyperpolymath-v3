import type { Metadata } from "next";
import { Suspense } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { adminDb } from "@/server/ctx";
import { checkAuthorize, pickParams } from "@/server/oauth-authorize";
import { originFrom } from "@/server/oauth-http";
import { currentUserId } from "@/lib/session";
import { redirectLabel } from "@/lib/oauth";
import { KiwiLoader } from "@/components/ui/kiwi-loader";
import { ConsentCard, ConsentError, ConsentShell } from "./consent";

export const metadata: Metadata = { title: "Connect an app", robots: { index: false, follow: false } };

// OAuth 2.1 authorization endpoint. An MCP client (Claude, ChatGPT, Grok Bot...)
// sends the account owner here; they sign in if needed, see exactly which app
// is asking and where they'll be sent back, and approve or decline.

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default function AuthorizePage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <ConsentShell>
      <Suspense
        fallback={
          <div className="flex h-[420px] items-center justify-center">
            <KiwiLoader size={44} label="Loading" />
          </div>
        }
      >
        <Gate searchParams={searchParams} />
      </Suspense>
    </ConsentShell>
  );
}

async function Gate({ searchParams }: { searchParams: SearchParams }) {
  const params = pickParams(await searchParams);
  const issuer = originFrom(await headers());
  const check = await checkAuthorize(adminDb(), params, issuer);
  if (check.kind === "fatal") return <ConsentError title={check.title} detail={check.detail} />;
  if (check.kind === "redirect") redirect(check.url);

  const selfPath = `/oauth/authorize?${new URLSearchParams(params as Record<string, string>).toString()}`;
  const userId = await currentUserId();
  if (!userId) redirect(`/login?next=${encodeURIComponent(selfPath)}`);

  const { data: profile } = await adminDb().from("profiles").select("email, display_name, avatar_url").eq("id", userId).maybeSingle();
  const { client } = check;
  return (
    <ConsentCard
      params={params}
      selfPath={selfPath}
      client={{
        name: client.name,
        logoUri: client.logo_uri,
        clientUri: client.client_uri,
        verifiedDomain: client.kind === "cimd" ? new URL(client.client_id).hostname.replace(/^www\./, "") : null,
      }}
      returnTo={redirectLabel(check.redirectUri)}
      profile={profile ?? { email: "", display_name: null, avatar_url: null }}
    />
  );
}
