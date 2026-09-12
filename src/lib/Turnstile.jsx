// Thin wrapper around the Cloudflare Turnstile widget (script loaded in index.html).
import { useEffect, useRef } from 'react';
import { TURNSTILE_SITE_KEY } from './supabase';

export default function Turnstile({ onToken }) {
  const ref = useRef(null);
  const widgetId = useRef(null);

  useEffect(() => {
    let cancelled = false;
    function render() {
      if (cancelled || !ref.current) return;
      if (!window.turnstile) return void setTimeout(render, 200);
      if (widgetId.current !== null) return;
      widgetId.current = window.turnstile.render(ref.current, {
        sitekey: TURNSTILE_SITE_KEY,
        theme: 'dark',
        callback: (token) => onToken(token),
        'expired-callback': () => onToken(null),
      });
    }
    render();
    return () => {
      cancelled = true;
      if (widgetId.current !== null && window.turnstile) {
        try { window.turnstile.remove(widgetId.current); } catch {}
        widgetId.current = null;
      }
    };
  }, [onToken]);

  return <div ref={ref} className="turnstile-box" />;
}
