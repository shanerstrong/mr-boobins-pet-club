import { describe, expect, it, vi } from "vitest";
import {
  canPlayRememberedAudio,
  syncMusicPlayer,
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
    const music = playerSpy();
    syncMusicPlayer(music, true, false);
    await Promise.resolve();
    expect(music.seekTo).toHaveBeenCalledOnce();
    expect(music.play).toHaveBeenCalledOnce();

    syncSfxPlayers([sfx], false);
    expect(sfx.pause).toHaveBeenCalledOnce();
    expect(music.seekTo).toHaveBeenCalledOnce();
    expect(music.play).toHaveBeenCalledOnce();

    syncMusicPlayer(music, true, true);
    expect(music.seekTo).toHaveBeenCalledOnce();
    expect(music.play).toHaveBeenCalledOnce();
  });
});
