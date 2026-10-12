import type { Metadata } from "next";
import { Landing } from "@/components/landing/landing";

// The public landing page. Signed-out visitors to `/` are rewritten here by
// the proxy (the URL stays `/`); the signed-in owner gets the dashboard. It is
// fully static: no session, no data. Robots stay noindex from the root layout.

export const metadata: Metadata = {
  title: { absolute: "Hyperpolymath" },
  description:
    "A calm, one-screen dashboard for tasks, calendar, habits, projects and captures, run by a team of Grok Bots over MCP.",
};

export default function WelcomePage() {
  return <Landing />;
}
