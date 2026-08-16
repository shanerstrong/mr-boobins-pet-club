import { describe, expect, it } from "vitest";
import animationManifest from "../assets/3d/jack/v2/animations/animation-event-manifest-v2.json";
import {
  TRAINING_CELEBRATIONS,
  TRAINING_COMMANDS,
  TRAINING_COMMAND_DURATION_MS,
  TRAINING_CELEBRATION_DURATION_MS,
  TRAINING_EAT_DURATION_MS,
  TRAINING_TREAT_CONTACT_MS,
  createTrainingState,
  getTrainingAnnouncement,
  getReducedCelebrationPose,
  getTrainingMotionDuration,
  transitionTraining,
  type TrainingCommand,
  type TrainingState,
} from "./training-policy";

function reachAwaitingTreat(command: TrainingCommand): TrainingState {
  const opened = transitionTraining(createTrainingState(), { type: "OPEN" });
  const performing = transitionTraining(opened, {
    type: "SELECT_COMMAND",
    command,
  });
  return transitionTraining(performing, {
    type: "COMMAND_COMPLETE",
    session: performing.session,
    command,
  });
}

describe("Training Mode state machine", () => {
  it("matches the approved V2 animation completion and contact contract", () => {
    const manifest = animationManifest as {
      clips: Record<
        string,
        { durationMs: number; markers: { name: string; timeMs: number }[] }
      >;
    };
    expect(TRAINING_COMMAND_DURATION_MS).toEqual({
      sit: manifest.clips.training_sit.durationMs,
      paw: manifest.clips.training_paw.durationMs,
      up: manifest.clips.training_up.durationMs,
    });
    expect(TRAINING_CELEBRATION_DURATION_MS).toEqual({
      "happy-hop": manifest.clips.celebration_happy_hop.durationMs,
      "spin-wag": manifest.clips.celebration_spin_wag.durationMs,
      "goofy-shimmy": manifest.clips.celebration_goofy_shimmy.durationMs,
    });
    expect(TRAINING_EAT_DURATION_MS).toBe(
      manifest.clips.training_treat_eat.durationMs,
    );
    expect(TRAINING_TREAT_CONTACT_MS).toBe(
      manifest.clips.training_treat_receive.markers.find(
        (marker) => marker.name === "treat_contact",
      )?.timeMs,
    );
  });

  it("removes travel duration but preserves distinct still celebration poses", () => {
    expect(getTrainingMotionDuration(true, 2200)).toBe(0);
    expect(getTrainingMotionDuration(false, 2200)).toBe(2200);
    expect(TRAINING_CELEBRATIONS.map(getReducedCelebrationPose)).toEqual([
      0.28,
      0.25,
      0.25,
    ]);
  });

  it.each(TRAINING_COMMANDS)(
    "completes the %s command, one treat, and one celebration",
    (command) => {
      const awaiting = reachAwaitingTreat(command);
      expect(awaiting.phase).toBe("awaiting-treat");
      expect(getTrainingAnnouncement(awaiting)).toContain("Give him one treat");

      const flying = transitionTraining(awaiting, { type: "GIVE_TREAT" });
      const eating = transitionTraining(flying, {
        type: "TREAT_CONTACT",
        session: flying.session,
      });
      const celebrating = transitionTraining(eating, {
        type: "EAT_COMPLETE",
        session: eating.session,
        celebration: "happy-hop",
      });
      const result = transitionTraining(celebrating, {
        type: "CELEBRATION_COMPLETE",
        session: celebrating.session,
      });

      expect(result).toMatchObject({
        phase: "result",
        command,
        celebration: "happy-hop",
        treatClaimed: true,
      });
      expect(getTrainingAnnouncement(result)).toContain("Show it again");
    },
  );

  it("rejects overlapping commands and duplicate treats", () => {
    const awaiting = reachAwaitingTreat("paw");
    expect(
      transitionTraining(awaiting, { type: "SELECT_COMMAND", command: "up" }),
    ).toBe(awaiting);
    const flying = transitionTraining(awaiting, { type: "GIVE_TREAT" });
    expect(transitionTraining(flying, { type: "GIVE_TREAT" })).toBe(flying);
  });

  it("ignores stale command, contact, eating, and celebration events", () => {
    const awaiting = reachAwaitingTreat("sit");
    const flying = transitionTraining(awaiting, { type: "GIVE_TREAT" });
    expect(
      transitionTraining(flying, {
        type: "TREAT_CONTACT",
        session: flying.session - 1,
      }),
    ).toBe(flying);
    const eating = transitionTraining(flying, {
      type: "TREAT_CONTACT",
      session: flying.session,
    });
    expect(
      transitionTraining(eating, {
        type: "EAT_COMPLETE",
        session: eating.session - 1,
        celebration: "spin-wag",
      }),
    ).toBe(eating);
  });

  it.each(TRAINING_CELEBRATIONS)(
    "replays %s without creating another treat",
    (celebration) => {
      const awaiting = reachAwaitingTreat("up");
      const flying = transitionTraining(awaiting, { type: "GIVE_TREAT" });
      const eating = transitionTraining(flying, {
        type: "TREAT_CONTACT",
        session: flying.session,
      });
      const celebrating = transitionTraining(eating, {
        type: "EAT_COMPLETE",
        session: eating.session,
        celebration,
      });
      const result = transitionTraining(celebrating, {
        type: "CELEBRATION_COMPLETE",
        session: celebrating.session,
      });
      const replay = transitionTraining(result, { type: "SHOW_AGAIN" });
      expect(replay).toMatchObject({
        phase: "celebrating",
        celebration,
        treatClaimed: true,
      });
      expect(transitionTraining(replay, { type: "GIVE_TREAT" })).toBe(replay);
    },
  );

  it("invalidates late callbacks when training closes", () => {
    const awaiting = reachAwaitingTreat("sit");
    const closed = transitionTraining(awaiting, { type: "CLOSE" });
    expect(closed.phase).toBe("closed");
    expect(closed.session).toBeGreaterThan(awaiting.session);
    expect(
      transitionTraining(closed, {
        type: "COMMAND_COMPLETE",
        session: awaiting.session,
        command: "sit",
      }),
    ).toBe(closed);
  });
});
