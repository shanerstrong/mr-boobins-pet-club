import { describe, expect, it, vi } from "vitest";
import {
  canPlayRememberedAudio,
  selectMusicTrack,
  syncAdaptiveMusic,
  syncSfxPlayers,
  type PlaybackPlayer,
} from "./audio-policy";

function playerSpy(): PlaybackPlayer {
  return {
    muted: false,
    loop: false,
    pause: vi.fn(),
    play: vi.fn(),
    seekTo: vi.fn().mockResolvedValue(undefined),
  };
}

describe("audio gesture policy", () => {
  it("keeps remembered audio silent before Enter or Visit Room", () => {
    expect(canPlayRememberedAudio(true, false, false)).toBe(false);
    expect(canPlayRememberedAudio(false, true, false)).toBe(false);
  });

  it("allows enabled audio only after a gesture and while Jack is alive", () => {
    expect(canPlayRememberedAudio(true, true, false)).toBe(true);
    expect(canPlayRememberedAudio(true, true, true)).toBe(false);
  });

  it("keeps SFX mute changes independent from the music lifecycle", async () => {
    const sfx = playerSpy();
    const music = { idle: playerSpy(), play: playerSpy(), sleep: playerSpy() };
    syncAdaptiveMusic(music, "idle", null);
    await Promise.resolve();
    expect(music.idle.seekTo).toHaveBeenCalledOnce();
    expect(music.idle.play).toHaveBeenCalledOnce();

    syncSfxPlayers([sfx], false);
    expect(sfx.pause).toHaveBeenCalledOnce();
    expect(music.idle.seekTo).toHaveBeenCalledOnce();
    expect(music.idle.play).toHaveBeenCalledOnce();

    syncAdaptiveMusic(music, "idle", "idle");
    expect(music.idle.seekTo).toHaveBeenCalledOnce();
    expect(music.idle.play).toHaveBeenCalledOnce();
  });

  it("selects idle, Play, and Sleep music with stable priority", () => {
    expect(selectMusicTrack({ allowed: false, sleeping: false, playing: false })).toBeNull();
    expect(selectMusicTrack({ allowed: true, sleeping: false, playing: false })).toBe("idle");
    expect(selectMusicTrack({ allowed: true, sleeping: false, playing: true })).toBe("play");
    expect(selectMusicTrack({ allowed: true, sleeping: true, playing: true })).toBe("sleep");
  });

  it("pauses old tracks and starts only a changed adaptive track", async () => {
    const music = { idle: playerSpy(), play: playerSpy(), sleep: playerSpy() };
    syncAdaptiveMusic(music, "play", "idle");
    await Promise.resolve();
    expect(music.idle.pause).toHaveBeenCalledOnce();
    expect(music.sleep.pause).toHaveBeenCalledOnce();
    expect(music.play.seekTo).toHaveBeenCalledOnce();
    expect(music.play.play).toHaveBeenCalledOnce();

    syncAdaptiveMusic(music, "play", "play");
    expect(music.play.seekTo).toHaveBeenCalledOnce();
    expect(music.play.play).toHaveBeenCalledOnce();
  });
});
