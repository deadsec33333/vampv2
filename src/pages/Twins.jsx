import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { fmtCap } from './Home';

export default function Twins() {
  const [pairs, setPairs] = useState(null);
  const [caps, setCaps] = useState({});      // set_id -> best mcap in native units
  const [solUsd, setSolUsd] = useState(null);

  useEffect(() => {
    async function load() {
      const { data: tw } = await supabase.from('twin_sets_view').select('*').limit(30);
      setPairs(tw ?? []);
      const ids = (tw ?? []).flatMap((t) => [t.sol_id, t.rh_id]);
      if (ids.length) {
        const { data: coins } = await supabase
          .from('coins')
          .select('vamp_set_id, last_market_cap_sol, market_cap_sol_at_launch')
          .in('vamp_set_id', ids);
        const m = {};
        for (const c of coins ?? []) {
          const v = Number(c.last_market_cap_sol ?? c.market_cap_sol_at_launch ?? 0);
          if (v > (m[c.vamp_set_id] ?? 0)) m[c.vamp_set_id] = v;
        }
        setCaps(m);
      }
      try {
        const r = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd');
        const j = await r.json();
        setSolUsd(j?.solana?.usd ?? null);
      } catch {}
    }
    load();
    const t = setInterval(load, 20000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="wrap">
      <div className="main">
        <h1 className="page">TWIN SETS</h1>
        <p className="sub">
          The same ticker alive on Solana and Robinhood Chain at the same time.
          Two births, one narrative, and only one of them is the original. Vote on each chain's set.
        </p>

        {pairs === null && <p className="sub mono" style={{ padding: 16 }}>LOADING…</p>}
        {pairs !== null && pairs.length === 0 && (
          <p className="sub" style={{ padding: '4px 16px' }}>
            No twins right now. The moment the same ticker launches on both chains within 48 hours, the pair appears here.
          </p>
        )}

        {(pairs ?? []).map((t) => {
          const solNative = caps[t.sol_id];                       // SOL units
          const rhUsd = caps[t.rh_id];                            // USD
          const solInUsd = solNative != null && solUsd ? solNative * solUsd : null;
          let div = null;
          if (solInUsd > 0 && rhUsd > 0) div = ((rhUsd - solInUsd) / ((rhUsd + solInUsd) / 2)) * 100;
          return (
            <div key={`${t.sol_id}-${t.rh_id}`} className="panel" style={{ margin: '0 16px 12px', display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap' }}>
              <div className="mono" style={{ fontSize: 20, fontWeight: 600, color: 'var(--gold)', minWidth: 110 }}>${t.ticker_norm}</div>
              <Link to={`/set/${t.sol_id}`} style={{ flex: 1, minWidth: 200 }}>
                <div className="mono" style={{ fontSize: 10, color: 'var(--dim2)', letterSpacing: '0.1em' }}>SOLANA · {t.sol_coins} COINS</div>
                <div style={{ fontWeight: 600, marginTop: 3 }}>{t.sol_name}</div>
                <div className="mono" style={{ fontSize: 11, marginTop: 3 }}>
                  {solNative != null ? `${fmtCap('solana', solNative)} SOL` : '—'}
                  {solInUsd != null && <span style={{ color: 'var(--dim2)' }}> ≈ {fmtCap('robinhood', solInUsd)}</span>}
                  {' '}<span className={`chip ${t.sol_status === 'declared' ? 'declared' : t.sol_status === 'voting' ? 'voting' : 'muted'}`}>{t.sol_status.toUpperCase()}</span>
                </div>
              </Link>
              <div style={{ textAlign: 'center', minWidth: 110 }}>
                <div className="mono" style={{ fontSize: 9, color: 'var(--dim2)', letterSpacing: '0.12em' }}>DIVERGENCE</div>
                <div className="mono" style={{ fontSize: 18, fontWeight: 600, marginTop: 4, color: div == null ? 'var(--dim2)' : Math.abs(div) <= 5 ? 'var(--green)' : 'var(--gold)' }}>
                  {div == null ? '—' : `${div >= 0 ? '+' : ''}${div.toFixed(1)}%`}
                </div>
                <div className="mono" style={{ fontSize: 9, color: 'var(--dim2)', marginTop: 2 }}>
                  {div == null ? 'AWAITING PRICES' : Math.abs(div) <= 5 ? 'INSIDE 5% BAND' : div > 0 ? 'RH RUNS AHEAD' : 'SOL RUNS AHEAD'}
                </div>
              </div>
              <Link to={`/set/${t.rh_id}`} style={{ flex: 1, minWidth: 200 }}>
                <div className="mono" style={{ fontSize: 10, color: 'var(--dim2)', letterSpacing: '0.1em' }}>ROBINHOOD CHAIN · {t.rh_coins} COINS</div>
                <div style={{ fontWeight: 600, marginTop: 3 }}>{t.rh_name}</div>
                <div className="mono" style={{ fontSize: 11, marginTop: 3 }}>
                  {rhUsd != null ? fmtCap('robinhood', rhUsd) : '—'}
                  {' '}<span className={`chip ${t.rh_status === 'declared' ? 'declared' : t.rh_status === 'voting' ? 'voting' : 'muted'}`}>{t.rh_status.toUpperCase()}</span>
                </div>
              </Link>
            </div>
          );
        })}

        <div className="foot">
          TWIN SETS COMPARE REAL MARKET DATA READ-ONLY · SOL CAPS CONVERTED TO USD AT THE LIVE SOL PRICE · NOT FINANCIAL ADVICE
        </div>
      </div>
    </div>
  );
}
