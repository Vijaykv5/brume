import { WalletAdapterNetwork } from "@solana/wallet-adapter-base";
import { clusterApiUrl } from "@solana/web3.js";

const configuredNetwork = process.env.NEXT_PUBLIC_SOLANA_NETWORK;

export const SOLANA_NETWORK =
  configuredNetwork === WalletAdapterNetwork.Mainnet ||
  configuredNetwork === WalletAdapterNetwork.Testnet
    ? configuredNetwork
    : WalletAdapterNetwork.Devnet;

export const SOLANA_RPC_ENDPOINT =
  process.env.NEXT_PUBLIC_SOLANA_RPC_URL?.trim() || clusterApiUrl(SOLANA_NETWORK);

export const SOLANA_NETWORK_LABEL =
  SOLANA_NETWORK === WalletAdapterNetwork.Mainnet
    ? "Mainnet"
    : SOLANA_NETWORK === WalletAdapterNetwork.Testnet
      ? "Testnet"
      : "Devnet";

export function getExplorerUrl(path: "address" | "tx", value: string) {
  const cluster =
    SOLANA_NETWORK === WalletAdapterNetwork.Mainnet
      ? ""
      : `?cluster=${SOLANA_NETWORK}`;
  return `https://explorer.solana.com/${path}/${value}${cluster}`;
}

export function shortenWalletAddress(address: string, chars = 4) {
  return `${address.slice(0, chars)}…${address.slice(-chars)}`;
}
