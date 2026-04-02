import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import clientPromise from "@/lib/mongodb";


const formatDollars = (value: number) => {
  const formatter = new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 3,
  });
  return `$${formatter.format(value)}`;
};

const formatTimeLeft = (minutesLeft: number) => {
  if (minutesLeft <= 0) return "Ended";
  const hours = Math.floor(minutesLeft / 60);
  const minutes = minutesLeft % 60;
  const hh = `${hours}`.padStart(2, "0");
  const mm = `${minutes}`.padStart(2, "0");
  return `${hh}h ${mm}m`;
};

const buildSlots = (revealedKey: (string | null)[], length: number) => {
  const revealedCount = revealedKey.filter(Boolean).length;
  return `${revealedCount} / ${length} characters`;
};

const buildProgress = (revealedKey: (string | null)[], length: number) => {
  const revealedCount = revealedKey.filter(Boolean).length;
  return Math.round((revealedCount / length) * 100);
};

const buildRewardShares = (count: number) => {
  const base = 26.5;
  const step = 1;
  const raw = Array.from({ length: count }, (_, index) =>
    Math.max(1, base - step * index)
  );
  const sum = raw.reduce((total, value) => total + value, 0);
  return raw.map((value) => value / sum);
};

const shapeVault = (vault: any) => {
  const length = vault.keyLength;
  const now = Date.now();
  const endsAt = vault.endsAt ? new Date(vault.endsAt).getTime() : now;
  const minutesLeft =
    vault.vaultState === "running"
      ? Math.max(0, Math.ceil((endsAt - now) / 60000))
      : 0;
  return {
    id: vault._id.toString(),
    name: vault.name,
    reward: formatDollars(vault.rewardValue),
    rewardValue: vault.rewardValue,
    initialLocked: formatDollars(vault.initialLockedValue),
    currentLocked: formatDollars(vault.currentLockedValue),
    entryFee: formatDollars(vault.entryFeeValue),
    entryFeeValue: vault.entryFeeValue,
    keyLength: String(length),
    revealedKey: vault.revealedKey ?? Array.from({ length }, () => null),
    progress: vault.progress ?? buildProgress(vault.revealedKey, length),
    slots: vault.slots ?? buildSlots(vault.revealedKey, length),
    timeLeftMinutes: minutesLeft,
    timeLeft: formatTimeLeft(minutesLeft),
    status: vault.status,
    vaultState: vault.vaultState,
  };
};

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await context.params;
    const vaultId = resolvedParams.id;

    if (!ObjectId.isValid(vaultId)) {
      return NextResponse.json(
        { error: "Invalid vault id." },
        { status: 400 }
      );
    }

    const body = (await request.json()) as {
      address?: string;
      index?: number;
      guess?: string;
    };

    const rawAddress = body.address?.trim();
    if (!rawAddress) {
      return NextResponse.json(
        { error: "Wallet address is required." },
        { status: 400 }
      );
    }

    const index =
      typeof body.index === "number" ? Math.floor(body.index) : -1;
    const guess = body.guess?.trim().toLowerCase();
    if (!guess || guess.length !== 1) {
      return NextResponse.json(
        { error: "Guess must be a single character." },
        { status: 400 }
      );
    }

    const client = await clientPromise;
    const dbName = process.env.MONGODB_DB || "ctv";
    const db = client.db(dbName);
    const vaults = db.collection("vaults");
    const wallets = db.collection("wallets");

    const vault = await vaults.findOne({ _id: new ObjectId(vaultId) });
    if (!vault) {
      return NextResponse.json({ error: "Vault not found." }, { status: 404 });
    }
    if (vault.vaultState !== "running") {
      return NextResponse.json(
        { error: "Vault is closed." },
        { status: 400 }
      );
    }

    const length = vault.keyLength;
    if (index < 0 || index >= length) {
      return NextResponse.json(
        { error: "Invalid guess position." },
        { status: 400 }
      );
    }

    const wallet = await wallets.findOne({
      address: rawAddress.toLowerCase(),
    });
    if (!wallet) {
      return NextResponse.json(
        { error: "Wallet not found." },
        { status: 404 }
      );
    }

    const currentBalance =
      typeof wallet.balance === "number" ? wallet.balance : 0;
    const guessCost =
      typeof vault.entryFeeValue === "number" ? vault.entryFeeValue : 0;
    if (currentBalance < guessCost) {
      return NextResponse.json(
        { error: "Not enough credits to crack." },
        { status: 400 }
      );
    }

    const revealedKey: (string | null)[] = Array.isArray(vault.revealedKey)
      ? vault.revealedKey
      : Array.from({ length }, () => null);
    const revealedBy: (string | null)[] = Array.isArray(vault.revealedBy)
      ? vault.revealedBy
      : Array.from({ length }, () => null);
    const revealOrder: { index: number; address: string; revealedAt: string }[] =
      Array.isArray(vault.revealOrder) ? vault.revealOrder : [];
    if (revealedKey[index]) {
      return NextResponse.json(
        { error: "Position already revealed." },
        { status: 400 }
      );
    }

    const keyChar = String(vault.key ?? "")[index]?.toLowerCase();
    const isCorrect = keyChar === guess;

    if (isCorrect) {
      revealedKey[index] = keyChar;
      if (!revealedBy[index]) {
        revealedBy[index] = rawAddress.toLowerCase();
        revealOrder.push({
          index,
          address: rawAddress.toLowerCase(),
          revealedAt: new Date().toISOString(),
        });
      }
    }

    const progress = buildProgress(revealedKey, length);
    const slots = buildSlots(revealedKey, length);
    const cracked = revealedKey.every((char) => typeof char === "string");
    const now = new Date();
    const currentRewardValue =
      typeof vault.rewardValue === "number" ? vault.rewardValue : 0;
    const currentLockedValue =
      typeof vault.currentLockedValue === "number" ? vault.currentLockedValue : currentRewardValue;
    const nextRewardValue = currentRewardValue + guessCost;
    const nextLockedValue = currentLockedValue + guessCost;

    const updatedVault = {
      revealedKey,
      revealedBy,
      revealOrder,
      progress,
      slots,
      rewardValue: nextRewardValue,
      currentLockedValue: nextLockedValue,
      vaultState: cracked ? "cracked" : vault.vaultState,
      status: cracked ? "Cracked" : vault.status,
      endsAt: cracked ? now : vault.endsAt,
      updatedAt: now,
    };

    await vaults.updateOne(
      { _id: vault._id },
      {
        $set: updatedVault,
      }
    );

    const updatedBalance = currentBalance - guessCost;
    await wallets.updateOne(
      { address: rawAddress.toLowerCase() },
      {
        $set: {
          balance: updatedBalance,
          updatedAt: now,
        },
      }
    );

    if (cracked && !vault.crackedPayoutProcessed) {
      const poolValue = nextLockedValue;
      const contributors = revealOrder
        .filter((entry) => entry && typeof entry.address === "string")
        .map((entry) => entry.address);
      const uniqueContributors = contributors.length
        ? contributors
        : revealedBy.filter((entry) => typeof entry === "string") as string[];
      const shares = buildRewardShares(uniqueContributors.length);
      const payoutMap = new Map<string, number>();
      uniqueContributors.forEach((address, index) => {
        const shareAmount = poolValue * (shares[index] ?? 0);
        payoutMap.set(
          address,
          (payoutMap.get(address) ?? 0) + shareAmount
        );
      });
      const payouts = Array.from(payoutMap.entries()).map(
        ([address, amount]) => ({
          address,
          amount,
        })
      );

      await Promise.all(
        payouts.map((payout) =>
          wallets.updateOne(
            { address: payout.address },
            {
              $inc: { balance: payout.amount },
              $set: { updatedAt: now },
            }
          )
        )
      );

      await vaults.updateOne(
        { _id: vault._id },
        {
          $set: {
            crackedPayoutProcessed: true,
            crackedPayoutPool: poolValue,
            crackedPayouts: payouts,
            crackedPayoutAt: now,
          },
        }
      );
    }

    const refreshed = await vaults.findOne({ _id: vault._id });

    return NextResponse.json({
      vault: shapeVault(refreshed),
      balance: updatedBalance,
      correct: isCorrect,
    });
  } catch (error) {
    console.error("Guess vault error:", error);
    return NextResponse.json(
      { error: "Unable to submit guess." },
      { status: 500 }
    );
  }
}
