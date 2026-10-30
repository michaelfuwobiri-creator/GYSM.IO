// Settings come from .env (see .env.example) and are baked in at build time.
const env = import.meta.env;

export const CONFIG = {
  // thirdweb client ID from https://thirdweb.com/dashboard. Empty = demo mode.
  clientId: env.VITE_THIRDWEB_CLIENT_ID || "",
  // Chain the pass contract lives on (8453 = Base, 84532 = Base Sepolia).
  chainId: Number(env.VITE_CHAIN_ID || 8453),
  // Address of your thirdweb Edition Drop (ERC-1155) and the pass token ID.
  passContract: env.VITE_PASS_CONTRACT || "",
  passTokenId: Number(env.VITE_PASS_TOKEN_ID || 0),
  // Public URL of pass.html. The TV shows it as a QR code, so it must be
  // reachable from a phone; the copy bundled inside the Android app is not.
  passPageUrl: env.VITE_PASS_PAGE_URL || "",
  passPrice: env.VITE_PASS_PRICE_LABEL || "0.002 ETH / month",
};
