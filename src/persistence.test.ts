import { describe, expect, it } from "vitest";
import { loadPet, savePet, type StorageLike } from "./persistence";
import { createNewPet } from "./simulation";
const memory = (): StorageLike & { values: Map<string, string> } => {
  const values = new Map<string, string>();
  return {
    values,
    async getItem(key) {
      return values.get(key) ?? null;
    },
    async setItem(key, value) {
      values.set(key, value);
    },
  };
};
describe("persistence", () => {
  it("migrates V1 and V2 saves and round-trips V3", async () => {
    const store = memory();
    const v3 = createNewPet(2);
    const v1 = { ...v3, version: 1 };
    delete (v1 as Partial<typeof v1>).ageVirtualMinutes;
    delete (v1 as Partial<typeof v1>).introCompleted;
    delete (v1 as Partial<typeof v1>).sleepUntilVirtualMinutes;
    await store.setItem("mr-boobins-pet-club/v0/pet", JSON.stringify(v1));
    await expect(loadPet(store)).resolves.toMatchObject({
      kind: "loaded",
      pet: { version: 3, ageVirtualMinutes: 0, introCompleted: false },
    });

    const { introCompleted, sleepUntilVirtualMinutes, ...v2Base } = v3;
    const v2 = { ...v2Base, version: 2, isSleeping: false };
    await store.setItem("mr-boobins-pet-club/v0/pet", JSON.stringify(v2));
    await expect(loadPet(store)).resolves.toMatchObject({
      kind: "loaded",
      pet: { version: 3, introCompleted: false, sleepUntilVirtualMinutes: null },
    });

    const completedIntro = { ...v3, introCompleted: true };
    await savePet(completedIntro, store);
    await expect(loadPet(store)).resolves.toEqual({
      kind: "loaded",
      pet: completedIntro,
    });
  });
  it("retains malformed data and reports unavailable/save failures", async () => {
    const store = memory();
    store.values.set("mr-boobins-pet-club/v0/pet", "{bad");
    await expect(loadPet(store)).resolves.toEqual({ kind: "invalid" });
    expect(store.values.get("mr-boobins-pet-club/v0/pet")).toBe("{bad");

    const schemaInvalid = JSON.stringify({ ...createNewPet(4), extra: true });
    store.values.set("mr-boobins-pet-club/v0/pet", schemaInvalid);
    await expect(loadPet(store)).resolves.toEqual({ kind: "invalid" });
    expect(store.values.get("mr-boobins-pet-club/v0/pet")).toBe(schemaInvalid);

    const bad: StorageLike = {
      async getItem() {
        throw new Error("no storage");
      },
      async setItem() {
        throw new Error("no storage");
      },
    };
    await expect(loadPet(bad)).resolves.toEqual({ kind: "unavailable" });
    await expect(savePet(createNewPet(), bad)).rejects.toThrow("no storage");
  });
});
