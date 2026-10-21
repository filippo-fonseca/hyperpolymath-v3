import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { Logotype } from "@/components/ui/brand";

export const metadata: Metadata = {
  title: "Terms and privacy",
  description: "The terms for using Hyperpolymath and how it handles your data.",
};

// Terms of use and privacy policy on one public page. The contact address
// comes from CONTACT_EMAIL so it stays out of this public repo.

const UPDATED = "October 21, 2026";
const LINKEDIN_URL = "https://linkedin.com/in/filippo-fonseca";
const REPO_URL = "https://github.com/filippo-fonseca/hyperpolymath-v3";

function Contact() {
  const email = process.env.CONTACT_EMAIL?.trim();
  if (email) {
    return (
      <a href={`mailto:${email}`} className="underline underline-offset-4 hover:text-ink-2">
        {email}
      </a>
    );
  }
  return (
    <a href={LINKEDIN_URL} target="_blank" rel="noopener noreferrer" className="underline underline-offset-4 hover:text-ink-2">
      message me on LinkedIn
    </a>
  );
}

function H2({ id, children }: { id: string; children: ReactNode }) {
  return (
    <h2 id={id} className="mt-14 scroll-mt-8 text-[24px] font-semibold tracking-[-0.02em] sm:text-[28px]">
      {children}
    </h2>
  );
}

function H3({ children }: { children: ReactNode }) {
  return <h3 className="mt-8 text-[16px] font-semibold">{children}</h3>;
}

