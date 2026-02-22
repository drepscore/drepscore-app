'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { BrowserWallet, Address } from '@meshsdk/core';
import { getStoredSession, saveSession, clearSession, parseSessionToken, isSessionExpired } from '@/lib/supabaseAuth';

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
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [address, setAddress] = useState<string | null>(null);
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

  const connect = async (walletName: string) => {
    setConnecting(true);
    setError(null);

    try {
      const browserWallet = await BrowserWallet.enable(walletName);
      setWallet(browserWallet);
      
      const addresses = await browserWallet.getUsedAddresses();
      // #region agent log
      console.log('[DEBUG ce4185] getUsedAddresses returned:', addresses?.length, 'first:', addresses?.[0]?.substring(0, 20));
      // #endregion
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

  const signMessage = useCallback(async (message: string): Promise<{ signature: string; key: string } | null> => {
    if (!wallet || !address) {
      setError('Wallet not connected');
      return null;
    }

    try {
      // CIP-30 getUsedAddresses() returns hex; MeshJS signData expects bech32
      const bech32Address = Address.fromHex(address).toBech32();
      // #region agent log
      console.log('[DEBUG ce4185] signData called with address:', bech32Address?.substring(0, 20), 'message:', message?.substring(0, 30));
      // #endregion
      const result = await wallet.signData(bech32Address, message);
      // #region agent log
      console.log('[DEBUG ce4185] signData result:', { sigLen: result.signature?.length, keyLen: result.key?.length });
      // #endregion
      return { signature: result.signature, key: result.key };
    } catch (err) {
      // #region agent log
      console.error('[DEBUG ce4185] signData error:', err);
      // #endregion
      const errorMessage = err instanceof Error ? err.message : 'Failed to sign message';
      setError(errorMessage);
      console.error('Sign message error:', err);
      return null;
    }
  }, [wallet, address]);

  const authenticate = useCallback(async (): Promise<boolean> => {
    if (!wallet || !address) {
      setError('Connect wallet first');
      return false;
    }

    try {
      const nonceResponse = await fetch('/api/auth/nonce');
      const { nonce, signature: nonceSignature } = await nonceResponse.json();

      // MeshJS signData/checkSignature expect hex-encoded payload — plain nonce with UUID hyphens
      // would fail bech32 decoding inside checkSignature
      const nonceHex = Buffer.from(nonce, 'utf8').toString('hex');
      
      // CIP-30 returns hex addresses; MeshJS expects bech32 for signing/verification
      const bech32Address = Address.fromHex(address).toBech32();
      // #region agent log
      console.log('[DEBUG ce4185] nonce:', nonce?.substring(0, 30), 'nonceHex:', nonceHex?.substring(0, 30), 'bech32Address:', bech32Address?.substring(0, 20));
      // #endregion

      const signResult = await signMessage(nonceHex);
      if (!signResult) return false;

      const authResponse = await fetch('/api/auth/wallet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          address: bech32Address,
          nonce,
          nonceSignature,
          nonceHex,
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
      setSessionAddress(bech32Address);
      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Authentication failed';
      setError(errorMessage);
      console.error('Authentication error:', err);
      return false;
    }
  }, [wallet, address, signMessage]);

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
