import type { Metadata } from "next";
import Link from "next/link";
import { KiwiLost } from "@/components/illustrations";
import { StatePage, statePrimary } from "@/components/ui/state-page";

export const metadata: Metadata = { title: "Not found" };

export default function NotFound() {
  return (
    <StatePage
      art={<KiwiLost size={168} title="Kiwi studying a map" />}
      title="This page doesn't exist"
      actions={
        <Link href="/" className={statePrimary}>
          Back to the dashboard
        </Link>
      }
    >
      Kiwi checked the map twice. Whatever lived here has moved on, or never was.
    </StatePage>
  );
}
