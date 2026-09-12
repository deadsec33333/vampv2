import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export default function Treasury() {
  const [positions, setPositions] = useState([]);

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

  return (
    <>
      <h1 className="page">Simulated treasury</h1>
      <p className="sub">
        Every position below is paper trading: recorded at the coin's real market
        price at declaration time, tracked against real market data, settled in
        fake SOL. Losses are public too — that's the point.
      </p>
      {positions.length === 0 && <p className="meta">No positions yet. The treasury buys when a vamp set declares its runner.</p>}
      {positions.length > 0 && (
        <div className="tbl-wrap">
          <table className="tbl">
            <thead>
              <tr>
                <th>Status</th><th>Coin</th><th>Vamp set</th><th>Entry mcap (SOL)</th>
                <th>Now (SOL)</th><th>PnL</th><th>Size (paper SOL)</th><th>Opened</th>
              </tr>
            </thead>
            <tbody>
              {positions.map((p) => {
                const pnl = p.pnl_pct ?? 0;
                return (
                  <tr key={p.id}>
                    <td>
                      <span className={`pill ${p.closed_at ? 'closed' : 'declared'}`}>
                        {p.closed_at ? 'settled' : 'open'}
                      </span>
                    </td>
                    <td>{p.coins?.name} <span className="ticker">{p.coins?.symbol}</span></td>
                    <td>{p.vamp_sets?.display_name}</td>
                    <td>{Number(p.entry_market_cap_sol).toFixed(1)}</td>
                    <td>{p.current_market_cap_sol != null ? Number(p.current_market_cap_sol).toFixed(1) : '—'}</td>
                    <td className={pnl >= 0 ? 'pnl-pos' : 'pnl-neg'}>
                      {pnl >= 0 ? '+' : ''}{Number(pnl).toFixed(1)}%
                    </td>
                    <td>{Number(p.paper_size_sol).toFixed(0)}</td>
                    <td className="meta">{new Date(p.entry_at).toLocaleString()}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
