import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';

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
    } catch {
      // clipboard blocked: user can select the text manually
    }
  }

  return (
    <>
      <h1 className="page">Recruit degens</h1>
      <p className="sub">
        Your invite link counts only verified humans who actually voted at least
        once. Bots don't climb this board.
      </p>

      {!session && (
        <p className="meta">
          <button className="btn small" onClick={onNeedLogin}>Connect wallet</button>
          {'  '}to get your invite link.
        </p>
      )}
      {session && profile && (
        <div className="coin-row">
          <div style={{ flex: 1, minWidth: 200 }}>
            <div className="name">Your link</div>
            <div className="mint">{link}</div>
          </div>
          <button className="btn small" onClick={copy}>{copied ? 'Copied ✔' : 'Copy'}</button>
        </div>
      )}

      <h1 className="page">Referral leaderboard</h1>
      {rows.length === 0 && <p className="meta">Nobody recruited anyone yet. The board is wide open.</p>}
      {rows.length > 0 && (
        <div className="tbl-wrap">
          <table className="tbl">
            <thead><tr><th>#</th><th>Recruiter</th><th>Verified humans who voted</th></tr></thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.profile_id}>
                  <td>{i + 1}</td><td>{r.username}</td><td>{r.verified_referrals}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
