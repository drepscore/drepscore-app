'use client';

/**
 * Wallet Context Provider using MeshJS
 * Manages Cardano wallet connection state
 */

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { BrowserWallet } from '@meshsdk/core';

export interface WalletContextType {
  wallet: BrowserWallet | null;
  connected: boolean;
  connecting: boolean;
  address: string | null;
  error: string | null;
  availableWallets: string[];
  connect: (walletName: string) => Promise<void>;
  disconnect: () => void;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

export function WalletProvider({ children }: { children: ReactNode }) {
  const [wallet, setWallet] = useState<BrowserWallet | null>(null);
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [address, setAddress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [availableWallets, setAvailableWallets] = useState<string[]>([]);

  // Check for available wallets on mount
  useEffect(() => {
    const checkWallets = () => {
      const wallets = BrowserWallet.getInstalledWallets();
      setAvailableWallets(wallets.map(w => w.name));
    };

    // Check immediately and after a short delay (wallets might load async)
    checkWallets();
    const timer = setTimeout(checkWallets, 1000);
    
    return () => clearTimeout(timer);
  }, []);

  const connect = async (walletName: string) => {
    setConnecting(true);
    setError(null);

    try {
      const browserWallet = await BrowserWallet.enable(walletName);
      setWallet(browserWallet);
      
      const addresses = await browserWallet.getUsedAddresses();
      if (addresses && addresses.length > 0) {
        setAddress(addresses[0]);
        setConnected(true);
      } else {
        throw new Error('No addresses found in wallet');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to connect wallet';
      setError(errorMessage);
      console.error('Wallet connection error:', err);
    } finally {
      setConnecting(false);
    }
  };

  const disconnect = () => {
    setWallet(null);
    setConnected(false);
    setAddress(null);
    setError(null);
  };

  return (
    <WalletContext.Provider
      value={{
        wallet,
        connected,
        connecting,
        address,
        error,
        availableWallets,
        connect,
        disconnect,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet() {
  const context = useContext(WalletContext);
  if (context === undefined) {
    throw new Error('useWallet must be used within a WalletProvider');
  }
  return context;
}
