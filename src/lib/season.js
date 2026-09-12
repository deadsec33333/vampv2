// Season = ISO year-week in UTC, matching Postgres to_char(..., 'IYYY-IW').
export function seasonKey(d = new Date()) {
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - day);
  const isoYear = date.getUTCFullYear();
  const yearStart = new Date(Date.UTC(isoYear, 0, 1));
  const week = Math.ceil(((date - yearStart) / 86400000 + 1) / 7);
  return `${isoYear}-${String(week).padStart(2, '0')}`;
}

export function nextSeasonStart() {
  const n = new Date();
  const d = new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + (8 - day));
  return d;
}

export function countdownText(to) {
  let s = Math.max(0, Math.floor((to.getTime() - Date.now()) / 1000));
  const dys = Math.floor(s / 86400); s -= dys * 86400;
  const hrs = Math.floor(s / 3600); s -= hrs * 3600;
  const min = Math.floor(s / 60);
  return `${dys}d ${hrs}h ${min}m`;
}
