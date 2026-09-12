import { useState, useCallback, useEffect } from 'react';
import { Routes, Route, NavLink } from 'react-router-dom';
import { supabase } from './lib/supabase';
import { useAuth } from './lib/auth';
import Turnstile from './lib/Turnstile';
import Home from './pages/Home';
import SetDetail from './pages/SetDetail';
import Treasury from './pages/Treasury';
import Leaderboard from './pages/Leaderboard';
import Referral from './pages/Referral';

function LoginModal({ onClose }) {
  const { signInWithWallet, authError } = useAuth();
  const [token, setToken] = useState(null);
  const [busy, setBusy] = useState(false);
  const onToken = useCallback((t) => setToken(t), []);

  async function go() {
    setBusy(true);
    const ok = await signInWithWallet(token);
    setBusy(false);
    if (ok) onClose();
  }

  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>Connect wallet</h2>
        <p className="fine">
          Your wallet signs one free message to prove it's yours. That's it.
          VAMP never asks for transactions, never touches your funds, and has
          no buy buttons — the treasury here is fake money in a simulation game.
        </p>
        <Turnstile onToken={onToken} />
        <button className="btn" disabled={busy} onClick={go}>
          {busy ? 'Waiting for wallet…' : 'Sign in with Solana'}
        </button>
        {authError && <div className="err">{authError}</div>}
        <p className="fine" style={{ marginTop: 14 }}>
          Works with Phantom, Solflare, Backpack and other Solana wallets.
        </p>
      </div>
    </div>
  );
}

export default function App() {
  const { session, profile, signOut, refreshProfile } = useAuth();
  const [showLogin, setShowLogin] = useState(false);

  // capture ?ref=CODE from invite links; claim it after login
  useEffect(() => {
    const ref = new URLSearchParams(window.location.search).get('ref');
    if (ref) {
      try { localStorage.setItem('vamp_ref', ref); } catch {}
    }
  }, []);

  useEffect(() => {
    if (!session || !profile || profile.referred_by) return;
    let code = null;
    try { code = localStorage.getItem('vamp_ref'); } catch {}
    if (!code) return;
    supabase.rpc('claim_referral', { code }).then(({ data }) => {
      if (data) {
        try { localStorage.removeItem('vamp_ref'); } catch {}
        refreshProfile();
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user?.id, profile?.id]);

  return (
    <>
      <div className="disclaimer">
        ⚠ VAMP is a simulation game. The treasury is paper money. No real trading
        occurs on this site. Not financial advice.
      </div>
      <div className="app">
        <header className="nav">
          <NavLink to="/" className="logo">VAMP<span>.</span></NavLink>
          <nav className="links">
            <NavLink to="/">Live sets</NavLink>
            <NavLink to="/treasury">Treasury</NavLink>
            <NavLink to="/leaderboard">Leaderboard</NavLink>
            <NavLink to="/recruit">Recruit</NavLink>
          </nav>
          <div className="spacer" />
          {session ? (
            <>
              <span className="meta">{profile?.username ?? '…'}</span>
              <button className="btn ghost small" onClick={signOut}>Sign out</button>
            </>
          ) : (
            <button className="btn small" onClick={() => setShowLogin(true)}>Connect wallet</button>
          )}
        </header>

        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/set/:id" element={<SetDetail onNeedLogin={() => setShowLogin(true)} />} />
          <Route path="/treasury" element={<Treasury />} />
          <Route path="/leaderboard" element={<Leaderboard />} />
          <Route path="/recruit" element={<Referral onNeedLogin={() => setShowLogin(true)} />} />
        </Routes>

        <footer className="foot">
          VAMP is a game about spotting the original coin among copycat launches.
          All positions shown are simulated paper positions recorded at real market
          prices. No real funds are ever moved, held, or traded by this site.
          Market data is read-only. Points have no monetary value.
        </footer>
      </div>
      {showLogin && !session && <LoginModal onClose={() => setShowLogin(false)} />}
    </>
  );
}
