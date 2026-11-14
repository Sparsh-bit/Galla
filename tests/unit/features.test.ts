import { describe, expect, it } from "vitest";
import { ALL_FEATURES, effectiveFeatures, permissionOn, PLAN_PRESETS } from "@/lib/features";

describe("plan features", () => {
  it("keeps everything for businesses made before plans existed", () => {
    expect(effectiveFeatures(undefined)).toEqual(ALL_FEATURES);
    expect(effectiveFeatures(null)).toEqual(ALL_FEATURES);
  });
  it("drops unknown names and honours an empty list", () => {
    expect(effectiveFeatures([])).toEqual([]);
    expect(effectiveFeatures(["offline", "bogus"])).toEqual(["offline"]);
  });
  it("hides purchasing, import and audit permissions when switched off", () => {
    const dukaan = PLAN_PRESETS.Dukaan.features;
    expect(permissionOn(dukaan, "pos:sell")).toBe(true);
    expect(permissionOn(dukaan, "purchases:write")).toBe(false);
    expect(permissionOn(dukaan, "import:run")).toBe(false);
    expect(permissionOn(PLAN_PRESETS.Business.features, "audit:read")).toBe(true);
  });
});
