const DEFAULT_PRICE_USD_PER_MTOK = 10

function getRate(): number {
  const env = process.env.TOKEN_PRICE_USD_PER_MTOK
  if (env) {
    const parsed = parseFloat(env)
    if (!isNaN(parsed) && parsed > 0) return parsed
  }
  return DEFAULT_PRICE_USD_PER_MTOK
}

export function tokensToUsdCents(tokens: number): number {
  if (tokens <= 0) return 0
  const rate = getRate()
  const dollars = (tokens / 1_000_000) * rate
  return Math.ceil(dollars * 100)
}

export function formatCentsAsUsd(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`
}
