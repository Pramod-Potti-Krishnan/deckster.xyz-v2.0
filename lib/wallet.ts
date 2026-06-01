import { prisma } from "@/lib/prisma"
import type { PrismaClient, Prisma } from "@prisma/client"

type TransactionClient = Omit<PrismaClient, "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends">

export type WalletTransactionReason =
  | "coupon_redemption"
  | "token_usage"
  | "card_topup"
  | "admin_adjust"

interface WalletMutationParams {
  userId: string
  amountCents: number
  reason: WalletTransactionReason
  sourceRef?: string
  tokens?: number
  metadata?: Prisma.JsonValue
  tx?: TransactionClient
}

async function mutateWallet(
  type: "credit" | "debit",
  params: WalletMutationParams,
): Promise<{ balanceAfterCents: number; transactionId: string }> {
  const { userId, amountCents, reason, sourceRef, tokens, metadata, tx } = params
  if (amountCents <= 0) throw new Error("amountCents must be positive")

  const run = async (client: TransactionClient) => {
    if (sourceRef) {
      const existing = await client.walletTransaction.findUnique({
        where: { sourceRef },
        select: { id: true, balanceAfterCents: true },
      })
      if (existing) {
        return { balanceAfterCents: existing.balanceAfterCents, transactionId: existing.id }
      }
    }

    const delta = type === "credit" ? amountCents : -amountCents

    const user = await client.user.update({
      where: { id: userId },
      data: { walletBalanceCents: { increment: delta } },
      select: { walletBalanceCents: true },
    })

    if (user.walletBalanceCents < 0) {
      throw new InsufficientFundsError(user.walletBalanceCents - delta, amountCents)
    }

    const txn = await client.walletTransaction.create({
      data: {
        userId,
        type,
        amountCents,
        reason,
        balanceAfterCents: user.walletBalanceCents,
        sourceRef: sourceRef ?? undefined,
        tokens: tokens ?? undefined,
        metadata: metadata ?? undefined,
      },
    })

    return { balanceAfterCents: user.walletBalanceCents, transactionId: txn.id }
  }

  if (tx) return run(tx)
  return prisma.$transaction(async (txClient) => run(txClient))
}

export async function creditWallet(params: WalletMutationParams) {
  return mutateWallet("credit", params)
}

export async function debitWallet(params: WalletMutationParams) {
  return mutateWallet("debit", params)
}

/**
 * Record plan-included token usage in the ledger WITHOUT touching the prepaid
 * balance. Within-cap turns are covered by the (virtual) monthly plan
 * allowance, so only the ledger row is written — the wallet is reserved for
 * overflow once a cap is hit. Idempotent via `sourceRef`.
 */
export async function recordPlanUsage(params: {
  userId: string
  amountCents: number
  tokens?: number
  sourceRef?: string
  metadata?: Prisma.JsonValue
  tx?: TransactionClient
}): Promise<{ balanceAfterCents: number; transactionId: string }> {
  const { userId, amountCents, tokens, sourceRef, metadata, tx } = params

  const run = async (client: TransactionClient) => {
    if (sourceRef) {
      const existing = await client.walletTransaction.findUnique({
        where: { sourceRef },
        select: { id: true, balanceAfterCents: true },
      })
      if (existing) {
        return { balanceAfterCents: existing.balanceAfterCents, transactionId: existing.id }
      }
    }

    const user = await client.user.findUniqueOrThrow({
      where: { id: userId },
      select: { walletBalanceCents: true },
    })

    const txn = await client.walletTransaction.create({
      data: {
        userId,
        type: "debit",
        amountCents,
        reason: "token_usage",
        balanceAfterCents: user.walletBalanceCents,
        sourceRef: sourceRef ?? undefined,
        tokens: tokens ?? undefined,
        metadata: metadata ?? undefined,
      },
    })

    return { balanceAfterCents: user.walletBalanceCents, transactionId: txn.id }
  }

  if (tx) return run(tx)
  return prisma.$transaction(async (txClient) => run(txClient))
}

export async function getBalance(userId: string): Promise<number> {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { walletBalanceCents: true },
  })
  return user.walletBalanceCents
}

export async function getTransactions(userId: string, limit = 20) {
  return prisma.walletTransaction.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: limit,
  })
}

export class InsufficientFundsError extends Error {
  public readonly currentBalanceCents: number
  public readonly requestedCents: number

  constructor(currentBalanceCents: number, requestedCents: number) {
    super(`Insufficient funds: balance ${currentBalanceCents}, requested ${requestedCents}`)
    this.name = "InsufficientFundsError"
    this.currentBalanceCents = currentBalanceCents
    this.requestedCents = requestedCents
  }
}
