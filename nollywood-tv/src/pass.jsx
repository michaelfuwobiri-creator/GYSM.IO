// Phone checkout for the Nollywood Pass, opened from the QR code on the TV.
// The buyer connects any wallet (or signs in with email/Google/Apple), pays
// with crypto or card through thirdweb, and the pass is minted straight to
// the TV viewer's address from the `to` URL parameter.

import "@fontsource-variable/outfit";
import "@fontsource-variable/inter";
import "./pass.css";
import { useState } from "react";
import { createRoot } from "react-dom/client";
import { createThirdwebClient, defineChain } from "thirdweb";
import { ThirdwebProvider, ConnectButton, ClaimButton, useActiveAccount } from "thirdweb/react";
import { inAppWallet, createWallet } from "thirdweb/wallets";
import { CONFIG } from "./config.js";

const to = new URLSearchParams(location.search).get("to");
const validTo = to && /^0x[0-9a-fA-F]{40}$/.test(to) ? to : null;
const short = (a) => `${a.slice(0, 6)}…${a.slice(-4)}`;

const client = CONFIG.clientId ? createThirdwebClient({ clientId: CONFIG.clientId }) : null;
const chain = defineChain(CONFIG.chainId);
const wallets = [
  inAppWallet({ auth: { options: ["email", "google", "apple", "phone", "passkey"] } }),
  createWallet("io.metamask"),
  createWallet("com.coinbase.wallet"),
  createWallet("me.rainbow"),
  createWallet("walletConnect"),
];

const theme = "dark";

function Checkout() {
  const account = useActiveAccount();
  const [done, setDone] = useState(null);
  const recipient = validTo || account?.address;

  if (done) {
    return (
      <div className="done">
        <div className="pass pass--on"><b>N</b><span>NOLLYWOOD PASS</span><small>ACTIVE</small></div>
        <h2>You're in!</h2>
        <p>{validTo ? "Your TV will unlock in a few seconds." : "Sign in on your TV with the same account to start watching."}</p>
        <a className="tx" href={`https://blockscan.com/tx/${done}`} target="_blank" rel="noreferrer">View transaction</a>
      </div>
    );
  }

  return (
    <>
      <ol className="steps">
        <li className={account ? "is-done" : ""}><span>1</span>Connect a wallet or sign in</li>
        <li><span>2</span>Pay with card or crypto</li>
        <li><span>3</span>Watch on your TV</li>
      </ol>
      <ConnectButton client={client} chain={chain} wallets={wallets} theme={theme} connectModal={{ size: "compact", title: "Nollywood" }} connectButton={{ label: "Connect to continue" }} />
      {account && recipient && (
        <ClaimButton
          client={client}
          chain={chain}
          contractAddress={CONFIG.passContract}
          claimParams={{ type: "ERC1155", tokenId: BigInt(CONFIG.passTokenId), quantity: 1n, to: recipient }}
          payModal={{ theme }}
          onTransactionConfirmed={(r) => setDone(r.transactionHash)}
          onError={(e) => alert(e.message)}
          style={{ width: "100%" }}
        >
          Buy pass · {CONFIG.passPrice}
        </ClaimButton>
      )}
      {validTo && <p className="note">The pass will be sent to your TV wallet <code>{short(validTo)}</code>.</p>}
    </>
  );
}

function App() {
  return (
    <main className="wrap">
      <header><span className="mark">N</span> NOLLYWOOD</header>
      <div className="pass"><b>N</b><span>NOLLYWOOD PASS</span><small>MEMBERSHIP</small></div>
      <h1>Every premium film and series. One pass.</h1>
      <ul className="perks">
        <li>All Pass originals and premieres</li>
        <li>4K and no ads</li>
        <li>An on-chain membership you own</li>
      </ul>
      {client && CONFIG.passContract ? (
        <ThirdwebProvider><Checkout /></ThirdwebProvider>
      ) : (
        <p className="note">This page needs <code>VITE_THIRDWEB_CLIENT_ID</code> and <code>VITE_PASS_CONTRACT</code> in <code>.env</code>. On the TV, demo mode lets you simulate the purchase.</p>
      )}
    </main>
  );
}

createRoot(document.getElementById("root")).render(<App />);
