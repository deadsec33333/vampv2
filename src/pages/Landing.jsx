import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { seasonKey } from '../lib/season';

export default function Landing() {
  const [stats, setStats] = useState({});

  useEffect(() => {
    async function load() {
      const dayAgo = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
      const [{ count: launches }, { count: activeSets }] = await Promise.all([
        supabase.from('coins').select('mint', { count: 'exact', head: true }).gte('launched_at', dayAgo),
        supabase.from('vamp_sets').select('id', { count: 'exact', head: true }).eq('status', 'voting'),
      ]);
      setStats({ launches, activeSets });
    }
    load();
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '80px 20px 60px', textAlign: 'center', background: 'radial-gradient(700px 340px at 50% 0%, rgba(246,70,93,0.09), transparent 70%)' }}>
        <img src="/logo.png" alt="" style={{ width: 84, height: 84, borderRadius: '50%', marginBottom: 26 }} />
        <div className="mono" style={{ fontSize: 12, letterSpacing: '0.22em', color: 'var(--red)', marginBottom: 20 }}>
          EVERY RUNNER BREEDS A SWARM
        </div>
        <h1 style={{ fontSize: 'clamp(44px, 8vw, 84px)', fontWeight: 700, letterSpacing: '-0.03em', lineHeight: 1.02, margin: 0 }}>
          SPOT THE<br />REAL RUNNER.
        </h1>
        <p style={{ maxWidth: 620, margin: '26px auto 0', fontSize: 17, lineHeight: 1.6, color: 'var(--dim)' }}>
          Every hot memecoin instantly spawns copycats built to feed on its hype.
          VAMP clusters the swarms live, on Solana and Robinhood Chain, and asks one
          question: which one is the original? Vote early. The scoreboard remembers.
        </p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginTop: 34, flexWrap: 'wrap' }}>
          <Link to="/terminal"><button className="btn" style={{ padding: '15px 30px', fontSize: 13 }}>OPEN TERMINAL</button></Link>
          <Link to="/rules"><button className="btn ghost" style={{ padding: '15px 30px', fontSize: 13 }}>READ THE RULES</button></Link>
        </div>
        <div className="mono" style={{ display: 'flex', gap: 30, justifyContent: 'center', marginTop: 50, fontSize: 12, flexWrap: 'wrap' }}>
          {stats.launches != null && <div><span style={{ color: 'var(--dim2)' }}>LAUNCHES TRACKED 24H </span><b>{stats.launches.toLocaleString()}</b></div>}
          {stats.activeSets != null && <div><span style={{ color: 'var(--dim2)' }}>ACTIVE VAMP SETS </span><b>{stats.activeSets}</b></div>}
          <div><span style={{ color: 'var(--dim2)' }}>CHAINS WATCHED </span><b>2</b></div>
          <div><span style={{ color: 'var(--dim2)' }}>SEASON </span><b className="gold">{seasonKey()}</b></div>
        </div>
      </div>

      <div style={{ padding: '30px 20px 0' }}>
        <div className="mono" style={{ fontSize: 11, letterSpacing: '0.2em', color: 'var(--dim2)', marginBottom: 16 }}>HOW IT WORKS</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14 }}>
          {[
            ['01', 'Watch the swarm', "Collectors stream every launch from pump.fun and Robinhood Chain's pads, clustering copycats by ticker and name within seconds of birth."],
            ['02', 'Back the original', 'One vote per set. When a coin hits the threshold, the simulated treasury paper-buys it at the real market price. Early conviction weighs double.'],
            ['03', 'Climb the season', 'Positions settle after 24 hours and PnL becomes points. Wrong picks bleed. Every Monday the board resets and one degen enters the Hall of Runners.'],
          ].map(([n, t, d]) => (
            <div key={n} className="panel" style={{ padding: 24 }}>
              <div className="mono" style={{ fontSize: 13, color: 'var(--red)', fontWeight: 600 }}>{n}</div>
              <div style={{ fontSize: 19, fontWeight: 700, marginTop: 10 }}>{t}</div>
              <div style={{ fontSize: 14, lineHeight: 1.6, color: 'var(--dim)', marginTop: 10 }}>{d}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="panel" style={{ margin: '30px 20px 0', display: 'flex', alignItems: 'center', gap: 26, padding: 30, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 260 }}>
          <div className="mono" style={{ fontSize: 11, letterSpacing: '0.2em', color: 'var(--gold)', marginBottom: 12 }}>TWIN SETS</div>
          <div style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1.15 }}>One narrative. Two chains.<br />Double the hunt.</div>
          <p style={{ fontSize: 14, lineHeight: 1.65, color: 'var(--dim)', marginTop: 12, maxWidth: 460 }}>
            When the same coin lives on Solana and Robinhood Chain at once, VAMP pairs
            them into a Twin Set: both market caps side by side, live divergence, and
            the sharpest question in the game.
          </p>
          <Link to="/twins"><button className="btn ghost small" style={{ marginTop: 14 }}>SEE TWIN SETS</button></Link>
        </div>
        <div style={{ flex: 1, minWidth: 260 }}>
          <div className="mono" style={{ fontSize: 11, letterSpacing: '0.2em', color: 'var(--red)', marginBottom: 12 }}>SPOTLIGHT AUCTION</div>
          <div style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1.15 }}>Burn points.<br />Own the spotlight.</div>
          <p style={{ fontSize: 14, lineHeight: 1.65, color: 'var(--dim)', marginTop: 12, maxWidth: 460 }}>
            Every day at 21:00 UTC the spotlight slot goes to auction. Bid season points,
            pin any live vamp set to everyone's terminal for 24 hours, and the winning
            bid burns forever. No money. Pure flex.
          </p>
          <Link to="/auction"><button className="btn ghost small" style={{ marginTop: 14 }}>GO TO AUCTION</button></Link>
        </div>
      </div>

      <div className="foot" style={{ textAlign: 'center', marginTop: 40 }}>
        VAMP IS A SIMULATION GAME · NO REAL TRADING OCCURS ON THIS SITE · POINTS HAVE NO MONETARY VALUE · NOT FINANCIAL ADVICE
      </div>
    </div>
  );
}
