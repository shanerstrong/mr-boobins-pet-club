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
  it("migrates V1 saves and round-trips V2", async () => {
    const store = memory();
    const v2 = createNewPet(2);
    const v1 = { ...v2, version: 1 };
    delete (v1 as Partial<typeof v1>).ageVirtualMinutes;
    delete (v1 as Partial<typeof v1>).isSleeping;
    await store.setItem("mr-boobins-pet-club/v0/pet", JSON.stringify(v1));
    await expect(loadPet(store)).resolves.toMatchObject({
      kind: "loaded",
      pet: { version: 2, ageVirtualMinutes: 0, isSleeping: false },
    });
    await savePet(v2, store);
    await expect(loadPet(store)).resolves.toEqual({ kind: "loaded", pet: v2 });
  });
  it("retains malformed data and reports unavailable/save failures", async () => {
    const store = memory();
    store.values.set("mr-boobins-pet-club/v0/pet", "{bad");
    await expect(loadPet(store)).resolves.toEqual({ kind: "invalid" });
    expect(store.values.get("mr-boobins-pet-club/v0/pet")).toBe("{bad");
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
