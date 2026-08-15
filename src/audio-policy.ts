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

export function syncSfxPlayers(players: PlaybackPlayer[], enabled: boolean) {
  for (const player of players) {
    player.muted = !enabled;
    if (!enabled) player.pause();
  }
}

export function syncMusicPlayer(
  player: PlaybackPlayer,
  enabled: boolean,
  previouslyEnabled: boolean,
) {
  player.loop = true;
  player.muted = !enabled;
  if (!enabled) {
    player.pause();
    return;
  }
  if (!previouslyEnabled) {
    void player
      .seekTo(0)
      .then(() => player.play())
      .catch(() => player.play());
  }
}
