// Pure helpers for the `entitlement` Edge Function (no Deno or network APIs, so Node can test them).

// ERC-1155 balanceOf(address,uint256) selector.
const BALANCE_OF = "0x00fdd58e";

export function isAddress(value: unknown): value is string {
  return typeof value === "string" && /^0x[0-9a-fA-F]{40}$/.test(value);
}

/** Encodes the eth_call data for balanceOf(owner, tokenId). */
export function encodeBalanceOf(owner: string, tokenId: bigint): string {
  if (!isAddress(owner)) throw new Error("invalid wallet address");
  if (tokenId < 0n) throw new Error("invalid token id");
  const word = (hex: string) => hex.padStart(64, "0");
  return BALANCE_OF + word(owner.slice(2).toLowerCase()) + word(tokenId.toString(16));
}

/** Decodes a uint256 returned by eth_call. */
export function decodeUint(result: unknown): bigint {
  if (typeof result !== "string" || !/^0x[0-9a-fA-F]*$/.test(result)) throw new Error("bad RPC result");
  return result === "0x" ? 0n : BigInt(result);
}

/**
 * Finds the wallet address of a user who signed in with Supabase Web3.
 * Supabase stores it on the web3 identity; the exact field has varied, so check
 * the known places and fall back to the 0x address inside provider_id.
 */
export function walletFromIdentities(identities: Array<Record<string, any>> | null | undefined): string | null {
  for (const identity of identities ?? []) {
    if (identity?.provider !== "web3") continue;
    const data = identity.identity_data ?? {};
    const candidates = [data.address, data.custom_claims?.address, data.sub, identity.provider_id, identity.id];
    for (const c of candidates) {
      const match = typeof c === "string" ? c.match(/0x[0-9a-fA-F]{40}/) : null;
      if (match) return match[0].toLowerCase();
    }
  }
  return null;
}
