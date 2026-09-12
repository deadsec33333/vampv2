// Wallet sign-in via Supabase Web3 auth (Sign in with Solana).
// IDENTITY ONLY: the wallet signs one free off-chain message to prove
// ownership. This app never requests transactions, balances, or
// approvals, and must never gain the ability to — see project rules.

import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase } from './supabase';

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [authError, setAuthError] = useState(null);

  const loadProfile = useCallback(async (userId) => {
    if (!userId) return setProfile(null);
    const { data } = await supabase
      .from('profiles')
      .select('id, username, wallet_address, human_verified_at, referral_code')
      .eq('id', userId)
      .single();
    setProfile(data ?? null);
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session ?? null);
      loadProfile(data.session?.user?.id);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_evt, s) => {
      setSession(s ?? null);
      loadProfile(s?.user?.id);
    });
    return () => sub.subscription.unsubscribe();
  }, [loadProfile]);

  async function signInWithWallet(captchaToken) {
    setAuthError(null);
    try {
      const { data, error } = await supabase.auth.signInWithWeb3({
        chain: 'solana',
        statement: 'Sign in to VAMP. This is a simulation game; this signature is free and authorizes no transactions.',
        ...(captchaToken ? { options: { captchaToken } } : {}),
      });
      if (error) throw error;
      // record the wallet address on the profile (own row only, via RLS)
      const addr = data?.user?.user_metadata?.custom_claims?.address
        ?? data?.user?.identities?.find((i) => i.provider === 'web3')?.identity_data?.address;
      if (addr && data?.user?.id) {
        await supabase.from('profiles').update({ wallet_address: addr }).eq('id', data.user.id);
      }
      await loadProfile(data?.user?.id);
      return true;
    } catch (e) {
      setAuthError(e.message ?? String(e));
      return false;
    }
  }

  async function signOut() {
    await supabase.auth.signOut();
    setProfile(null);
  }

  return (
    <AuthCtx.Provider value={{ session, profile, authError, signInWithWallet, signOut, refreshProfile: () => loadProfile(session?.user?.id) }}>
      {children}
    </AuthCtx.Provider>
  );
}

export const useAuth = () => useContext(AuthCtx);
