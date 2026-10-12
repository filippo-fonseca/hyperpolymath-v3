import { Hero } from "./hero";
import { HowItWorks } from "./how-it-works";
import { Talk } from "./talk";
import { Organized } from "./organized";
import { Features } from "./features";
import { Closing } from "./closing";
import { Footer } from "./footer";
import { RevealObserver } from "./reveal-observer";

// Public landing page, shown to signed-out visitors at `/`. Static: no session,
// no data. Sections are plain server components; Kiwi, the chat mock, the hero
// dot grid and the reveal observer are the only parts that hydrate.
export function Landing() {
  return (
    <>
      <main className="landing-page overflow-x-clip">
        <Hero />
        <HowItWorks />
        <Talk />
        <Organized />
        <Features />
        <Closing />
        <RevealObserver />
      </main>
      <Footer />
    </>
  );
}
