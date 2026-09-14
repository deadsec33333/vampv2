import { useEffect, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import Turnstile from '../lib/Turnstile';
import {timeAgo, fmtCap, fmtTick } from './Home';

export default function SetDetail({ onNeedLogin }) {
  const { id } = useParams();
  const { session, profile, refreshProfile } = useAuth();
  const [set, setSet] = useState(null);
  const [coins, setCoins] = useState([]);
  const [voteCounts, setVoteCounts] = useState({});
  const [threshold, setThreshold] = useState(100);
  const [myVote, setMyVote] = useState(null);
  const [needTurnstile, setNeedTurnstile] = useState(false);
  const [tsToken, setTsToken] = useState(null);
  const [pendingMint, setPendingMint] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [declared, setDeclared] = useState(null);

  const onToken = useCallback((t) => setTsToken(t), []);

  async function load() {
    const [{ data: s }, { data: cs }, { data: vs }, { data: cfg }] = await Promise.all([
      supabase.from('vamp_sets').select('*').eq('id', id).single(),
      supabase.from('coins').select('*').eq('vamp_set_id', id).order('launched_at'),
      supabase.from('votes').select('coin_mint').eq('vamp_set_id', id),
      supabase.from('game_config').select('value').eq('key', 'vote_threshold').single(),
    ]);
    setSet(s ?? null);
    setCoins(cs ?? []);
    if (cfg?.value != null) setThreshold(Number(cfg.value));
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
      try { const ctx = await fnErr.context?.json?.(); if (ctx?.error) msg = ctx.error; } catch {}
      setError(msg);
      return;
    }
    if (firstVote) refreshProfile();
    setMyVote(mint);
    if (data?.declared) setDeclared(coins.find((x) => x.mint === mint) ?? { name: mint, symbol: '' });
    load();
  }

  if (!set) return <p className="sub mono" style={{ padding: 16 }}>LOADING…</p>;

  const totalVotes = Object.values(voteCounts).reduce((a, b) => a + b, 0);
  const leadVotes = totalVotes ? Math.max(...Object.values(voteCounts)) : 0;

  return (
    <>
      <div className="set-head">
        <div className="big-tick">${fmtTick(set.ticker_norm)}</div>
        {(set.chain ?? 'solana') === 'robinhood' && <span className="chip muted">ROBINHOOD CHAIN</span>}
        <div>
          <h1>{set.display_name} cluster</h1>
          <div className="sub">
            {coins.length} COINS · {set.voting_opened_at ? `OPENED ${timeAgo(set.voting_opened_at)} AGO` : 'WATCHING'} · ONE VOTE PER PLAYER ·{' '}
            <Link to="/" style={{ color: 'var(--dim)' }}>← TERMINAL</Link>
          </div>
        </div>
        {set.status === 'voting' && (
          <div className="progress-box">
            <div className="lbl"><span>VOTES TO DECLARE</span><b>{leadVotes} / {threshold}</b></div>
            <div className="bar"><div style={{ width: `${Math.min(100, (leadVotes / threshold) * 100)}%` }} /></div>
          </div>
        )}
        {set.status !== 'voting' && <span className={`chip ${set.status === 'declared' ? 'declared' : 'muted'}`}>{set.status.toUpperCase()}</span>}
      </div>

      <div className="wrap">
        <div className="main" style={{ paddingTop: 14 }}>
          {coins.map((c) => {
            const n = voteCounts[c.mint] ?? 0;
            const pct = totalVotes ? Math.round((n / totalVotes) * 100) : 0;
            const isWinner = set.declared_coin_mint === c.mint;
            const mcap = c.last_market_cap_sol ?? c.market_cap_sol_at_launch;
            const delta = c.last_market_cap_sol != null && c.market_cap_sol_at_launch > 0
              ? ((c.last_market_cap_sol - c.market_cap_sol_at_launch) / c.market_cap_sol_at_launch) * 100
              : null;
            return (
              <div key={c.mint} className={`coin-card ${myVote === c.mint ? 'picked' : ''} ${isWinner ? 'winner' : ''}`}>
                <div className="pct-box">
                  <div className="p" style={{ color: pct >= 50 ? 'var(--green)' : 'var(--text)' }}>{pct}%</div>
                  <div className="l">OF VOTES</div>
                </div>
                <div className="body">
                  <div className="title">
                    {c.name}
                    <span className="mono" style={{ color: 'var(--red)', fontSize: 12 }}>{c.symbol}</span>
                    {isWinner && <span className="chip declared">MAIN RUNNER</span>}
                    {myVote === c.mint && <span className="chip voting">YOUR PICK</span>}
                  </div>
                  <div className="mint">{c.mint}</div>
                  <div className="facts">
                    <div><span className="k">AGE </span>{timeAgo(c.launched_at)}</div>
                    <div><span className="k">DEV BUY </span>{c.initial_buy_sol != null ? `${Number(c.initial_buy_sol).toFixed(2)} SOL` : '—'}</div>
                    <div><span className="k">MCAP </span>{fmtCap(set.chain ?? 'solana', mcap)}{(set.chain ?? 'solana') === 'solana' && mcap != null ? ' SOL' : ''}</div>
                    {delta != null && (
                      <div><span className="k">Δ LAUNCH </span>
                        <span className={delta >= 0 ? 'up' : 'down'}>{delta >= 0 ? '+' : ''}{delta.toFixed(1)}%</span>
                      </div>
                    )}
                  </div>
                </div>
                {set.status === 'voting' && !myVote && (
                  <button className="btn" disabled={busy} onClick={() => vote(c.mint)}>BACK AS RUNNER</button>
                )}
                {myVote === c.mint && <button className="btn ghost" disabled>VOTED</button>}
              </div>
            );
          })}
          {error && <div className="err pad">{error}</div>}
          <div className="foot">
            SIMULATION · WHEN A COIN REACHES {threshold} VOTES THE PAPER TREASURY BUYS IT AT MARKET PRICE · NO REAL TRADE OCCURS
          </div>
        </div>

        <aside className="rail">
          <div className="rail-head"><h3>VOTE DISTRIBUTION</h3></div>
          <div style={{ padding: '0 16px 8px' }}>
            {coins.map((c) => {
              const n = voteCounts[c.mint] ?? 0;
              const pct = totalVotes ? (n / totalVotes) * 100 : 0;
              const leader = n === leadVotes && n > 0;
              return (
                <div key={c.mint} style={{ marginBottom: 10 }}>
                  <div className="kv"><span className="name">{c.name}</span><span>{n}</span></div>
                  <div className="bar thin"><div className={leader ? 'g' : 'n'} style={{ width: `${pct}%`, background: leader ? 'var(--green)' : 'var(--dim)' }} /></div>
                </div>
              );
            })}
          </div>
          <div className="rail-block">
            <h4>EARLY VOTE WEIGHT</h4>
            <div className="kv"><span style={{ color: 'var(--dim2)' }}>VOTE AT MIN 2</span><span className="up">0.96×</span></div>
            <div className="kv"><span style={{ color: 'var(--dim2)' }}>VOTE AT MIN 30</span><span>0.50×</span></div>
            <div className="kv"><span style={{ color: 'var(--dim2)' }}>VOTE AT MIN 60</span><span style={{ color: 'var(--dim2)' }}>0.25×</span></div>
            <p className="fine" style={{ color: 'var(--dim)', fontSize: 12, lineHeight: 1.5, marginTop: 10, marginBottom: 0 }}>
              Your share of the runner's PnL pool halves every 30 minutes. Early conviction pays. Wrong picks cost a flat 25 points.
            </p>
          </div>
          <div className="rail-block" style={{ marginTop: 'auto' }}>
            <div className="mono" style={{ fontSize: 10, color: 'var(--dim2)', lineHeight: 1.6, border: '1px solid var(--hair)', borderRadius: 4, padding: 12 }}>
              POINTS ARE IN-GAME ONLY. THE TREASURY IS DISPLAY-ONLY PAPER TRADING TRACKED AGAINST REAL MARKET DATA.
            </div>
          </div>
        </aside>
      </div>

      {needTurnstile && (
        <div className="modal-bg" onClick={() => setNeedTurnstile(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>PROVE YOU'RE HUMAN</h2>
            <p className="fine">One quick check before your first vote. Never again after this.</p>
            <Turnstile onToken={onToken} />
            <button className="btn" disabled={!tsToken || busy} onClick={() => vote(pendingMint)}>
              {busy ? 'CASTING…' : 'CAST MY VOTE'}
            </button>
          </div>
        </div>
      )}

      {declared && (
        <div className="declare-overlay" onClick={() => setDeclared(null)}>
          <div className="title">MAIN RUNNER<br />DECLARED</div>
          <div className="coin">{declared.name} {declared.symbol}</div>
          <div className="paper">
            THE SIMULATED TREASURY OPENED A PAPER POSITION AT THE CURRENT MARKET PRICE.
            FAKE MONEY, REAL SCOREBOARD. TAP TO CONTINUE.
          </div>
        </div>
      )}
    </>
  );
}
