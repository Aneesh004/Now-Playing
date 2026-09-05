/* ─── Spotify Web API Service ──────────────────────────────────── */

const CLIENT_ID = import.meta.env.VITE_SPOTIFY_CLIENT_ID;
const REDIRECT_URI = import.meta.env.VITE_REDIRECT_URI;
const AUTH_ENDPOINT = 'https://accounts.spotify.com/authorize';
const TOKEN_ENDPOINT = 'https://accounts.spotify.com/api/token';
const API_BASE = 'https://api.spotify.com/v1';

const SCOPES = [
  'user-read-playback-state',
  'user-modify-playback-state',
  'user-read-currently-playing',
].join(' ');

/* ─── PKCE helpers ────────────────────────────────────────────── */

function generateRandomString(length) {
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
  const values = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(values, (v) => possible[v % possible.length]).join('');
}

async function sha256(plain) {
  const encoder = new TextEncoder();
  const data = encoder.encode(plain);
  return crypto.subtle.digest('SHA-256', data);
}

function base64UrlEncode(arrayBuffer) {
  const bytes = new Uint8Array(arrayBuffer);
  let str = '';
  bytes.forEach((b) => (str += String.fromCharCode(b)));
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export async function generateCodeVerifier() {
  return generateRandomString(64);
}

export async function generateCodeChallenge(verifier) {
  const hashed = await sha256(verifier);
  return base64UrlEncode(hashed);
}

/* ─── Auth URL builder ────────────────────────────────────────── */

export function getAuthUrl(codeChallenge, state) {
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    response_type: 'code',
    redirect_uri: REDIRECT_URI,
    code_challenge_method: 'S256',
    code_challenge: codeChallenge,
    scope: SCOPES,
    state,
  });
  return `${AUTH_ENDPOINT}?${params.toString()}`;
}

/* ─── Token exchange ──────────────────────────────────────────── */

export async function exchangeCodeForToken(code, codeVerifier) {
  const response = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      grant_type: 'authorization_code',
      code,
      redirect_uri: REDIRECT_URI,
      code_verifier: codeVerifier,
    }),
  });

  if (!response.ok) {
    throw new Error(`Token exchange failed: ${response.status}`);
  }

  const data = await response.json();
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresIn: data.expires_in,
  };
}

export async function refreshAccessToken(refreshToken) {
  const response = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
  });

  if (!response.ok) {
    throw new Error(`Token refresh failed: ${response.status}`);
  }

  const data = await response.json();
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token || refreshToken,
    expiresIn: data.expires_in,
  };
}

/* ─── Authenticated API helper ────────────────────────────────── */

let _getAccessToken = null;

export function setTokenGetter(fn) {
  _getAccessToken = fn;
}

async function apiFetch(endpoint, options = {}) {
  if (!_getAccessToken) throw new Error('Token getter not set');

  const token = await _getAccessToken();
  const res = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  });

  if (res.status === 204) return null;
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API ${res.status}: ${text}`);
  }
  return res.json();
}

/* ─── Player endpoints ────────────────────────────────────────── */

export async function getCurrentPlayback() {
  try {
    return await apiFetch('/me/player');
  } catch {
    return null;
  }
}

export async function play() {
  await apiFetch('/me/player/play', { method: 'PUT' });
}

export async function pause() {
  await apiFetch('/me/player/pause', { method: 'PUT' });
}

export async function next() {
  await apiFetch('/me/player/next', { method: 'POST' });
}

export async function previous() {
  await apiFetch('/me/player/previous', { method: 'POST' });
}

export async function setVolume(percent) {
  await apiFetch(`/me/player/volume?volume_percent=${Math.round(percent)}`, {
    method: 'PUT',
  });
}

export async function seek(positionMs) {
  await apiFetch(`/me/player/seek?position_ms=${Math.round(positionMs)}`, {
    method: 'PUT',
  });
}
