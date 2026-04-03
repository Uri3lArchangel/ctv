"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

const currencyFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 3,
});
const formatDollars = (value: number) => `$${currencyFormatter.format(value)}`;

const buildRewardShares = (count: number) => {
  if (count <= 0) return [];
  if (count === 1) return [1];
  const delta = 0.12;
  const raw = Array.from({ length: count }, (_, index) => {
    const position = index / (count - 1);
    const bias = 1 - 2 * position;
    return 1 + delta * bias;
  });
  const sum = raw.reduce((total, value) => total + value, 0);
  return raw.map((value) => value / sum);
};

type Vault = {
  id: string;
  name: string;
  reward: string;
  rewardValue: number;
  initialLocked: string;
  currentLocked: string;
  entryFee: string;
  entryFeeValue: number;
  keyLength: string;
  revealedKey: (string | null)[];
  progress: number;
  slots: string;
  timeLeft: string;
  timeLeftMinutes: number;
  status: string;
  vaultState: "running" | "cracked" | "ended";
  createdAt?: string | null;
  revealOrder?: { index: number; address: string; revealedAt: string }[];
};

const filters = ["All Vaults", "Hot", "Open", "Closing", "Cracked", "Ended"];

const sortOptions = [
  { label: "Newest", value: "newest" },
  { label: "Highest Reward", value: "reward" },
  { label: "Ending Soon", value: "time" },
  { label: "Lowest Fee", value: "fee" },
];

