export type UsdDisplay = {
  main: string
  extra: string | null
}

/**
 * Shorten an address for display (e.g. 0x1234...5678).
 * @param addr - Full address string
 * @param start - Number of leading characters (default 6)
 * @param end - Number of trailing characters (default 4)
 */
export function shortenAddress(addr: string, start = 6, end = 4): string {
  if (!addr || typeof addr !== 'string') return ''
  if (addr.length <= start + end) return addr
  return `${addr.slice(0, start)}...${addr.slice(-end)}`
}

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

/**
 * Format a USD value with optional subtle extra decimals.
 * - Values >= $0.01 use the standard 2-decimal currency format.
 * - Values between $0 and $0.01 show up to 6 decimals, revealing the first non-zero digit.
 * - Extra decimals beyond the first two are returned separately for gray styling.
 */
export function formatUsdValueParts(value: number): UsdDisplay {
  if (!Number.isFinite(value) || value <= 0) {
    return { main: '$0.00', extra: null }
  }

  if (value >= 0.01) {
    return { main: currencyFormatter.format(value), extra: null }
  }

  const fixedSix = value.toFixed(6) // up to 6 decimals to search for a non-zero digit
  const [intPart, decimals = ''] = fixedSix.split('.')
  const firstNonZero = decimals.split('').findIndex(digit => digit !== '0')
  const decimalsToShow = firstNonZero === -1 ? 6 : Math.min(6, Math.max(2, firstNonZero + 1))

  const precise = value.toFixed(decimalsToShow)
  const [intPrecise, decimalsPrecise = ''] = precise.split('.')
  const mainDecimals = decimalsPrecise.slice(0, 2).padEnd(2, '0')
  const extra = decimalsPrecise.slice(2)

  return {
    main: `$${Number(intPrecise).toLocaleString('en-US')}.${mainDecimals}`,
    extra: extra.length ? extra : null,
  }
}

export function formatUsdValueString(value: number): string {
  const { main, extra } = formatUsdValueParts(value)
  return `${main}${extra ?? ''}`
}
