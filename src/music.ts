/** Music playback detection — parses Now Playing from page titles on music platforms. */

const MUSIC_PLATFORMS: Record<string, string> = {
  'open.spotify.com': 'spotify_web',
  'music.apple.com': 'apple_music_web',
  'music.youtube.com': 'youtube_music',
  'soundcloud.com': 'soundcloud',
  'listen.tidal.com': 'tidal',
};

interface ParsedTrack {
  track: string;
  artist: string;
}

function parseMusicTitle(title: string, player: string): ParsedTrack | null {
  if (!title) return null;

  let cleaned = title;
  let track = '';
  let artist = '';

  switch (player) {
    case 'spotify_web':
      cleaned = title.replace(/\s*[|·]\s*Spotify.*$/, '');
      break;
    case 'youtube_music':
      cleaned = title.replace(/\s*-\s*YouTube Music$/, '');
      break;
    case 'soundcloud': {
      cleaned = title.replace(/\s*[|·]\s*SoundCloud.*$/, '');
      const scParts = cleaned.split(' - ');
      if (scParts.length >= 2) return { track: scParts.slice(1).join(' - '), artist: scParts[0] };
      return { track: cleaned, artist: 'unknown' };
    }
    case 'tidal':
      cleaned = title.replace(/\s*-\s*TIDAL$/, '');
      break;
    default:
      break;
  }

  const parts = cleaned.split(' - ');
  if (parts.length >= 2) {
    track = parts[0].trim();
    artist = parts.slice(1).join(' - ').trim();
  } else {
    return { track: cleaned.trim(), artist: 'unknown' };
  }

  return track ? { track, artist } : null;
}

function send(eventType: string, data: Record<string, unknown>): void {
  chrome.runtime.sendMessage({ type: 'content_event', event_type: eventType, data }).catch(() => {});
}

let lastMusicTrack = '';
let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
let titleObserver: MutationObserver | null = null;

function emitTrack(parsed: ParsedTrack, player: string, eventKind: string): void {
  send('music_playing', {
    track: parsed.track,
    artist: parsed.artist,
    source: 'extension',
    player,
    event_kind: eventKind,
  });
}

function checkTitle(player: string): void {
  const parsed = parseMusicTitle(document.title, player);
  if (!parsed) return;

  const key = `${parsed.artist}::${parsed.track}`;
  if (key !== lastMusicTrack) {
    lastMusicTrack = key;
    emitTrack(parsed, player, 'track_change');
  }
}

export function detectMusic(): void {
  const player = MUSIC_PLATFORMS[location.hostname];
  if (!player) return;

  checkTitle(player);

  // Observe title changes for track switches
  const titleEl = document.querySelector('title');
  if (titleEl && !titleObserver) {
    titleObserver = new MutationObserver(() => checkTitle(player));
    titleObserver.observe(titleEl, { childList: true, characterData: true, subtree: true });
  }

  // 60s heartbeat while on music tab
  if (!heartbeatTimer) {
    heartbeatTimer = setInterval(() => {
      if (!lastMusicTrack) return;
      const parsed = parseMusicTitle(document.title, player);
      if (parsed) emitTrack(parsed, player, 'heartbeat');
    }, 60_000);
  }
}
