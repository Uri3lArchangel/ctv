import { NextResponse } from "next/server";
import clientPromise from "@/lib/mongodb";
import { applyReferralBonus } from "@/lib/referrals";

const CREATE_COST = 50;
const DEFAULT_KEY_CHARS = "abcdefghijklmnopqrstuvwxyz0123456789";

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

const generateKey = (
  length: number,
  fixed: Record<number, string> = {}
) => {
  const chars = DEFAULT_KEY_CHARS;
  const keyArray = Array.from({ length }, (_, index) => {
    if (fixed[index]) return fixed[index].toLowerCase();
    const pick = Math.floor(Math.random() * chars.length);
    return chars[pick];
  });
  return keyArray.join("");
};

const seedVaults = async (vaults: any) => {
  const count = await vaults.countDocuments();
  if (count > 0) return;

  const now = Date.now();
  const seeds = [
    {
      name: "Apex Blitz",
      rewardValue: 40.0,
      initialLockedValue: 25.0,
      currentLockedValue: 40.0,
      entryFeeValue: 0.02,
      keyLength: 6,
      revealedKey: ["a", null, null, null, "9", null],
      timeLeftMinutes: 10,
      status: "Hot",
      vaultState: "running",
    },
    {
      name: "Velvet Cipher",
      rewardValue: 12.5,
      initialLockedValue: 8.5,
      currentLockedValue: 12.5,
      entryFeeValue: 0.008,
      keyLength: 5,
      revealedKey: [null, "k", null, null, null],
      timeLeftMinutes: 220,
      status: "Open",
      vaultState: "running",
    },
  ];

  const docs = seeds.map((seed) => {
    const fixedChars: Record<number, string> = {};
    seed.revealedKey.forEach((char, index) => {
      if (typeof char === "string") fixedChars[index] = char;
    });
    const key = generateKey(seed.keyLength, fixedChars);
    const revealedKey =
      seed.vaultState === "cracked"
        ? key.split("")
        : seed.revealedKey.map((char, index) =>
            typeof char === "string" ? key[index] : null
          );
    const progress = buildProgress(revealedKey, seed.keyLength);
    const slots = buildSlots(revealedKey, seed.keyLength);
    return {
      ...seed,
      key,
      revealedKey,
      progress,
      slots,
      endsAt:
        seed.vaultState === "running"
          ? new Date(now + seed.timeLeftMinutes * 60 * 1000)
          : new Date(now),
      createdAt: new Date(now),
      updatedAt: new Date(now),
    };
  });

  await vaults.insertMany(docs);
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
    revealOrder: Array.isArray(vault.revealOrder) ? vault.revealOrder : [],
    createdAt: vault.createdAt
      ? new Date(vault.createdAt).toISOString()
      : null,
  };
};

