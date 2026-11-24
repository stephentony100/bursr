// Which Stellar network the Stellar edition runs on, safe for the browser and
// the server (next.config passes STELLAR_NETWORK to the browser). Everything
// here is public: contract IDs, passphrases and URLs, no secrets.

export type StellarNetworkName = "testnet" | "mainnet";

export interface StellarNetwork {
  name: StellarNetworkName;
  passphrase: string;
  rpcUrl: string;
  horizonUrl: string;
  /** Free test XLM for new accounts; mainnet has none. */
  friendbotUrl: string | null;
  /** Circle's USDC: issuer and its Stellar Asset Contract (developers.circle.com usdc-contract-addresses; `stellar contract id asset`). */
  usdcIssuer: string;
  usdcContract: string;
  /** Smart Account Kit (stellar-accounts v0.8.0): the passkey account wasm and the WebAuthn verifier (docs/deployments-stellar-accounts-0.8-2026-10-25.md). */
  accountWasmHash: string;
  webauthnVerifier: string;
  explorer: string;
}

const ACCOUNT_WASM_V080 = "c514d35ea67eaea9bfc1fb3327854c0c06111bc1ddebd4fe217c504c1004b9e1";

export const STELLAR_NETWORKS: Record<StellarNetworkName, StellarNetwork> = {
  testnet: {
    name: "testnet",
    passphrase: "Test SDF Network ; September 2015",
    rpcUrl: "https://soroban-testnet.stellar.org",
    horizonUrl: "https://horizon-testnet.stellar.org",
    friendbotUrl: "https://friendbot.stellar.org",
    usdcIssuer: "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5",
    usdcContract: "CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA",
    accountWasmHash: ACCOUNT_WASM_V080,
    webauthnVerifier: "CC7EKIHQP3TN4CARQDND6CEOY2UXLWWC2X5GHTD5NLAT7BG5GPZIOM3F",
    explorer: "https://stellar.expert/explorer/testnet",
  },
  mainnet: {
    name: "mainnet",
    passphrase: "Public Global Stellar Network ; September 2015",
    // No default public Soroban RPC for mainnet: set STELLAR_RPC_URL to a provider's.
    rpcUrl: "",
    horizonUrl: "https://horizon.stellar.org",
    friendbotUrl: null,
    usdcIssuer: "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
    usdcContract: "CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75",
    accountWasmHash: ACCOUNT_WASM_V080,
    webauthnVerifier: "CB7HENHJ7NF34I5FFXQK7D5I3WWQRGB5O5XO77D3NXMT7LM7LOKRQ5YR",
    explorer: "https://stellar.expert/explorer/public",
  },
};

export function stellarNetworkName(raw: string | undefined = process.env.NEXT_PUBLIC_STELLAR_NETWORK ?? process.env.STELLAR_NETWORK): StellarNetworkName {
  return raw === "mainnet" ? "mainnet" : "testnet";
}

/** The network this build runs on (testnet unless STELLAR_NETWORK=mainnet). */
export function stellarNetwork(): StellarNetwork {
  return STELLAR_NETWORKS[stellarNetworkName()];
}