export default function Home() {
  const [vaults, setVaults] = useState<Vault[]>([]);
  const [activeFilter, setActiveFilter] = useState("All Vaults");
  const [sortBy, setSortBy] = useState("newest");
  const [isSortOpen, setIsSortOpen] = useState(false);
  const [isKeyLengthOpen, setIsKeyLengthOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [crackVault, setCrackVault] = useState<Vault | null>(null);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [walletBalance, setWalletBalance] = useState<number | null>(null);
  const [isBalanceLoading, setIsBalanceLoading] = useState(false);
  const [isWalletVerified, setIsWalletVerified] = useState(false);
  const [isDemo, setIsDemo] = useState(true);
  const [demoCredits, setDemoCredits] = useState(0);
  const [accountsOpen, setAccountsOpen] = useState(false);
  const [connectedAccounts, setConnectedAccounts] = useState<string[]>([]);
  const [isAccountsLoading, setIsAccountsLoading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [vaultsError, setVaultsError] = useState<string | null>(null);
  const [isVaultsLoading, setIsVaultsLoading] = useState(false);
  const [welcomeOpen, setWelcomeOpen] = useState(false);
  const [welcomeAddress, setWelcomeAddress] = useState<string | null>(null);
  const [activeGuessIndex, setActiveGuessIndex] = useState<number | null>(null);
  const [guessValues, setGuessValues] = useState<string[]>([]);
  const [revealedChars, setRevealedChars] = useState<(string | null)[]>([]);
  const [isGuessLoading, setIsGuessLoading] = useState(false);
  const [showCrackedCelebration, setShowCrackedCelebration] = useState(false);
  const [guessFeedback, setGuessFeedback] = useState<{
    tone: "success" | "info" | "error";
    message: string;
  } | null>(null);
  const [vaultName, setVaultName] = useState("");
  const [rewardAmount, setRewardAmount] = useState("");
  const [trialFee, setTrialFee] = useState("");
  const [keyLength, setKeyLength] = useState("6");
  const [lockDays, setLockDays] = useState("0");
  const [lockHours, setLockHours] = useState("12");
  const [lockMins, setLockMins] = useState("00");
  const [lockSecs, setLockSecs] = useState("00");

  const recentCracked = useMemo(
    () =>
      vaults
        .filter((vault) => vault.vaultState === "cracked")
        .slice(0, 3)
        .map((vault, index) => ({
          name: vault.name,
          reward: vault.reward,
          time: index === 0 ? "12m ago" : index === 1 ? "38m ago" : "1h ago",
        })),
    [vaults]
  );

  const totalVaultVolume = useMemo(
    () => vaults.reduce((sum, vault) => sum + (vault.rewardValue || 0), 0),
    [vaults]
  );

  const filteredVaults = useMemo(() => {
    const base = vaults.filter((vault) =>
      activeFilter === "All Vaults" ? true : vault.status === activeFilter
    );

    const sorted = [...base].sort((a, b) => {
      if (sortBy === "newest") {
        const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return bTime - aTime;
      }
      if (sortBy === "time") {
        return a.timeLeftMinutes - b.timeLeftMinutes;
      }
      if (sortBy === "fee") {
        return a.entryFeeValue - b.entryFeeValue;
      }
      return b.rewardValue - a.rewardValue;
    });

    return sorted;
  }, [activeFilter, sortBy, vaults]);

  const runningVaults = useMemo(
    () => vaults.filter((vault) => vault.vaultState === "running"),
    [vaults]
  );
  const hottestVault = useMemo(() => {
    if (!runningVaults.length) return null;
    return runningVaults.reduce(
      (max, v) => (v.progress > max.progress ? v : max),
      runningVaults[0]
    );
  }, [runningVaults]);
  const closingSoon = useMemo(() => {
    if (!runningVaults.length) return null;
    return runningVaults.reduce(
      (min, v) => (v.timeLeftMinutes < min.timeLeftMinutes ? v : min),
      runningVaults[0]
    );
  }, [runningVaults]);
  const highestReward = useMemo(() => {
    if (!runningVaults.length) return null;
    return runningVaults.reduce(
      (max, v) => (v.rewardValue > max.rewardValue ? v : max),
      runningVaults[0]
    );
  }, [runningVaults]);

  const handleScrollToVaults = () => {
    const section = document.getElementById("vaults");
    section?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const handleScrollToStats = () => {
    const section = document.getElementById("stats");
    section?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const showNotice = (message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice(null), 3000);
  };

  const loadVaults = async () => {
    setIsVaultsLoading(true);
    try {
      const response = await fetch("/api/vaults");
      if (!response.ok) {
        throw new Error("Failed to load vaults.");
      }
      const data = (await response.json()) as
        | { vaults: Vault[] }
        | Vault[];
      const nextVaults = Array.isArray(data) ? data : data.vaults;
      setVaults(Array.isArray(nextVaults) ? nextVaults : []);
      setVaultsError(null);
      if (crackVault) {
        const vaultArray = Array.isArray(data) ? data : data.vaults;
        const next = vaultArray.find((vault) => vault.id === crackVault.id);
        if (next) {
          setCrackVault(next);
          setRevealedChars(next.revealedKey);
        }
      }
    } catch (error) {
      showNotice("Unable to load vaults.");
      setVaultsError(
        error instanceof Error ? error.message : "Unable to load vaults."
      );
    } finally {
      setIsVaultsLoading(false);
    }
  };

  const connectWallet = async (): Promise<string | null> => {
    if (typeof window === "undefined") return null;
    const ethereum = (window as typeof window & { ethereum?: any }).ethereum;
    if (!ethereum) {
      showNotice("Wallet not found. Install a wallet extension to connect.");
      return null;
    }
    try {
      const accounts = await ethereum.request({
        method: "eth_requestAccounts",
      });
      const address = accounts?.[0] ?? null;
      setConnectedAccounts(Array.isArray(accounts) ? accounts : []);
      setWalletAddress(address);
      if (address) {
        window.localStorage.setItem("ctv-last-wallet", address);
        setIsWalletVerified(true);
        await fetchWalletBalance(address);
      } else {
        setWalletBalance(null);
        setIsWalletVerified(false);
      }
      showNotice("Wallet connected.");
      return address;
    } catch (error) {
      showNotice("Wallet connection cancelled.");
      return null;
    }
  };

  const loadConnectedAccounts = async () => {
    if (typeof window === "undefined") return;
    const ethereum = (window as typeof window & { ethereum?: any }).ethereum;
    if (!ethereum?.request) return;
    setIsAccountsLoading(true);
    try {
      const accounts = (await ethereum.request({
        method: "eth_accounts",
      })) as string[];
      setConnectedAccounts(Array.isArray(accounts) ? accounts : []);
    } catch {
      setConnectedAccounts([]);
    } finally {
      setIsAccountsLoading(false);
    }
  };

  const handleWalletButton = async () => {
    if (!walletAddress) {
      await connectWallet();
      return;
    }
    await loadConnectedAccounts();
    setAccountsOpen(true);
  };

  const handleSelectAccount = async (address: string) => {
    setWalletAddress(address);
    window.localStorage.setItem("ctv-last-wallet", address);
    setIsWalletVerified(true);
    await fetchWalletBalance(address);
    setAccountsOpen(false);
    showNotice("Wallet switched.");
  };

  const fetchWalletBalance = async (address: string) => {
    setIsBalanceLoading(true);
    try {
      const response = await fetch("/api/wallet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address }),
      });
      if (!response.ok) {
        throw new Error("Failed to load balance.");
      }
      const data = (await response.json()) as {
        balance?: number;
        isNew?: boolean;
      };
      const balance = typeof data.balance === "number" ? data.balance : 0;
      setWalletBalance(balance);
      setDemoCredits(balance);
      if (data.isNew) {
        setWelcomeAddress(address);
        setWelcomeOpen(true);
        showNotice("New wallet funded with $10,000 demo tokens.");
      }
    } catch (error) {
      showNotice("Unable to load wallet balance.");
    } finally {
      setIsBalanceLoading(false);
    }
  };

  useEffect(() => {
    loadVaults();
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    let cancelled = false;

    const waitForEthereum = async () => {
      for (let attempt = 0; attempt < 10; attempt += 1) {
        const ethereum = (window as typeof window & { ethereum?: any }).ethereum;
        if (ethereum?.request) return ethereum;
        await new Promise((resolve) => setTimeout(resolve, 250));
      }
      return null;
    };

    const reconnect = async () => {
      const ethereum = await waitForEthereum();
      if (!ethereum || cancelled) return;
      try {
        const accounts = (await ethereum.request({
          method: "eth_accounts",
        })) as string[];
        const address = accounts?.[0] ?? null;
        setConnectedAccounts(Array.isArray(accounts) ? accounts : []);
        if (address) {
          setWalletAddress(address);
          window.localStorage.setItem("ctv-last-wallet", address);
          setIsWalletVerified(true);
          fetchWalletBalance(address);
        } else {
          setWalletAddress(null);
          setIsWalletVerified(false);
        }
      } catch {
        // Ignore silent reconnect errors.
      }
    };

    reconnect();

    const handleAccountsChanged = (accounts: string[]) => {
      const address = accounts?.[0] ?? null;
      setConnectedAccounts(Array.isArray(accounts) ? accounts : []);
      setWalletAddress(address);
      if (address) {
        window.localStorage.setItem("ctv-last-wallet", address);
        setIsWalletVerified(true);
        fetchWalletBalance(address);
      } else {
        setWalletBalance(null);
        setDemoCredits(0);
        setIsWalletVerified(false);
      }
    };

    const ethereum = (window as typeof window & { ethereum?: any }).ethereum;
    ethereum?.on?.("accountsChanged", handleAccountsChanged);
    return () => {
      cancelled = true;
      ethereum?.removeListener?.("accountsChanged", handleAccountsChanged);
    };
  }, []);

  const requestSignature = async (action: string) => {
    if (typeof window === "undefined") return false;
    const ethereum = (window as typeof window & { ethereum?: any }).ethereum;
    if (!ethereum) {
      showNotice("Wallet not found. Install a wallet extension to connect.");
      return false;
    }
    const address = walletAddress ?? (await connectWallet());
    if (!address) return false;
    const message = `Crack The Vault Demo\\nAction: ${action}\\nTimestamp: ${new Date().toISOString()}`;
    try {
      await ethereum.request({
        method: "personal_sign",
        params: [message, address],
      });
      return true;
    } catch (error) {
      try {
        await ethereum.request({
          method: "personal_sign",
          params: [address, message],
        });
        return true;
      } catch (innerError) {
        showNotice("Signature declined.");
        return false;
      }
    }
  };

  const handleCreateVault = async () => {
    if (isDemo) {
      const ok = await requestSignature("Create Vault");
      if (!ok) return;
      const address = walletAddress ?? (await connectWallet());
      if (!address) return;
      try {
          const totalSeconds =
            (Number.parseInt(lockDays, 10) || 0) * 24 * 60 * 60 +
            (Number.parseInt(lockHours, 10) || 0) * 60 * 60 +
            (Number.parseInt(lockMins, 10) || 0) * 60 +
            (Number.parseInt(lockSecs, 10) || 0);
          const lockMinutes =
            totalSeconds > 0 ? Math.ceil(totalSeconds / 60) : 0;
          const payload = {
            address,
            name: vaultName.trim() || "Midnight Mirage",
            rewardValue: Number.parseFloat(rewardAmount) || 12.5,
            entryFeeValue: Number.parseFloat(trialFee) || 0.01,
            keyLength: Number.parseInt(keyLength, 10) || 6,
            lockMinutes,
          };
        const response = await fetch("/api/vaults", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!response.ok) {
          const data = (await response.json()) as { error?: string };
          throw new Error(data.error || "Failed to create vault.");
        }
        const data = (await response.json()) as {
          vault: Vault;
          balance: number;
        };
        setWalletBalance(data.balance);
        setDemoCredits(data.balance);
        if (data.vault) {
          setVaults((prev) => [data.vault, ...prev]);
        }
        setActiveFilter("All Vaults");
        await loadVaults();
        showNotice("Vault created.");
        setCreateOpen(false);
      } catch (error) {
        showNotice("Unable to create vault.");
      }
      return;
    }
    showNotice("Live mode coming soon.");
  };

  const handleSubmitGuess = async () => {
    const index =
      activeGuessIndex !== null
        ? activeGuessIndex
        : guessValues.findIndex((value) => value.trim().length > 0);
    if (index === -1) {
      showNotice("Pick a position to try.");
      setGuessFeedback({
        tone: "error",
        message: "Pick a position first.",
      });
      return;
    }
    const guess = guessValues[index]?.trim() ?? "";
    if (!guess) {
      showNotice("Enter a character to try.");
      setGuessFeedback({
        tone: "error",
        message: "Enter a character to try.",
      });
      return;
    }
    if (revealedChars[index]) {
      showNotice("That position is already revealed.");
      setGuessFeedback({
        tone: "info",
        message: "That slot is already revealed.",
      });
      return;
    }
    if (isDemo) {
      if (isGuessLoading) return;
      setIsGuessLoading(true);
      const ok = await requestSignature(
        `Crack Vault: ${crackVault?.name ?? "Unknown"} | Position ${
          index + 1
        } | Guess ${guess}`
      );
      if (!ok) {
        setGuessFeedback({
          tone: "error",
          message: "Signature declined. Try again.",
        });
        setIsGuessLoading(false);
        return;
      }
      const address = walletAddress ?? (await connectWallet());
      if (!address || !crackVault) {
        setGuessFeedback({
          tone: "error",
          message: "Connect your wallet to continue.",
        });
        setIsGuessLoading(false);
        return;
      }
      try {
        const response = await fetch(
          `/api/vaults/${crackVault.id}/guess`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              address,
              index,
              guess,
            }),
          }
        );
        if (!response.ok) {
          const data = (await response.json()) as { error?: string };
          throw new Error(data.error || "Failed to submit guess.");
        }
        const data = (await response.json()) as {
          vault: Vault;
          balance: number;
          correct: boolean;
        };
        setWalletBalance(data.balance);
        setDemoCredits(data.balance);
        setCrackVault(data.vault);
        setRevealedChars(data.vault.revealedKey);
        setGuessValues((prev) => {
          const next = [...prev];
          next[index] = "";
          return next;
        });
        setActiveGuessIndex(null);
        await loadVaults();
        if (data.vault.vaultState === "cracked") {
          setShowCrackedCelebration(true);
        }
        if (data.vault.vaultState === "cracked") {
          await fetchWalletBalance(address);
        }
        const cost = crackVault?.entryFee ?? "$0";
        const feedbackMessage = data.correct
          ? "Correct guess!"
          : "Oops, wrong guess. Try again.";
        setGuessFeedback({
          tone: data.correct ? "success" : "info",
          message: feedbackMessage,
        });
        showNotice(feedbackMessage);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Unable to submit guess.";
        setGuessFeedback({ tone: "error", message });
        showNotice(message);
      } finally {
        setIsGuessLoading(false);
      }
      return;
    }
    showNotice("Live mode coming soon.");
  };

  useEffect(() => {
    if (!crackVault) {
      setActiveGuessIndex(null);
      setGuessValues([]);
      setRevealedChars([]);
      setGuessFeedback(null);
      setShowCrackedCelebration(false);
      return;
    }
    const length = Number.parseInt(crackVault.keyLength, 10);
    const revealed = crackVault.revealedKey?.length
      ? crackVault.revealedKey.map((char) =>
          typeof char === "string" ? char.toLowerCase() : null
        )
      : Array.from({ length }, () => null);
    setRevealedChars(revealed);
    setActiveGuessIndex(null);
    setGuessValues(Array.from({ length }, () => ""));
  }, [crackVault]);

  useEffect(() => {
    if (!showCrackedCelebration) return;
    const timer = window.setTimeout(() => {
      setShowCrackedCelebration(false);
    }, 4000);
    return () => window.clearTimeout(timer);
  }, [showCrackedCelebration]);

  useEffect(() => {
    if (!vaults.length) return;
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const targetId = params.get("vault");
    if (!targetId) return;
    const target = vaults.find((vault) => vault.id === targetId);
    if (target) {
      setCrackVault(target);
    }
  }, [vaults]);

  const isCrackClosed = Boolean(
    crackVault &&
      (crackVault.vaultState !== "running" ||
        crackVault.timeLeftMinutes <= 0 ||
        revealedChars.every(Boolean))
  );

  return (
    <div
      className="relative min-h-screen overflow-hidden bg-black text-white"
      suppressHydrationWarning
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(225,29,72,0.25),transparent_55%)] ambient-float" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_60%,rgba(228,178,86,0.08),transparent_45%)] ambient-float-slow" />
      <div className="pointer-events-none absolute inset-0 opacity-60 [background-image:linear-gradient(120deg,rgba(255,255,255,0.06)_0%,transparent_30%,rgba(255,255,255,0.04)_70%,transparent_100%)] ambient-pulse" />

      <div className="relative mx-auto flex w-full max-w-6xl flex-col gap-14 px-6 pb-24 pt-10 fade-in-up">
        <header className="flex flex-wrap items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <div className="flex h-13 w-13 items-center justify-center rounded-full border border-red-500/40 bg-red-500/10 shadow-[0_0_25px_rgba(225,29,72,0.35)]">
              <Image
                src="/logo.png"
                alt="Crack The Vault"
                width={36}
                height={36}
                className="rounded-full h-full w-full "
                priority
              />
            </div>
            <div>
              <p className="text-sm uppercase tracking-[0.3em] text-red-300/70">
                Crack The Vault
              </p>
            </div>
          </div>
          <nav className="flex flex-wrap items-center gap-4 text-sm text-white/70">
            <button
              className={`rounded-full border border-white/15 px-4 py-2 text-white/80 transition hover:border-white/30 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 ${
                walletAddress ? "cursor-pointer" : "cursor-pointer"
              }`}
              onClick={handleWalletButton}
            >
              {isWalletVerified && walletAddress
                ? `Wallet ${walletAddress.slice(0, 6)}...${walletAddress.slice(
                    -4
                  )}`
                : "Connect Wallet"}
            </button>
            {walletAddress && isWalletVerified ? (
              <div className="flex items-center gap-2 rounded-full border border-amber-200/20 bg-amber-200/10 px-4 py-2 text-xs uppercase tracking-[0.2em] text-amber-100">
                <span className="text-[0.6rem] text-amber-100/70">Balance</span>
                <span className="text-sm font-semibold normal-case text-amber-50">
                  {isBalanceLoading
                    ? "Loading..."
                    : formatDollars(walletBalance ?? 0)}
                </span>
              </div>
            ) : null}
            <button
              type="button"
              disabled
              title="Live mode coming soon"
              className="group flex cursor-not-allowed items-center gap-3 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-[0.7rem] uppercase tracking-[0.3em] text-white/60 opacity-80"
              aria-disabled="true"
            >
              <span className={isDemo ? "text-white" : "text-white/50"}>
                Demo
              </span>
              <span className="relative flex h-6 w-12 items-center rounded-full border border-white/15 bg-black/40">
                <span
                  className={`absolute top-0.5 h-5 w-5 rounded-full shadow-[0_0_12px_rgba(225,29,72,0.45)] transition ${
                    isDemo
                      ? "left-0.5 bg-red-400"
                      : "left-6 bg-white/40"
                  }`}
                />
              </span>
              <span className={!isDemo ? "text-white" : "text-white/50"}>
                Live
              </span>
            </button>
          </nav>
        </header>

        <section className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="flex flex-col gap-8">
            <div className="inline-flex w-fit items-center gap-2 rounded-full border border-red-500/30 bg-red-500/10 px-4 py-2 text-xs uppercase tracking-[0.35em] text-red-200 shadow-[0_0_20px_rgba(225,29,72,0.2)]">
              {isDemo ? "Demo Vaults" : "Jackpot Live"}
              <span className="h-2 w-2 rounded-full bg-red-400 shadow-[0_0_12px_rgba(225,29,72,0.8)]" />
            </div>
            <div className="space-y-5">
              <h1 className="font-[var(--font-heading)] text-4xl leading-tight text-white sm:text-5xl">
                Unlock the vault together.
                <span className="block text-red-200">Claim the jackpot.</span>
              </h1>
              <p className="max-w-xl text-lg text-white/70">
                Crack-The-Vault is a collaborative Web3 puzzle arena. Players
                test key characters, reveal progress, and share the reward pool
                when the vault opens before the clock hits zero.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-3" id="stats">
              {[
                {
                  label: "Active Vaults",
                  value: String(
                    vaults.filter(
                      (vault) =>
                        vault.vaultState !== "ended" &&
                        vault.vaultState !== "cracked"
                    ).length
                  ),
                },
                {
                  label: "Total Vault Volume",
                  value: formatDollars(totalVaultVolume),
                },
                { label: "Crackers Online", value: "4,892" },
              ].map((stat) => (
                <div
                  key={stat.label}
                  className="rounded-2xl border border-white/10 bg-white/5 px-4 py-5"
                >
                  <p className="text-xs uppercase tracking-[0.2em] text-white/50">
                    {stat.label}
                  </p>
                  <p className="mt-3 text-2xl font-semibold text-white">
                    {stat.value}
                  </p>
                </div>
              ))}
            </div>
            <div className="flex flex-wrap gap-4">
              <button
                className="cursor-pointer rounded-full bg-red-500 px-6 py-3 text-sm font-semibold text-white shadow-[0_0_30px_rgba(225,29,72,0.45)] transition hover:-translate-y-0.5 hover:bg-red-400 hover:shadow-[0_0_40px_rgba(225,29,72,0.6)] active:translate-y-0 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300/70"
                onClick={handleScrollToVaults}
              >
                Start Cracking
              </button>
              <Link
                href="/how-it-works"
                className="cursor-pointer rounded-full border border-white/15 px-6 py-3 text-sm font-semibold text-white/80 transition hover:-translate-y-0.5 hover:border-white/30 hover:text-white active:translate-y-0 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
              >
                How It Works
              </Link>
            </div>
          </div>

          <div className="rounded-3xl border border-red-500/30 bg-gradient-to-br from-[#1a0c15] via-[#12090f] to-[#0c0b10] p-7 shadow-[0_30px_120px_rgba(0,0,0,0.45)] transition hover:-translate-y-1 hover:shadow-[0_40px_140px_rgba(0,0,0,0.6)]">
            <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-[0.7rem] uppercase tracking-[0.35em] text-red-300/60">
                  Vault Intel
                </p>
                <h2 className="mt-3 font-[var(--font-heading)] text-2xl leading-snug text-white">
                  Actionable vault signals
                </h2>
                <p className="mt-2 text-sm leading-6 text-white/60">
                  Make faster decisions with what matters now.
                </p>
              </div>
              <div className="rounded-full border border-red-400/30 bg-red-500/10 px-3 py-1 text-[0.65rem] uppercase tracking-[0.3em] text-red-100">
                Fee 2.5%
              </div>
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-black/40 px-5 py-5 transition hover:border-white/20 hover:bg-white/5">
                <p className="text-[0.7rem] uppercase tracking-[0.3em] text-white/50">
                  Hottest Vault
                </p>
                <div className="mt-4 flex items-center justify-between gap-3">
                  <p className="text-lg font-semibold text-white">
                    {hottestVault ? hottestVault.name : "No active vaults"}
                  </p>
                  <span className="whitespace-nowrap rounded-full border border-red-400/30 bg-red-500/10 px-3 py-1 text-xs text-red-100">
                    {hottestVault ? `${hottestVault.progress}% solved` : "--"}
                  </span>
                </div>
                <div className="mt-4 h-2 w-full rounded-full bg-white/10">
                  <div
                    className="h-2 rounded-full bg-gradient-to-r from-red-500 via-red-400 to-amber-300"
                    style={{
                      width: `${hottestVault ? hottestVault.progress : 0}%`,
                    }}
                  />
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/40 px-5 py-5 transition hover:border-white/20 hover:bg-white/5">
                <p className="text-[0.7rem] uppercase tracking-[0.3em] text-white/50">
                  Closing Soon
                </p>
                <div className="mt-4 flex items-center justify-between gap-3">
                  <p className="text-lg font-semibold text-white">
                    {closingSoon ? closingSoon.name : "No active vaults"}
                  </p>
                  <span className="whitespace-nowrap text-sm text-white/70">
                    {closingSoon ? `${closingSoon.timeLeft} left` : "--"}
                  </span>
                </div>
                <p className="mt-3 text-sm leading-6 text-white/60">
                  {closingSoon
                    ? `Entry ${closingSoon.entryFee} · Reward ${closingSoon.reward}`
                    : "Entry -- · Reward --"}
                </p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/40 px-5 py-5 transition hover:border-white/20 hover:bg-white/5">
                <p className="text-[0.7rem] uppercase tracking-[0.3em] text-white/50">
                  Highest Reward
                </p>
                <div className="mt-4 flex items-center justify-between gap-3">
                  <p className="text-lg font-semibold text-white">
                    {highestReward ? highestReward.name : "No active vaults"}
                  </p>
                  <span className="whitespace-nowrap text-sm text-white/70">
                    {highestReward ? highestReward.reward : "--"}
                  </span>
                </div>
                <p className="mt-3 text-sm leading-6 text-white/60">
                  {highestReward
                    ? `${highestReward.slots} · ${highestReward.timeLeft} left`
                    : "--"}
                </p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/40 px-5 py-5 transition hover:border-white/20 hover:bg-white/5">
                <p className="text-[0.7rem] uppercase tracking-[0.3em] text-white/50">
                  Recently Cracked
                </p>
                <div className="mt-4 grid gap-3 text-sm text-white/70">
                  {recentCracked.length ? (
                    recentCracked.map((item) => (
                    <div
                      key={item.name}
                      className="flex items-center justify-between"
                    >
                      <span>{item.name}</span>
                      <span className="whitespace-nowrap text-white/50">
                        {item.reward} · {item.time}
                      </span>
                    </div>
                    ))
                  ) : (
                    <p className="text-white/50">No cracked vaults yet.</p>
                  )}
                </div>
              </div>
            </div>
            <div className="mt-6">
              <button
                className="w-full cursor-pointer rounded-2xl bg-red-500 py-3 text-sm font-semibold text-white shadow-[0_0_35px_rgba(225,29,72,0.45)] transition hover:-translate-y-0.5 hover:bg-red-400 hover:shadow-[0_0_45px_rgba(225,29,72,0.6)] active:translate-y-0 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300/70"
                onClick={() => setCreateOpen(true)}
              >
                Create a Vault
              </button>
            </div>
          </div>
        </section>

        <section id="vaults" className="flex flex-col gap-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-red-300/60">
                Vault Floor
              </p>
              <h2 className="font-[var(--font-heading)] text-3xl">
                Live vaults to crack
              </h2>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              {filters.map((filter) => (
                <button
                  key={filter}
                  onClick={() => setActiveFilter(filter)}
                  className={`cursor-pointer rounded-full border px-4 py-2 text-xs uppercase tracking-[0.2em] transition hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300/50 ${
                    filter === activeFilter
                      ? "border-red-400 bg-red-500/20 text-red-100"
                      : "border-white/10 text-white/60 hover:border-white/30 hover:text-white"
                  }`}
                >
                  {filter}
                </button>
              ))}
              <Link
                href="/how-it-works"
                className="cursor-pointer rounded-full border border-white/15 px-4 py-2 text-xs uppercase tracking-[0.2em] text-white/70 transition hover:-translate-y-0.5 hover:border-white/30 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
              >
                How It Works
              </Link>
            </div>
          </div>

          <div className="grid gap-4 rounded-3xl border border-white/10 bg-white/5 p-5">
            <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr_1fr_1fr]">
              <div className="rounded-2xl border border-white/10 bg-black/40 px-4 py-3 transition hover:border-white/20 hover:bg-white/5">
                <p className="text-xs uppercase tracking-[0.2em] text-white/50">
                  Active Vaults
                </p>
                <p className="mt-2 text-sm text-white/80">
                  {String(
                    vaults.filter(
                      (vault) =>
                        vault.vaultState !== "ended" &&
                        vault.vaultState !== "cracked"
                    ).length
                  )}
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/40 px-4 py-3 transition hover:border-white/20 hover:bg-white/5">
                <p className="text-xs uppercase tracking-[0.2em] text-white/50">
                  Total Reward Pool
                </p>
                <p className="mt-2 text-sm text-white/80">
                  {formatDollars(totalVaultVolume)}
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/40 px-4 py-3 transition hover:border-white/20 hover:bg-white/5">
                <p className="text-xs uppercase tracking-[0.2em] text-white/50">
                  Closing Soon
                </p>
                <p className="mt-2 text-sm text-white/80">
                  {closingSoon ? `${closingSoon.timeLeft} left` : "--"}
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/40 px-4 py-3 transition hover:border-white/20 hover:bg-white/5">
                <p className="text-xs uppercase tracking-[0.2em] text-white/50">
                  Sort By
                </p>
                <div
                  className="relative mt-2 group"
                  tabIndex={0}
                  onBlur={(event) => {
                    const next = event.relatedTarget as Node | null;
                    if (!next || !event.currentTarget.contains(next)) {
                      setIsSortOpen(false);
                    }
                  }}
                >
                  <div className="pointer-events-none absolute -inset-1 rounded-full bg-[radial-gradient(circle_at_top,rgba(239,68,68,0.35),transparent_60%)] opacity-0 blur-md transition duration-300 group-hover:opacity-100" />
                  <div className="pointer-events-none absolute inset-0 rounded-full border border-red-400/30 bg-gradient-to-r from-red-500/20 via-amber-200/10 to-transparent transition duration-300 group-hover:border-red-300/70 group-hover:shadow-[0_0_22px_rgba(225,29,72,0.35)]" />
                  <button
                    type="button"
                    className="relative flex w-full items-center justify-between rounded-full border border-red-400/30 bg-gradient-to-r from-black/80 via-black/70 to-black/60 px-4 py-2 text-xs uppercase tracking-[0.28em] text-red-50 transition-all duration-300 ease-out hover:-translate-y-1 hover:border-red-300/70 hover:shadow-[0_16px_40px_rgba(0,0,0,0.55)] focus:-translate-y-1 focus:border-red-300/90 focus:outline-none focus:ring-2 focus:ring-red-300/40"
                    onClick={() => setIsSortOpen((value) => !value)}
                    aria-haspopup="listbox"
                    aria-expanded={isSortOpen}
                  >
                    <span>
                      {sortOptions.find((option) => option.value === sortBy)
                        ?.label ?? "Sort"}
                    </span>
                    <span
                      className={`ml-3 text-red-200/70 transition duration-300 ${
                        isSortOpen ? "-rotate-180 text-red-100" : ""
                      }`}
                    >
                      <svg
                        width="12"
                        height="12"
                        viewBox="0 0 24 24"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <path
                          d="M6 9L12 15L18 9"
                          stroke="currentColor"
                          strokeWidth="1.8"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </span>
                  </button>
                  {isSortOpen ? (
                    <div
                      className="absolute left-0 right-0 top-full z-10 mt-3 overflow-hidden rounded-2xl border border-red-400/30 bg-black/90 shadow-[0_24px_60px_rgba(0,0,0,0.6)] backdrop-blur"
                      role="listbox"
                    >
                      {sortOptions.map((option) => {
                        const isActive = option.value === sortBy;
                        return (
                          <button
                            key={option.value}
                            type="button"
                            className={`flex w-full cursor-pointer items-center justify-between px-4 py-3 text-left text-xs uppercase tracking-[0.25em] transition ${
                              isActive
                                ? "bg-red-500/15 text-red-100"
                                : "text-white/70 hover:bg-white/5 hover:text-white"
                            }`}
                            onClick={() => {
                              setSortBy(option.value);
                              setIsSortOpen(false);
                            }}
                            role="option"
                            aria-selected={isActive}
                          >
                            <span>{option.label}</span>
                            {isActive ? (
                              <span className="text-[0.6rem] uppercase tracking-[0.3em] text-red-200/80">
                                Active
                              </span>
                            ) : null}
                          </button>
                        );
                      })}
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-4">
            {vaultsError ? (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-100">
                <span>{vaultsError}</span>
                <button
                  className="cursor-pointer rounded-full border border-red-200/40 px-3 py-1 text-xs text-red-100 transition hover:border-red-100 hover:text-white"
                  onClick={loadVaults}
                >
                  Retry
                </button>
              </div>
            ) : null}
            {isVaultsLoading && !vaults.length ? (
              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-6 text-sm text-white/60">
                Loading vaults...
              </div>
            ) : null}
            {filteredVaults.map((vault) => (
              <div
                key={vault.id}
                className="rounded-3xl border border-white/10 bg-gradient-to-r from-white/5 via-white/2 to-transparent p-5 transition hover:-translate-y-1 hover:border-white/20 hover:bg-white/5 hover:shadow-[0_20px_60px_rgba(0,0,0,0.45)]"
              >
                <div className="flex flex-wrap items-center justify-between gap-6">
                  <div className="space-y-2">
                    <div className="flex items-center gap-3">
                      <h3 className="font-[var(--font-heading)] text-2xl">
                        {vault.name}
                      </h3>
                      <span className="rounded-full border border-red-400/30 bg-red-500/10 px-3 py-1 text-xs text-red-100">
                        {vault.status}
                      </span>
                    </div>
                    <p className="text-sm text-white/60">
                      Key length {vault.keyLength} · {vault.slots}
                    </p>
                    <p className="text-xs text-white/50">
                      Initial lock: {vault.initialLocked}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-6">
                    <div>
                      <p className="text-xs uppercase tracking-[0.2em] text-white/50">
                        Reward Pool
                      </p>
                      <p className="mt-2 text-lg font-semibold text-white">
                        {vault.reward}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-[0.2em] text-white/50">
                        Entry Fee
                      </p>
                      <p className="mt-2 text-lg font-semibold text-white">
                        {vault.entryFee}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-[0.2em] text-white/50">
                        {vault.vaultState === "running" ? "Time Left" : "Outcome"}
                      </p>
                      <p className="mt-2 text-lg font-semibold text-white">
                        {vault.vaultState === "running" ? vault.timeLeft : vault.status}
                      </p>
                    </div>
                    {vault.vaultState === "running" ? (
                      <div className="flex flex-col items-start gap-2">
                        <button
                          className="cursor-pointer rounded-full bg-red-500 px-5 py-2 text-sm font-semibold text-white shadow-[0_0_25px_rgba(225,29,72,0.35)] transition hover:-translate-y-0.5 hover:bg-red-400 hover:shadow-[0_0_35px_rgba(225,29,72,0.55)] active:translate-y-0 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300/70"
                          onClick={() => setCrackVault(vault)}
                        >
                          Crack
                        </button>
                        <Link
                          href={`/?vault=${vault.id}`}
                          className="text-[0.65rem] uppercase tracking-[0.25em] text-white/60 transition hover:text-white"
                          onClick={() => setCrackVault(vault)}
                        >
                          Open Vault
                        </Link>
                      </div>
                    ) : (
                      <button className="cursor-default rounded-full border border-white/10 bg-white/5 px-5 py-2 text-sm font-semibold text-white/50">
                        Closed
                      </button>
                    )}
                  </div>
                </div>
                <div className="mt-4">
                  <div className="flex items-center justify-between text-xs text-white/50">
                    <span>Progress</span>
                    <span>{vault.progress}%</span>
                  </div>
                  <div className="mt-2 h-2 w-full rounded-full bg-white/10">
                    <div
                      className="h-2 rounded-full bg-gradient-to-r from-red-500 via-red-400 to-amber-300"
                      style={{ width: `${vault.progress}%` }}
                    />
                  </div>
                </div>
                <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                  <p className="text-[0.75rem] uppercase tracking-[0.2em] text-white/50">
                    Contributors
                  </p>
                  {vault.revealOrder && vault.revealOrder.length ? (
                    <div className="mt-3 grid gap-2 text-sm text-white/80">
                      {(() => {
                        const length = Number.parseInt(vault.keyLength, 10) || 0;
                        const shares = buildRewardShares(length);
                        const payoutMap = new Map<
                          string,
                          { amount: number; share: number }
                        >();
                        vault.revealOrder.forEach((entry, index) => {
                          const share = shares[index] ?? 0;
                          const amount = (vault.rewardValue || 0) * share;
                          const prev = payoutMap.get(entry.address);
                          payoutMap.set(entry.address, {
                            amount: (prev?.amount ?? 0) + amount,
                            share: (prev?.share ?? 0) + share,
                          });
                        });
                        const entries = Array.from(payoutMap.entries());
                        return entries.map(([address, payout]) => {
                          const resolved = payout ?? {
                            amount: 0,
                            share: 0,
                          };
                          return (
                            <div
                              key={`${vault.id}-${address}`}
                              className="flex items-center justify-between"
                            >
                              <span className="font-mono text-xs text-white/80">
                                {address.slice(0, 6)}...{address.slice(-4)}
                              </span>
                              <span className="text-white/70">
                                {(resolved.share * 100).toFixed(1)}% ·{" "}
                                {formatDollars(resolved.amount)}
                              </span>
                            </div>
                          );
                        });
                      })()}
                    </div>
                  ) : (
                    <p className="mt-2 text-sm text-white/60">
                      No contributors yet.
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>

      </div>

      {accountsOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-6 py-10 backdrop-blur-sm"
          onClick={() => setAccountsOpen(false)}
        >
          <div
            className="relative w-full max-w-md rounded-3xl border border-red-500/30 bg-gradient-to-br from-[#16070f] via-[#12090f] to-[#0c0b10] p-6 text-white shadow-[0_30px_120px_rgba(0,0,0,0.6)] fade-in-up-delay"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              className="absolute right-5 top-5 cursor-pointer rounded-full border border-white/10 px-3 py-1 text-xs text-white/60 transition hover:border-white/30 hover:text-white"
              onClick={() => setAccountsOpen(false)}
            >
              Close
            </button>
            <div className="mb-4 space-y-2">
              <p className="text-xs uppercase tracking-[0.3em] text-red-300/60">
                Connected Accounts
              </p>
              <h2 className="font-[var(--font-heading)] text-2xl text-white">
                Switch wallet
              </h2>
              <p className="text-sm text-white/60">
                Choose a connected address. If signatures fail, switch inside
                your wallet too.
              </p>
            </div>
            <div className="grid gap-3">
              {isAccountsLoading ? (
                <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/60">
                  Loading accounts...
                </div>
              ) : connectedAccounts.length ? (
                connectedAccounts.map((account) => {
                  const isActive =
                    account.toLowerCase() ===
                    (walletAddress ?? "").toLowerCase();
                  return (
                    <button
                      key={account}
                      className={`flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left text-sm transition ${
                        isActive
                          ? "border-red-400/50 bg-red-500/10 text-white"
                          : "border-white/10 bg-white/5 text-white/80 hover:border-white/20 hover:bg-white/10"
                      }`}
                      onClick={() => handleSelectAccount(account)}
                    >
                      <span className="font-mono text-xs">
                        {account.slice(0, 8)}...{account.slice(-6)}
                      </span>
                      {isActive ? (
                        <span className="rounded-full border border-red-400/40 px-2 py-0.5 text-[0.65rem] uppercase tracking-[0.2em] text-red-200">
                          Active
                        </span>
                      ) : (
                        <span className="text-[0.65rem] uppercase tracking-[0.2em] text-white/50">
                          Switch
                        </span>
                      )}
                    </button>
                  );
                })
              ) : (
                <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/60">
                  No connected accounts found. Open your wallet and connect.
                </div>
              )}
              <button
                className="mt-2 w-full cursor-pointer rounded-2xl border border-white/15 bg-white/5 py-3 text-xs uppercase tracking-[0.3em] text-white/70 transition hover:border-white/30 hover:text-white"
                onClick={loadConnectedAccounts}
              >
                Refresh
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {welcomeOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-6 py-10 backdrop-blur-sm"
          onClick={() => setWelcomeOpen(false)}
        >
          <div
            className="relative w-full max-w-lg rounded-3xl border border-red-500/30 bg-gradient-to-br from-[#16070f] via-[#12090f] to-[#0c0b10] p-6 text-white shadow-[0_30px_120px_rgba(0,0,0,0.6)] fade-in-up-delay"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              className="absolute right-5 top-5 cursor-pointer rounded-full border border-white/10 px-3 py-1 text-xs text-white/60 transition hover:border-white/30 hover:text-white"
              onClick={() => setWelcomeOpen(false)}
            >
              Close
            </button>
            <div className="space-y-4">
              <p className="text-xs uppercase tracking-[0.3em] text-red-300/60">
                Welcome Bonus
              </p>
              <h2 className="font-[var(--font-heading)] text-2xl">
                First connect bonus unlocked
              </h2>
              <p className="text-sm text-white/70">
                You just snagged $10,000 in free play tokens. One-time bonus per
                wallet, so make it count.
              </p>
              <button
                className="mt-2 w-full cursor-pointer rounded-2xl bg-red-500 py-3 text-sm font-semibold text-white shadow-[0_0_35px_rgba(225,29,72,0.45)] transition hover:-translate-y-0.5 hover:bg-red-400 hover:shadow-[0_0_45px_rgba(225,29,72,0.6)] active:translate-y-0 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300/70"
                onClick={() => setWelcomeOpen(false)}
              >
                Play
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {createOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-6 py-10 backdrop-blur-sm"
          onClick={() => setCreateOpen(false)}
        >
          <div
            className="relative w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-3xl border border-red-500/30 bg-gradient-to-br from-[#1a0c15] via-[#12090f] to-[#0c0b10] p-6 shadow-[0_30px_120px_rgba(0,0,0,0.6)] fade-in-up-delay"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              className="absolute right-5 top-5 cursor-pointer rounded-full border border-white/10 px-3 py-1 text-xs text-white/60 transition hover:border-white/30 hover:text-white"
              onClick={() => setCreateOpen(false)}
            >
              Close
            </button>
            <div className="mb-5 space-y-2">
              <p className="text-xs uppercase tracking-[0.3em] text-red-300/60">
                Create Vault
              </p>
              <h2 className="font-[var(--font-heading)] text-2xl text-white">
                Launch a new vault
              </h2>
              <p className="text-sm text-white/60">
                Set the prize, lock time, and key length. We’ll auto‑generate
                the key.
              </p>
            </div>
            <div className="grid gap-4">
              <div className="grid gap-2">
                <label className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-white/50">
                  Vault Name
                  <span
                    className="group relative inline-flex h-4 w-4 cursor-pointer items-center justify-center rounded-full border border-white/20 text-[0.6rem] text-white/60"
                    aria-label="Vault name help"
                  >
                    ?
                    <span className="pointer-events-none absolute left-1/2 bottom-full z-10 mb-2 w-48 -translate-x-1/2 rounded-lg border border-white/10 bg-black/90 px-2 py-1 text-[0.65rem] text-white/80 opacity-0 shadow-lg transition group-hover:opacity-100">
                      Give your vault a unique name.
                    </span>
                  </span>
                </label>
                  <input
                    className="h-11 rounded-2xl border border-white/10 bg-black/50 px-4 text-sm text-white placeholder:text-white/30 transition focus:border-red-400/60 focus:outline-none focus:ring-2 focus:ring-red-300/40"
                    placeholder="Midnight Mirage"
                    value={vaultName}
                    onChange={(event) => setVaultName(event.target.value)}
                  />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-2">
                  <label className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-white/50">
                    Reward Amount
                    <span
                      className="group relative inline-flex h-4 w-4 cursor-pointer items-center justify-center rounded-full border border-white/20 text-[0.6rem] text-white/60"
                      aria-label="Reward amount help"
                    >
                      ?
                      <span className="pointer-events-none absolute left-1/2 bottom-full z-10 mb-2 w-56 -translate-x-1/2 rounded-lg border border-white/10 bg-black/90 px-2 py-1 text-[0.65rem] text-white/80 opacity-0 shadow-lg transition group-hover:opacity-100">
                        Total reward pool for cracking this vault.
                      </span>
                    </span>
                  </label>
                  <input
                    className="h-11 rounded-2xl border border-white/10 bg-black/50 px-4 text-sm text-white placeholder:text-white/30 transition focus:border-red-400/60 focus:outline-none focus:ring-2 focus:ring-red-300/40"
                    placeholder="$12.5"
                    value={rewardAmount}
                    onChange={(event) => setRewardAmount(event.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <label className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-white/50">
                    Trial Fee
                    <span
                      className="group relative inline-flex h-4 w-4 cursor-pointer items-center justify-center rounded-full border border-white/20 text-[0.6rem] text-white/60"
                      aria-label="Trial fee help"
                    >
                      ?
                      <span className="pointer-events-none absolute left-1/2 bottom-full z-10 mb-2 w-44 -translate-x-1/2 rounded-lg border border-white/10 bg-black/90 px-2 py-1 text-[0.65rem] text-white/80 opacity-0 shadow-lg transition group-hover:opacity-100">
                        Cost per guess for players.
                      </span>
                    </span>
                  </label>
                  <input
                    className="h-11 rounded-2xl border border-white/10 bg-black/50 px-4 text-sm text-white placeholder:text-white/30 transition focus:border-red-400/60 focus:outline-none focus:ring-2 focus:ring-red-300/40"
                    placeholder="$0.01"
                    value={trialFee}
                    onChange={(event) => setTrialFee(event.target.value)}
                  />
                </div>
              </div>
              <div className="grid gap-2">
              <label className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-white/50">
                Key Length
                <span
                  className="group relative inline-flex h-4 w-4 cursor-pointer items-center justify-center rounded-full border border-white/20 text-[0.6rem] text-white/60"
                  aria-label="Key length help"
                >
                  ?
                  <span className="pointer-events-none absolute left-1/2 bottom-full z-10 mb-2 w-44 -translate-x-1/2 rounded-lg border border-white/10 bg-black/90 px-2 py-1 text-[0.65rem] text-white/80 opacity-0 shadow-lg transition group-hover:opacity-100">
                    Longer keys are harder to crack.
                  </span>
                </span>
              </label>
                <div
                  className="relative group"
                  tabIndex={0}
                  onBlur={(event) => {
                    const next = event.relatedTarget as Node | null;
                    if (!next || !event.currentTarget.contains(next)) {
                      setIsKeyLengthOpen(false);
                    }
                  }}
                >
                  <div className="pointer-events-none absolute -inset-1 rounded-2xl bg-[radial-gradient(circle_at_top,rgba(239,68,68,0.35),transparent_60%)] opacity-0 blur-md transition duration-300 group-hover:opacity-100" />
                  <div className="pointer-events-none absolute inset-0 rounded-2xl border border-red-400/30 bg-gradient-to-br from-red-500/20 via-transparent to-amber-200/10 transition duration-300 group-hover:border-red-300/70 group-hover:shadow-[0_0_22px_rgba(225,29,72,0.35)]" />
                  <button
                    type="button"
                    className="relative flex h-11 w-full items-center justify-between rounded-2xl border border-red-400/30 bg-gradient-to-r from-black/80 via-black/70 to-black/60 px-4 text-sm text-red-50 transition-all duration-300 ease-out hover:-translate-y-1 hover:border-red-300/70 hover:shadow-[0_16px_40px_rgba(0,0,0,0.55)] focus:-translate-y-1 focus:border-red-300/90 focus:outline-none focus:ring-2 focus:ring-red-300/40"
                    onClick={() => setIsKeyLengthOpen((value) => !value)}
                    aria-haspopup="listbox"
                    aria-expanded={isKeyLengthOpen}
                  >
                    <span>{keyLength} characters</span>
                    <span
                      className={`ml-3 text-red-200/70 transition duration-300 ${
                        isKeyLengthOpen ? "-rotate-180 text-red-100" : ""
                      }`}
                    >
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <path
                          d="M6 9L12 15L18 9"
                          stroke="currentColor"
                          strokeWidth="1.8"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </span>
                  </button>
                  {isKeyLengthOpen ? (
                    <div
                      className="absolute left-0 right-0 top-full z-10 mt-3 max-h-64 overflow-auto rounded-2xl border border-red-400/30 bg-black/90 shadow-[0_24px_60px_rgba(0,0,0,0.6)] backdrop-blur"
                      role="listbox"
                    >
                      {Array.from({ length: 13 }, (_, index) => index + 4).map(
                        (value) => {
                          const isActive = String(value) === keyLength;
                          return (
                            <button
                              key={value}
                              type="button"
                              className={`flex w-full cursor-pointer items-center justify-between px-4 py-3 text-left text-xs uppercase tracking-[0.25em] transition ${
                                isActive
                                  ? "bg-red-500/15 text-red-100"
                                  : "text-white/70 hover:bg-white/5 hover:text-white"
                              }`}
                              onClick={() => {
                                setKeyLength(String(value));
                                setIsKeyLengthOpen(false);
                              }}
                              role="option"
                              aria-selected={isActive}
                            >
                              <span>{value} characters</span>
                              {isActive ? (
                                <span className="text-[0.6rem] uppercase tracking-[0.3em] text-red-200/80">
                                  Active
                                </span>
                              ) : null}
                            </button>
                          );
                        }
                      )}
                    </div>
                  ) : null}
                </div>
              </div>
              <div className="grid gap-2">
                <label className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-white/50">
                  Lock Period
                  <span
                  className="group relative inline-flex h-4 w-4 cursor-pointer items-center justify-center rounded-full border border-white/20 text-[0.6rem] text-white/60"
                  aria-label="Lock period help"
                >
                  ?
                  <span className="pointer-events-none absolute left-1/2 bottom-full z-10 mb-2 w-52 -translate-x-1/2 rounded-lg border border-white/10 bg-black/90 px-2 py-1 text-[0.65rem] text-white/80 opacity-0 shadow-lg transition group-hover:opacity-100">
                    How long the vault stays open before it ends.
                  </span>
                </span>
                </label>
                <div className="grid grid-cols-4 gap-2">
                  <div className="flex flex-col gap-1">
                    <span className="text-[0.65rem] uppercase tracking-[0.25em] text-white/40">
                      Days
                    </span>
                    <input
                      className="h-11 rounded-2xl border border-white/10 bg-black/50 px-3 text-sm text-white placeholder:text-white/30 transition focus:border-red-400/60 focus:outline-none focus:ring-2 focus:ring-red-300/40"
                      placeholder="0"
                      value={lockDays}
                      onChange={(event) => setLockDays(event.target.value)}
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-[0.65rem] uppercase tracking-[0.25em] text-white/40">
                      Hours
                    </span>
                    <input
                      className="h-11 rounded-2xl border border-white/10 bg-black/50 px-3 text-sm text-white placeholder:text-white/30 transition focus:border-red-400/60 focus:outline-none focus:ring-2 focus:ring-red-300/40"
                      placeholder="12"
                      value={lockHours}
                      onChange={(event) => setLockHours(event.target.value)}
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-[0.65rem] uppercase tracking-[0.25em] text-white/40">
                      Mins
                    </span>
                    <input
                      className="h-11 rounded-2xl border border-white/10 bg-black/50 px-3 text-sm text-white placeholder:text-white/30 transition focus:border-red-400/60 focus:outline-none focus:ring-2 focus:ring-red-300/40"
                      placeholder="00"
                      value={lockMins}
                      onChange={(event) => setLockMins(event.target.value)}
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-[0.65rem] uppercase tracking-[0.25em] text-white/40">
                      Secs
                    </span>
                    <input
                      className="h-11 rounded-2xl border border-white/10 bg-black/50 px-3 text-sm text-white placeholder:text-white/30 transition focus:border-red-400/60 focus:outline-none focus:ring-2 focus:ring-red-300/40"
                      placeholder="00"
                      value={lockSecs}
                      onChange={(event) => setLockSecs(event.target.value)}
                    />
                  </div>
                </div>
              </div>
              <button
                className="mt-1 cursor-pointer rounded-2xl bg-red-500 py-3 text-sm font-semibold text-white shadow-[0_0_35px_rgba(225,29,72,0.45)] transition hover:-translate-y-0.5 hover:bg-red-400 hover:shadow-[0_0_45px_rgba(225,29,72,0.6)] active:translate-y-0 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300/70"
                onClick={handleCreateVault}
              >
                {isDemo ? "Create Demo Vault" : "Create Vault"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {crackVault ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-6 py-10 backdrop-blur-sm"
          onClick={() => setCrackVault(null)}
        >
          <div
            className="relative w-full max-w-2xl rounded-3xl border border-red-500/30 bg-gradient-to-br from-[#12060d] via-[#12090f] to-[#0c0b10] p-6 shadow-[0_30px_120px_rgba(0,0,0,0.6)] fade-in-up-delay"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              className="absolute right-5 top-5 cursor-pointer rounded-full border border-white/10 px-3 py-1 text-xs text-white/60 transition hover:border-white/30 hover:text-white"
              onClick={() => setCrackVault(null)}
            >
              Close
            </button>
            <div className="mb-6">
              <p className="text-xs uppercase tracking-[0.3em] text-red-300/60">
                Crack Vault
              </p>
              <h2 className="font-[var(--font-heading)] text-2xl text-white">
                {crackVault.name}
              </h2>
              <p className="mt-2 text-sm text-white/60">
                Reward pool {crackVault.reward} · Entry fee{" "}
                {crackVault.entryFee}
              </p>
            </div>
            {showCrackedCelebration ? (
              <div className="relative mb-4 overflow-hidden rounded-2xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
                <div className="absolute inset-0 opacity-60">
                  <div className="absolute -top-6 left-6 h-12 w-12 animate-ping rounded-full bg-emerald-400/20" />
                  <div className="absolute top-2 right-10 h-10 w-10 animate-ping rounded-full bg-emerald-300/20 [animation-delay:200ms]" />
                  <div className="absolute bottom-0 left-1/2 h-10 w-10 -translate-x-1/2 animate-ping rounded-full bg-amber-300/20 [animation-delay:400ms]" />
                </div>
                <div className="relative flex items-center justify-between gap-3">
                  <span className="font-semibold">
                    Vault cracked! Rewards are being distributed.
                  </span>
                  <span className="rounded-full border border-emerald-300/40 px-3 py-1 text-[0.65rem] uppercase tracking-[0.3em] text-emerald-200">
                    Vault Opened
                  </span>
                </div>
              </div>
            ) : null}
            <div className="grid gap-4">
              <div className="grid gap-3">
                <label className="text-xs uppercase tracking-[0.2em] text-white/50">
                  Choose a Position
                </label>
                <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(48px,1fr))]">
                  {Array.from(
                    {
                      length: Number.parseInt(
                        crackVault?.keyLength ?? "0",
                        10
                      ),
                    },
                    (_, index) => {
                      const filledIndex = guessValues.findIndex(
                        (value) => value.trim().length > 0
                      );
                      const hasActiveValue =
                        activeGuessIndex !== null &&
                        (guessValues[activeGuessIndex] ?? "").trim().length > 0;
                      const lockIndex =
                        hasActiveValue
                          ? activeGuessIndex
                          : filledIndex !== -1
                          ? filledIndex
                          : null;
                      const revealed = Boolean(revealedChars[index]);
                      const isLocked =
                        lockIndex !== null && lockIndex !== index;
                      const isActive = activeGuessIndex === index;
                      const value = guessValues[index] ?? "";
                      return (
                        <div
                          key={`${crackVault?.name}-${index}`}
                          className="flex flex-col items-center gap-2"
                        >
                          <input
                            className={`h-12 w-12 rounded-xl border text-center text-base font-semibold transition ${
                              revealed
                                ? "cursor-not-allowed border-white/10 bg-white/5 text-white/30"
                                : isLocked
                                ? "cursor-not-allowed border-white/10 bg-black/30 text-white/30"
                                : isActive
                                ? "border-red-400 bg-red-500/15 text-white shadow-[0_0_18px_rgba(225,29,72,0.35)]"
                                : "border-white/10 bg-black/40 text-white/80 hover:border-white/30"
                            }`}
                            maxLength={1}
                            value={revealed ? (revealedChars[index] ?? "") : value}
                            onFocus={() => {
                              if (revealed) return;
                              if (lockIndex !== null && lockIndex !== index) return;
                              setActiveGuessIndex(index);
                            }}
                            onChange={(event) => {
                              if (revealed) return;
                              if (lockIndex !== null && lockIndex !== index) return;
                              const raw = event.target.value.slice(0, 1);
                              const normalized = raw.toLowerCase();
                              const nextValue = /^[a-z0-9]$/.test(normalized)
                                ? normalized
                                : "";
                              setGuessValues((prev) => {
                                const next = [...prev];
                                next[index] = nextValue;
                                return next;
                              });
                              if (nextValue) {
                                setActiveGuessIndex(index);
                              } else if (
                                activeGuessIndex === index ||
                                (lockIndex === index && filledIndex === index)
                              ) {
                                setActiveGuessIndex(null);
                              }
                            }}
                            disabled={revealed || isLocked}
                          />
                        </div>
                      );
                    }
                  )}
                </div>
              </div>
              {guessFeedback ? (
                <div
                  className={`rounded-2xl border px-4 py-3 text-sm ${
                    guessFeedback.tone === "success"
                      ? "border-emerald-400/40 bg-emerald-500/10 text-emerald-100"
                      : guessFeedback.tone === "error"
                      ? "border-red-400/40 bg-red-500/10 text-red-100"
                      : "border-white/10 bg-white/5 text-white/70"
                  }`}
                >
                  {guessFeedback.message}
                </div>
              ) : null}
              {!isCrackClosed ? (
                <button
                  className="mt-1 cursor-pointer rounded-2xl bg-red-500 py-3 text-sm font-semibold text-white shadow-[0_0_35px_rgba(225,29,72,0.45)] transition hover:-translate-y-0.5 hover:bg-red-400 hover:shadow-[0_0_45px_rgba(225,29,72,0.6)] active:translate-y-0 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300/70 disabled:cursor-not-allowed disabled:opacity-60"
                  onClick={handleSubmitGuess}
                  disabled={isGuessLoading}
                >
                  {isGuessLoading
                    ? "Submitting..."
                    : isDemo
                    ? "Submit Guess (Demo)"
                    : "Submit Guess"}
                </button>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {notice ? (
        <div className="fixed bottom-6 right-6 z-50 rounded-2xl border border-white/10 bg-black/70 px-4 py-3 text-sm text-white shadow-[0_12px_40px_rgba(0,0,0,0.5)]">
          {notice}
        </div>
      ) : null}
    </div>
  );
}
