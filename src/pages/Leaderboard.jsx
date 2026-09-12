import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { seasonKey, nextSeasonStart, countdownText } from '../lib/season';

export default function Leaderboard() {
  const { session } = useAuth();
  const [rows, setRows] = useState([]);
  const [pastSeasons, setPastSeasons] = useState([]);
  const [countdown, setCountdown] = useState(countdownText(nextSeasonStart()));
  const key = seasonKey();

  useEffect(() => {
    async function load() {
      const [{ data: lb }, { data: past }] = await Promise.all([
        supabase
          .from('season_leaderboard')
          .select('*')
          .eq('season_key', key)
          .order('points', { ascending: false })
          .limit(50),
        supabase
          .from('seasons')
          .select('*')
          .order('key', { ascending: false })
          .limit(10),
      ]);
      setRows(lb ?? []);
      setPastSeasons(past ?? []);
    }
    load();
    const t = setInterval(load, 20000);
    const c = setInterval(() => setCountdown(countdownText(nextSeasonStart())), 30000);
    return () => { clearInterval(t); clearInterval(c); };
  }, [key]);

  const myRow = session ? rows.find((r) => r.profile_id === session.user.id) : null;

  return (
    <>
      <h1 className="page">Season {key}</h1>
      <p className="sub">
        Points come from settled treasury positions: back the runner early and share
        its PnL, back a dud and pay for it. Resets in <b>{countdown}</b>. Points are
        in-game only, worth nothing outside the leaderboard (for now).
      </p>

      {myRow && (
        <p className="sub">
          You: <b>{Number(myRow.points).toFixed(1)} pts</b> (rank {rows.indexOf(myRow) + 1})
        </p>
      )}

      {rows.length === 0 && (
        <p className="meta">
          No settled positions this season yet. Points appear after the treasury
          closes its first position (it holds for 24h after a declaration).
        </p>
      )}
      {rows.length > 0 && (
        <div className="tbl-wrap">
          <table className="tbl">
            <thead><tr><th>#</th><th>Player</th><th>Points</th><th>Winning picks</th></tr></thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.profile_id}>
                  <td>{i + 1}</td>
                  <td>{r.username}</td>
                  <td className={Number(r.points) >= 0 ? 'pnl-pos' : 'pnl-neg'}>
                    {Number(r.points).toFixed(1)}
                  </td>
                  <td>{r.winning_picks}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {pastSeasons.length > 0 && (
        <>
          <h1 className="page">Hall of runners</h1>
          <div className="tbl-wrap">
            <table className="tbl">
              <thead><tr><th>Season</th><th>Winner</th><th>Points</th></tr></thead>
              <tbody>
                {pastSeasons.map((s) => (
                  <tr key={s.key}>
                    <td>{s.key}</td>
                    <td>{s.winner_username ?? '—'}</td>
                    <td>{s.winner_points != null ? Number(s.winner_points).toFixed(1) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
}
