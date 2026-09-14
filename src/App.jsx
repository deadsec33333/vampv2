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
import Rules from './pages/Rules';
import Landing from './pages/Landing';
import Twins from './pages/Twins';
import Auction from './pages/Auction';

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
      const [{ count: launches }, { count: activeSets }] = await Promise.all([
        supabase.from('coins').select('mint', { count: 'exact', head: true }).gte('launched_at', tenMinAgo),
        supabase.from('vamp_sets').select('id', { count: 'exact', head: true }).eq('status', 'voting'),
      ]);
      let sol = null;
      let eth = null;
      try {
        const r = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=solana,ethereum&vs_currencies=usd&include_24hr_change=true');
        const j = await r.json();
        sol = j?.solana ? { usd: j.solana.usd, chg: j.solana.usd_24h_change } : null;
        eth = j?.ethereum ? { usd: j.ethereum.usd, chg: j.ethereum.usd_24h_change } : null;
      } catch { /* stats hidden when unreachable */ }
      if (!dead) setStats({ launchesPerMin: launches != null ? (launches / 10).toFixed(1) : null, activeSets, sol, eth });
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
  rules: <svg width="20" height="20" viewBox="0 0 20 20" fill="none" strokeWidth="1.6"><path d="M4 3.5 H12 A2.5 2.5 0 0 1 14.5 6 V16.5 H6.5 A2.5 2.5 0 0 1 4 14 Z" /><path d="M14.5 16.5 A2 2 0 0 0 16.5 14.5 V5.5" /><path d="M7 7.5 H11.5" /><path d="M7 10.5 H11.5" /></svg>,
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
          <img src="/logo.png" alt="Vamp" style={{ width: 28, height: 28, borderRadius: '50%' }} />
          <span className="word">VAMP</span>
          <span className="tag">TERMINAL</span>
        </NavLink>
        <div className="stats">
          {stats.sol && (
            <div><span className="k">SOL/USD </span>{stats.sol.usd.toFixed(2)}{' '}
              <span className={stats.sol.chg >= 0 ? 'up' : 'down'}>{stats.sol.chg >= 0 ? '+' : ''}{stats.sol.chg.toFixed(1)}%</span>
            </div>
          )}
          {stats.eth && (
            <div><span className="k">ETH/USD </span>{stats.eth.usd.toFixed(0)}{' '}
              <span className={stats.eth.chg >= 0 ? 'up' : 'down'}>{stats.eth.chg >= 0 ? '+' : ''}{stats.eth.chg.toFixed(1)}%</span>
            </div>
          )}
          {stats.launchesPerMin != null && <div><span className="k">LAUNCHES/MIN </span>{stats.launchesPerMin}</div>}
          {stats.activeSets != null && <div><span className="k">ACTIVE SETS </span>{stats.activeSets}</div>}
        </div>
        <div className="spacer" />
        <a
          href="https://x.com/vamppro"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Vamp on X"
          style={{ display: 'flex', alignItems: 'center', color: 'var(--dim)', padding: '6px 4px' }}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M2.5 2.5 L13.5 13.5" />
            <path d="M13.5 2.5 L2.5 13.5" />
          </svg>
        </a>
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
        <NavLink to="/terminal">TERMINAL</NavLink>
        <NavLink to="/swipe">SWIPE</NavLink>
        <NavLink to="/twins">TWINS</NavLink>
        <NavLink to="/auction">AUCTION</NavLink>
        <NavLink to="/treasury">TREASURY</NavLink>
        <NavLink to="/leaderboard">LEADERBOARD</NavLink>
        <NavLink to="/recruit">RECRUIT</NavLink>
        <NavLink to="/rules">RULES</NavLink>
      </nav>

      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/terminal" element={<Home />} />
        <Route path="/twins" element={<Twins />} />
        <Route path="/auction" element={<Auction onNeedLogin={() => setShowLogin(true)} />} />
        <Route path="/set/:id" element={<SetDetail onNeedLogin={() => setShowLogin(true)} />} />
        <Route path="/swipe" element={<Swipe onNeedLogin={() => setShowLogin(true)} />} />
        <Route path="/treasury" element={<Treasury />} />
        <Route path="/leaderboard" element={<Leaderboard />} />
        <Route path="/recruit" element={<Referral onNeedLogin={() => setShowLogin(true)} />} />
        <Route path="/rules" element={<Rules />} />
      </Routes>

      <nav className="bottomnav">
        <NavLink to="/terminal">{icons.sets}<span>SETS</span></NavLink>
        <NavLink to="/swipe">{icons.swipe}<span>SWIPE</span></NavLink>
        <NavLink to="/treasury">{icons.treasury}<span>TREASURY</span></NavLink>
        <NavLink to="/leaderboard">{icons.ranks}<span>RANKS</span></NavLink>
        <NavLink to="/rules">{icons.rules}<span>RULES</span></NavLink>
      </nav>

      {showLogin && !session && <LoginModal onClose={() => setShowLogin(false)} />}
    </>
  );
}
