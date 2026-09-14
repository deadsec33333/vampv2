import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';

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

const RANGES = { '1H': { hours: 1, bucket: 30 }, '6H': { hours: 6, bucket: 180 }, '24H': { hours: 24, bucket: 600 } };

function TwinChart({ solMint, rhMint, solUsd }) {
  const [range, setRange] = useState('6H');
  const [rows, setRows] = useState(null);

  useEffect(() => {
    let dead = false;
    async function load() {
      const { hours, bucket } = RANGES[range];
      const since = new Date(Date.now() - hours * 3600 * 1000).toISOString();
      const { data } = await supabase.rpc('twin_ticks', { p_mints: [solMint, rhMint], p_since: since, p_bucket_sec: bucket });
      if (!dead) setRows(data ?? []);
    }
    load();
    const t = setInterval(load, 30000);
    return () => { dead = true; clearInterval(t); };
  }, [solMint, rhMint, range]);

  const chart = useMemo(() => {
    if (!rows || !solUsd) return null;
    const solRaw = new Map();
    const rhRaw = new Map();
    for (const r of rows) {
      const t = new Date(r.bucket).getTime();
      if (r.mint === solMint) solRaw.set(t, Number(r.mcap) * solUsd);
      else if (r.mint === rhMint) rhRaw.set(t, Number(r.mcap));
    }
    if (solRaw.size < 2 || rhRaw.size < 2) return { empty: true };

    const times = [...new Set([...solRaw.keys(), ...rhRaw.keys()])].sort((a, b) => a - b);
    // carry-forward align both series on the union timeline
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

    // fill between the lines, green while the spread stays inside 5%, red outside
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
    return { solPath, rhPath, bandPolys, grid, xTicks, W, H, last, yLast: { s: Y(last.s), r: Y(last.r) } };
  }, [rows, solUsd, solMint, rhMint]);

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
        <div className="chips">
          {Object.keys(RANGES).map((k) => (
            <button key={k} className={range === k ? 'on' : ''} onClick={() => setRange(k)}>{k}</button>
          ))}
        </div>
      </div>
      {(!chart || chart.empty) ? (
        <div className="mono twin-chart-empty">
          {rows === null ? 'LOADING…' : 'COLLECTING PRICE HISTORY — THE CHART DRAWS ITSELF AS LIVE TICKS ARRIVE'}
        </div>
      ) : (
        <div className="twin-chart-body">
          <svg viewBox={`0 0 ${chart.W} ${chart.H}`} preserveAspectRatio="none">
            {chart.grid.map((g, i) => (
              <line key={i} x1="0" x2={chart.W} y1={g.y} y2={g.y} stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
            ))}
            {chart.bandPolys.map((b) => (
              <path key={b.key} d={b.d} fill={b.state ? 'rgba(22,199,132,0.14)' : 'rgba(246,70,93,0.14)'} />
            ))}
            <path d={chart.solPath} fill="none" stroke="#f6465d" strokeWidth="2" vectorEffect="non-scaling-stroke" />
            <path d={chart.rhPath} fill="none" stroke="#f0b90b" strokeWidth="2" vectorEffect="non-scaling-stroke" />
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
            <span className="rh" style={{ top: `${(chart.yLast.r / chart.H) * 100}%` }}>{fmtUsd(chart.last.r)}</span>
            <span className="sol" style={{ top: `${(chart.yLast.s / chart.H) * 100}%` }}>{fmtUsd(chart.last.s)}</span>
          </div>
        </div>
      )}
    </div>
  );
}

function ChainCard({ side, chainLabel, srcLabel, coin, mcapUsd, nativeLine, viewHref, viewLabel, setId }) {
  return (
    <div className={`twin-card ${side}`}>
      <div className="twin-card-head">
        <span className={`dot ${side}`} />
        <b>{chainLabel}</b>
        <div className="spacer" />
        <span className="mono src">{srcLabel}</span>
      </div>
      <div className="mono k">MARKET CAP</div>
      <div className="mono big">{fmtUsd(mcapUsd)}</div>
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

export default function Twins() {
  const [pairs, setPairs] = useState(null);
  const [leads, setLeads] = useState({});   // set_id -> lead coin row
  const [solUsd, setSolUsd] = useState(null);

  useEffect(() => {
    let dead = false;
    async function load() {
      const { data: tw } = await supabase.from('twin_sets_view').select('*').limit(20);
      if (dead) return;
      setPairs(tw ?? []);
      const ids = (tw ?? []).flatMap((t) => [t.sol_id, t.rh_id]);
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
    const t = setInterval(load, 20000);
    return () => { dead = true; clearInterval(t); };
  }, []);

  return (
    <div className="wrap">
      <div className="main">
        <h1 className="page">TWIN SETS</h1>
        <p className="sub">
          The same ticker alive on Solana and Robinhood Chain at the same time. Two births, one
          narrative — watch the two market caps pressure each other in real time and vote on each chain's set.
        </p>

        {pairs === null && <p className="sub mono" style={{ padding: 16 }}>LOADING…</p>}
        {pairs !== null && pairs.length === 0 && (
          <p className="sub" style={{ padding: '4px 16px' }}>
            No twins right now. The moment the same ticker launches on both chains within 48 hours, the pair appears here.
          </p>
        )}

        {(pairs ?? []).map((t) => {
          const sol = leads[t.sol_id];
          const rh = leads[t.rh_id];
          const solMcapUsd = sol && solUsd ? sol.mcap * solUsd : null;
          const rhMcapUsd = rh ? rh.mcap : null;
          let div = null;
          if (solMcapUsd > 0 && rhMcapUsd > 0) div = ((rhMcapUsd - solMcapUsd) / ((rhMcapUsd + solMcapUsd) / 2)) * 100;
          const inBand = div != null && Math.abs(div) <= 5;
          // marker position: divergence clamped to ±20% mapped onto the track
          const markerPct = div == null ? 50 : 50 + Math.max(-20, Math.min(20, div)) * 2.25;
          return (
            <div key={`${t.sol_id}-${t.rh_id}`} className="twin-mod">
              <div className="twin-title mono">
                <span className="gold big">${t.ticker_norm}</span>
                <span className="nm">{t.sol_name}</span>
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
                />
                <div className="twin-gauge">
                  <div className="mono top">
                    <div className="k">SOL</div>
                    <div className="v">{fmtUsd(solMcapUsd)}</div>
                  </div>
                  <div className="track">
                    <div className="band" />
                    <div className={`marker ${div == null ? '' : inBand ? 'in' : 'out'}`} style={{ top: `${markerPct}%`, '--mk': `${markerPct}%` }} />
                  </div>
                  <div className="mono bot">
                    <div className="k">RH</div>
                    <div className="v">{fmtUsd(rhMcapUsd)}</div>
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
                />
              </div>
              {sol && rh && <TwinChart solMint={sol.mint} rhMint={rh.mint} solUsd={solUsd} />}
            </div>
          );
        })}

        <div className="foot">
          TWIN SETS COMPARE REAL MARKET DATA READ-ONLY · SOL CAPS CONVERTED TO USD AT THE LIVE SOL PRICE ·
          EXTERNAL LINKS OPEN THIRD-PARTY SITES · VAMP ITSELF NEVER TRADES · NOT FINANCIAL ADVICE
        </div>
      </div>
    </div>
  );
}
