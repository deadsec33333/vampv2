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
import Swipe from './pages/Swipe';

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
        <h2>CONNECT WALLET</h2>
        <p className="fine">
          Your wallet signs one free message to prove it's yours. That's it.
          VAMP never asks for transactions, never touches your funds, and has
          no buy buttons. The treasury here is fake money in a simulation game.
        </p>
        <Turnstile onToken={onToken} />
        <button className="btn" disabled={busy} onClick={go}>
          {busy ? 'WAITING FOR WALLET…' : 'SIGN IN WITH SOLANA'}
        </button>
        {authError && <div className="err">{authError}</div>}
        <p className="fine" style={{ marginTop: 14 }}>
          Works with Phantom, Solflare, Backpack and other Solana wallets.
        </p>
      </div>
    </div>
  );
}

function useTopStats() {
  const [stats, setStats] = useState({});
  useEffect(() => {
    let dead = false;
    async function load() {
      const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
      const [{ count: launches }, { count: activeSets }, { data: positions }] = await Promise.all([
        supabase.from('coins').select('mint', { count: 'exact', head: true }).gte('launched_at', tenMinAgo),
        supabase.from('vamp_sets').select('id', { count: 'exact', head: true }).eq('status', 'voting'),
        supabase.from('paper_positions').select('paper_size_sol, pnl_pct').limit(500),
      ]);
      let pnl = 0;
      for (const p of positions ?? []) pnl += (Number(p.paper_size_sol) || 0) * ((Number(p.pnl_pct) || 0) / 100);
      let sol = null;
      try {
        const r = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd&include_24hr_change=true');
        const j = await r.json();
        sol = j?.solana ? { usd: j.solana.usd, chg: j.solana.usd_24h_change } : null;
      } catch { /* stat hidden when unreachable */ }
      if (!dead) setStats({ launchesPerMin: launches != null ? (launches / 10).toFixed(1) : null, activeSets, pnl, sol });
    }
    load();
    const t = setInterval(load, 30000);
    return () => { dead = true; clearInterval(t); };
  }, []);
  return stats;
}

const icons = {
  sets: <svg width="20" height="20" viewBox="0 0 20 20" fill="none" strokeWidth="1.6"><rect x="2.5" y="2.5" width="6" height="6" rx="1" /><rect x="11.5" y="2.5" width="6" height="6" rx="1" /><rect x="2.5" y="11.5" width="6" height="6" rx="1" /><rect x="11.5" y="11.5" width="6" height="6" rx="1" /></svg>,
  swipe: <svg width="20" height="20" viewBox="0 0 20 20" fill="none" strokeWidth="1.6"><rect x="5" y="2.5" width="10" height="15" rx="2" transform="rotate(-8 10 10)" /><path d="M13 6 L15.5 8.5" /></svg>,
  treasury: <svg width="20" height="20" viewBox="0 0 20 20" fill="none" strokeWidth="1.6"><path d="M3 8 L10 3 L17 8" /><rect x="4.5" y="8" width="11" height="8.5" rx="1" /><path d="M8.5 12 H11.5" /></svg>,
  ranks: <svg width="20" height="20" viewBox="0 0 20 20" fill="none" strokeWidth="1.6"><path d="M6 3 H14 V8 A4 4 0 0 1 6 8 Z" /><path d="M10 12 V15" /><path d="M7 17 H13" /><path d="M6 5 H3.5 V6.5 A2.5 2.5 0 0 0 6 9" /><path d="M14 5 H16.5 V6.5 A2.5 2.5 0 0 1 14 9" /></svg>,
};

export default function App() {
  const { session, profile, signOut, refreshProfile } = useAuth();
  const [showLogin, setShowLogin] = useState(false);
  const stats = useTopStats();

  useEffect(() => {
    const ref = new URLSearchParams(window.location.search).get('ref');
    if (ref) { try { localStorage.setItem('vamp_ref', ref); } catch {} }
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
      <div className="topbar">
        <NavLink to="/" className="brand">
          <span className="block" />
          <span className="word">VAMP</span>
          <span className="tag">TERMINAL</span>
        </NavLink>
        <div className="stats">
          {stats.sol && (
            <div><span className="k">SOL/USD </span>{stats.sol.usd.toFixed(2)}{' '}
              <span className={stats.sol.chg >= 0 ? 'up' : 'down'}>{stats.sol.chg >= 0 ? '+' : ''}{stats.sol.chg.toFixed(1)}%</span>
            </div>
          )}
          {stats.launchesPerMin != null && <div><span className="k">LAUNCHES/MIN </span>{stats.launchesPerMin}</div>}
          {stats.activeSets != null && <div><span className="k">ACTIVE SETS </span>{stats.activeSets}</div>}
          {stats.pnl != null && (
            <div><span className="k">PAPER PNL </span>
              <span className={stats.pnl >= 0 ? 'up' : 'down'}>{stats.pnl >= 0 ? '+' : ''}{stats.pnl.toFixed(1)} SOL</span>
            </div>
          )}
        </div>
        <div className="spacer" />
        {session ? (
          <>
            <span className="mono" style={{ fontSize: 11, color: 'var(--dim)' }}>{profile?.username ?? '…'}</span>
            <button className="btn ghost small" onClick={signOut}>EXIT</button>
          </>
        ) : (
          <button className="btn small" onClick={() => setShowLogin(true)}>CONNECT WALLET</button>
        )}
      </div>

      <nav className="tabs">
        <NavLink to="/" end>TERMINAL</NavLink>
        <NavLink to="/swipe">SWIPE</NavLink>
        <NavLink to="/treasury">TREASURY</NavLink>
        <NavLink to="/leaderboard">LEADERBOARD</NavLink>
        <NavLink to="/recruit">RECRUIT</NavLink>
        <div className="spacer" />
        <span className="sim-chip">SIMULATION · PAPER MONEY ONLY</span>
      </nav>

      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/set/:id" element={<SetDetail onNeedLogin={() => setShowLogin(true)} />} />
        <Route path="/swipe" element={<Swipe onNeedLogin={() => setShowLogin(true)} />} />
        <Route path="/treasury" element={<Treasury />} />
        <Route path="/leaderboard" element={<Leaderboard />} />
        <Route path="/recruit" element={<Referral onNeedLogin={() => setShowLogin(true)} />} />
      </Routes>

      <nav className="bottomnav">
        <NavLink to="/" end>{icons.sets}<span>SETS</span></NavLink>
        <NavLink to="/swipe">{icons.swipe}<span>SWIPE</span></NavLink>
        <NavLink to="/treasury">{icons.treasury}<span>TREASURY</span></NavLink>
        <NavLink to="/leaderboard">{icons.ranks}<span>RANKS</span></NavLink>
      </nav>

      {showLogin && !session && <LoginModal onClose={() => setShowLogin(false)} />}
    </>
  );
}
