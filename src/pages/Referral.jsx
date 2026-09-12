import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';

const GRID = { gridTemplateColumns: '52px 1.4fr 150px' };

export default function Referral({ onNeedLogin }) {
  const { session, profile } = useAuth();
  const [rows, setRows] = useState([]);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('referral_leaderboard')
        .select('*')
        .order('verified_referrals', { ascending: false })
        .limit(50);
      setRows(data ?? []);
    }
    load();
  }, []);

  const link = profile ? `${window.location.origin}/?ref=${profile.referral_code}` : null;

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* user can select the text manually */ }
  }

  return (
    <div className="wrap">
      <div className="main">
        <h1 className="page">RECRUIT DEGENS</h1>
        <p className="sub">
          Your invite link counts only verified humans who actually voted at least once. Bots don't climb this board.
        </p>

        <div className="pad" style={{ marginBottom: 8 }}>
          {!session && <button className="btn" onClick={onNeedLogin}>CONNECT WALLET FOR YOUR LINK</button>}
          {session && profile && (
            <div className="panel" style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 200 }}>
                <div className="mono" style={{ fontSize: 10, color: 'var(--dim2)', letterSpacing: '0.12em' }}>YOUR LINK</div>
                <div className="mono" style={{ fontSize: 12, marginTop: 6, wordBreak: 'break-all' }}>{link}</div>
              </div>
              <button className="btn small" onClick={copy}>{copied ? 'COPIED' : 'COPY'}</button>
            </div>
          )}
        </div>

        <div className="thead" style={GRID}>
          <div>RANK</div><div>RECRUITER</div><div className="r">VERIFIED VOTERS</div>
        </div>
        {rows.length === 0 && <p className="sub" style={{ padding: 16 }}>Nobody recruited anyone yet. The board is wide open.</p>}
        {rows.map((r, i) => (
          <div key={r.profile_id} className="trow" style={GRID}>
            <div className={i < 3 ? `rank-${i + 1}` : ''} style={i >= 3 ? { color: 'var(--dim2)' } : {}}>{String(i + 1).padStart(2, '0')}</div>
            <div className="name" style={{ fontFamily: 'IBM Plex Mono, monospace' }}>{r.username}</div>
            <div className="r">{r.verified_referrals}</div>
          </div>
        ))}
        <div className="foot">
          A RECRUIT COUNTS AFTER THEY VERIFY AS HUMAN AND CAST A VOTE
        </div>
      </div>
    </div>
  );
}
