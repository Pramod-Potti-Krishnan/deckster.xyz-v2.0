import { describe, expect, it, vi } from "vitest";

describe("Director voice opt in", () => {
  it("enables only the literal true value", async () => {
    for (const [value, enabled] of [[undefined, false], ["", false], ["false", false], ["1", false], ["TRUE", false], ["true", true]] as const) {
      vi.stubEnv("NEXT_PUBLIC_STUDIO_VOICE_CALL", value);
      vi.resetModules();
      expect((await import("../../../lib/studio/voice/flag")).STUDIO_VOICE_CALL_ENABLED).toBe(enabled);
    }
    vi.unstubAllEnvs();
  });
});
