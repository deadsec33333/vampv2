import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { seasonKey, nextSeasonStart, countdownText } from '../lib/season';
import { timeAgo, fmtCap, fmtTick, fmtName } from './Home';

function lagText(firstIso, iso) {
  const s = Math.max(0, (new Date(iso).getTime() - new Date(firstIso).getTime()) / 1000);
  if (s < 90) return `+${Math.floor(s)}S AFTER`;
  if (s < 5400) return `+${Math.round(s / 60)}M AFTER`;
  return `+${(s / 3600).toFixed(1)}H AFTER`;
}

export default function Landing() {
  const [sets, setSets] = useState(null);
  const [feed, setFeed] = useState([]);
  const [votingCount, setVotingCount] = useState(null);
  const [threshold, setThreshold] = useState(null);
  const [settled, setSettled] = useState(null);
  const [chainFilter, setChainFilter] = useState('all');

  async function load() {
    try {
    const [{ data: s }, { data: f }, { count: vc }, { data: cfg }, { data: st }] = await Promise.all([
      supabase
        .from('vamp_sets')
        .select('id, display_name, ticker_norm, status, chain, coin_count, last_coin_at, coins!coins_vamp_set_id_fkey(mint, symbol, name, launched_at, last_market_cap_sol, market_cap_sol_at_launch), votes(coin_mint)')
        .in('status', ['voting', 'declared'])
        .order('last_coin_at', { ascending: false })
        .limit(30),
      supabase
        .from('coins')
        .select('mint, symbol, name, chain, launched_at, market_cap_sol_at_launch, vamp_sets!coins_vamp_set_id_fkey(coin_count)')
        .order('launched_at', { ascending: false })
        .limit(10),
      supabase.from('vamp_sets').select('id', { count: 'exact', head: true }).eq('status', 'voting'),
      supabase.from('game_config').select('value').eq('key', 'vote_threshold').single(),
      supabase
        .from('paper_positions')
        .select('pnl_pct, closed_at, coins(symbol)')
        .not('closed_at', 'is', null)
        .order('closed_at', { ascending: false })
        .limit(1),
    ]);
    setSets(s ?? []);
    setFeed(f ?? []);
    setVotingCount(vc);
    setThreshold(cfg?.value != null ? Number(cfg.value) : null);
    setSettled(st?.[0] ?? null);
    } catch { setSets((prev) => prev ?? []); }
  }

  useEffect(() => {
    load();
    const t = setInterval(load, 10000);
    return () => clearInterval(t);
  }, []);

  const rows = (sets ?? []).map((s) => {
    const votes = s.votes?.length ?? 0;
    const counts = {};
    for (const v of s.votes ?? []) counts[v.coin_mint] = (counts[v.coin_mint] ?? 0) + 1;
    const lead = votes ? Math.round((Math.max(...Object.values(counts)) / votes) * 100) : null;
    const mcap = Math.max(...(s.coins ?? []).map((c) => Number(c.last_market_cap_sol ?? c.market_cap_sol_at_launch ?? 0)), 0);
    return { ...s, votes, counts, lead, mcap };
  });

  // Hottest swarm: the voting set closest to declaration (most votes), newest wins ties.
  const hot = rows.filter((s) => s.status === 'voting').sort((a, b) => b.votes - a.votes)[0] ?? null;
  const hotCoins = hot
    ? [...(hot.coins ?? [])].sort((a, b) => new Date(a.launched_at) - new Date(b.launched_at)).slice(0, 3)
    : [];
  const hotLeaderMint = hot && hot.votes
    ? Object.entries(hot.counts).sort((a, b) => b[1] - a[1])[0][0]
    : null;
  const toGo = hot && threshold != null ? Math.max(0, threshold - hot.votes) : null;

  // Ticker strip events, derived from live data.
  const events = [];
  const joined = feed.find((c) => c.vamp_sets?.coin_count >= 2);
  if (joined) events.push(<span key="j"><b>${fmtTick(joined.symbol)}</b> just joined a swarm</span>);
  if (hot) events.push(
    <span key="h"><b>${fmtTick(hot.ticker_norm)}</b> {toGo != null && toGo > 0 ? `${toGo} votes from declaration` : `${hot.votes} votes and counting`}</span>
  );
  const rhCoin = feed.find((c) => c.chain === 'robinhood');
  if (rhCoin) events.push(<span key="r"><b className="gold">${fmtTick(rhCoin.symbol)}</b> new on Robinhood Chain</span>);
  if (settled?.coins?.symbol) {
    const p = Number(settled.pnl_pct ?? 0);
    events.push(
      <span key="s">treasury settled{' '}
        <b className={p >= 0 ? 'up' : 'down'}>${fmtTick(settled.coins.symbol)} {p >= 0 ? '+' : ''}{p.toFixed(0)}%</b>
      </span>
    );
  }
  const biggest = [...rows].sort((a, b) => b.coin_count - a.coin_count)[0];
  if (biggest && biggest.coin_count >= 3) events.push(<span key="b"><b>${fmtTick(biggest.ticker_norm)}</b> swarm grew to {biggest.coin_count} coins</span>);
  events.push(<span key="w">season {seasonKey()} resets in {countdownText(nextSeasonStart())}</span>);

  const listed = rows
    .filter((s) => (chainFilter === 'all' ? true : (s.chain ?? 'solana') === chainFilter))
    .slice(0, 8);

  return (
    <div className="landing">
      <div className="land-ticker mono">
        <div className="land-ticker-inner">
          {[0, 1].map((n) => (
            <div className="land-ticker-run" key={n} aria-hidden={n === 1}>
              {events.map((e, i) => (
                <span className="ev" key={i}>{e}<span className="sep">·</span></span>
              ))}
            </div>
          ))}
        </div>
      </div>

      <div className="land-hero">
        <div className="land-say">
          Every runner on <span className="glow-red">pump.fun</span> and{' '}
          <span className="glow-gold">Robinhood Chain</span> breeds a swarm of copycats
          within minutes. Vamp clusters them live.{' '}
          <span className="dim">You call the original, the paper treasury keeps score in public.</span>
        </div>
        <div className="land-bignum">
          <div className="k mono">SWARMS IN VOTING</div>
          <div className="v mono">{votingCount ?? '—'}</div>
        </div>
      </div>

      {hot && (
        <div className="hot-frame">
          <div className="hot-panel">
            <div className="hot-head">
              <span className="mono lbl">⦿ HOTTEST SWARM RIGHT NOW</span>
              <Link to={`/set/${hot.id}`} className="mono name">${fmtTick(hot.ticker_norm)} · {fmtName(hot.display_name)}</Link>
              <div className="spacer" />
              <span className="mono meta">
                {hot.votes} VOTES{toGo != null && <> · <span className="gold">{toGo > 0 ? `${toGo} TO DECLARATION` : 'DECLARATION IMMINENT'}</span></>}
              </span>
            </div>
            <div className="hot-grid">
              {hotCoins.map((c, i) => {
                const pct = hot.votes ? Math.round(((hot.counts[c.mint] ?? 0) / hot.votes) * 100) : 0;
                const isLead = c.mint === hotLeaderMint;
                return (
                  <div key={c.mint} className={`hot-card ${isLead ? 'lead' : ''}`}>
                    <div className="row1">
                      <div className="nm">{fmtName(c.name) || `$${fmtTick(c.symbol)}`}</div>
                      <div className={`mono pct ${isLead ? 'up' : ''}`}>{pct}%</div>
                    </div>
                    <div className="mono sub">
                      {i === 0 ? 'FIRST IN SWARM' : lagText(hotCoins[0].launched_at, c.launched_at)}
                      {' · '}MCAP {fmtCap(hot.chain ?? 'solana', Number(c.last_market_cap_sol ?? c.market_cap_sol_at_launch ?? 0))}
                      {(hot.chain ?? 'solana') === 'solana' && ' SOL'}
                      {' · '}{timeAgo(c.launched_at).toUpperCase()}
                    </div>
                    <div className="bar thin" style={{ marginTop: 12 }}>
                      <div className={isLead ? 'g' : 'n'} style={{ width: `${pct}%` }} />
                    </div>
                    <Link to={`/set/${hot.id}`}>
                      <button className={`btn hot-btn ${isLead ? '' : 'ghost'}`}>BACK AS THE ORIGINAL</button>
                    </Link>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      <div className="land-split">
        <div className="land-main">
          <div className="section-head" style={{ paddingLeft: 0, paddingRight: 0 }}>
            <h2>LIVE SWARMS</h2>
            <div className="chips">
              <button className={chainFilter === 'all' ? 'on' : ''} onClick={() => setChainFilter('all')}>ALL</button>
              <button className={chainFilter === 'solana' ? 'on' : ''} onClick={() => setChainFilter('solana')}>SOL</button>
              <button className={chainFilter === 'robinhood' ? 'on' : ''} onClick={() => setChainFilter('robinhood')}>RH</button>
            </div>
            <div className="spacer" />
            <Link to="/terminal" className="mono all-link">FULL TERMINAL →</Link>
          </div>
          {sets === null && <p className="sub mono" style={{ padding: '12px 0' }}>LOADING…</p>}
          {sets !== null && listed.length === 0 && (
            <p className="sub" style={{ padding: '12px 0' }}>No live swarms right now. New clusters form as copycats launch, usually within minutes.</p>
          )}
          <div className="mono">
            {listed.map((s) => (
              <Link key={s.id} to={`/set/${s.id}`} className="land-row">
                <span className={`tk ${s.status === 'declared' || (s.chain ?? 'solana') === 'robinhood' ? 'gold' : ''}`}>${fmtTick(s.ticker_norm)}</span>
                <span className="nm">
                  {fmtName(s.display_name)}
                  {(s.chain ?? 'solana') === 'robinhood' && <span className="rh"> · RH</span>}
                </span>
                <span className="d m-hide">{s.coin_count} COINS</span>
                <span className="m-hide">{s.votes} VOTES</span>
                <span className={s.status === 'declared' ? 'gold' : 'up'}>
                  {s.status === 'declared' ? 'WON' : s.lead != null ? `${s.lead}%` : '—'}
                </span>
                <span className={`chip ${s.status}`}>{s.status === 'declared' ? 'DECLARED' : 'VOTING'}</span>
              </Link>
            ))}
          </div>
          <div className="mono land-fine">
            VAMP IS A SIMULATION GAME · NO REAL TRADING OCCURS ON THIS SITE · NOT FINANCIAL ADVICE
          </div>
        </div>

        <aside className="land-rail">
          <div className="rail-head" style={{ paddingLeft: 18 }}>
            <span className="dot" />
            <h3>LAUNCH FEED</h3>
          </div>
          <div className="mono">
            {feed.map((c) => (
              <div key={c.mint} className="land-feed-row">
                <span className="t">{new Date(c.launched_at).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit' })}</span>
                <span className={`s ${(c.chain ?? 'solana') === 'robinhood' ? 'gold' : ''}`}>${fmtTick(c.symbol)}</span>
                <span className="n">{fmtName(c.name)}</span>
                {c.vamp_sets?.coin_count >= 2
                  ? <span className="chip voting">SET +{c.vamp_sets.coin_count}</span>
                  : <span className="t">{(c.chain ?? 'solana') === 'robinhood' && c.market_cap_sol_at_launch != null ? fmtCap('robinhood', c.market_cap_sol_at_launch) : ''}</span>}
              </div>
            ))}
          </div>
        </aside>
      </div>
    </div>
  );
}
