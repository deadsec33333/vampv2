import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { fmtTick, fmtName, fmtCap, timeAgo } from './Home';

const SUPPLY = 1e9; // both pump.fun and RH launchpad tokens mint 1B

function fmtUsd(v) {
  if (v == null || !isFinite(v) || v <= 0) return '—';
  if (v >= 1e9) return `$${(v / 1e9).toFixed(2)}B`;
  if (v >= 1e6) return `$${(v / 1e6).toFixed(2)}M`;
  if (v >= 1e3) return `$${(v / 1e3).toFixed(1)}K`;
  return `$${v.toFixed(0)}`;
}

function fmtPrice(mcapUsd) {
  if (mcapUsd == null || mcapUsd <= 0) return '—';
  const p = mcapUsd / SUPPLY;
  if (p >= 1) return `$${p.toFixed(2)}`;
  if (p >= 0.001) return `$${p.toFixed(6)}`;
  return `$${p.toExponential(2)}`;
}

function shortCA(a) {
  if (!a) return '—';
  return a.length > 22 ? `${a.slice(0, 10)}…${a.slice(-8)}` : a;
}

function CopyBtn({ text }) {
  const [ok, setOk] = useState(false);
  return (
    <button
      className="twin-copy mono"
      onClick={() => {
        try { navigator.clipboard.writeText(text); setOk(true); setTimeout(() => setOk(false), 1200); } catch {}
      }}
    >
      {ok ? 'COPIED' : 'COPY'}
    </button>
  );
}

// A number that flashes green/red when it moves.
function LiveUsd({ value, className = '' }) {
  const prev = useRef(value);
  const [flash, setFlash] = useState('');
  useEffect(() => {
    if (prev.current != null && value != null && value !== prev.current) {
      setFlash(value > prev.current ? 'flash-up' : 'flash-down');
      const t = setTimeout(() => setFlash(''), 700);
      prev.current = value;
      return () => clearTimeout(t);
    }
    prev.current = value;
  }, [value]);
  return <span className={`${className} ${flash}`}>{fmtUsd(value)}</span>;
}

const RANGES = {
  '15M': { ms: 15 * 60e3, bucket: 15 },
  '1H': { ms: 3600e3, bucket: 30 },
  '6H': { ms: 6 * 3600e3, bucket: 180 },
  '24H': { ms: 24 * 3600e3, bucket: 600 },
};

