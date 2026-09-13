import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';

export function timeAgo(iso) {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `${Math.floor(s)}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

const GRID = { gridTemplateColumns: '110px 1.6fr 52px 60px 56px 50px 84px 84px 90px' };

export function fmtCap(chain, v) {
  if (v == null || !isFinite(Number(v)) || Number(v) <= 0) return '—';
  const n = Number(v);
  if (chain === 'robinhood') {
    if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
    if (n >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
    return `$${n.toFixed(0)}`;
  }
  return `${n.toFixed(1)}`;
}

export default function Home() {
  const [sets, setSets] = useState(null);
  const [filter, setFilter] = useState('all');
  const [chainFilter, setChainFilter] = useState('all');
  const [feed, setFeed] = useState([]);
  const [positions, setPositions] = useState([]);

  async function load() {
    const SET_FIELDS = 'id, display_name, ticker_norm, status, chain, coin_count, last_coin_at, voting_opened_at, coins!coins_vamp_set_id_fkey(mint, last_market_cap_sol, market_cap_sol_at_launch), votes(coin_mint)';
    const [{ data: s }, { data: rh }, { data: f }, { data: p }] = await Promise.all([
      supabase
        .from('vamp_sets')
        .select(SET_FIELDS)
        .in('status', ['voting', 'declared'])
        .order('last_coin_at', { ascending: false })
        .limit(40),
      // Robinhood Chain is low-volume: show its lone "watching" coins too,
      // so the RH tab breathes while copycats brew
      supabase
        .from('vamp_sets')
        .select(SET_FIELDS)
        .eq('chain', 'robinhood')
        .in('status', ['watching', 'voting', 'declared'])
        .order('last_coin_at', { ascending: false })
        .limit(40),
      supabase
        .from('coins')
        .select('mint, symbol, name, chain, launched_at, market_cap_sol_at_launch, vamp_sets!coins_vamp_set_id_fkey(coin_count)')
        .order('launched_at', { ascending: false })
        .limit(14),
      supabase
        .from('paper_positions')
        .select('coin_mint, pnl_pct, coins(symbol)')
        .is('closed_at', null)
        .limit(6),
    ]);
    const ids = new Set((s ?? []).map((x) => x.id));
    setSets([...(s ?? []), ...(rh ?? []).filter((x) => !ids.has(x.id))]);
    setFeed(f ?? []);
    setPositions(p ?? []);
  }

  useEffect(() => {
    load();
    const t = setInterval(load, 8000);
    return () => clearInterval(t);
  }, []);

  const rows = (sets ?? [])
    .filter((s) => (filter === 'all' ? true : s.status === filter))
    .filter((s) => (chainFilter === 'all' ? true : (s.chain ?? 'solana') === chainFilter))
    .map((s) => {
      const votes = s.votes?.length ?? 0;
      const counts = {};
      for (const v of s.votes ?? []) counts[v.coin_mint] = (counts[v.coin_mint] ?? 0) + 1;
      const lead = votes ? Math.round((Math.max(...Object.values(counts)) / votes) * 100) : null;
      // biggest coin's move since launch
      let delta = null;
      for (const c of s.coins ?? []) {
        if (c.last_market_cap_sol != null && c.market_cap_sol_at_launch > 0) {
          const d = ((c.last_market_cap_sol - c.market_cap_sol_at_launch) / c.market_cap_sol_at_launch) * 100;
          if (delta === null || Math.abs(d) > Math.abs(delta)) delta = d;
        }
      }
      const mcap = Math.max(...(s.coins ?? []).map((c) => Number(c.last_market_cap_sol ?? c.market_cap_sol_at_launch ?? 0)), 0);
      return { ...s, votes, lead, delta, mcap };
    });

  const voting = (sets ?? []).filter((s) => s.status === 'voting').length;
  const declared = (sets ?? []).filter((s) => s.status === 'declared').length;

  return (
    <div className="wrap">
      <div className="main">
        <div className="section-head">
          <h2>LIVE VAMP SETS</h2>
          <span className="count">{voting} VOTING · {declared} DECLARED</span>
          <div className="spacer" />
          <div className="chips">
            <button className={chainFilter === 'all' ? 'on' : ''} onClick={() => setChainFilter('all')}>ALL CHAINS</button>
            <button className={chainFilter === 'solana' ? 'on' : ''} onClick={() => setChainFilter('solana')}>SOL</button>
            <button className={chainFilter === 'robinhood' ? 'on' : ''} onClick={() => setChainFilter('robinhood')}>RH</button>
          </div>
          <div className="chips">
            <button className={filter === 'all' ? 'on' : ''} onClick={() => setFilter('all')}>ALL</button>
            <button className={filter === 'voting' ? 'on' : ''} onClick={() => setFilter('voting')}>VOTING</button>
            <button className={filter === 'declared' ? 'on' : ''} onClick={() => setFilter('declared')}>DECLARED</button>
          </div>
        </div>

        <div className="thead" style={GRID}>
          <div>TICKER</div><div>NARRATIVE</div><div className="r">COINS</div><div className="r">VOTES</div>
          <div className="r">LEAD</div><div className="r">AGE</div><div className="r">MCAP</div><div className="r">Δ LAUNCH</div><div className="r">STATUS</div>
        </div>

        {sets === null && <p className="sub mono" style={{ padding: 16 }}>LOADING…</p>}
        {sets !== null && rows.length === 0 && (
          <p className="sub" style={{ padding: 16 }}>No live sets right now. New clusters form as copycats launch, usually within minutes.</p>
        )}
        {rows.map((s) => (
          <Link key={s.id} to={`/set/${s.id}`} className="trow" style={GRID}>
            <div className={`tick ${s.status === 'declared' ? 'won' : ''}`}>
              ${s.ticker_norm}{(s.chain ?? 'solana') === 'robinhood' && <span className="chip muted" style={{ marginLeft: 6 }}>RH</span>}
            </div>
            <div className="name">{s.display_name}</div>
            <div className="r">{s.coin_count}</div>
            <div className="r">{s.votes}</div>
            <div className={`r m-hide ${s.status === 'declared' ? 'gold' : 'up'}`}>{s.status === 'declared' ? 'WON' : s.lead != null ? `${s.lead}%` : '—'}</div>
            <div className="r m-hide" style={{ color: 'var(--dim)' }}>{timeAgo(s.last_coin_at)}</div>
            <div className="r m-hide">{fmtCap(s.chain ?? 'solana', s.mcap)}</div>
            <div className={`r m-hide ${s.delta == null ? '' : s.delta >= 0 ? 'up' : 'down'}`}>
              {s.delta == null ? '—' : `${s.delta >= 0 ? '+' : ''}${s.delta.toFixed(1)}%`}
            </div>
            <div className="r">
              <span className={`chip ${s.status === 'watching' ? 'muted' : s.status}`}>
                {s.status === 'declared' ? 'DECLARED' : s.status === 'watching' ? 'WATCHING' : 'VOTING'}
              </span>
            </div>
          </Link>
        ))}

        <div className="foot">
          VAMP IS A SIMULATION GAME · NO REAL TRADING OCCURS ON THIS SITE · NOT FINANCIAL ADVICE
        </div>
      </div>

      <aside className="rail">
        <div className="rail-head">
          <span className="dot" />
          <h3>LAUNCH FEED</h3>
          <span className="src">PUMP.FUN · LIVE</span>
        </div>
        <div style={{ flex: 1, overflow: 'hidden' }}>
          {feed.map((c) => (
            <div key={c.mint} className="feed-row">
              <span className="t">{new Date(c.launched_at).toLocaleTimeString([], { hour12: false })}</span>
              <span className="s">${c.symbol}</span>
              {(c.chain ?? 'solana') === 'robinhood' && <span className="chip muted">RH</span>}
              <span className="n">{c.name}</span>
              {c.vamp_sets?.coin_count >= 2
                ? <span className="chip voting">SET +{c.vamp_sets.coin_count}</span>
                : <span className="t">{(c.chain ?? 'solana') === 'solana' && c.market_cap_sol_at_launch != null ? Number(c.market_cap_sol_at_launch).toFixed(1) : ''}</span>}
            </div>
          ))}
        </div>
        <div className="rail-block">
          <h4>OPEN PAPER POSITIONS</h4>
          {positions.length === 0 && <div className="kv"><span style={{ color: 'var(--dim2)' }}>NONE OPEN</span></div>}
          {positions.map((p) => (
            <div key={p.coin_mint} className="kv">
              <span>${p.coins?.symbol}</span>
              <span className={Number(p.pnl_pct) >= 0 ? 'up' : 'down'}>
                {Number(p.pnl_pct) >= 0 ? '+' : ''}{Number(p.pnl_pct ?? 0).toFixed(1)}%
              </span>
            </div>
          ))}
        </div>
      </aside>
    </div>
  );
}
