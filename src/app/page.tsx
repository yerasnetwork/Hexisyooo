import { LinkButton } from "@/components/Button";
import { Card } from "@/components/Card";
import { ResumeBanner } from "@/components/ResumeBanner";
import {
  BookIcon,
  CameraIcon,
  CheckIcon,
  LockIcon,
  ShieldIcon,
  UnlockIcon,
  UsersIcon,
} from "@/components/icons";

const steps = [
  {
    icon: BookIcon,
    title: "Set a goal and a stake",
    body: "Pick what you want to read, your pace, and a deposit in simulated dollars. An AI coach breaks it into a week-by-week plan you can edit before locking it in.",
  },
  {
    icon: CameraIcon,
    title: "Read on camera, not on trust",
    body: "Start a session and your webcam confirms a human is actually present — periodically, locally, in your browser. No photos, no OCR, nothing ever leaves your device.",
  },
  {
    icon: UnlockIcon,
    title: "Hit the target, unlock your share",
    body: "Each week you meet your verified-minutes target, that week's slice of your deposit moves from locked to claimable. Miss a week, and it simply stays locked — yours, waiting.",
  },
];

export default function Home() {
  return (
    <div className="flex flex-1 flex-col bg-[var(--color-bg)]">
      <header className="flex items-center justify-between px-6 py-5 sm:px-10">
        <div className="flex items-center gap-2">
          <ShieldIcon className="text-[var(--color-accent)]" />
          <span className="font-semibold tracking-tight">Hexis</span>
        </div>
        <ResumeBanner />
      </header>

      <main className="flex flex-1 flex-col items-center px-6 sm:px-10">
        <section className="flex max-w-3xl flex-col items-center pt-12 pb-16 text-center sm:pt-20">
          <div className="mb-5 inline-flex items-center gap-1.5 rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1 text-xs font-medium text-[var(--color-text-muted)]">
            <LockIcon width={13} height={13} />
            Simulated money. Real accountability.
          </div>
          <h1 className="text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
            Put your own money on your reading habit.
            <br />
            <span className="text-[var(--color-accent)]">Get it back by proving you showed up.</span>
          </h1>
          <p className="mt-5 max-w-xl text-base text-[var(--color-text-muted)] sm:text-lg">
            Commitment apps fail because self-reported minutes are easy to fake. Hexis verifies
            you&rsquo;re actually present with a quick on-device webcam check — then unlocks your
            own stake, week by week, as you earn it back. Nothing is ever forfeited to us or
            anyone else.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <LinkButton href="/goal/new" size="lg">
              Start a goal
              <CheckIcon width={18} height={18} />
            </LinkButton>
            <LinkButton href="#how" variant="secondary" size="lg">
              See how it works
            </LinkButton>
          </div>
          <p className="mt-4 text-xs text-[var(--color-text-faint)]">
            No sign-up. No app to install. Works right in this browser.
          </p>
        </section>

        <section id="how" className="w-full max-w-5xl pb-20">
          <div className="grid gap-5 sm:grid-cols-3">
            {steps.map((step, i) => (
              <Card key={step.title} className="flex flex-col gap-3">
                <div className="flex items-center gap-2 text-[var(--color-text-faint)]">
                  <span className="font-mono text-xs">0{i + 1}</span>
                  <step.icon className="text-[var(--color-accent)]" />
                </div>
                <h3 className="text-base font-semibold">{step.title}</h3>
                <p className="text-sm leading-relaxed text-[var(--color-text-muted)]">
                  {step.body}
                </p>
              </Card>
            ))}
          </div>
        </section>

        <section className="w-full max-w-5xl pb-24">
          <Card className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <UsersIcon className="text-[var(--color-accent)]" />
              <div>
                <h3 className="text-base font-semibold">Read together, verified together</h3>
                <p className="text-sm text-[var(--color-text-muted)]">
                  Share a room code with friends — the leaderboard ranks everyone by verified
                  minutes this week, no accounts needed.
                </p>
              </div>
            </div>
            <LinkButton href="/goal/new" variant="secondary">
              Get started
            </LinkButton>
          </Card>
        </section>
      </main>

      <footer className="border-t border-[var(--color-border)] px-6 py-6 text-center text-xs text-[var(--color-text-faint)] sm:px-10">
        Hexis is a hackathon demo. All money shown is simulated — no real payments are processed.
      </footer>
    </div>
  );
}
