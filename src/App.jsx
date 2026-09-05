import { useState, useEffect, useRef, useCallback } from 'react';
import Player from './components/Player';
import {
  generateCodeVerifier,
  generateCodeChallenge,
  getAuthUrl,
  exchangeCodeForToken,
  refreshAccessToken,
  setTokenGetter,
  getCurrentPlayback,
} from './services/spotifyApi';

const POLL_INTERVAL = 3000;
const STORAGE_ACCESS_KEY = 'spotify_access_token';
const STORAGE_REFRESH_KEY = 'spotify_refresh_token';
const STORAGE_EXPIRY_KEY = 'spotify_token_expiry';

/* ─── Reusable SVG: Spotify logo ──────────────────────────────── */

function SpotifyLogo({ size = 64 }) {
  const isSmall = size <= 24;
  const sw = isSmall ? '1.5' : '2.5';
  const paths = isSmall
    ? [
        'M7 16c3-1.3 7-1.5 10-.3',
        'M8 13c2.5-1.1 6-1.3 8.5-.3',
        'M9.5 10.2c1.8-.7 4.5-.8 6.5-.1',
      ]
    : [
        'M13 32c5.5-2.5 13-2.8 18.5-.5',
        'M14.5 26.5c5-2.2 11.5-2.5 17-.5',
        'M16.5 21c4-1.8 10-2 14.5-.3',
      ];
  const vb = isSmall ? '0 0 24 24' : '0 0 48 48';
  const r = isSmall ? 12 : 24;
  const cx = r, cy = r;

  return (
    <svg viewBox={vb} width={size} height={size}>
      <circle cx={cx} cy={cy} r={r} fill="#1DB954" />
      {paths.map((d) => (
        <path key={d} d={d} stroke="#000" strokeWidth={sw} fill="none" strokeLinecap="round" />
      ))}
    </svg>
  );
}

/* ─── Title bar (full mode only) ──────────────────────────────── */

function TitleBar() {
  return (
    <div className="title-bar">
      <div className="title-bar-drag">
        <svg className="title-bar-icon" viewBox="0 0 24 24" width="14" height="14">
          <circle cx="12" cy="12" r="10" fill="#1DB954" />
          <path d="M8 15.5c2.7-1.2 5.7-1.2 8.4 0" stroke="#000" strokeWidth="1.5" fill="none" strokeLinecap="round" />
          <path d="M9.5 12.5c2-1 4.5-1 6.5 0" stroke="#000" strokeWidth="1.5" fill="none" strokeLinecap="round" />
          <path d="M11 9.8c1-.4 2.5-.4 3.5 0" stroke="#000" strokeWidth="1.5" fill="none" strokeLinecap="round" />
        </svg>
        <span className="title-bar-text">Mini Player</span>
      </div>
      <div className="title-bar-controls" onMouseDown={(e) => e.stopPropagation()}>
        <TitleButton
          className="title-btn-mode"
          onClick={() => window.electronAPI?.toggleCompact()}
          label="Switch to Compact Bar"
        >
          <svg viewBox="0 0 12 12" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.2">
            <rect x="2" y="4" width="8" height="4" rx="1" />
          </svg>
        </TitleButton>
        <TitleButton
          className="title-btn-minimize"
          onClick={() => window.electronAPI?.minimizeWindow()}
          label="Minimize"
        >
          <svg viewBox="0 0 12 12" width="12" height="12">
            <rect x="2" y="5.5" width="8" height="1" rx="0.5" fill="currentColor" />
          </svg>
        </TitleButton>
        <TitleButton
          className="title-btn-close"
          onClick={() => window.electronAPI?.closeWindow()}
          label="Close"
        >
          <svg viewBox="0 0 12 12" width="12" height="12">
            <path d="M3 3l6 6M9 3l-6 6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
          </svg>
        </TitleButton>
      </div>
    </div>
  );
}

function TitleButton({ className, onClick, label, children }) {
  const handleClick = (e) => {
    e.stopPropagation();
    onClick();
  };

  return (
    <button
      className={`title-btn ${className}`}
      onMouseDown={(e) => e.stopPropagation()}
      onClick={handleClick}
      aria-label={label}
      title={label}
    >
      {children}
    </button>
  );
}

/* ─── Close button (compact views) ────────────────────────────── */

function CloseButton() {
  return (
    <button
      className="compact-close-btn"
      onClick={() => window.electronAPI?.closeWindow()}
      aria-label="Close"
    >
      <svg viewBox="0 0 12 12" width="10" height="10">
        <path d="M3 3l6 6M9 3l-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    </button>
  );
}

