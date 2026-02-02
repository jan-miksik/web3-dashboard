/**
 * Canonical token key for maps/caches: chainId-address.
 * Use everywhere instead of inline template literals to keep format consistent.
 */
export function getTokenKey(token: { chainId: number; address: string }): string {
  return `${token.chainId}-${token.address}`
}
