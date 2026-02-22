'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { BrowserWallet } from '@meshsdk/core';
import { getStoredSession, saveSession, clearSession, parseSessionToken, isSessionExpired } from '@/lib/supabaseAuth';

interface CIP30Api {
  getUsedAddresses(): Promise<string[]>;
  signData(addr: string, payload: string): Promise<{ signature: string; key: string }>;
}

function getCardanoApi(name: string): { enable(): Promise<CIP30Api> } | undefined {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (window as any).cardano?.[name];
}

export interface WalletContextType {
  wallet: BrowserWallet | null;
  connected: boolean;
  connecting: boolean;
  address: string | null;
  sessionAddress: string | null;
  isAuthenticated: boolean;
  error: string | null;
  availableWallets: string[];
  connect: (walletName: string) => Promise<void>;
  disconnect: () => void;
  signMessage: (message: string) => Promise<{ signature: string; key: string } | null>;
  authenticate: () => Promise<boolean>;
  logout: () => void;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

export function WalletProvider({ children }: { children: ReactNode }) {
  const [wallet, setWallet] = useState<BrowserWallet | null>(null);
  const [walletName, setWalletName] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [address, setAddress] = useState<string | null>(null);
  const [hexAddress, setHexAddress] = useState<string | null>(null);
  const [sessionAddress, setSessionAddress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [availableWallets, setAvailableWallets] = useState<string[]>([]);

  const isAuthenticated = sessionAddress !== null;

  useEffect(() => {
    const checkWallets = () => {
      const wallets = BrowserWallet.getInstalledWallets();
      setAvailableWallets(wallets.map(w => w.name));
    };

    checkWallets();
    const timer = setTimeout(checkWallets, 1000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const token = getStoredSession();
    if (token) {
      const payload = parseSessionToken(token);
      if (payload && !isSessionExpired(payload)) {
        setSessionAddress(payload.walletAddress);
      } else {
        clearSession();
      }
    }
  }, []);

  const connect = async (name: string) => {
    setConnecting(true);
    setError(null);

    try {
      const browserWallet = await BrowserWallet.enable(name);
      setWallet(browserWallet);
      setWalletName(name);
      
      const addresses = await browserWallet.getUsedAddresses();

      // Also get hex address from raw CIP-30 API for signData
      const rawApi = await getCardanoApi(name)?.enable();
      const hexAddresses = rawApi ? await rawApi.getUsedAddresses() : [];
      // #region agent log
      console.log('[DEBUG ce4185] connect:', { bech32First: addresses?.[0]?.substring(0, 20), hexFirst: hexAddresses?.[0]?.substring(0, 20), bech32Count: addresses?.length, hexCount: hexAddresses?.length });
      // #endregion

      if (addresses && addresses.length > 0) {
        setAddress(addresses[0]);
        if (hexAddresses.length > 0) setHexAddress(hexAddresses[0]);
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
    setWalletName(null);
    setConnected(false);
    setAddress(null);
    setHexAddress(null);
    setError(null);
  };

  const signMessage = useCallback(async (message: string): Promise<{ signature: string; key: string } | null> => {
    // #region agent log
    console.log('[DEBUG ce4185] signMessage entry:', { walletName, hexAddr: hexAddress?.substring(0, 20), messageLen: message?.length });
    // #endregion
    if (!walletName || !hexAddress) {
      setError('Wallet not connected');
      return null;
    }

    try {
      // Bypass MeshJS wrapper — it incorrectly bech32-decodes the payload.
      // CIP-30 signData expects hex address + hex-encoded payload.
      const rawApi = await getCardanoApi(walletName)?.enable();
      if (!rawApi) throw new Error('Could not access wallet API');

      const hexPayload = Array.from(new TextEncoder().encode(message))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
      // #region agent log
      console.log('[DEBUG ce4185] CIP-30 signData params:', { hexAddr: hexAddress.substring(0, 20), hexPayload: hexPayload.substring(0, 30) });
      // #endregion
      const result = await rawApi.signData(hexAddress, hexPayload);
      // #region agent log
      console.log('[DEBUG ce4185] CIP-30 signData result:', { sigLen: result.signature?.length, keyLen: result.key?.length });
      // #endregion
      return { signature: result.signature, key: result.key };
    } catch (err) {
      // #region agent log
      console.error('[DEBUG ce4185] CIP-30 signData error:', err);
      // #endregion
      const errorMessage = err instanceof Error ? err.message : 'Failed to sign message';
      setError(errorMessage);
      console.error('Sign message error:', err);
      return null;
    }
  }, [walletName, hexAddress]);

  const authenticate = useCallback(async (): Promise<boolean> => {
    if (!walletName || !address || !hexAddress) {
      setError('Connect wallet first');
      return false;
    }

    try {
      const nonceResponse = await fetch('/api/auth/nonce');
      const { nonce, signature: nonceSignature } = await nonceResponse.json();

      // #region agent log
      console.log('[DEBUG ce4185] authenticate:', { nonce: nonce?.substring(0, 30), address: address?.substring(0, 20) });
      // #endregion

      const signResult = await signMessage(nonce);
      if (!signResult) return false;

      const authResponse = await fetch('/api/auth/wallet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          address,
          nonce,
          nonceSignature,
          signature: signResult.signature,
          key: signResult.key,
        }),
      });

      if (!authResponse.ok) {
        const data = await authResponse.json();
        throw new Error(data.error || 'Authentication failed');
      }

      const { sessionToken } = await authResponse.json();
      saveSession(sessionToken);
      setSessionAddress(address);
      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Authentication failed';
      setError(errorMessage);
      console.error('Authentication error:', err);
      return false;
    }
  }, [walletName, address, hexAddress, signMessage]);

  const logout = useCallback(() => {
    clearSession();
    setSessionAddress(null);
  }, []);

  return (
    <WalletContext.Provider
      value={{
        wallet,
        connected,
        connecting,
        address,
        sessionAddress,
        isAuthenticated,
        error,
        availableWallets,
        connect,
        disconnect,
        signMessage,
        authenticate,
        logout,
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
