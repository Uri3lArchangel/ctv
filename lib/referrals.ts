import type { Collection, Document } from "mongodb";

export const REFERRAL_RATE = 0.001;

export const getReferralBonus = (amount: number) =>
  amount > 0 ? amount * REFERRAL_RATE : 0;

export async function applyReferralBonus(params: {
  wallets: Collection<Document>;
  earnerAddress: string;
  amount: number;
  now: Date;
  referredBy?: string | null;
}) {
  const { wallets, earnerAddress, amount, now, referredBy } = params;
  if (!amount || amount <= 0) return 0;

  const normalizedEarner = earnerAddress.toLowerCase();
  let ref = referredBy?.trim().toLowerCase() ?? null;

  if (!ref) {
    const earner = await wallets.findOne(
      { address: normalizedEarner },
      { projection: { referredBy: 1 } }
    );
    if (typeof earner?.referredBy === "string") {
      ref = earner.referredBy.toLowerCase();
    }
  }

  if (!ref || ref === normalizedEarner) return 0;

  const refWallet = await wallets.findOne(
    { address: ref },
    { projection: { _id: 1 } }
  );
  if (!refWallet) return 0;

  const bonus = getReferralBonus(amount);
  if (!bonus) return 0;

  await wallets.updateOne(
    { address: ref },
    {
      $inc: { balance: bonus, referralEarnings: bonus },
      $set: { updatedAt: now },
    }
  );

  return bonus;
}
