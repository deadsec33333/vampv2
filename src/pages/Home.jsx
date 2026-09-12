import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';

function timeAgo(iso) {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `${Math.floor(s)}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export default function Home() {
  const [sets, setSets] = useState([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    const { data } = await supabase
      .from('vamp_sets')
      .select('id, display_name, ticker_norm, status, coin_count, last_coin_at, voting_opened_at, declared_at')
      .in('status', ['voting', 'declared'])
      .order('last_coin_at', { ascending: false })
      .limit(60);
    setSets(data ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
    const t = setInterval(load, 10000); // poll; realtime channel can replace this later
    return () => clearInterval(t);
  }, []);

  return (
    <>
      <h1 className="page">Live vamp sets</h1>
      <p className="sub">
        Copycat launches ("vamps") clustered around one narrative. Vote for the coin
        you think is the real runner. Early correct votes earn the most points.
      </p>
      {loading && <p className="meta">Loading…</p>}
      {!loading && sets.length === 0 && (
        <p className="meta">No active vamp sets right now. The stream refreshes automatically.</p>
      )}
      <div className="grid">
        {sets.map((s) => (
          <Link key={s.id} to={`/set/${s.id}`} className="card">
            <span className={`pill ${s.status}`}>{s.status === 'voting' ? 'voting open' : 'runner declared'}</span>
            <h3>{s.display_name}</h3>
            <div className="ticker">${s.ticker_norm}</div>
            <div className="meta">
              {s.coin_count} coins in cluster · last launch {timeAgo(s.last_coin_at)}
            </div>
          </Link>
        ))}
      </div>
    </>
  );
}
