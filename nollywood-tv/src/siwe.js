// Sign-In with Ethereum (EIP-4361) message, signed by the thirdweb wallet and
// verified by Supabase Auth (Sign in with Web3).

const nonce = () => {
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  return [...bytes].map((b) => b.toString(36).padStart(2, "0")).join("").slice(0, 16);
};

export function buildSiweMessage({ domain, uri, address, chainId, statement, now = new Date(), nonceValue = nonce() }) {
  if (!/^0x[0-9a-fA-F]{40}$/.test(address)) throw new Error("invalid wallet address");
  return [
    `${domain} wants you to sign in with your Ethereum account:`,
    address,
    "",
    statement,
    "",
    `URI: ${uri}`,
    "Version: 1",
    `Chain ID: ${chainId}`,
    `Nonce: ${nonceValue}`,
    `Issued At: ${now.toISOString()}`,
  ].join("\n");
}
