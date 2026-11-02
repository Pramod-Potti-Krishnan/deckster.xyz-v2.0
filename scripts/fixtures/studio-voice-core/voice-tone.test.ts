import { describe, expect, it } from "vitest";
import { replyGesture, replyTone } from "../../../lib/studio/voice/tone";

describe("reply tone: a cheap read of the words", () => {
  it("good news reads pleased", () => {
    for (const t of [
      "Good news: the launch is approved and the build is green.",
      "Done. The report is ready and everything is on track.",
      "Great, that shipped this morning.",
      "All clear today, nothing needs you.",
    ]) expect(replyTone(t), t).toBe("pleased");
  });

  it("trouble reads concerned: blocked, failed, budget", () => {
    for (const t of [
      "The backend is blocked on the API contract.",
      "The nightly run failed twice, and the retry is stuck.",
      "You're over budget for the month.",
      "Unfortunately I can't reach the Mac right now.",
      "Two tasks are overdue and one is blocked.",
      "The budget is nearly gone.",
    ]) expect(replyTone(t), t).toBe("concerned");
  });

  it("plain facts stay neutral", () => {
    for (const t of ["Two approvals are waiting on you.", "Maya asked about the launch date.", "Opening the team page.", "", "…", "Mm."]) {
      expect(replyTone(t), t).toBe("neutral");
    }
  });

  it("negated trouble is good news, not bad", () => {
    for (const t of ["No blockers today.", "Nothing failed overnight.", "Nothing is blocked.", "The deploy isn't late.", "It's unblocked now."]) {
      expect(replyTone(t), t).toBe("pleased");
    }
  });

  it("mixed news is judged by what outweighs what", () => {
    expect(replyTone("Good news: the build is green. Bad news: it failed review and is blocked.")).toBe("concerned");
    expect(replyTone("It failed once, but it's fixed, shipped and approved now.")).toBe("pleased");
    expect(replyTone("One thing is done and one thing is late.")).toBe("neutral");
    expect(replyTone("One thing is done and one thing is blocked.")).toBe("concerned"); // a blocker outweighs a single win
  });

  it("curly apostrophes and case do not matter", () => {
    expect(replyTone("I couldn’t reach the server.")).toBe("concerned");
    expect(replyTone("BLOCKED on review.")).toBe("concerned");
  });
});

describe("reply gesture: a nod for yes, a shake for no", () => {
  it("nods when the reply opens with agreement", () => {
    for (const t of ["Sure, one sec.", "Yes, it's done.", "On it.", "Got it. Checking now.", "Absolutely.", "Okay, opening the page."]) expect(replyGesture(t), t).toBe("nod");
  });
  it("shakes when it opens with a no", () => {
    for (const t of ["No blockers today.", "Nothing needs you.", "Unfortunately that failed.", "Sorry, I can't do that.", "I couldn't find it.", "Not yet."]) expect(replyGesture(t), t).toBe("shake");
  });
  it("does neither for everything else", () => {
    for (const t of ["Two approvals are waiting.", "Maya wrote back.", "Let me check the team.", "", "Nobody is blocked."]) expect(replyGesture(t), t).toBeNull();
  });
});
