import Link from "next/link";

export default function HowItWorks() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-black text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(186,159,51,0.25),transparent_55%)] ambient-float" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_60%,rgba(228,178,86,0.08),transparent_45%)] ambient-float-slow" />
      <div className="pointer-events-none absolute inset-0 opacity-60 [background-image:linear-gradient(120deg,rgba(255,255,255,0.06)_0%,transparent_30%,rgba(255,255,255,0.04)_70%,transparent_100%)] ambient-pulse" />

      <div className="relative mx-auto flex w-full max-w-6xl flex-col gap-10 px-6 pb-24 pt-12 lg:flex-row">
        <aside className="w-full space-y-4 lg:sticky lg:top-8 lg:max-w-xs lg:self-start">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-[0.65rem] uppercase tracking-[0.3em] text-white/60 transition hover:text-white"
          >
            <span className="text-sm">←</span>
            Back
          </Link>
          <p className="text-xs uppercase tracking-[0.3em] text-amber-300/70">
            How It Works
          </p>
          <nav className="grid gap-2 text-sm text-white/70">
            {[
              { id: "overview", label: "Overview" },
              { id: "mechanics", label: "Game Mechanics" },
              { id: "play", label: "How to Play" },
              { id: "create", label: "Create a Vault" },
              { id: "pool", label: "Reward Pool" },
              { id: "distribution", label: "Reward Distribution" },
              { id: "timer", label: "When Time Runs Out" },
              { id: "fees", label: "Platform Fee" },
            ].map((item) => (
              <a
                key={item.id}
                href={`#${item.id}`}
                className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs uppercase tracking-[0.25em] text-white/70 transition hover:-translate-y-0.5 hover:border-white/30 hover:text-white"
              >
                {item.label}
              </a>
            ))}
          </nav>
        </aside>

        <article className="flex-1 space-y-10">
          <header id="overview" className="space-y-3">
            <h1 className="font-[var(--font-heading)] text-4xl leading-tight text-white sm:text-5xl">
              Crack the vault. Share the jackpot.
            </h1>
            <p className="max-w-2xl text-base text-white/70">
              Crack‑The‑Vault is a collaborative puzzle game. Players spend a
              small trial fee to guess characters in a hidden key. Each correct
              discovery reveals a slot, and the full key unlocks the reward
              pool.
            </p>
          </header>

          <section id="mechanics" className="space-y-3">
            <h2 className="font-[var(--font-heading)] text-2xl text-white">
              Game Mechanics
            </h2>
            <p className="text-sm text-white/70">
              Every vault has a locked reward pool, a time limit, and a hidden
              key. Players guess one character at a time for a specific slot.
              Correct guesses reveal that slot; incorrect guesses don’t reveal
              anything but still contribute to the pool.
            </p>
            <p className="text-sm text-white/70">
              Players can also create vaults by setting the initial reward,
              trial fee, key length, and lock time.
            </p>
          </section>

          <section id="play" className="space-y-3">
            <h2 className="font-[var(--font-heading)] text-2xl text-white">
              How to Play
            </h2>
            <div className="space-y-2 text-sm text-white/70">
              <p>
                1. Create a vault with a reward pool and timer, or pick an
                existing one to crack.
              </p>
              <p>2. Choose a position and submit a guess.</p>
              <p>3. Keep cracking with others until the key is revealed.</p>
            </div>
          </section>

          <section id="create" className="space-y-3">
            <h2 className="font-[var(--font-heading)] text-2xl text-white">
              Create a Vault
            </h2>
            <p className="text-sm text-white/70">
              You can create your own vault by setting the initial reward, trial
              fee, key length, and lock time. Once created, it appears on the
              vault list for others to crack.
            </p>
          </section>

          <section id="pool" className="space-y-3">
            <h2 className="font-[var(--font-heading)] text-2xl text-white">
              Reward Pool
            </h2>
            <p className="text-sm text-white/70">
              The reward pool starts with the creator’s initial stake. Every
              trial fee adds to it, so the pool grows with each attempt while
              the vault is active.
            </p>
          </section>

          <section id="distribution" className="space-y-3">
            <h2 className="font-[var(--font-heading)] text-2xl text-white">
              Reward Distribution
            </h2>
            <p className="text-sm text-white/70">
              When a vault is cracked, the reward pool is distributed to the
              contributors who revealed the key. The split is not equal: earlier
              discoveries earn a larger share than later ones.
            </p>
          </section>

          <section id="timer" className="space-y-3">
            <h2 className="font-[var(--font-heading)] text-2xl text-white">
              When Time Runs Out
            </h2>
            <p className="text-sm text-white/70">
              If the timer ends before the key is fully revealed, the vault
              closes and the pool returns to the vault creator after the
              platform fee.
            </p>
          </section>

          <section id="fees" className="space-y-3">
            <h2 className="font-[var(--font-heading)] text-2xl text-white">
              Platform Fee
            </h2>
            <p className="text-sm text-white/70">
              A 5% platform fee is taken from the final pool before any payouts
              are distributed.
            </p>
          </section>
        </article>
      </div>
    </div>
  );
}
