import { Hero } from "./hero";
import { HowItWorks } from "./how-it-works";
import { Talk } from "./talk";
import { Features } from "./features";

// Public landing page, shown to signed-out visitors at `/`. Static: no session,
// no data. Sections are plain server components; only Kiwi and the chat mock
// hydrate.
export function Landing() {
  return (
    <main className="landing-page overflow-x-clip">
      <Hero />
      <HowItWorks />
      <Talk />
      <Features />
    </main>
  );
}
