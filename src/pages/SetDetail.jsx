import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import Turnstile from '../lib/Turnstile';

export default function SetDetail({ onNeedLogin }) {
  const { id } = useParams();
  const { session, profile, refreshProfile } = useAuth();
  const [set, setSet] = useState(null);
  const [coins, setCoins] = useState([]);
  const [voteCounts, setVoteCounts] = useState({});
  const [myVote, setMyVote] = useState(null);
  const [needTurnstile, setNeedTurnstile] = useState(false);
  const [tsToken, setTsToken] = useState(null);
  const [pendingMint, setPendingMint] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [declared, setDeclared] = useState(null); // coin object for the overlay

  const onToken = useCallback((t) => setTsToken(t), []);

  async function load() {
    const [{ data: s }, { data: cs }, { data: vs }] = await Promise.all([
      supabase.from('vamp_sets').select('*').eq('id', id).single(),
      supabase.from('coins').select('*').eq('vamp_set_id', id).order('launched_at'),
      supabase.from('votes').select('coin_mint').eq('vamp_set_id', id),
    ]);
    setSet(s ?? null);
    setCoins(cs ?? []);
    const counts = {};
    for (const v of vs ?? []) counts[v.coin_mint] = (counts[v.coin_mint] ?? 0) + 1;
    setVoteCounts(counts);
    if (session) {
      const { data: mine } = await supabase
        .from('votes').select('coin_mint')
        .eq('vamp_set_id', id).eq('voter_id', session.user.id).maybeSingle();
      setMyVote(mine?.coin_mint ?? null);
    }
  }

  useEffect(() => {
    load();
    const t = setInterval(load, 8000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, session?.user?.id]);

  async function vote(mint) {
    setError(null);
    if (!session) return onNeedLogin();
    const firstVote = !profile?.human_verified_at;
    if (firstVote && !tsToken) {
      setPendingMint(mint);
      setNeedTurnstile(true);
      return;
    }
    setBusy(true);
    const { data, error: fnErr } = await supabase.functions.invoke('cast-vote', {
      body: { vamp_set_id: id, coin_mint: mint, turnstile_token: tsToken ?? undefined },
    });
    setBusy(false);
    setNeedTurnstile(false);
    setPendingMint(null);
    if (fnErr) {
      let msg = fnErr.message;
      try {
        const ctx = await fnErr.context?.json?.();
        if (ctx?.error) msg = ctx.error;
      } catch {}
      setError(msg);
      return;
    }
    if (firstVote) refreshProfile();
    setMyVote(mint);
    if (data?.declared) {
      const c = coins.find((x) => x.mint === mint);
      setDeclared(c ?? { name: mint, symbol: '' });
    }
    load();
  }

  if (!set) return <p className="meta">Loading…</p>;

  const totalVotes = Object.values(voteCounts).reduce((a, b) => a + b, 0);

  return (
    <>
      <h1 className="page">{set.display_name}</h1>
      <p className="sub">
        <span className={`pill ${set.status}`}>{set.status}</span>{' '}
        <span className="ticker">${set.ticker_norm}</span> · {coins.length} coins · {totalVotes} votes
      </p>

      {coins.map((c) => {
        const n = voteCounts[c.mint] ?? 0;
        const pct = totalVotes ? Math.round((n / totalVotes) * 100) : 0;
        const isWinner = set.declared_coin_mint === c.mint;
        return (
          <div key={c.mint} className={`coin-row ${isWinner ? 'winner' : ''}`}>
            <div style={{ flex: 1, minWidth: 180 }}>
              <div className="name">
                {c.name} <span className="ticker">{c.symbol}</span>{' '}
                {isWinner && <span className="pill declared">main runner</span>}
                {myVote === c.mint && <span className="pill voting">your pick</span>}
              </div>
              <div className="mint">{c.mint}</div>
              <div className="meta">
                launched {new Date(c.launched_at).toLocaleTimeString()} · matched by {c.match_rule} ({c.match_score})
                {c.last_market_cap_sol != null && (
                  <> · mcap now {Number(c.last_market_cap_sol).toFixed(1)} SOL</>
                )}
              </div>
            </div>
            <div className="meta">{n} votes ({pct}%)</div>
            {set.status === 'voting' && !myVote && (
              <button className="btn small" disabled={busy} onClick={() => vote(c.mint)}>
                Vote real
              </button>
            )}
            <div className="votebar"><div style={{ width: `${pct}%` }} /></div>
          </div>
        );
      })}

      {needTurnstile && (
        <div className="modal-bg" onClick={() => setNeedTurnstile(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Prove you're human</h2>
            <p className="fine">One quick check before your first vote. Never again after this.</p>
            <Turnstile onToken={onToken} />
            <button className="btn" disabled={!tsToken || busy} onClick={() => vote(pendingMint)}>
              {busy ? 'Casting…' : 'Cast my vote'}
            </button>
          </div>
        </div>
      )}

      {error && <div className="err">{error}</div>}

      {declared && (
        <div className="declare-overlay" onClick={() => setDeclared(null)}>
          <div className="title">MAIN RUNNER<br />DECLARED</div>
          <div className="coin">
            {declared.name} <span className="ticker">{declared.symbol}</span>
          </div>
          <div className="paper">
            The simulated treasury just opened a PAPER position at the current market
            price. Fake money, real scoreboard. Tap anywhere to continue.
          </div>
        </div>
      )}
    </>
  );
}
