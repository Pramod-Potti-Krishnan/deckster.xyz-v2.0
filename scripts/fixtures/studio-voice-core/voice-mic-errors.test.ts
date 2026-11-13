import { describe, expect, it } from "vitest";
import { describeMicError } from "../../../lib/studio/voice/mic-errors";
describe("microphone help", () => {
  it("explains a denied microphone in the Mac app with the macOS steps", () => {
    const h = describeMicError("NotAllowedError", { macApp: true });
    expect(h.kind).toBe("denied");
    expect(h.title).toMatch(/Deckster can't use your microphone/);
    expect(h.steps.join(" ")).toMatch(/System Settings/);
    expect(h.steps.join(" ")).toMatch(/Privacy & Security/);
    expect(h.steps.join(" ")).toMatch(/Microphone/);
  });

  it("explains a blocked microphone in a browser (with the Mac steps only on a Mac)", () => {
    const mac = describeMicError("NotAllowedError", { mac: true });
    expect(mac.steps.join(" ")).toMatch(/address bar/);
    expect(mac.steps.join(" ")).toMatch(/System Settings/);
    const other = describeMicError("NotAllowedError", {});
    expect(other.steps.join(" ")).not.toMatch(/System Settings/);
  });

  it("covers a missing, busy, insecure and unsupported microphone and anything else", () => {
    expect(describeMicError("NotFoundError").kind).toBe("not_found");
    expect(describeMicError("NotReadableError").kind).toBe("in_use");
    expect(describeMicError("InsecureContext").kind).toBe("insecure");
    expect(describeMicError("Unsupported").kind).toBe("unsupported");
    expect(describeMicError(undefined).kind).toBe("unknown");
    expect(describeMicError("WeirdError").steps.length).toBeGreaterThan(0);
  });
});

