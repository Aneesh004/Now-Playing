# Spotify Mini Player 🎵

A sleek, lightweight, always-on-top desktop controller for Spotify on Windows.

> [!IMPORTANT]
> **Spotify Premium Required**: Controlling playback (play, pause, skip, seek, volume) via Spotify's Web API requires an active **Spotify Premium** account.

---

## ✨ Features

- **Always-on-Top Floating Widget**: Stays visible over all full-screen apps and browsers.
- **Dual View Modes**:
  - **Compact Bar**: Ultra-slim widget designed for the taskbar or screen corner.
  - **Full Card**: Album art, track info, progress/seeking, volume, and playback controls.
- **Persistent Session**: Authorize once; login is saved across app restarts.
- **Real-time Sync**: Instant sync with playback from your desktop or phone Spotify app.

---

## 🚀 Quick Start

1. Download / unzip the application folder.
2. Launch **`Spotify Mini Player.exe`**.
3. Click **"Connect to Spotify"** and log in via your browser.
4. Play music on Spotify — the player will automatically sync!

---

## 🛠️ Setup from Source

### Prerequisites
- [Node.js](https://nodejs.org/) (v18+)
- Active **Spotify Premium** account
- Spotify Developer App (Client ID)

### 1. Spotify Developer Settings
1. Go to [Spotify Developer Dashboard](https://developer.spotify.com/dashboard) and create an app.
2. Under **Settings**, add Redirect URI: `http://127.0.0.1:8888/callback`
3. Under **User Management**, add your Spotify account email.

### 2. Configure & Run
```bash
# Clone & install dependencies
git clone <repo-url>
cd spotify-mini-player
npm install

# Create .env file
# VITE_SPOTIFY_CLIENT_ID=your_client_id_here
# VITE_REDIRECT_URI=http://127.0.0.1:8888/callback

# Run locally
npm run dev

# Build standalone .exe
npm run dist:win
```

---

## 💡 Controls & Tips

- **Drag & Move**: Click and drag anywhere on the player to reposition it.
- **Toggle Mode**: Click the **collapse/expand** icon in the header to switch between Compact and Full card views.
- **Exit**: Click the **✕** button to close the app completely.