/* ─── Main App ────────────────────────────────────────────────── */

export default function App() {
  const [accessToken, setAccessToken] = useState(() => localStorage.getItem(STORAGE_ACCESS_KEY) || null);
  const [refreshToken, setRefreshToken] = useState(() => localStorage.getItem(STORAGE_REFRESH_KEY) || null);
  const [tokenExpiry, setTokenExpiry] = useState(() => {
    const saved = localStorage.getItem(STORAGE_EXPIRY_KEY);
    return saved ? parseInt(saved, 10) : null;
  });
  const [isInitializing, setIsInitializing] = useState(() => {
    return Boolean(localStorage.getItem(STORAGE_REFRESH_KEY));
  });
  const [playback, setPlayback] = useState(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState(null);
  const [isCompact, setIsCompact] = useState(false);

  const codeVerifierRef = useRef(null);
  const pollRef = useRef(null);

  /* ─── Compact mode detection ───────────────────────────────── */

  useEffect(() => {
    const checkCompact = () => setIsCompact(window.innerHeight <= 150);
    checkCompact();
    window.addEventListener('resize', checkCompact);
    return () => window.removeEventListener('resize', checkCompact);
  }, []);

  /* ─── Save tokens to localStorage & Electron storage ────────── */

  const saveTokens = useCallback((access, refresh, expiryMs) => {
    setAccessToken(access);
    if (access) {
      localStorage.setItem(STORAGE_ACCESS_KEY, access);
    } else {
      localStorage.removeItem(STORAGE_ACCESS_KEY);
    }

    if (refresh) {
      setRefreshToken(refresh);
      localStorage.setItem(STORAGE_REFRESH_KEY, refresh);
    }

    if (expiryMs) {
      setTokenExpiry(expiryMs);
      localStorage.setItem(STORAGE_EXPIRY_KEY, expiryMs.toString());
    } else {
      setTokenExpiry(null);
      localStorage.removeItem(STORAGE_EXPIRY_KEY);
    }

    window.electronAPI?.saveStoredTokens({
      accessToken: access,
      refreshToken: refresh,
      tokenExpiry: expiryMs,
    });
  }, []);

  const clearTokens = useCallback(() => {
    setAccessToken(null);
    setRefreshToken(null);
    setTokenExpiry(null);
    localStorage.removeItem(STORAGE_ACCESS_KEY);
    localStorage.removeItem(STORAGE_REFRESH_KEY);
    localStorage.removeItem(STORAGE_EXPIRY_KEY);
    window.electronAPI?.clearStoredTokens();
  }, []);

  /* ─── Token management ─────────────────────────────────────── */

  const getValidToken = useCallback(async (customRefreshToken) => {
    if (accessToken && tokenExpiry && Date.now() < tokenExpiry - 60000) {
      return accessToken;
    }

    const currentRefreshToken = customRefreshToken || refreshToken || localStorage.getItem(STORAGE_REFRESH_KEY);

    if (currentRefreshToken) {
      try {
        const tokens = await refreshAccessToken(currentRefreshToken);
        const expiry = Date.now() + tokens.expiresIn * 1000;
        saveTokens(tokens.accessToken, tokens.refreshToken, expiry);
        return tokens.accessToken;
      } catch (err) {
        console.error('Token refresh failed:', err);
        clearTokens();
        setError('Session expired. Please reconnect.');
        return null;
      }
    }

    return accessToken;
  }, [accessToken, refreshToken, tokenExpiry, saveTokens, clearTokens]);

  useEffect(() => {
    setTokenGetter(getValidToken);
  }, [getValidToken]);

  // Initial token load & silent refresh on startup
  useEffect(() => {
    let isMounted = true;

    async function initTokens() {
      try {
        const stored = await window.electronAPI?.getStoredTokens?.() ?? null;

        const effectiveRefresh = stored?.refreshToken || localStorage.getItem(STORAGE_REFRESH_KEY);
        const effectiveAccess = stored?.accessToken || localStorage.getItem(STORAGE_ACCESS_KEY);
        const effectiveExpiry = stored?.tokenExpiry || localStorage.getItem(STORAGE_EXPIRY_KEY);

        if (effectiveRefresh) {
          setRefreshToken(effectiveRefresh);
          if (effectiveAccess && effectiveExpiry && Date.now() < Number(effectiveExpiry) - 60000) {
            setAccessToken(effectiveAccess);
            setTokenExpiry(Number(effectiveExpiry));
            if (isMounted) setIsInitializing(false);
          } else {
            const newToken = await getValidToken(effectiveRefresh);
            if (isMounted) {
              if (newToken) setAccessToken(newToken);
              setIsInitializing(false);
            }
          }
        } else {
          if (isMounted) setIsInitializing(false);
        }
      } catch {
        if (isMounted) setIsInitializing(false);
      }
    }

    initTokens();
    return () => { isMounted = false; };
  }, []);

  /* ─── OAuth flow ───────────────────────────────────────────── */

  const handleLogin = async () => {
    setIsConnecting(true);
    setError(null);

    try {
      const verifier = await generateCodeVerifier();
      codeVerifierRef.current = verifier;
      const challenge = await generateCodeChallenge(verifier);
      const state = crypto.randomUUID();
      const authUrl = getAuthUrl(challenge, state);

      if (window.electronAPI) {
        await window.electronAPI.startAuthServer();
        await window.electronAPI.openExternal(authUrl);
      } else {
        window.open(authUrl, '_blank');
      }
    } catch (err) {
      console.error('Login error:', err);
      setError('Failed to start authorization.');
      setIsConnecting(false);
    }
  };

  useEffect(() => {
    if (window.electronAPI) {
      window.electronAPI.onAuthCode(async (code) => {
        try {
          const tokens = await exchangeCodeForToken(code, codeVerifierRef.current);
          const expiry = Date.now() + tokens.expiresIn * 1000;
          saveTokens(tokens.accessToken, tokens.refreshToken, expiry);
          setError(null);
        } catch (err) {
          console.error('Token exchange failed:', err);
          setError('Authorization failed. Please try again.');
        }
        setIsConnecting(false);
      });
    }
  }, [saveTokens]);

  /* ─── Playback polling ─────────────────────────────────────── */

  useEffect(() => {
    if (!accessToken) {
      if (pollRef.current) clearInterval(pollRef.current);
      return;
    }

    const fetchPlayback = async () => {
      try {
        const data = await getCurrentPlayback();
        setPlayback(data);
      } catch {
        // Silently ignore polling errors
      }
    };

    fetchPlayback();
    pollRef.current = setInterval(fetchPlayback, POLL_INTERVAL);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [accessToken]);

  /* ─── Render ───────────────────────────────────────────────── */

  // Determine which screen to show
  let content;
  if (accessToken) {
    content = <Player playback={playback} onPlaybackChange={setPlayback} isCompact={isCompact} />;
  } else if (isInitializing) {
    content = isCompact ? (
      <div className="login-compact">
        <div className="login-compact-drag" />
        <span className="login-spinner" style={{ width: 16, height: 16, borderTopColor: '#1DB954' }} />
        <span style={{ fontSize: 11, color: '#b3b3b3' }}>Connecting…</span>
      </div>
    ) : (
      <div className="login-screen">
        <div className="login-glow" />
        <div className="login-content">
          <SpotifyLogo size={64} />
          <h1 className="login-title">Spotify Mini Player</h1>
          <p className="login-subtitle">Connecting to Spotify…</p>
          <div style={{ marginTop: 12 }}>
            <span className="login-spinner" style={{ width: 24, height: 24 }} />
          </div>
        </div>
      </div>
    );
  } else {
    content = isCompact ? (
      <div className="login-compact">
        <div className="login-compact-drag" />
        <SpotifyLogo size={20} />
        <button
          className={`login-compact-btn ${isConnecting ? 'login-btn-connecting' : ''}`}
          onClick={handleLogin}
          disabled={isConnecting}
        >
          {isConnecting ? 'Waiting…' : 'Connect'}
        </button>
        <CloseButton />
      </div>
    ) : (
      <div className="login-screen">
        <div className="login-glow" />
        <div className="login-content">
          <SpotifyLogo size={64} />
          <h1 className="login-title">Spotify Mini Player</h1>
          <p className="login-subtitle">Control your music without switching apps</p>
          <button
            className={`login-btn ${isConnecting ? 'login-btn-connecting' : ''}`}
            onClick={handleLogin}
            disabled={isConnecting}
          >
            {isConnecting ? (
              <>
                <span className="login-spinner" />
                Waiting for Spotify…
              </>
            ) : (
              'Connect to Spotify'
            )}
          </button>
          {error && <p className="login-error">{error}</p>}
        </div>
      </div>
    );
  }

  return (
    <div className={`app-shell ${isCompact ? 'app-compact' : ''}`}>
      {!isCompact && <TitleBar />}
      {content}
    </div>
  );
}