export async function GET() {
  try {
    const client = await clientPromise;
    const dbName = process.env.MONGODB_DB || "ctv";
    const db = client.db(dbName);
    const vaults = db.collection("vaults");
    const wallets = db.collection("wallets");

    await seedVaults(vaults);

    const docs = await vaults.find({}).toArray();
    const now = Date.now();

    for (const doc of docs) {
      if (doc.vaultState === "running" && doc.endsAt) {
        const endsAt = new Date(doc.endsAt).getTime();
        if (endsAt <= now) {
          const creatorAddress =
            typeof doc.creatorAddress === "string"
              ? doc.creatorAddress
              : null;
          const poolValue =
            typeof doc.currentLockedValue === "number"
              ? doc.currentLockedValue
              : typeof doc.rewardValue === "number"
                ? doc.rewardValue
                : typeof doc.initialLockedValue === "number"
                  ? doc.initialLockedValue
                  : 0;
          const feeRate = 0.05;
          const feeAmount = poolValue * feeRate;
          const payoutAmount = poolValue - feeAmount;
          const shouldPayout =
            Boolean(creatorAddress) && !doc.payoutProcessed;

          if (shouldPayout) {
            await wallets.updateOne(
              { address: creatorAddress },
              {
                $inc: { balance: payoutAmount },
                $set: { updatedAt: new Date(now) },
              }
            );
            if (creatorAddress) {
              await applyReferralBonus({
                wallets,
                earnerAddress: creatorAddress,
                amount: payoutAmount,
                now: new Date(now),
              });
            }
          }

          await vaults.updateOne(
            { _id: doc._id },
            {
              $set: {
                vaultState: "ended",
                status: "Ended",
                payoutProcessed: shouldPayout
                  ? true
                  : doc.payoutProcessed ?? false,
                payoutFeeRate: feeRate,
                payoutFeeAmount: feeAmount,
                payoutAmount,
                payoutWallet: creatorAddress,
                payoutAt: shouldPayout ? new Date(now) : doc.payoutAt ?? null,
                updatedAt: new Date(now),
              },
            }
          );
          doc.vaultState = "ended";
          doc.status = "Ended";
        }
      }
    }

    return NextResponse.json({
      vaults: docs.map(shapeVault),
    });
  } catch (error) {
    console.error("Vaults API error:", error);
    return NextResponse.json(
      { error: "Unable to load vaults." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      address?: string;
      name?: string;
      rewardValue?: number;
      entryFeeValue?: number;
      keyLength?: number;
      lockMinutes?: number;
    };

    const rawAddress = body.address?.trim();
    if (!rawAddress) {
      return NextResponse.json(
        { error: "Wallet address is required." },
        { status: 400 }
      );
    }

    const address = rawAddress.toLowerCase();
    const client = await clientPromise;
    const dbName = process.env.MONGODB_DB || "ctv";
    const db = client.db(dbName);
    const vaults = db.collection("vaults");
    const wallets = db.collection("wallets");

    const wallet = await wallets.findOne({ address });
    if (!wallet) {
      return NextResponse.json(
        { error: "Wallet not found." },
        { status: 404 }
      );
    }

    const currentBalance =
      typeof wallet.balance === "number" ? wallet.balance : 0;
    if (currentBalance < CREATE_COST) {
      return NextResponse.json(
        { error: "Not enough credits to create a vault." },
        { status: 400 }
      );
    }

    const length =
      typeof body.keyLength === "number" && body.keyLength >= 4
        ? body.keyLength
        : 6;
    const rewardValue =
      typeof body.rewardValue === "number" && body.rewardValue > 0
        ? body.rewardValue
        : 12.5;
    const entryFeeValue =
      typeof body.entryFeeValue === "number" && body.entryFeeValue > 0
        ? body.entryFeeValue
        : 0.01;
    const lockMinutes =
      typeof body.lockMinutes === "number" && body.lockMinutes > 0
        ? body.lockMinutes
        : 12 * 60;

    const key = generateKey(length);
    const revealedKey = Array.from({ length }, () => null);
    const now = new Date();
    const doc = {
      creatorAddress: address,
      name: body.name?.trim() || "Midnight Mirage",
      rewardValue,
      initialLockedValue: rewardValue,
      currentLockedValue: rewardValue,
      entryFeeValue,
      keyLength: length,
      key,
      revealedKey,
      revealedBy: Array.from({ length }, () => null),
      revealOrder: [],
      progress: 0,
      slots: buildSlots(revealedKey, length),
      timeLeftMinutes: lockMinutes,
      status: "Open",
      vaultState: "running",
      endsAt: new Date(now.getTime() + lockMinutes * 60 * 1000),
      createdAt: now,
      updatedAt: now,
    };

    const updatedBalance = currentBalance - CREATE_COST;
    await wallets.updateOne(
      { address },
      {
        $set: {
          balance: updatedBalance,
          updatedAt: now,
        },
      }
    );

    const result = await vaults.insertOne(doc);
    const created = await vaults.findOne({ _id: result.insertedId });

    return NextResponse.json({
      vault: shapeVault(created),
      balance: updatedBalance,
    });
  } catch (error) {
    console.error("Create vault error:", error);
    return NextResponse.json(
      { error: "Unable to create vault." },
      { status: 500 }
    );
  }
}