export default function TermsPage() {
  return (
    <main className="px-4 pb-[max(64px,env(safe-area-inset-bottom))] pt-10 sm:pt-16">
      <article className="mx-auto max-w-[680px] text-[15px] leading-relaxed text-ink-2 [&_li]:mt-1.5 [&_p]:mt-3 [&_strong]:text-ink [&_ul]:mt-3 [&_ul]:list-disc [&_ul]:pl-5">
        <Link href="/" className="inline-block text-[24px] leading-none text-ink">
          <Logotype />
        </Link>
        <h1 className="mt-10 text-[32px] font-semibold leading-tight tracking-[-0.03em] text-ink sm:text-[38px]">Terms and privacy</h1>
        <p className="!mt-2 text-[13.5px] text-ink-3">Last updated {UPDATED}</p>

        <p>
          Hyperpolymath is a personal dashboard for tasks, calendar, habits, projects and notes, built and run by Filippo Fonseca as an individual (not a
          company). This page has two parts: the <a href="#terms" className="underline underline-offset-4">terms</a> you agree to when you use it, and
          the <a href="#privacy" className="underline underline-offset-4">privacy policy</a> that explains what happens to your data. Questions about
          either: <Contact />.
        </p>

        <H2 id="terms">Terms of use</H2>

        <H3>Using Hyperpolymath</H3>
        <p>
          You can create an account with an email address and a password. You need to be at least 13 years old, and you&apos;re responsible for what
          happens under your account, including anything done by bots or apps you give a token to. Keep your password and tokens to yourself.
        </p>

        <H3>It&apos;s free, and it&apos;s a side project</H3>
        <p>
          Hyperpolymath costs nothing and comes with no guarantees. It&apos;s maintained by one person, so features can change, things can break, and
          the service could shut down. If it ever does, I&apos;ll give at least 30 days&apos; notice by email so you can export your data first.
        </p>

        <H3>Your content</H3>
        <p>
          What you put in (tasks, notes, captures, widgets) stays yours. You give me only the permission needed to store it, show it back to you, and
          send it where you tell the app to send it, such as your Grok Bot or your Google Calendar. I don&apos;t claim any other rights to it.
        </p>

        <H3>Things you can&apos;t do</H3>
        <ul>
          <li>Break the law with it, or store content you don&apos;t have the right to store.</li>
          <li>Try to get into other people&apos;s accounts or data, or around the app&apos;s security.</li>
          <li>Overload the service, for example with automated sign-ups or bots that hammer the API.</li>
          <li>Use it to send spam or anything harmful through the reminder relay or calendar.</li>
        </ul>
        <p>I can suspend or delete an account that does these things. Outside of that, you can stop using the app and delete your account whenever you like.</p>

        <H3>Other services</H3>
        <p>
          Hyperpolymath connects to services it doesn&apos;t run: Grok Bot, Google Calendar, and the hosting and database providers listed below. Your
          use of those is covered by their own terms, and I&apos;m not responsible for what they do.
        </p>

        <H3>No warranty, limited liability</H3>
        <p>
          The service is provided &quot;as is&quot;, without warranties of any kind, including that it will be available, accurate, or free of errors.
          Don&apos;t rely on it as the only place you keep something important, and don&apos;t rely on its reminders for anything where a missed nudge
          could cause harm. To the extent the law allows, I&apos;m not liable for any indirect or consequential loss, or for lost data, and my total
          liability for any claim is limited to $50.
        </p>

        <H3>Changes and law</H3>
        <p>
          I may update these terms. If a change matters, I&apos;ll say so in the app or by email before it takes effect, and continuing to use the app
          after that means you accept it. These terms are governed by the laws of the State of Connecticut, USA.
        </p>

        <H2 id="privacy">Privacy policy</H2>
        <p>
          The short version: your data is used to run your dashboard and nothing else. It isn&apos;t sold, it isn&apos;t used for ads, and there are no
          analytics or tracking scripts in the app.
        </p>

        <H3>What&apos;s stored</H3>
        <ul>
          <li>
            <strong>Your account:</strong> your email address, your password (stored only as a one-way hash, never in a readable form), and when you
            signed up and last signed in.
          </li>
          <li>
            <strong>What you put in the dashboard:</strong> tasks, reminders, habits, captures, projects, widgets, your timezone, and the bots you
            register.
          </li>
          <li>
            <strong>An activity log</strong> of changes made by you and your bots, with before and after copies, so changes can be reviewed and undone.
          </li>
          <li>
            <strong>Connection keys:</strong> MCP tokens (stored only as hashes), the Reminder relay webhook key you paste in, and Google Calendar
            access tokens. The webhook key and Google tokens are encrypted before they&apos;re stored.
          </li>
        </ul>

        <H3>Who can see it</H3>
        <p>
          Each account is private. The database only lets a signed-in account read its own rows, and every change goes through the server, which checks
          which account is asking. Other people who use Hyperpolymath can&apos;t see your data. As the person who runs the service I have technical
          access to the database, and I only look at account data when you ask me to or to fix a problem with the service.
        </p>

        <H3>Where it goes</H3>
        <p>Your data is only sent to these places, and only to make the app work:</p>
        <ul>
          <li>
            <strong>Supabase</strong> hosts the database and handles sign-in, on servers in the United States.
          </li>
          <li>
            <strong>Vercel</strong> hosts the app itself.
          </li>
          <li>
            <strong>Your Grok Bot</strong>, but only if you set it up. Bots read and change your data through tokens you create, and due reminders are
            sent to the relay webhook you add in Settings. Once data reaches Grok Bot, its own privacy policy applies.
          </li>
          <li>
            <strong>Google Calendar</strong>, but only if you connect it (see below).
          </li>
        </ul>

        <H3>Google Calendar</H3>
        <p>
          If you connect a Google account, Hyperpolymath asks for your email address and access to your calendars. It uses that access only to show
          your events on the dashboard and to create, edit or delete events when you or your bots ask it to. Google data isn&apos;t used for ads, isn&apos;t
          sold or shared with anyone else, and isn&apos;t used to train AI models. Hyperpolymath&apos;s use of information received from Google APIs
          follows the{" "}
          <a
            href="https://developers.google.com/terms/api-services-user-data-policy"
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-4 hover:text-ink-2"
          >
            Google API Services User Data Policy
          </a>
          , including the Limited Use requirements. You can disconnect a Google account in Settings at any time, which revokes access at Google and
          deletes its stored tokens. You can also revoke access from your Google account settings.
        </p>

        <H3>Cookies</H3>
        <p>The only cookies are the ones that keep you signed in. There are no advertising or analytics cookies.</p>

        <H3>Emails</H3>
        <p>You&apos;ll only get emails you ask for, such as a password reset link. There&apos;s no newsletter or marketing email.</p>

        <H3>Your choices</H3>
        <ul>
          <li>
            <strong>Export:</strong> Settings, Data, &quot;Export everything&quot; downloads all your data as JSON.
          </li>
          <li>
            <strong>Delete:</strong> to delete your account, contact me (<Contact />) from the email on the account. Deleting it removes your account and
            everything in it within 30 days. Database backups roll over and are gone within a further 30 days.
          </li>
          <li>
            <strong>Correct:</strong> you can edit nearly everything in the app directly. For your email address, contact me.
          </li>
        </ul>
        <p>Your data is kept for as long as your account exists.</p>

        <H3>Children</H3>
        <p>Hyperpolymath isn&apos;t meant for children under 13, and I don&apos;t knowingly collect data from them.</p>

        <H3>Security</H3>
        <p>
          Connections are encrypted, passwords are hashed, secrets are encrypted at rest, and each account is walled off from the others in the database
          itself. No system is perfectly secure, though. If I learn of a breach that affects your data, I&apos;ll tell you by email. The code is open
          source on{" "}
          <a href={REPO_URL} target="_blank" rel="noopener noreferrer" className="underline underline-offset-4 hover:text-ink-2">
            GitHub
          </a>
          , so you can check how all of this works.
        </p>

        <H3>Changes</H3>
        <p>If this policy changes in a way that matters, I&apos;ll update the date at the top and tell you in the app or by email.</p>

        <p className="!mt-14 border-t border-ink/[0.06] pt-6 text-[13.5px] text-ink-3">
          <Link href="/" className="underline underline-offset-4 hover:text-ink-2">
            Back to Hyperpolymath
          </Link>
        </p>
      </article>
    </main>
  );
}
