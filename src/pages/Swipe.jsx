import { useEffect, useRef, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { fmtTick } from './Home';
import { useAuth } from '../lib/auth';
import Turnstile from '../lib/Turnstile';

const THRESHOLD = 110; // px of drag that counts as a decision

function timeAgo(iso) {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `${Math.floor(s)}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  return `${Math.floor(s / 3600)}h ago`;
}

export default function Swipe({ onNeedLogin }) {
  const { session, profile, refreshProfile } = useAuth();
  const [queue, setQueue] = useState(null); // [{ set, coins }]
  const [si, setSi] = useState(0);
  const [ci, setCi] = useState(0);
  const [busy, setBusy] = useState(false);
  const [needTurnstile, setNeedTurnstile] = useState(false);
  const [tsToken, setTsToken] = useState(null);
  const [error, setError] = useState(null);
  const [declared, setDeclared] = useState(null);

  const cardRef = useRef(null);
  const runnerRef = useRef(null);
  const vampRef = useRef(null);
  const startX = useRef(0);
  const xRef = useRef(0);
  const draggingRef = useRef(false);
  const animatingRef = useRef(false);
  const onToken = useCallback((t) => setTsToken(t), []);

  async function load() {
    const { data: sets } = await supabase
      .from('vamp_sets')
      .select('id, display_name, ticker_norm, coin_count, last_coin_at')
      .eq('status', 'voting')
      .order('last_coin_at', { ascending: false })
      .limit(20);
    if (!sets?.length) return setQueue([]);

    let votedSetIds = new Set();
    if (session) {
      const { data: mine } = await supabase
        .from('votes').select('vamp_set_id').eq('voter_id', session.user.id);
      votedSetIds = new Set((mine ?? []).map((v) => v.vamp_set_id));
    }
    const fresh = sets.filter((s) => !votedSetIds.has(s.id));
    if (!fresh.length) return setQueue([]);

    const { data: coins } = await supabase
      .from('coins')
      .select('mint, vamp_set_id, name, symbol, creator, initial_buy_sol, market_cap_sol_at_launch, last_market_cap_sol, launched_at')
      .in('vamp_set_id', fresh.map((s) => s.id))
      .order('launched_at');
    const bySet = {};
    for (const c of coins ?? []) (bySet[c.vamp_set_id] ??= []).push(c);
    setQueue(fresh.map((s) => ({ set: s, coins: bySet[s.id] ?? [] })).filter((q) => q.coins.length >= 2));
    setSi(0); setCi(0);
  }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [session?.user?.id]);

  const current = queue?.[si];
  const coin = current?.coins?.[ci];
  const nextCoin = current?.coins?.[ci + 1] ?? queue?.[si + 1]?.coins?.[0] ?? null;

  function nextSet() { setCi(0); setSi((i) => i + 1); }

  function advanceLeft() {
    if (ci + 1 < current.coins.length) setCi(ci + 1);
    else nextSet(); // dismissed everything: no vote on this set
  }

  async function castVote(token) {
    setBusy(true);
    const { data, error: fnErr } = await supabase.functions.invoke('cast-vote', {
      body: { vamp_set_id: current.set.id, coin_mint: coin.mint, turnstile_token: token ?? undefined },
    });
    setBusy(false);
    setNeedTurnstile(false);
    if (fnErr) {
      let msg = fnErr.message;
      try { const ctx = await fnErr.context?.json?.(); if (ctx?.error) msg = ctx.error; } catch {}
      if (msg !== 'already_voted') setError(msg);
      return;
    }
    if (!profile?.human_verified_at) refreshProfile();
    if (data?.declared) setDeclared(coin);
  }

  // ---------- animation helpers (direct DOM writes: no re-render per frame) ----------
  function setDragTransform(x) {
    const el = cardRef.current;
    if (!el) return;
    el.style.transition = 'none';
    el.style.transform = `translate(${x}px, ${Math.abs(x) * 0.05}px) rotate(${x / 20}deg)`;
    if (runnerRef.current) runnerRef.current.style.opacity = Math.max(0, Math.min(1, x / THRESHOLD));
    if (vampRef.current) vampRef.current.style.opacity = Math.max(0, Math.min(1, -x / THRESHOLD));
  }

  function snapBack() {
    const el = cardRef.current;
    if (!el) return;
    el.style.transition = 'transform 0.45s cubic-bezier(0.18, 1.4, 0.35, 1)';
    el.style.transform = 'translate(0px, 0px) rotate(0deg)';
    if (runnerRef.current) runnerRef.current.style.opacity = 0;
    if (vampRef.current) vampRef.current.style.opacity = 0;
  }

  function flyOut(dir, after) {
    const el = cardRef.current;
    if (!el || animatingRef.current) return;
    animatingRef.current = true;
    const stamp = dir > 0 ? runnerRef.current : vampRef.current;
    if (stamp) stamp.style.opacity = 1;
    el.style.transition = 'transform 0.34s cubic-bezier(0.2, 0.65, 0.3, 1), opacity 0.34s ease-out';
    el.style.transform = `translate(${dir * (window.innerWidth * 0.7 + 200)}px, 60px) rotate(${dir * 26}deg)`;
    el.style.opacity = '0';
    setTimeout(() => {
      animatingRef.current = false;
      after();
    }, 320);
  }

  // ---------- decisions ----------
  function decideLeft() {
    if (!coin || busy || animatingRef.current) return;
    flyOut(-1, advanceLeft);
  }

  function decideRight() {
    if (!coin || busy || animatingRef.current) return;
    setError(null);
    if (!session) { snapBack(); return onNeedLogin(); }
    const firstVote = !profile?.human_verified_at;
    if (firstVote && !tsToken) { snapBack(); return setNeedTurnstile(true); }
    const token = tsToken;
    flyOut(1, () => { castVote(token); nextSet(); });
  }

  function voteFromModal() {
    if (!coin || busy) return;
    const token = tsToken;
    setNeedTurnstile(false);
    flyOut(1, () => { castVote(token); nextSet(); });
  }

  // ---------- pointer mechanics ----------
  function onPointerDown(e) {
    if (animatingRef.current) return;
    startX.current = e.clientX;
    xRef.current = 0;
    draggingRef.current = true;
    e.currentTarget.setPointerCapture?.(e.pointerId);
  }
  function onPointerMove(e) {
    if (!draggingRef.current || animatingRef.current) return;
    xRef.current = e.clientX - startX.current;
    setDragTransform(xRef.current);
  }
  function onPointerUp() {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    const x = xRef.current;
    xRef.current = 0;
    if (x <= -THRESHOLD) decideLeft();
    else if (x >= THRESHOLD) decideRight();
    else snapBack();
  }

  // keyboard
  useEffect(() => {
    function onKey(e) {
      if (e.key === 'ArrowLeft') decideLeft();
      if (e.key === 'ArrowRight') decideRight();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coin?.mint, busy, tsToken, session?.user?.id]);

  if (queue === null) return <p className="meta" style={{ marginTop: 40 }}>Loading…</p>;

  if (!current || !coin) {
    return (
      <>
        <h1 className="page">Swipe</h1>
        <p className="sub">No fresh vamp sets to judge right now. New clusters appear as copycats launch, usually within minutes.</p>
        <button className="btn ghost small" onClick={load}>Check again</button>
      </>
    );
  }

  const mcap = coin.last_market_cap_sol ?? coin.market_cap_sol_at_launch;

  return (
    <>
      <h1 className="page">Which is the real one?</h1>
      <p className="sub">
        <span className="ticker">${fmtTick(current.set.ticker_norm)}</span> · "{current.set.display_name}" ·
        card {ci + 1} of {current.coins.length} · set {si + 1} of {queue.length}
      </p>
      <p className="sub">Swipe right to back it as the runner (that's your one vote for this set). Swipe left to call it a vamp.</p>

      <div className="swipe-stage">
        {nextCoin && (
          <div className="swipe-card behind">
            <div className="swipe-name">{nextCoin.name}</div>
            <div className="swipe-ticker">{fmtTick(nextCoin.symbol)}</div>
          </div>
        )}
        <div
          key={coin.mint}
          ref={cardRef}
          className="swipe-card top"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          <div ref={runnerRef} className="stamp runner" style={{ opacity: 0 }}>RUNNER</div>
          <div ref={vampRef} className="stamp vamp" style={{ opacity: 0 }}>VAMP</div>
          <div className="swipe-name">{coin.name}</div>
          <div className="swipe-ticker">{fmtTick(coin.symbol)}</div>
          <div className="swipe-facts">
            <div><span>Launched</span>{timeAgo(coin.launched_at)}</div>
            <div><span>Mcap</span>{mcap != null ? `${Number(mcap).toFixed(1)} SOL` : '—'}</div>
            <div><span>Dev buy</span>{coin.initial_buy_sol != null ? `${Number(coin.initial_buy_sol).toFixed(2)} SOL` : '—'}</div>
            <div><span>Creator</span>{coin.creator ? `${coin.creator.slice(0, 4)}…${coin.creator.slice(-4)}` : '—'}</div>
          </div>
          <div className="swipe-mint">{coin.mint}</div>
        </div>
      </div>

      <div className="swipe-actions">
        <button className="swipe-btn no" onClick={decideLeft} disabled={busy} aria-label="Call it a vamp">
          <b>✕</b><span>VAMP</span>
        </button>
        <button className="swipe-btn yes" onClick={decideRight} disabled={busy} aria-label="Back as the runner">
          <b>⚔</b><span>RUNNER</span>
        </button>
      </div>
      {error && <div className="err" style={{ textAlign: 'center' }}>{error}</div>}

      {needTurnstile && (
        <div className="modal-bg" onClick={() => setNeedTurnstile(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Prove you're human</h2>
            <p className="fine">One quick check before your first vote. Never again after this.</p>
            <Turnstile onToken={onToken} />
            <button className="btn" disabled={!tsToken || busy} onClick={voteFromModal}>
              {busy ? 'Casting…' : 'Cast my vote'}
            </button>
          </div>
        </div>
      )}

      {declared && (
        <div className="declare-overlay" onClick={() => setDeclared(null)}>
          <div className="title">MAIN RUNNER<br />DECLARED</div>
          <div className="coin">{declared.name} <span className="ticker">{declared.symbol}</span></div>
          <div className="paper">
            Your swipe tipped it. The simulated treasury just opened a PAPER position
            at the current market price. Fake money, real scoreboard. Tap to continue.
          </div>
        </div>
      )}
    </>
  );
}
