import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { seasonKey } from '../lib/season';
import { useAuth } from '../lib/auth';

function currentAuctionDay() {
  const now = new Date();
  const close = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 21, 0, 0));
  const d = now < close ? close : new Date(close.getTime() + 24 * 3600 * 1000);
  return { day: d.toISOString().slice(0, 10), endsAt: d };
}

function countdown(to) {
  let s = Math.max(0, Math.floor((to.getTime() - Date.now()) / 1000));
  const h = Math.floor(s / 3600); s -= h * 3600;
  const m = Math.floor(s / 60); s -= m * 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export default function Auction({ onNeedLogin }) {
  const { session } = useAuth();
  const { day, endsAt } = currentAuctionDay();
  const [bids, setBids] = useState([]);
  const [liveSets, setLiveSets] = useState([]);
  const [balance, setBalance] = useState(null);
  const [spotlight, setSpotlight] = useState(null);
  const [past, setPast] = useState([]);
  const [pickSet, setPickSet] = useState('');
  const [amount, setAmount] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const [tick, setTick] = useState(0);

  async function load() {
    const nowIso = new Date().toISOString();
    const [{ data: b }, { data: sets }, { data: spot }, { data: hist }] = await Promise.all([
      supabase.from('auction_bids').select('*, profiles(username), vamp_sets(display_name, ticker_norm)').eq('auction_day', day).order('amount', { ascending: false }).limit(20),
      supabase.from('vamp_sets').select('id, display_name, ticker_norm, chain').eq('status', 'voting').order('last_coin_at', { ascending: false }).limit(30),
      supabase.from('auctions').select('*, vamp_sets(display_name, ticker_norm)').eq('status', 'settled').gt('spotlight_until', nowIso).order('spotlight_until', { ascending: false }).limit(1),
      supabase.from('auctions').select('*').eq('status', 'settled').order('day', { ascending: false }).limit(5),
    ]);
    setBids(b ?? []);
    setLiveSets(sets ?? []);
    setSpotlight(spot?.[0] ?? null);
    setPast(hist ?? []);
    if (session) {
      const { data: pts } = await supabase.from('points_ledger').select('points').eq('profile_id', session.user.id).eq('season_key', seasonKey());
      setBalance((pts ?? []).reduce((a, r) => a + Number(r.points), 0));
    }
  }

  useEffect(() => {
    load();
    const t = setInterval(load, 15000);
    const c = setInterval(() => setTick((x) => x + 1), 1000);
    return () => { clearInterval(t); clearInterval(c); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [day, session?.user?.id]);

  const topBid = bids[0]?.amount != null ? Number(bids[0].amount) : null;
  const minBid = (topBid ?? 50) + 50;

  async function bid() {
    setMsg(null);
    if (!session) return onNeedLogin();
    if (!pickSet) return setMsg('pick a set to spotlight');
    const amt = Number(amount);
    if (!isFinite(amt) || amt < minBid) return setMsg(`minimum bid is ${minBid}`);
    setBusy(true);
    const { data, error } = await supabase.rpc('place_bid', { set_id: pickSet, amount: amt });
    setBusy(false);
    if (error) return setMsg(error.message);
    if (data?.error) return setMsg(data.error);
    setAmount('');
    load();
  }

  return (
    <div className="wrap">
      <div className="main">
        <div className="section-head">
          <h2>SPOTLIGHT AUCTION</h2>
          <span className="count">DAILY · CLOSES 21:00 UTC · WINNING BID BURNS FOREVER</span>
        </div>
        <p className="sub">
          Bid season points for tomorrow's spotlight: the winning bidder pins any live vamp set
          to the top of everyone's terminal for 24 hours. Points burn, nothing is bought. Pure flex.
        </p>

        {spotlight && (
          <div className="panel" style={{ margin: '0 16px 12px', display: 'flex', alignItems: 'center', gap: 14, borderColor: 'rgba(240,185,11,0.5)', flexWrap: 'wrap' }}>
            <span className="chip declared">CURRENT SPOTLIGHT</span>
            <span className="mono" style={{ color: 'var(--gold)', fontWeight: 600 }}>${spotlight.vamp_sets?.ticker_norm}</span>
            <span>{spotlight.vamp_sets?.display_name}</span>
            <div className="spacer" />
            <span className="mono" style={{ fontSize: 11, color: 'var(--dim)' }}>
              pinned by {spotlight.winner_username} · {Number(spotlight.winning_bid).toFixed(0)} PTS BURNED
            </span>
          </div>
        )}

        <div className="panel" style={{ margin: '0 16px 12px', display: 'flex', alignItems: 'center', gap: 26, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 200 }}>
            <div className="mono" style={{ fontSize: 10, color: 'var(--dim2)', letterSpacing: '0.12em' }}>CURRENT BID</div>
            <div className="mono" style={{ fontSize: 34, fontWeight: 600, marginTop: 6 }}>
              {topBid != null ? topBid.toFixed(0) : '—'} <span style={{ fontSize: 13, color: 'var(--dim)' }}>PTS</span>
            </div>
            <div className="mono" style={{ fontSize: 11, color: 'var(--dim)', marginTop: 4 }}>
              {bids[0] ? `${bids[0].profiles?.username} → $${bids[0].vamp_sets?.ticker_norm}` : 'no bids yet, the floor is 100'}
            </div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div className="mono" style={{ fontSize: 10, color: 'var(--dim2)', letterSpacing: '0.12em' }}>ENDS IN</div>
            <div className="mono" style={{ fontSize: 26, fontWeight: 600, color: 'var(--gold)', marginTop: 6 }}>{countdown(endsAt)}</div>
          </div>
        </div>

        <div style={{ margin: '0 16px', display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <select
            value={pickSet}
            onChange={(e) => setPickSet(e.target.value)}
            className="mono"
            style={{ flex: 2, minWidth: 220, background: 'var(--panel)', color: 'var(--text)', border: '1px solid var(--hair)', borderRadius: 3, padding: '12px 14px', fontSize: 12 }}
          >
            <option value="">PICK THE SET TO SPOTLIGHT…</option>
            {liveSets.map((s) => (
              <option key={s.id} value={s.id}>
                ${s.ticker_norm} · {s.display_name} {s.chain === 'robinhood' ? '· RH' : ''}
              </option>
            ))}
          </select>
          <input
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder={`${minBid}`}
            inputMode="numeric"
            className="mono"
            style={{ flex: 1, minWidth: 120, background: 'var(--panel)', color: 'var(--text)', border: '1px solid var(--hair)', borderRadius: 3, padding: '12px 14px', fontSize: 13 }}
          />
          <button className="btn" disabled={busy} onClick={bid}>BID POINTS</button>
        </div>
        <div className="mono" style={{ margin: '8px 16px 0', fontSize: 10, color: 'var(--dim2)' }}>
          {session
            ? `YOUR BALANCE: ${balance != null ? balance.toFixed(1) : '…'} PTS · MINIMUM RAISE +50 · POINTS COME FROM SETTLED PICKS`
            : 'CONNECT YOUR WALLET AND WIN SOME PICKS BEFORE BIDDING'}
        </div>
        {msg && <div className="err" style={{ margin: '8px 16px 0' }}>{msg}</div>}

        <div style={{ margin: '22px 16px 0' }}>
          <div className="mono" style={{ fontSize: 10, color: 'var(--dim2)', letterSpacing: '0.12em', borderBottom: '1px solid var(--hair)', paddingBottom: 8 }}>BID LADDER · {day}</div>
          {bids.length === 0 && <div className="mono" style={{ fontSize: 12, color: 'var(--dim2)', padding: '12px 0' }}>NO BIDS YET. FIRST BID TAKES THE LEAD AT 100 PTS.</div>}
          {bids.map((b) => (
            <div key={b.id} className="mono" style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '10px 0', borderBottom: '1px solid var(--hair2)', fontSize: 12, flexWrap: 'wrap' }}>
              <span>{b.profiles?.username}</span>
              <span style={{ color: 'var(--dim)' }}>${b.vamp_sets?.ticker_norm} · {b.vamp_sets?.display_name}</span>
              <span style={{ fontWeight: 600 }}>{Number(b.amount).toFixed(0)}</span>
            </div>
          ))}
        </div>

        {past.length > 0 && (
          <div style={{ margin: '22px 16px 0' }}>
            <div className="mono" style={{ fontSize: 10, color: 'var(--dim2)', letterSpacing: '0.12em', borderBottom: '1px solid var(--hair)', paddingBottom: 8 }}>PAST SPOTLIGHTS</div>
            {past.map((a) => (
              <div key={a.day} className="mono" style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '10px 0', borderBottom: '1px solid var(--hair2)', fontSize: 12 }}>
                <span style={{ color: 'var(--dim)' }}>{a.day}</span>
                <span>{a.winner_username}</span>
                <span className="gold">{Number(a.winning_bid).toFixed(0)} PTS BURNED</span>
              </div>
            ))}
          </div>
        )}

        <div className="foot">
          POINTS ARE IN-GAME ONLY AND HAVE NO MONETARY VALUE · BURNED MEANS GONE · <Link to="/rules" style={{ color: 'var(--dim)' }}>RULES</Link>
        </div>
      </div>
    </div>
  );
}
