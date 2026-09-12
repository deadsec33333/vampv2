import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { AuthProvider } from './lib/auth';
import { CONFIG_OK } from './lib/supabase';
import './styles.css';

function ConfigError() {
  return (
    <div style={{ maxWidth: 560, margin: '80px auto', padding: 24, fontFamily: 'system-ui' }}>
      <h1 style={{ color: '#e5484d' }}>VAMP isn't configured yet</h1>
      <p>
        The app is missing its environment variables, so it can't reach the
        database. In Vercel open Settings, then Environment Variables, and add:
      </p>
      <pre style={{ background: '#161624', padding: 16, borderRadius: 8, overflowX: 'auto' }}>
        VITE_SUPABASE_URL{'\n'}VITE_SUPABASE_ANON_KEY{'\n'}VITE_TURNSTILE_SITE_KEY
      </pre>
      <p>
        The values are in the project's <code>.env.example</code> file. After
        adding them, redeploy the site (Deployments, then Redeploy) — they only
        take effect on a fresh build.
      </p>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {CONFIG_OK ? (
      <BrowserRouter>
        <AuthProvider>
          <App />
        </AuthProvider>
      </BrowserRouter>
    ) : (
      <ConfigError />
    )}
  </React.StrictMode>
);
