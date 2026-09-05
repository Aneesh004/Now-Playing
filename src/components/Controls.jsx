import { useState, useCallback } from 'react';
import {
  play,
  pause,
  next,
  previous,
  setVolume,
  getCurrentPlayback,
} from '../services/spotifyApi';

/* ─── Icons ───────────────────────────────────────────────────── */

const PreviousIcon = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
    <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z" />
  </svg>
);

const NextIcon = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
    <path d="M6 18l8.5-6L6 6v12zm10-12v12h2V6z" />
  </svg>
);

const PlayIcon = () => (
  <svg viewBox="0 0 24 24" width="28" height="28" fill="currentColor">
    <path d="M8 5v14l11-7z" />
  </svg>
);

const PauseIcon = () => (
  <svg viewBox="0 0 24 24" width="28" height="28" fill="currentColor">
    <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
  </svg>
);

function VolumeIcon({ volume }) {
  if (volume === 0) {
    return (
      <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
        <path d="M16.5 12A4.5 4.5 0 0014 7.97v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51A8.796 8.796 0 0021 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06a8.99 8.99 0 003.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z" />
      </svg>
    );
  }
  if (volume < 50) {
    return (
      <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
        <path d="M18.5 12A4.5 4.5 0 0016 7.97v8.05c1.48-.73 2.5-2.25 2.5-4.02zM5 9v6h4l5 5V4L9 9H5z" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
      <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3A4.5 4.5 0 0014 7.97v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
    </svg>
  );
}

/* ─── Component ───────────────────────────────────────────────── */

export default function Controls({
  isPlaying,
  shuffleState,
  repeatState,
  volume,
  onPlaybackChange,
}) {
  const [localVolume, setLocalVolume] = useState(volume);
  const [isVolumeVisible, setIsVolumeVisible] = useState(false);

  const refreshPlayback = useCallback(async () => {
    setTimeout(async () => {
      try {
        const data = await getCurrentPlayback();
        if (data) onPlaybackChange(data);
      } catch { /* ignore */ }
    }, 300);
  }, [onPlaybackChange]);

  const handlePlayPause = async () => {
    try {
      if (isPlaying) await pause(); else await play();
      await refreshPlayback();
    } catch { /* ignore */ }
  };

  const handleNext = async () => {
    try { await next(); await refreshPlayback(); } catch { /* ignore */ }
  };

  const handlePrevious = async () => {
    try { await previous(); await refreshPlayback(); } catch { /* ignore */ }
  };

  const handleVolumeChange = async (e) => {
    const val = Number(e.target.value);
    setLocalVolume(val);
    try { await setVolume(val); } catch { /* ignore */ }
  };

  // Sync volume from API when it changes externally
  if (volume !== localVolume && !isVolumeVisible) {
    setLocalVolume(volume);
  }

  return (
    <div className="controls">
      <div className="controls-main">
        <button className="ctrl-btn ctrl-btn-secondary" onClick={handlePrevious} aria-label="Previous track" title="Previous">
          <PreviousIcon />
        </button>
        <button className="ctrl-btn ctrl-btn-play" onClick={handlePlayPause} aria-label={isPlaying ? 'Pause' : 'Play'} title={isPlaying ? 'Pause' : 'Play'}>
          {isPlaying ? <PauseIcon /> : <PlayIcon />}
        </button>
        <button className="ctrl-btn ctrl-btn-secondary" onClick={handleNext} aria-label="Next track" title="Next">
          <NextIcon />
        </button>
      </div>

      <div
        className="volume-section"
        onMouseEnter={() => setIsVolumeVisible(true)}
        onMouseLeave={() => setIsVolumeVisible(false)}
      >
        <button className="ctrl-btn ctrl-btn-vol" aria-label="Volume">
          <VolumeIcon volume={localVolume} />
        </button>
        <div className={`volume-slider-wrap ${isVolumeVisible ? 'volume-visible' : ''}`}>
          <input
            type="range"
            className="volume-slider"
            min="0"
            max="100"
            value={localVolume}
            onChange={handleVolumeChange}
            aria-label="Volume"
            style={{ '--volume-pct': `${localVolume}%` }}
          />
        </div>
      </div>
    </div>
  );
}
