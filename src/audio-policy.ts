export function canPlayRememberedAudio(
  enabled: boolean,
  gestureGranted: boolean,
  isDead: boolean,
) {
  return enabled && gestureGranted && !isDead;
}

export type PlaybackPlayer = {
  muted: boolean;
  loop?: boolean;
  pause: () => void;
  play: () => void;
  seekTo: (seconds: number) => Promise<void>;
};

export type MusicTrack = "idle" | "play" | "sleep" | null;

export function selectMusicTrack({
  allowed,
  sleeping,
  playing,
}: {
  allowed: boolean;
  sleeping: boolean;
  playing: boolean;
}): MusicTrack {
  if (!allowed) return null;
  if (sleeping) return "sleep";
  if (playing) return "play";
  return "idle";
}

export function syncSfxPlayers(players: PlaybackPlayer[], enabled: boolean) {
  for (const player of players) {
    player.muted = !enabled;
    if (!enabled) player.pause();
  }
}

export function syncAdaptiveMusic(
  players: Record<Exclude<MusicTrack, null>, PlaybackPlayer>,
  nextTrack: MusicTrack,
  previousTrack: MusicTrack,
) {
  for (const [track, player] of Object.entries(players) as [
    Exclude<MusicTrack, null>,
    PlaybackPlayer,
  ][]) {
    const active = track === nextTrack;
    player.loop = true;
    player.muted = !active;
    if (!active) player.pause();
  }

  if (nextTrack && nextTrack !== previousTrack) {
    const player = players[nextTrack];
    void player
      .seekTo(0)
      .then(() => player.play())
      .catch(() => player.play());
  }
}
