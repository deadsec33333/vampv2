import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { seasonKey, nextSeasonStart, countdownText } from '../lib/season';

const GRID = { gridTemplateColumns: '52px 1.4fr 110px 80px' };

export default function Leaderboard() {
  const { session } = useAuth();
  const [rows, setRows] = useState(null);
  const [pastSeasons, setPastSeasons] = useState([]);
  const [recruiters, setRecruiters] = useState([]);
  const [countdown, setCountdown] = useState(countdownText(nextSeasonStart()));
  const key = seasonKey();

  useEffect(() => {
    async function load() {
      const [{ data: lb }, { data: past }, { data: rec }] = await Promise.all([
        supabase.from('season_leaderboard').select('*').eq('season_key', key).order('points', { ascending: false }).limit(50),
        supabase.from('seasons').select('*').order('key', { ascending: false }).limit(6),
        supabase.from('referral_leaderboard').select('*').order('verified_referrals', { ascending: false }).limit(3),
      ]);
      setRows(lb ?? []);
      setPastSeasons(past ?? []);
      setRecruiters(rec ?? []);
    }
    load();
    const t = setInterval(load, 20000);
    const c = setInterval(() => setCountdown(countdownText(nextSeasonStart())), 30000);
    return () => { clearInterval(t); clearInterval(c); };
  }, [key]);

  const list = rows ?? [];
  const myRow = session ? list.find((r) => r.profile_id === session.user.id) : null;

  return (
    <div className="wrap">
      <div className="main">
        <div className="section-head">
          <h2>SEASON {key}</h2>
          <span className="chip declared">RESETS IN {countdown}</span>
          {myRow && (
            <span className="count">
              YOU: <b style={{ color: Number(myRow.points) >= 0 ? 'var(--green)' : 'var(--red)' }}>{Number(myRow.points).toFixed(1)} PTS</b> · RANK {list.indexOf(myRow) + 1}
            </span>
          )}
        </div>

        <div className="thead" style={GRID}>
          <div>RANK</div><div>PLAYER</div><div className="r">POINTS</div><div className="r">WINS</div>
        </div>
        {rows === null && <p className="sub mono" style={{ padding: 16 }}>LOADING…</p>}
        {rows !== null && list.length === 0 && (
          <p className="sub" style={{ padding: 16 }}>
            No settled positions this season yet. Points land after the treasury closes its first position (24h hold after declaration).
          </p>
        )}
        {list.map((r, i) => (
          <div key={r.profile_id} className="trow" style={GRID}>
            <div className={i < 3 ? `rank-${i + 1}` : ''} style={i >= 3 ? { color: 'var(--dim2)' } : {}}>
              {String(i + 1).padStart(2, '0')}
            </div>
            <div className="name" style={{ fontFamily: 'IBM Plex Mono, monospace' }}>{r.username}</div>
            <div className={`r ${Number(r.points) >= 0 ? 'up' : 'down'}`}>{Number(r.points).toFixed(1)}</div>
            <div className="r">{r.winning_picks}</div>
          </div>
        ))}
        <div className="foot">
          POINTS HAVE NO MONETARY VALUE · WEEKLY RESET MONDAY 00:00 UTC · SEASON WINNERS RECORDED FOREVER
        </div>
      </div>

      <aside className="rail">
        <div className="rail-head"><h3>HALL OF RUNNERS</h3></div>
        <div style={{ padding: '0 16px' }}>
          {pastSeasons.length === 0 && <div className="kv"><span style={{ color: 'var(--dim2)' }}>FIRST SEASON IN PROGRESS</span></div>}
          {pastSeasons.map((s) => (
            <div key={s.key} className="panel" style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginBottom: 8, fontFamily: 'IBM Plex Mono, monospace', fontSize: 11 }}>
              <span style={{ color: 'var(--dim)' }}>{s.key}</span>
              <span>{s.winner_username ?? '—'}</span>
              <span className="gold">{s.winner_points != null ? Number(s.winner_points).toFixed(0) : ''}</span>
            </div>
          ))}
        </div>
        <div className="rail-block">
          <h4>TOP RECRUITERS</h4>
          {recruiters.length === 0 && <div className="kv"><span style={{ color: 'var(--dim2)' }}>NOBODY RECRUITED YET</span></div>}
          {recruiters.map((r) => (
            <div key={r.profile_id} className="kv"><span>{r.username}</span><span>{r.verified_referrals} VERIFIED</span></div>
          ))}
          <p className="fine" style={{ color: 'var(--dim)', fontSize: 12, marginTop: 10, marginBottom: 0, lineHeight: 1.5 }}>
            Only verified humans who cast at least one vote count. Bots stay in the coffin.
          </p>
        </div>
      </aside>
    </div>
  );
}
