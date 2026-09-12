import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

const GRID = { gridTemplateColumns: '80px 110px 1.4fr 80px 80px 80px 64px 130px' };

export default function Treasury() {
  const [positions, setPositions] = useState(null);

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('paper_positions')
        .select('*, coins(name, symbol), vamp_sets(display_name, ticker_norm)')
        .order('entry_at', { ascending: false })
        .limit(100);
      setPositions(data ?? []);
    }
    load();
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, []);

  const list = positions ?? [];
  const open = list.filter((p) => !p.closed_at);
  const settled = list.filter((p) => p.closed_at);
  const seasonPnl = list.reduce((a, p) => a + (Number(p.paper_size_sol) || 0) * ((Number(p.pnl_pct) || 0) / 100), 0);
  const wins = settled.filter((p) => Number(p.pnl_pct) > 0).length;

  return (
    <div className="wrap">
      <div className="main">
        <div className="tiles">
          <div className="tile">
            <div className="k">OPEN POSITIONS</div>
            <div className="v">{open.length}</div>
            <div className="sub">{open.length ? `${Number(open[0].paper_size_sol).toFixed(0)} SOL EACH · 24H HOLD` : '24H HOLD PER POSITION'}</div>
          </div>
          <div className="tile">
            <div className="k">SETTLED</div>
            <div className="v">{settled.length}</div>
            <div className="sub">LOSSES ARE PUBLIC ON PURPOSE</div>
          </div>
          <div className="tile">
            <div className="k">TOTAL PNL</div>
            <div className="v" style={{ color: seasonPnl >= 0 ? 'var(--green)' : 'var(--red)' }}>
              {seasonPnl >= 0 ? '+' : ''}{seasonPnl.toFixed(1)} <span style={{ fontSize: 13, color: 'var(--dim)' }}>SOL</span>
            </div>
            <div className="sub">FAKE. ALL OF IT.</div>
          </div>
          <div className="tile">
            <div className="k">CROWD WIN RATE</div>
            <div className="v">{settled.length ? `${Math.round((wins / settled.length) * 100)}%` : '—'}</div>
            <div className="sub">{settled.length ? `${wins} OF ${settled.length} SETTLED GREEN` : 'NOTHING SETTLED YET'}</div>
          </div>
        </div>

        <div className="thead" style={GRID}>
          <div>STATUS</div><div>COIN</div><div>VAMP SET</div><div className="r">ENTRY</div>
          <div className="r">NOW</div><div className="r">PNL</div><div className="r">SIZE</div><div className="r">OPENED</div>
        </div>
        {positions === null && <p className="sub mono" style={{ padding: 16 }}>LOADING…</p>}
        {positions !== null && list.length === 0 && (
          <p className="sub" style={{ padding: 16 }}>No positions yet. The treasury buys when a vamp set declares its runner.</p>
        )}
        {list.map((p) => {
          const pnl = Number(p.pnl_pct ?? 0);
          return (
            <div key={p.id} className="trow" style={GRID}>
              <div><span className={`chip ${p.closed_at ? 'muted' : 'voting'}`}>{p.closed_at ? 'SETTLED' : 'OPEN'}</span></div>
              <div className="tick">${p.coins?.symbol}</div>
              <div className="name">{p.vamp_sets?.display_name}</div>
              <div className="r m-hide">{Number(p.entry_market_cap_sol).toFixed(1)}</div>
              <div className="r m-hide">{p.current_market_cap_sol != null ? Number(p.current_market_cap_sol).toFixed(1) : '—'}</div>
              <div className={`r ${pnl >= 0 ? 'up' : 'down'}`}>{pnl >= 0 ? '+' : ''}{pnl.toFixed(1)}%</div>
              <div className="r m-hide">{Number(p.paper_size_sol).toFixed(0)}</div>
              <div className="r m-hide" style={{ color: 'var(--dim)' }}>
                {new Date(p.entry_at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false })}
              </div>
            </div>
          );
        })}
        <div className="foot">
          ENTRY AND EXIT RECORDED AT REAL MARKET PRICES · EVERY POSITION SIMULATED · NO REAL TRADE EVER OCCURS
        </div>
      </div>
    </div>
  );
}
