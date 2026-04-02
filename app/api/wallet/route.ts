import { NextResponse } from "next/server";
import clientPromise from "@/lib/mongodb";

const DEFAULT_START_BALANCE = 10000;

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { address?: string };
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
    const wallets = db.collection("wallets");

    const existing = await wallets.findOne({ address });

    if (!existing) {
      const now = new Date();
      const doc = {
        address,
        balance: DEFAULT_START_BALANCE,
        welcomeBonusGranted: true,
        createdAt: now,
        updatedAt: now,
      };
      await wallets.insertOne(doc);
      return NextResponse.json({
        address,
        balance: doc.balance,
        isNew: true,
      });
    }

    const now = new Date();
    const hasBonus = Boolean(existing.welcomeBonusGranted);
    const currentBalance =
      typeof existing.balance === "number" ? existing.balance : 0;

    if (!hasBonus) {
      const nextBalance = currentBalance + DEFAULT_START_BALANCE;
      await wallets.updateOne(
        { address },
        {
          $set: {
            balance: nextBalance,
            welcomeBonusGranted: true,
            updatedAt: now,
          },
        }
      );
      return NextResponse.json({
        address,
        balance: nextBalance,
        isNew: true,
      });
    }

    return NextResponse.json({
      address,
      balance: currentBalance,
      isNew: false,
    });
  } catch (error) {
    console.error("Wallet API error:", error);
    return NextResponse.json(
      {
        error: "Unable to fetch wallet balance.",
        detail:
          process.env.NODE_ENV === "development"
            ? error instanceof Error
              ? error.message
              : String(error)
            : undefined,
      },
      { status: 500 }
    );
  }
}
