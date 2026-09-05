import { useState, useEffect, useRef, useCallback } from 'react';
import SongInfo from './SongInfo';
import Controls from './Controls';
import {
  seek,
  getCurrentPlayback,
  play as apiPlay,
  pause as apiPause,
  next as apiNext,
  previous as apiPrevious,
} from '../services/spotifyApi';

/* ─── Shared SVG icons ────────────────────────────────────────── */

const MusicNoteIcon = ({ size = 48 }) => (
  <svg viewBox="0 0 24 24" width={size} height={size}>
    <path d="M12 3v10.55A4 4 0 1014 17V7h4V3h-6z" fill="#535353" />
  </svg>
);

const CloseIcon = () => (
  <svg viewBox="0 0 12 12" width="10" height="10">
    <path d="M3 3l6 6M9 3l-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

const ExpandIcon = () => (
  <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const PrevIcon = ({ size = 14 }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor">
    <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z" />
  </svg>
);

const NextIcon = ({ size = 14 }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor">
    <path d="M6 18l8.5-6L6 6v12zm10-12v12h2V6z" />
  </svg>
);

const PlayIcon = ({ size = 18 }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor">
    <path d="M8 5v14l11-7z" />
  </svg>
);

const PauseIcon = ({ size = 18 }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor">
    <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
  </svg>
);

/* ─── Helpers ─────────────────────────────────────────────────── */

function formatTime(ms) {
  const totalSec = Math.floor(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min}:${sec.toString().padStart(2, '0')}`;
}

function stopEvent(e) {
  e.stopPropagation();
}

/* ─── Component ───────────────────────────────────────────────── */

export default function Player({ playback, onPlaybackChange, isCompact }) {
  const [localProgress, setLocalProgress] = useState(0);
  const [isSeeking, setIsSeeking] = useState(false);
  const progressTimer = useRef(null);

  const track = playback?.item;
  const isPlaying = playback?.is_playing ?? false;
  const duration = track?.duration_ms ?? 0;
  const albumArt = track?.album?.images?.[0]?.url ?? '';
  const trackName = track?.name ?? 'Unknown Track';
  const artists = track?.artists?.map((a) => a.name).join(', ') ?? 'Unknown Artist';

  /* ─── Local progress ticker ────────────────────────────────── */

  useEffect(() => {
    if (!isSeeking && playback?.progress_ms != null) {
      setLocalProgress(playback.progress_ms);
    }
  }, [playback?.progress_ms, isSeeking]);

  useEffect(() => {
    if (progressTimer.current) clearInterval(progressTimer.current);

    if (isPlaying && !isSeeking) {
      progressTimer.current = setInterval(() => {
        setLocalProgress((prev) => Math.min(prev + 500, duration));
      }, 500);
    }

    return () => {
      if (progressTimer.current) clearInterval(progressTimer.current);
    };
  }, [isPlaying, isSeeking, duration]);

  /* ─── Playback actions ─────────────────────────────────────── */

  const refreshPlayback = useCallback(async () => {
    setTimeout(async () => {
      try {
        const data = await getCurrentPlayback();
        if (data) onPlaybackChange(data);
      } catch { /* ignore */ }
    }, 300);
  }, [onPlaybackChange]);

  const handleSeek = useCallback(
    async (e) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      const positionMs = ratio * duration;

      setIsSeeking(true);
      setLocalProgress(positionMs);

      try {
        await seek(positionMs);
        setTimeout(async () => {
          const data = await getCurrentPlayback();
          if (data) onPlaybackChange(data);
          setIsSeeking(false);
        }, 300);
      } catch {
        setIsSeeking(false);
      }
    },
    [duration, onPlaybackChange]
  );

  const handlePlayPause = async () => {
    try {
      if (isPlaying) await apiPause(); else await apiPlay();
      await refreshPlayback();
    } catch { /* ignore */ }
  };

  const handleNext = async () => {
    try { await apiNext(); await refreshPlayback(); } catch { /* ignore */ }
  };

  const handlePrevious = async () => {
    try { await apiPrevious(); await refreshPlayback(); } catch { /* ignore */ }
  };

  const progressPercent = duration > 0 ? (localProgress / duration) * 100 : 0;

  /* ═══ COMPACT MODE ══════════════════════════════════════════ */

  if (isCompact) {
    if (!track) {
      return (
        <div className="player-compact">
          <div className="compact-drag" />
          <div className="compact-empty-icon"><MusicNoteIcon size={20} /></div>
          <span className="compact-empty-text">Play something on Spotify</span>
          <CompactButton onClick={() => window.electronAPI?.toggleCompact()} label="Expand to Full Player">
            <ExpandIcon />
          </CompactButton>
          <button className="compact-close-btn" onClick={() => window.electronAPI?.closeWindow()} aria-label="Close" title="Close">
            <CloseIcon />
          </button>
        </div>
      );
    }

    return (
      <div className="player-compact">
        <div className="compact-drag" />

        <div className="compact-art">
          {albumArt ? (
            <img src={albumArt} alt="" draggable={false} />
          ) : (
            <div className="compact-art-placeholder"><MusicNoteIcon size={16} /></div>
          )}
        </div>

        <div className="compact-info">
          <span className="compact-title">{trackName}</span>
          <span className="compact-artist">{artists}</span>
        </div>

        <div className="compact-controls" onMouseDown={stopEvent}>
          <CompactButton onClick={handlePrevious} label="Previous"><PrevIcon /></CompactButton>
          <CompactButton className="compact-ctrl-play" onClick={handlePlayPause} label={isPlaying ? 'Pause' : 'Play'}>
            {isPlaying ? <PauseIcon /> : <PlayIcon />}
          </CompactButton>
          <CompactButton onClick={handleNext} label="Next"><NextIcon /></CompactButton>
          <CompactButton onClick={() => window.electronAPI?.toggleCompact()} label="Expand to Full Player">
            <ExpandIcon />
          </CompactButton>
        </div>

        <button
          className="compact-close-btn"
          onMouseDown={stopEvent}
          onClick={(e) => { stopEvent(e); window.electronAPI?.closeWindow(); }}
          aria-label="Close"
          title="Close"
        >
          <CloseIcon />
        </button>

        <div className="compact-progress" onClick={handleSeek}>
          <div className="compact-progress-fill" style={{ width: `${progressPercent}%` }} />
        </div>
      </div>
    );
  }

  /* ═══ FULL MODE ═════════════════════════════════════════════ */

  if (!track) {
    return (
      <div className="player player-empty">
        <div className="player-empty-icon"><MusicNoteIcon size={48} /></div>
        <p className="player-empty-text">Play something on Spotify to get started</p>
      </div>
    );
  }

  return (
    <div className="player">
      {albumArt && (
        <div className="player-bg" style={{ backgroundImage: `url(${albumArt})` }} />
      )}

      <div className="player-content">
        <div className="album-art-wrapper">
          {albumArt ? (
            <img
              className={`album-art ${isPlaying ? 'album-art-playing' : ''}`}
              src={albumArt}
              alt="Album artwork"
              draggable={false}
            />
          ) : (
            <div className="album-art album-art-placeholder"><MusicNoteIcon size={48} /></div>
          )}
        </div>

        <SongInfo track={track} />

        <div className="progress-section">
          <span className="progress-time">{formatTime(localProgress)}</span>
          <div className="progress-bar" onClick={handleSeek}>
            <div className="progress-track">
              <div className="progress-fill" style={{ width: `${progressPercent}%` }} />
              <div className="progress-knob" style={{ left: `${progressPercent}%` }} />
            </div>
          </div>
          <span className="progress-time">{formatTime(duration)}</span>
        </div>

        <Controls
          isPlaying={isPlaying}
          shuffleState={playback?.shuffle_state}
          repeatState={playback?.repeat_state}
          volume={playback?.device?.volume_percent ?? 50}
          onPlaybackChange={onPlaybackChange}
        />
      </div>
    </div>
  );
}

/* ─── Compact control button ──────────────────────────────────── */

function CompactButton({ className = '', onClick, label, children }) {
  return (
    <button
      className={`compact-ctrl ${className}`}
      onMouseDown={stopEvent}
      onClick={(e) => { stopEvent(e); onClick(); }}
      aria-label={label}
      title={label}
    >
      {children}
    </button>
  );
}
