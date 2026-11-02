import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { stripVoiceCore, VOICE_CORE_SCOPE_PIN } from "../../studio-voice-core-strip.mjs";

describe("voice proof compatibility is exact", () => {
  it("removes only the new dependency and test script", () => {
    const source = readFileSync("package.json", "utf8");
    const result = JSON.parse(stripVoiceCore("package.json", source));
    expect(result.devDependencies.vitest).toBeUndefined();
    expect(result.scripts["test:studio-voice-core"]).toBeUndefined();
    expect(result.dependencies).toEqual(JSON.parse(source).dependencies);
    expect(stripVoiceCore("other.json", source)).toBe(source);
  });
  it("does not hide a changed runner version or an unrelated dependency", () => {
    const source = readFileSync("package.json", "utf8");
    expect(stripVoiceCore("package.json", source.replace('"vitest": "5.0.3"', '"vitest": "99.0.0"'))).toContain('"vitest": "99.0.0"');
    expect(stripVoiceCore("package.json", source + "\nunrelated")).toContain("unrelated");
  });
  it("removes its compatibility pin and preserves every older assertion", () => {
    expect(stripVoiceCore("scripts/test-studio-deck-sync-truth.mjs", "before\n" + VOICE_CORE_SCOPE_PIN + "after\n")).toBe("before\nafter\n");
    expect(stripVoiceCore("scripts/test-studio-deck-sync-truth.mjs", "assert(false)\n")).toBe("assert(false)\n");
  });
});
