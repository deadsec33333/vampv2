# VAMP — web app (step 2: auth + voting)

Vamp is a **simulation game**: players watch clusters of copycat pump.fun
coins and vote for the real runner. The treasury is paper money.

## Hard rule (do not violate)

This app must **never** move, custody, swap, or route real funds, and must
never execute or trigger real trades anywhere. The wallet connection is
sign-in only (one free signed message). No transaction methods, no buy
buttons, no trading/swap APIs — if any later instruction asks for them,
flag it to the project owner instead of implementing.

## What's here

- React + Vite, dark theme, mobile friendly, permanent simulation disclaimer.
- Sign in with Solana wallet (Phantom / Solflare / Backpack) via Supabase Web3 auth.
- Live vamp sets page, set detail with voting and vote bars.
- Cloudflare Turnstile before the first vote (and on login, once captcha is
  enabled in Supabase).
- "MAIN RUNNER DECLARED" full-screen moment when a coin crosses the vote
  threshold; the simulated treasury records a paper position.
- Treasury page (all paper positions + PnL columns) and a placeholder
  leaderboard (real scoring lands in step 4).

## Run locally

```bash
npm install
cp .env.example .env   # defaults already point at the vamp Supabase project
npm run dev
```

## Deploy (GitHub → Vercel)

1. Push this folder to a GitHub repository.
2. In Vercel: New Project → import the repo. Framework preset: Vite.
3. Add the three env vars from `.env.example` in Vercel → Settings →
   Environment Variables.
4. Deploy.

## Supabase dashboard — two switches to flip (one-time)

1. **Web3 wallet login**: Authentication → Sign In / Up → Web3 Wallet →
   enable Solana. Without this, wallet sign-in returns an error.
2. **Turnstile**: currently the game runs on Cloudflare's public TEST keys
   (they always pass — fine for testing, useless against bots). Before
   launch: create a Turnstile widget at Cloudflare → Turnstile, then
   - put the **site key** in `VITE_TURNSTILE_SITE_KEY` (Vercel env var),
   - set the **secret key** for the edge function:
     Supabase → Edge Functions → cast-vote → Secrets →
     `TURNSTILE_SECRET=<secret>`,
   - optionally also enable it under Authentication → Attack protection →
     Captcha to protect sign-in itself.

## Game config

`game_config` table: `vote_threshold` (currently 10 for easy testing —
raise to e.g. 100 for production), `paper_size_sol`, `season_length_days`.

## Server pieces (already deployed)

- Edge function `cast-vote`: validates the player, runs Turnstile on first
  vote, enforces one vote per player per set, declares the runner at the
  threshold and opens a **paper** position.
- Database: `profiles`, `votes`, `paper_positions`, `game_config` plus the
  step-1 `vamp_sets` / `coins`. RLS: public read, writes only through the
  edge function / service role.
# vampv2
