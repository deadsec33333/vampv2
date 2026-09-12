import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

// v1 placeholder: ranks by votes cast until the points ledger lands (step 4).
export default function Leaderboard() {
  const [rows, setRows] = useState([]);

  useEffect(() => {
    async function load() {
      const { data: votes } = await supabase.from('votes').select('voter_id');
      const counts = {};
      for (const v of votes ?? []) counts[v.voter_id] = (counts[v.voter_id] ?? 0) + 1;
      const ids = Object.keys(counts);
      if (ids.length === 0) return setRows([]);
      const { data: profiles } = await supabase
        .from('profiles').select('id, username').in('id', ids);
      const byId = Object.fromEntries((profiles ?? []).map((p) => [p.id, p.username]));
      setRows(
        ids
          .map((id) => ({ id, username: byId[id] ?? 'unknown', votes: counts[id] }))
          .sort((a, b) => b.votes - a.votes)
          .slice(0, 50)
      );
    }
    load();
  }, []);

  return (
    <>
      <h1 className="page">Leaderboard</h1>
      <p className="sub">
        Season scoring (early-vote weighted points, weekly resets) arrives in the
        next build step. For now: most active voters.
      </p>
      {rows.length === 0 && <p className="meta">No votes yet. Be the first degen on the board.</p>}
      {rows.length > 0 && (
        <div className="tbl-wrap">
          <table className="tbl">
            <thead><tr><th>#</th><th>Player</th><th>Votes cast</th></tr></thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.id}><td>{i + 1}</td><td>{r.username}</td><td>{r.votes}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
