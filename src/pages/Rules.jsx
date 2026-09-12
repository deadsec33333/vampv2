import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

function Section({ num, title, children }) {
  return (
    <div className="panel" style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 10 }}>
        <span className="mono" style={{ color: 'var(--red)', fontSize: 12, fontWeight: 600 }}>{num}</span>
        <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, letterSpacing: '0.04em' }}>{title}</h3>
      </div>
      <div style={{ fontSize: 13, lineHeight: 1.65, color: 'var(--dim)' }}>{children}</div>
    </div>
  );
}

const Hl = ({ children }) => <span style={{ color: 'var(--text)' }}>{children}</span>;
const Mono = ({ children }) => <span className="mono" style={{ color: 'var(--text)', fontSize: 12 }}>{children}</span>;

export default function Rules() {
  const [cfg, setCfg] = useState({});

  useEffect(() => {
    supabase.from('game_config').select('key, value').then(({ data }) => {
      const m = {};
      for (const r of data ?? []) m[r.key] = Number(r.value);
      setCfg(m);
    });
  }, []);

  const threshold = cfg.vote_threshold ?? 100;
  const hold = cfg.hold_hours ?? 24;
  const half = cfg.early_half_life_min ?? 30;
  const penalty = cfg.wrong_pick_penalty ?? 25;
  const perPct = cfg.points_per_pnl_pct ?? 10;
  const size = cfg.paper_size_sol ?? 50;

  return (
    <div className="wrap">
      <div className="main">
        <h1 className="page">RULES</h1>
        <p className="sub">How the game works and what's under the hood. Live values, read straight from the game's own settings.</p>

        <div className="pad" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 12, paddingBottom: 8 }}>
          <div>
            <Section num="01" title="THE GAME">
              Every hot narrative on pump.fun instantly spawns copycats: same ticker, same name,
              near-identical coin, launched minutes apart to feed on the original's hype. We call
              them <Hl>vamps</Hl>. VAMP groups each swarm into a <Hl>vamp set</Hl> and asks one
              question: <Hl>which coin is the real runner?</Hl> You get <Hl>one vote per set</Hl>.
              Vote from the set page or swipe through the deck: right backs a coin as the runner,
              left calls it a vamp.
            </Section>

            <Section num="02" title="HOW COINS GET CLUSTERED">
              A collector listens to pump.fun's public launch stream (read-only market data) and
              matches every new coin against sets from the last 6 hours using three rules:{' '}
              <Mono>same normalized ticker</Mono> ($pNut2 and PNUT2 are the same),{' '}
              <Mono>same base ticker + similar name</Mono> (PNUT20 joins PNUT2), and{' '}
              <Mono>near-identical names</Mono> even with different tickers (McDonald's Cat,
              McDonalds Cat, mcdonalds cat). A set with 2+ coins opens for voting.
            </Section>

            <Section num="03" title="DECLARATION AND THE PAPER TREASURY">
              When one coin collects <Hl>{threshold} votes</Hl>, it's declared MAIN RUNNER and the
              simulated treasury "buys" it: a <Hl>paper position of {size} SOL of fake money</Hl>,
              recorded at the coin's real market price at that moment. The position tracks real
              market data for <Hl>{hold} hours</Hl>, then settles at the last seen price.{' '}
              <Hl>No real trade ever occurs.</Hl> Nothing is bought, sold, or routed anywhere.
              The treasury's wins and losses are public, losses very much included.
            </Section>

            <Section num="04" title="SCORING">
              When a position settles, its PnL becomes points: <Mono>{perPct} points per 1% of
              PnL</Mono>, split among everyone who backed the declared runner, weighted by how
              early they voted. Your weight <Hl>halves every {half} minutes</Hl>, so a vote in
              minute 2 is worth roughly double a vote in minute {half + 2}. If the runner dumped,
              its backers share the negative pool. Backing the wrong coin costs a flat{' '}
              <Hl>{penalty} points</Hl>. Points are <Hl>in-game only</Hl> and have no monetary value.
            </Section>
          </div>

          <div>
            <Section num="05" title="SEASONS">
              The leaderboard resets every <Hl>Monday 00:00 UTC</Hl>. Each season's winner is
              recorded forever in the Hall of Runners. New week, clean slate, same vamps.
            </Section>

            <Section num="06" title="RECRUITING">
              Every player gets an invite link. The referral board counts only{' '}
              <Hl>verified humans who actually cast at least one vote</Hl>. Inviting a bot farm
              gets you nothing.
            </Section>

            <Section num="07" title="UNDER THE HOOD">
              Launch and trade data flow <Hl>in, read-only</Hl>, from pump.fun's public data
              stream; nothing ever flows out to any exchange or chain. Sets, votes, and paper
              positions live in a Postgres database; prices on watched coins update live from the
              trade stream; settlement and scoring run on schedule inside the database itself.{' '}
              <Hl>Wallet connect is sign-in only:</Hl> your wallet signs one free message to prove
              it's yours. The site never requests transactions, never sees your keys, and has no
              ability to touch funds, yours or anyone's. Cloudflare Turnstile screens signups and
              first votes so the vote counts stay human.
            </Section>

            <Section num="08" title="THE FINE PRINT">
              VAMP is a simulation game. The treasury is paper money. Vote counts and declarations
              are game mechanics, <Hl>not trading signals and not financial advice</Hl>. Real
              memecoins are a casino where the house sniper-bots you; nothing on this site is a
              recommendation to buy any of them. Play the game, keep your SOL.
            </Section>
          </div>
        </div>

        <div className="foot">
          MARKET DATA IN, NOTHING OUT · EVERY POSITION SIMULATED · POINTS HAVE NO MONETARY VALUE
        </div>
      </div>
    </div>
  );
}
