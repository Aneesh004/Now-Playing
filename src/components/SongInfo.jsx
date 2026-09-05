import { useRef, useEffect, useState } from 'react';

export default function SongInfo({ track }) {
  const titleRef = useRef(null);
  const [shouldScroll, setShouldScroll] = useState(false);

  const trackName = track?.name ?? 'Unknown Track';
  const artists = track?.artists?.map((a) => a.name).join(', ') ?? 'Unknown Artist';
  const albumName = track?.album?.name ?? '';

  // Check if the title overflows and needs marquee scrolling
  useEffect(() => {
    const el = titleRef.current;
    if (el) {
      setShouldScroll(el.scrollWidth > el.clientWidth);
    }
  }, [trackName]);

  return (
    <div className="song-info">
      <div className="song-title-wrapper">
        <h2
          ref={titleRef}
          className={`song-title ${shouldScroll ? 'song-title-scroll' : ''}`}
        >
          {trackName}
        </h2>
      </div>
      <p className="song-artist">{artists}</p>
      {albumName && <p className="song-album">{albumName}</p>}
    </div>
  );
}
