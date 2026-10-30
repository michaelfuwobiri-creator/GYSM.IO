// thirdweb integration.
//
// Sign-in uses a thirdweb in-app wallet with email codes, which works with a
// TV remote: no browser extension or phone app is needed. Premium titles are
// unlocked by owning the "Nollywood Pass", an ERC-1155 token from a thirdweb
// Edition Drop. The pass is bought on a phone (pass.html) and sent straight to
// the TV viewer's wallet, so the TV never has to sign a transaction.
//
// Without VITE_THIRDWEB_CLIENT_ID the app runs in demo mode: sign-in accepts
// any 6-digit code and "buying" the pass is simulated locally.

import { CONFIG } from "./config.js";

const DEMO_KEY = "nollywood.demo";
let sdk = null; // lazily loaded thirdweb modules
let client = null;
let wallet = null;
let account = null;
const listeners = new Set();

export const isDemo = !CONFIG.clientId;

export function onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); }
const emit = () => listeners.forEach((fn) => fn(state()));

export function state() {
  if (isDemo) {
    const d = readDemo();
    return { address: d.address || null, email: d.email || null, hasPass: !!d.hasPass, demo: true };
  }
  return { address: account?.address || null, email: lastEmail, hasPass, demo: false };
}

let lastEmail = null;
let hasPass = false;

async function load() {
  if (sdk) return sdk;
  const [core, wallets, inApp, erc1155] = await Promise.all([
    import("thirdweb"),
    import("thirdweb/wallets"),
    import("thirdweb/wallets/in-app"),
    import("thirdweb/extensions/erc1155"),
  ]);
  sdk = { ...core, ...wallets, ...inApp, erc1155 };
  client = sdk.createThirdwebClient({ clientId: CONFIG.clientId });
  wallet = sdk.inAppWallet();
  return sdk;
}

export async function restore() {
  if (isDemo) return emit();
  try {
    await load();
    account = await wallet.autoConnect({ client });
    lastEmail = await sdk.getUserEmail({ client }).catch(() => null);
    await refreshPass();
  } catch {
    account = null;
  }
  emit();
}

export async function sendCode(email) {
  if (isDemo) return;
  await load();
  await sdk.preAuthenticate({ client, strategy: "email", email });
}

export async function verifyCode(email, code) {
  if (isDemo) {
    if (!/^\d{6}$/.test(code)) throw new Error("Enter the 6-digit code.");
    writeDemo({ ...readDemo(), email, address: demoAddress(email) });
    return emit();
  }
  await load();
  account = await wallet.connect({ client, strategy: "email", email, verificationCode: code });
  lastEmail = email;
  await refreshPass();
  emit();
}

export async function signOut() {
  if (isDemo) { writeDemo({}); return emit(); }
  await wallet?.disconnect();
  account = null;
  hasPass = false;
  lastEmail = null;
  emit();
}

export async function refreshPass() {
  if (isDemo) return readDemo().hasPass;
  if (!account || !CONFIG.passContract) return (hasPass = false);
  await load();
  const contract = sdk.getContract({ client, chain: sdk.defineChain(CONFIG.chainId), address: CONFIG.passContract });
  const balance = await sdk.erc1155.balanceOf({ contract, owner: account.address, tokenId: BigInt(CONFIG.passTokenId) });
  const had = hasPass;
  hasPass = balance > 0n;
  if (had !== hasPass) emit();
  return hasPass;
}

// Polls for the pass while the "scan to buy" QR code is on screen.
export function watchPass(onUnlocked) {
  const timer = setInterval(async () => {
    if (await refreshPass().catch(() => false)) { clearInterval(timer); onUnlocked(); }
  }, 4000);
  return () => clearInterval(timer);
}

export function passUrl() {
  const s = state();
  const base = CONFIG.passPageUrl || new URL("pass.html", location.href).href;
  const url = new URL(base);
  if (s.address) url.searchParams.set("to", s.address);
  return url.href;
}

// Demo mode only: stands in for the purchase finishing on the phone.
export function demoGrantPass() {
  writeDemo({ ...readDemo(), hasPass: true });
  emit();
}

export const short = (a) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "");

function readDemo() {
  try { return JSON.parse(localStorage.getItem(DEMO_KEY)) || {}; } catch { return {}; }
}
function writeDemo(v) {
  try { localStorage.setItem(DEMO_KEY, JSON.stringify(v)); } catch { /* storage unavailable */ }
}
function demoAddress(seed) {
  let h = 0x811c9dc5;
  let out = "0x";
  for (let i = 0; i < 40; i++) {
    h ^= seed.charCodeAt(i % seed.length) + i;
    h = Math.imul(h, 16777619) >>> 0;
    out += (h & 15).toString(16);
  }
  return out;
}