function TwinChart({ solMint, rhMint, solUsd }) {
  const [range, setRange] = useState('15M');
  const [rows, setRows] = useState(null);
  const [hover, setHover] = useState(null); // fraction 0..1 across the plot
  const bodyRef = useRef(null);

  // initial + fallback load
  useEffect(() => {
    let dead = false;
    async function load() {
      const { ms, bucket } = RANGES[range];
      const since = new Date(Date.now() - ms).toISOString();
      const { data } = await supabase.rpc('twin_ticks', { p_mints: [solMint, rhMint], p_since: since, p_bucket_sec: bucket });
      if (!dead) setRows(data ?? []);
    }
    load();
    const t = setInterval(load, 60000);
    return () => { dead = true; clearInterval(t); };
  }, [solMint, rhMint, range]);

  // realtime: every new tick lands on the chart the second it's written
  useEffect(() => {
    const ch = supabase
      .channel(`twin-ticks-${solMint.slice(0, 8)}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'price_ticks', filter: `mint=eq.${solMint}` },
        (p) => setRows((r) => [...(r ?? []), { mint: p.new.mint, bucket: p.new.ts, mcap: p.new.mcap }]))
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'price_ticks', filter: `mint=eq.${rhMint}` },
        (p) => setRows((r) => [...(r ?? []), { mint: p.new.mint, bucket: p.new.ts, mcap: p.new.mcap }]))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [solMint, rhMint]);

  const chart = useMemo(() => {
    if (!rows || !solUsd) return null;
    const cutoff = Date.now() - RANGES[range].ms;
    const solRaw = new Map();
    const rhRaw = new Map();
    for (const r of rows) {
      const t = new Date(r.bucket).getTime();
      if (t < cutoff) continue;
      if (r.mint === solMint) solRaw.set(t, Number(r.mcap) * solUsd);
      else if (r.mint === rhMint) rhRaw.set(t, Number(r.mcap));
    }
    if (solRaw.size < 2 || rhRaw.size < 2) return { empty: true, have: solRaw.size + rhRaw.size };

    const times = [...new Set([...solRaw.keys(), ...rhRaw.keys()])].sort((a, b) => a - b);
    let s = null; let r = null;
    const pts = times.map((t) => {
      if (solRaw.has(t)) s = solRaw.get(t);
      if (rhRaw.has(t)) r = rhRaw.get(t);
      return { t, s, r };
    }).filter((p) => p.s != null && p.r != null);
    if (pts.length < 2) return { empty: true };

    const W = 1000; const H = 300; const PAD_L = 6; const PAD_R = 6; const PAD_T = 14; const PAD_B = 26;
    const t0 = pts[0].t; const t1 = pts[pts.length - 1].t;
    const vals = pts.flatMap((p) => [p.s, p.r]);
    let vMin = Math.min(...vals); let vMax = Math.max(...vals);
    const span = Math.max(vMax - vMin, vMax * 0.02, 1);
    vMin -= span * 0.10; vMax += span * 0.10;
    const X = (t) => PAD_L + ((t - t0) / Math.max(1, t1 - t0)) * (W - PAD_L - PAD_R);
    const Y = (v) => PAD_T + (1 - (v - vMin) / (vMax - vMin)) * (H - PAD_T - PAD_B);

    const solPath = pts.map((p, i) => `${i ? 'L' : 'M'}${X(p.t).toFixed(1)},${Y(p.s).toFixed(1)}`).join('');
    const rhPath = pts.map((p, i) => `${i ? 'L' : 'M'}${X(p.t).toFixed(1)},${Y(p.r).toFixed(1)}`).join('');

    const bands = [];
    let run = null;
    const inside = (p) => Math.abs((p.r - p.s) / ((p.r + p.s) / 2)) <= 0.05;
    for (const p of pts) {
      const st = inside(p);
      if (!run || run.state !== st) { run = { state: st, pts: run ? [run.pts[run.pts.length - 1]] : [] }; bands.push(run); }
      run.pts.push(p);
    }
    const bandPolys = bands.filter((b) => b.pts.length > 1).map((b, i) => ({
      key: i,
      state: b.state,
      d: b.pts.map((p, j) => `${j ? 'L' : 'M'}${X(p.t).toFixed(1)},${Y(p.s).toFixed(1)}`).join('') +
         [...b.pts].reverse().map((p) => `L${X(p.t).toFixed(1)},${Y(p.r).toFixed(1)}`).join('') + 'Z',
    }));

    const gridN = 4;
    const grid = Array.from({ length: gridN }, (_, i) => {
      const v = vMin + ((i + 1) / (gridN + 1)) * (vMax - vMin);
      return { y: Y(v), label: fmtUsd(v) };
    });
    const ticksN = 6;
    const xTicks = Array.from({ length: ticksN }, (_, i) => {
      const t = t0 + ((i + 0.5) / ticksN) * (t1 - t0);
      return { x: X(t), label: new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }) };
    });
    const last = pts[pts.length - 1];
    return { pts, X, Y, solPath, rhPath, bandPolys, grid, xTicks, W, H, PAD_L, PAD_R, last, lastXY: { x: X(last.t), ys: Y(last.s), yr: Y(last.r) } };
  }, [rows, solUsd, solMint, rhMint, range]);

  // crosshair: nearest point to the pointer
  const hov = useMemo(() => {
    if (!chart || chart.empty || hover == null) return null;
    const tx = chart.PAD_L + hover * (chart.W - chart.PAD_L - chart.PAD_R);
    let best = null;
    for (const p of chart.pts) {
      const d = Math.abs(chart.X(p.t) - tx);
      if (!best || d < best.d) best = { d, p };
    }
    if (!best) return null;
    const p = best.p;
    const spread = ((p.r - p.s) / ((p.r + p.s) / 2)) * 100;
    return { p, x: chart.X(p.t), ys: chart.Y(p.s), yr: chart.Y(p.r), spread };
  }, [chart, hover]);

  return (
    <div className="twin-chart panel">
      <div className="twin-chart-head">
        <div className="mono legend">
          <span><i className="sw sol" /> pump.fun market cap</span>
          <span><i className="sw rh" /> RH market cap</span>
          <span><i className="sw in" /> spread inside the 5% band</span>
          <span><i className="sw out" /> outside</span>
        </div>
        <div className="spacer" />
        <span className="mono live-tag"><i />LIVE</span>
        <div className="chips">
          {Object.keys(RANGES).map((k) => (
            <button key={k} className={range === k ? 'on' : ''} onClick={() => setRange(k)}>{k}</button>
          ))}
        </div>
      </div>
      {(!chart || chart.empty) ? (
        <div className="mono twin-chart-empty">
          {rows === null ? 'LOADING…' : 'COLLECTING LIVE TICKS — THE CHART STARTS DRAWING WITHIN A MINUTE OF THE COLLECTOR RUNNING'}
        </div>
      ) : (
        <div
          className="twin-chart-body"
          ref={bodyRef}
          onPointerMove={(e) => {
            const el = bodyRef.current;
            if (!el) return;
            const r = el.getBoundingClientRect();
            const innerW = r.width - 62 - 4; // matches CSS padding
            setHover(Math.max(0, Math.min(1, (e.clientX - r.left - 4) / innerW)));
          }}
          onPointerLeave={() => setHover(null)}
        >
          <svg viewBox={`0 0 ${chart.W} ${chart.H}`} preserveAspectRatio="none">
            {chart.grid.map((g, i) => (
              <line key={i} x1="0" x2={chart.W} y1={g.y} y2={g.y} stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
            ))}
            {chart.bandPolys.map((b) => (
              <path key={b.key} d={b.d} fill={b.state ? 'rgba(22,199,132,0.14)' : 'rgba(246,70,93,0.14)'} />
            ))}
            <path d={chart.solPath} fill="none" stroke="#f6465d" strokeWidth="2" vectorEffect="non-scaling-stroke" />
            <path d={chart.rhPath} fill="none" stroke="#f0b90b" strokeWidth="2" vectorEffect="non-scaling-stroke" />
            {/* live edge pulses */}
            <circle className="pulse-ring sol" cx={chart.lastXY.x} cy={chart.lastXY.ys} r="5" />
            <circle cx={chart.lastXY.x} cy={chart.lastXY.ys} r="3" fill="#f6465d" />
            <circle className="pulse-ring rh" cx={chart.lastXY.x} cy={chart.lastXY.yr} r="5" />
            <circle cx={chart.lastXY.x} cy={chart.lastXY.yr} r="3" fill="#f0b90b" />
            {hov && (
              <g>
                <line x1={hov.x} x2={hov.x} y1="0" y2={chart.H} stroke="rgba(255,255,255,0.25)" strokeWidth="1" strokeDasharray="3 3" />
                <circle cx={hov.x} cy={hov.ys} r="4" fill="#f6465d" stroke="#0b0d11" strokeWidth="1.5" />
                <circle cx={hov.x} cy={hov.yr} r="4" fill="#f0b90b" stroke="#0b0d11" strokeWidth="1.5" />
              </g>
            )}
          </svg>
          <div className="ylabels mono">
            {chart.grid.map((g, i) => (
              <span key={i} style={{ top: `${(g.y / chart.H) * 100}%` }}>{g.label}</span>
            ))}
          </div>
          <div className="xlabels mono">
            {chart.xTicks.map((t, i) => (
              <span key={i} style={{ left: `${(t.x / chart.W) * 100}%` }}>{t.label}</span>
            ))}
          </div>
          <div className="endtags mono">
            <span className="rh" style={{ top: `${(chart.lastXY.yr / chart.H) * 100}%` }}>{fmtUsd(chart.last.r)}</span>
            <span className="sol" style={{ top: `${(chart.lastXY.ys / chart.H) * 100}%` }}>{fmtUsd(chart.last.s)}</span>
          </div>
          {hov && (
            <div
              className="twin-tip mono"
              style={{ left: `${(hov.x / chart.W) * 100}%`, transform: `translateX(${hov.x > chart.W * 0.7 ? '-108%' : '8px'})` }}
            >
              <div className="t">{new Date(hov.p.t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}</div>
              <div><i className="sw sol" /> {fmtUsd(hov.p.s)}</div>
              <div><i className="sw rh" /> {fmtUsd(hov.p.r)}</div>
              <div className={Math.abs(hov.spread) <= 5 ? 'up' : 'down'}>
                SPREAD {hov.spread >= 0 ? '+' : ''}{hov.spread.toFixed(1)}%
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ChainCard({ side, chainLabel, srcLabel, coin, mcapUsd, nativeLine, viewHref, viewLabel, setId, pulling }) {
  return (
    <div className={`twin-card ${side} ${pulling ? 'pulling' : ''}`}>
      <div className="twin-card-head">
        <span className={`dot ${side}`} />
        <b>{chainLabel}</b>
        <div className="spacer" />
        <span className="mono src">{srcLabel}</span>
      </div>
      <div className="mono k">MARKET CAP</div>
      <div className="mono big"><LiveUsd value={mcapUsd} /></div>
      <div className="twin-stats">
        <div>
          <div className="mono k">PRICE</div>
          <div className="mono v">{fmtPrice(mcapUsd)}</div>
        </div>
        <div>
          <div className="mono k">{nativeLine.k}</div>
          <div className="mono v">{nativeLine.v}</div>
        </div>
      </div>
      <div className="twin-ca mono">
        <span className="k">CA</span>
        <span className="a" title={coin?.mint}>{shortCA(coin?.mint)}</span>
        {coin?.mint && <CopyBtn text={coin.mint} />}
      </div>
      <div className="twin-actions">
        <Link to={`/set/${setId}`}><button className="btn small">VOTE ON THIS SET</button></Link>
        {coin?.mint && (
          <a href={viewHref} target="_blank" rel="noopener noreferrer">
            <button className="btn ghost small">{viewLabel} ↗</button>
          </a>
        )}
      </div>
    </div>
  );
}

// A pair is LIVE when both chains have a fresh price and real size behind it.
const FRESH_MS = 45 * 60 * 1000;
function isLive(t) {
  const fresh = (u) => u && Date.now() - new Date(u).getTime() < FRESH_MS;
  return fresh(t.sol_upd) && fresh(t.rh_upd) && Number(t.sol_mcap) >= 25 && Number(t.rh_mcap) >= 10000;
}

function actScore(t) {
  return Math.max(
    ...[t.sol_upd, t.rh_upd, t.sol_last, t.rh_last].filter(Boolean).map((x) => new Date(x).getTime()),
    0,
  );
}

export default function Twins() {
  const [pairs, setPairs] = useState(null);
  const [leads, setLeads] = useState({});   // set_id -> lead coin row
  const [solUsd, setSolUsd] = useState(null);

  useEffect(() => {
    let dead = false;
    async function load() {
      const { data: all } = await supabase.from('twin_pairs_full').select('*').limit(200);
      if (dead) return;
      // one pair per ticker: prefer the live one, then the most recently active
      const byTick = new Map();
      for (const t of all ?? []) {
        const cur = byTick.get(t.ticker_norm);
        if (!cur || (isLive(t) && !isLive(cur)) || (isLive(t) === isLive(cur) && actScore(t) > actScore(cur))) {
          byTick.set(t.ticker_norm, t);
        }
      }
      const dedup = [...byTick.values()].sort((a, b) => Number(isLive(b)) - Number(isLive(a)) || actScore(b) - actScore(a));
      setPairs(dedup);
      const ids = dedup.slice(0, 3).flatMap((t) => [t.sol_id, t.rh_id]);
      if (ids.length) {
        const { data: coins } = await supabase
          .from('coins')
          .select('mint, vamp_set_id, name, symbol, source, last_market_cap_sol, market_cap_sol_at_launch')
          .in('vamp_set_id', ids);
        const m = {};
        for (const c of coins ?? []) {
          const v = Number(c.last_market_cap_sol ?? c.market_cap_sol_at_launch ?? 0);
          if (!m[c.vamp_set_id] || v > m[c.vamp_set_id].mcap) m[c.vamp_set_id] = { ...c, mcap: v };
        }
        if (!dead) setLeads(m);
      }
      try {
        const r = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd');
        const j = await r.json();
        if (!dead && j?.solana?.usd) setSolUsd(j.solana.usd);
      } catch { /* keep last known */ }
    }
    load();
    const t = setInterval(load, 30000);
    return () => { dead = true; clearInterval(t); };
  }, []);

  // realtime: lead-coin mcap updates flow straight into cards + gauge
  const leadKey = Object.values(leads).map((c) => c.mint).sort().join(',');
  useEffect(() => {
    if (!leadKey) return;
    const mints = leadKey.split(',');
    let ch = supabase.channel('twin-leads');
    for (const mint of mints) {
      ch = ch.on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'coins', filter: `mint=eq.${mint}` }, (p) => {
        const v = Number(p.new.last_market_cap_sol ?? 0);
        if (!(v > 0)) return;
        setLeads((m) => {
          const id = p.new.vamp_set_id;
          if (!m[id] || m[id].mint !== p.new.mint) return m;
          return { ...m, [id]: { ...m[id], mcap: v } };
        });
      });
    }
    ch.subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leadKey]);

  return (
    <div className="wrap">
      <div className="main">
        <h1 className="page">TWIN SETS</h1>
        <p className="sub">
          The same ticker trading on Solana and Robinhood Chain at the same time. Only live pairs
          make the full live view — both sides must be actively priced and above dust level. Watch the two
          market caps pressure each other in real time and vote on each chain's set.
        </p>

        {pairs === null && <p className="sub mono" style={{ padding: 16 }}>LOADING…</p>}
        {pairs !== null && pairs.length === 0 && (
          <p className="sub" style={{ padding: '4px 16px' }}>
            No twins at all right now. The moment the same ticker exists on both chains within 48 hours,
            the pair appears here.
          </p>
        )}

        {(pairs ?? []).slice(0, 3).map((t) => {
          const sol = leads[t.sol_id];
          const rh = leads[t.rh_id];
          const solMcapUsd = sol && solUsd ? sol.mcap * solUsd : null;
          const rhMcapUsd = rh ? rh.mcap : null;
          let div = null;
          if (solMcapUsd > 0 && rhMcapUsd > 0) div = ((rhMcapUsd - solMcapUsd) / ((rhMcapUsd + solMcapUsd) / 2)) * 100;
          const inBand = div != null && Math.abs(div) <= 5;
          const leader = div == null || inBand ? null : div > 0 ? 'rh' : 'sol';
          const spd = div == null ? 5 : Math.max(0.7, 3.5 - Math.min(25, Math.abs(div)) * 0.11);
          const markerPct = div == null ? 50 : 50 + Math.max(-20, Math.min(20, div)) * 2.25;
          return (
            <div key={`${t.sol_id}-${t.rh_id}`} className="twin-mod">
              <div className="twin-title mono">
                <span className="gold big">${fmtTick(t.ticker_norm)}</span>
                <span className="nm">{fmtName(t.sol_name)}</span>
                <span className={`chip ${isLive(t) ? 'live' : 'muted'}`}>{isLive(t) ? 'LIVE' : 'DORMANT'}</span>
                <span className={`chip ${t.sol_status === 'declared' ? 'declared' : t.sol_status === 'voting' ? 'voting' : 'muted'}`}>SOL {t.sol_status.toUpperCase()}</span>
                <span className={`chip ${t.rh_status === 'declared' ? 'declared' : t.rh_status === 'voting' ? 'voting' : 'muted'}`}>RH {t.rh_status.toUpperCase()}</span>
              </div>
              <div className="twin-grid">
                <ChainCard
                  side="sol"
                  chainLabel="Solana"
                  srcLabel={`pump.fun · ${t.sol_coins} COINS IN SET`}
                  coin={sol}
                  mcapUsd={solMcapUsd}
                  nativeLine={{ k: 'MCAP IN SOL', v: sol ? `${sol.mcap.toFixed(1)} SOL` : '—' }}
                  viewHref={sol ? `https://pump.fun/coin/${sol.mint}` : '#'}
                  viewLabel="PUMP.FUN"
                  setId={t.sol_id}
                  pulling={leader === 'sol'}
                />
                <div className="twin-gauge">
                  <div className="mono top">
                    <div className="k">SOL</div>
                    <div className="v"><LiveUsd value={solMcapUsd} /></div>
                  </div>
                  <div className="track">
                    <div className="band" />
                    <div className={`marker ${div == null ? '' : inBand ? 'in' : 'out'}`} style={{ top: `${markerPct}%`, '--mk': `${markerPct}%` }} />
                  </div>
                  <div className="mono bot">
                    <div className="k">RH</div>
                    <div className="v"><LiveUsd value={rhMcapUsd} /></div>
                  </div>
                  <div className={`mono verdict ${div == null ? '' : inBand ? 'up' : 'down'}`}>
                    {div == null ? 'AWAITING PRICES'
                      : inBand ? 'INSIDE THE 5% MIRROR BAND'
                      : div > 0 ? `RH RUNS ${div.toFixed(1)}% AHEAD` : `SOL RUNS ${Math.abs(div).toFixed(1)}% AHEAD`}
                  </div>
                </div>
                <ChainCard
                  side="rh"
                  chainLabel="Robinhood Chain"
                  srcLabel={`${(rh?.source ?? 'launchpad').toUpperCase()} · ${t.rh_coins} COINS IN SET`}
                  coin={rh}
                  mcapUsd={rhMcapUsd}
                  nativeLine={{ k: 'CHAIN', v: 'RH L2' }}
                  viewHref={rh ? `https://dexscreener.com/search?q=${rh.mint}` : '#'}
                  viewLabel="DEXSCREENER"
                  setId={t.rh_id}
                  pulling={leader === 'rh'}
                />
              </div>
              <div className={`twin-pressure mono ${leader ?? 'flat'}`} style={{ '--spd': `${spd}s` }}>
                <span className="who sol-side">SOL</span>
                <div className="flow"><span className="chev">{'\u276f'.repeat(90)}</span><span className="chev">{'\u276f'.repeat(90)}</span></div>
                <span className="who rh-side">RH</span>
                <span className="note">
                  {div == null ? 'AWAITING PRICES'
                    : leader == null ? 'BALANCED'
                    : leader === 'rh' ? `RH PULLING +${div.toFixed(1)}%` : `SOL PULLING +${Math.abs(div).toFixed(1)}%`}
                </span>
              </div>
              {sol && rh && <TwinChart solMint={sol.mint} rhMint={rh.mint} solUsd={solUsd} />}
            </div>
          );
        })}

        {(pairs ?? []).length > 3 && (
          <div className="twin-dormant">
            <div className="section-head" style={{ paddingLeft: 0, paddingRight: 0 }}>
              <h2>DORMANT TWINS</h2>
              <span className="count">MORE PAIRS ON BOTH CHAINS</span>
            </div>
            <div className="mono">
              {(pairs ?? []).slice(3, 13).map((t) => {
                const act = actScore(t);
                return (
                  <div key={`${t.sol_id}-${t.rh_id}`} className="dorm-row">
                    <span className="tk">${fmtTick(t.ticker_norm)}</span>
                    <span className="nm">{fmtName(t.sol_name, 26)}</span>
                    <Link to={`/set/${t.sol_id}`} className="side">
                      SOL {t.sol_mcap != null ? `${Number(t.sol_mcap).toFixed(0)} SOL` : '—'}
                    </Link>
                    <Link to={`/set/${t.rh_id}`} className="side gold">
                      RH {t.rh_mcap != null ? fmtCap('robinhood', Number(t.rh_mcap)) : 'PRE-MARKET'}
                    </Link>
                    <span className="age m-hide">{act ? `${timeAgo(new Date(act).toISOString())} AGO` : ''}</span>
                    <span className="chip muted">DORMANT</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="foot">
          TWIN SETS COMPARE REAL MARKET DATA READ-ONLY · SOL CAPS CONVERTED TO USD AT THE LIVE SOL PRICE ·
          EXTERNAL LINKS OPEN THIRD-PARTY SITES · VAMP ITSELF NEVER TRADES · NOT FINANCIAL ADVICE
        </div>
      </div>
    </div>
  );
}
