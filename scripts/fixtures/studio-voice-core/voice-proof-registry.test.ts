import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { stripVoiceCore, VOICE_CORE_ENV_BLOCK, VOICE_CORE_SCOPE_PIN, VOICE_CORE_PROOF_EDITS, VOICE_CORE_LOCK_EDITS, VOICE_CORE_KNOWN_SUBJECTS, isVoiceCoreCommitSubject, voiceCoreProofDiffLines } from "../../studio-voice-core-strip.mjs";

describe("voice proof compatibility is exact", () => {
  it("normalizes git subject newlines and recognizes only this port's bounded subjects", () => {
    for (const subject of VOICE_CORE_KNOWN_SUBJECTS) expect(isVoiceCoreCommitSubject(subject + "\n")).toBe(true);
    expect(isVoiceCoreCommitSubject("Voice core: later proof fixes\n")).toBe(true);
    expect(isVoiceCoreCommitSubject("Chat element edit: unrelated\n")).toBe(false);
    expect(isVoiceCoreCommitSubject("Document an unrelated change\n")).toBe(false);
  });
  it("reverses only exact lockfile hunks and preserves unknown changes", () => {
    for (const [has, was] of VOICE_CORE_LOCK_EDITS) expect(stripVoiceCore("pnpm-lock.yaml", "prefix\n" + has + "foreign\n")).toBe("prefix\n" + was + "foreign\n");
    const changed = VOICE_CORE_LOCK_EDITS[0][0].replace("5.0.3", "99.0.0");
    expect(changed).not.toBe(VOICE_CORE_LOCK_EDITS[0][0]);
    expect(stripVoiceCore("pnpm-lock.yaml", changed)).toContain("99.0.0");
  });
  it("registers after all earlier changes so their environment proofs can remove this later flag", async () => {
    const registry = await import("../../studio-later-changes.mjs");
    const prior = await import("../../studio-stage-open-gate-strip.mjs");
    const envAt = registry.LATER_ENV_BLOCKS.indexOf(prior.STAGE_OPEN_GATE_ENV_BLOCK);
    const stripAt = registry.LATER_STRIPS.indexOf(prior.stripStageOpenGate);
    expect(envAt).toBeGreaterThanOrEqual(0);
    expect(stripAt).toBeGreaterThanOrEqual(0);
    expect(registry.LATER_ENV_BLOCKS.indexOf(VOICE_CORE_ENV_BLOCK)).toBeGreaterThan(envAt);
    expect(registry.LATER_STRIPS.indexOf(stripVoiceCore)).toBeGreaterThan(stripAt);
  });
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
    const rel = "scripts/test-studio-model-catalog.mjs";
    const [has, was] = VOICE_CORE_PROOF_EDITS[rel].find(([has, was]) => was && has.includes("const read"))!;
    expect(voiceCoreProofDiffLines(rel, ["-" + was.slice(0, -1), "+" + has.slice(0, -1), "+assert(false)", "-foreign"])).toEqual(["+assert(false)", "-foreign"]);
    expect(voiceCoreProofDiffLines(rel, ["+unknown", "-unknown"])).toEqual(["+unknown", "-unknown"]);
    for (const [file, edits] of Object.entries(VOICE_CORE_PROOF_EDITS)) {
      for (const [has, was] of edits) expect(stripVoiceCore(file, "before\n" + has + "assert(false)\n")).toBe("before\n" + was + "assert(false)\n");
    }
  });
});
