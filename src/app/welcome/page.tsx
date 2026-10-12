import { Landing } from "@/components/landing/landing";

// The public landing page. Signed-out visitors to `/` are rewritten here by
// the proxy (the URL stays `/`); the signed-in owner gets the dashboard. It is
// fully static: no session, no data.
export default function WelcomePage() {
  return <Landing />;
}
