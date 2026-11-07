import { describe, expect, it } from "vitest";
import { SentenceChunker, cleanForSpeech, splitSentences } from "../../../lib/studio/voice/sentences";

/** Feed `text` to the chunker `size` characters at a time, like a token stream; returns everything it spoke, in order. */
function stream(text: string, size = 3, opts?: ConstructorParameters<typeof SentenceChunker>[0]): string[] {
  const c = new SentenceChunker(opts);
  const out: string[] = [];
  for (let i = 0; i < text.length; i += size) out.push(...c.push(text.slice(i, i + size)));
  out.push(...c.flush());
  return out;
}

describe("sentence chunker: basics", () => {
  it("\"one sec.\" is a sentence, spoken at once (it is a second, not a section)", () => {
    const c = new SentenceChunker();
    expect(c.push("Sure, one sec. ")).toEqual(["Sure, one sec."]);
    expect(c.push("Hmm, give me a sec. ")).toEqual(["Hmm, give me a sec."]);
  });

  it("splits plain sentences", () => {
    expect(splitSentences("Good morning. Two things need you today. Want the short version?")).toEqual([
      "Good morning.",
      "Two things need you today.",
      "Want the short version?",
    ]);
  });

  it("emits the first sentence as soon as the next word starts, before the reply is over", () => {
    const c = new SentenceChunker();
    expect(c.push("You have two approvals waiting")).toEqual([]);
    expect(c.push(".")).toEqual([]); // the next character decides: "3" "." "5" is a number
    expect(c.push(" ")).toEqual(["You have two approvals waiting."]);
    expect(c.pending).toBe(false);
    expect(c.push("The budget")).toEqual([]);
    expect(c.pending).toBe(true);
    expect(c.flush()).toEqual(["The budget"]);
  });

  it("gives the same sentences however the stream is cut", () => {
    const text = "Backend is blocked on the API contract. Dr. Rao reviewed it at 3.5 hours, i.e. late. Is that fine? Yes! Shipping Friday.";
    const whole = splitSentences(text);
    for (const size of [1, 2, 3, 5, 7, 11, 50]) expect(stream(text, size)).toEqual(whole);
  });

  it("ends at question and exclamation marks, with closing quotes", () => {
    expect(splitSentences('She said "ship it!" Then we shipped. Done?')).toEqual(['She said "ship it!"', "Then we shipped.", "Done?"]);
  });

  it("splits at line breaks (paragraphs, list items) and drops the markers", () => {
    const out = splitSentences("Three things:\n- Approve the deploy\n- Reply to Maya\n1. Check the budget\n");
    expect(out).toEqual(["Three things:", "Approve the deploy", "Reply to Maya", "Check the budget"]);
  });
});

describe("sentence chunker: abbreviations and numbers", () => {
  it("does not split after titles and initials", () => {
    expect(splitSentences("Dr. Smith and Mrs. Jones met J. Appleseed at St. Mary's hospital. They talked.")).toEqual([
      "Dr. Smith and Mrs. Jones met J. Appleseed at St. Mary's hospital.",
      "They talked.",
    ]);
  });

  it("does not split inside e.g. / i.e. / vs.", () => {
    expect(splitSentences("Use a cheap model, e.g. Haiku, for triage vs. Opus for planning. That saves money.")).toEqual([
      "Use a cheap model, e.g. Haiku, for triage vs. Opus for planning.",
      "That saves money.",
    ]);
  });

  it("does not split decimals, versions, money, domains or file names", () => {
    const text = "Spend is $3.50 so far, version 2.1 is live at deckster.ai and notes.md is updated. Next one.";
    expect(splitSentences(text)).toEqual(["Spend is $3.50 so far, version 2.1 is live at deckster.ai and notes.md is updated.", "Next one."]);
    expect(stream(text, 1)).toEqual(splitSentences(text));
  });

  it("treats a number label as part of the sentence only when a number follows", () => {
    expect(splitSentences("See Fig. 2 for the trend. Ticket No. 42 is closed.")).toEqual(["See Fig. 2 for the trend.", "Ticket No. 42 is closed."]);
    expect(splitSentences("No. I don't think we should. Let's wait.")).toEqual(["No. I don't think we should.", "Let's wait."]);
  });

  it("splits after etc. / a.m. / Inc. only when a capital follows", () => {
    expect(splitSentences("Tools, docs, etc. Then deploy. We meet at 9 a.m. tomorrow at Acme Inc. The room is booked.")).toEqual([
      "Tools, docs, etc.",
      "Then deploy.",
      "We meet at 9 a.m. tomorrow at Acme Inc.",
      "The room is booked.",
    ]);
    expect(splitSentences("Tools, docs, etc. and more tools. Done here.")).toEqual(["Tools, docs, etc. and more tools.", "Done here."]);
  });

  it("does not split numbered list markers or a lone number", () => {
    expect(splitSentences("1. Approve the deploy\n2. Reply to Maya about the launch\n")).toEqual(["Approve the deploy", "Reply to Maya about the launch"]);
    expect(splitSentences("We shipped version 2. Next is 3.")).toEqual(["We shipped version 2.", "Next is 3."]);
  });

  it("only ends at an ellipsis when a capital follows", () => {
    expect(splitSentences("Well... maybe we should wait. Okay... Let's go.")).toEqual(["Well... maybe we should wait.", "Okay... Let's go."]);
  });
});

describe("sentence chunker: short sentences and run-ons", () => {
  it("joins very short sentences to the next so the voice does not stutter", () => {
    expect(splitSentences("Sure. I'll check the budget now.")).toEqual(["Sure. I'll check the budget now."]);
    expect(splitSentences("Sure. Okay. Yes. I'll check the budget now.")).toEqual(["Sure. Okay. Yes.", "I'll check the budget now."]);
  });

  it("flush() releases a held short sentence (the Director went off to use a tool)", () => {
    const c = new SentenceChunker();
    expect(c.push("Sure. ")).toEqual([]);
    expect(c.pending).toBe(true);
    expect(c.flush()).toEqual(["Sure."]);
    expect(c.pending).toBe(false);
  });

  it("cuts a long run-on at a clause mark, then at a space", () => {
    const clause = "we have the draft ready and the numbers checked, and the team has signed off on every section of it, so the only open item is the deploy window, which depends on the approval, and that is still waiting on you";
    const out = splitSentences(clause, { maxChars: 100 });
    expect(out.length).toBeGreaterThan(1);
    for (const piece of out) expect(piece.length).toBeLessThanOrEqual(100);
    expect(out.join(" ").replace(/\s+/g, " ")).toBe(clause);
    expect(out[0]!.endsWith(",")).toBe(true);

    const noMarks = "word ".repeat(120).trim();
    const pieces = splitSentences(noMarks, { maxChars: 80 });
    for (const p of pieces) expect(p.length).toBeLessThanOrEqual(80);
    expect(pieces.join(" ")).toBe(noMarks);
  });

  it("hard-cuts a single enormous token", () => {
    const blob = "x".repeat(500);
    const pieces = splitSentences(blob, { maxChars: 100 });
    expect(pieces.every((p) => p.length <= 100)).toBe(true);
    expect(pieces.join("")).toBe(blob);
  });

  it("a run-on is cut while it streams, before the reply ends", () => {
    const c = new SentenceChunker({ maxChars: 80 });
    const got: string[] = [];
    for (const w of ("alpha beta gamma delta epsilon zeta eta theta iota kappa lambda mu nu xi omicron pi rho sigma tau upsilon phi chi psi omega ").split(" ")) {
      got.push(...c.push(w + " "));
    }
    expect(got.length).toBeGreaterThan(0);
  });
});

describe("sentence chunker: text for the voice", () => {
  it("removes markdown, links, emoji and code", () => {
    expect(cleanForSpeech("**Heads up:** see [the report](https://deckster.ai/app/reports/1) or https://example.com/x 🚀")).toBe("Heads up: see the report or a link");
    expect(cleanForSpeech("## Today")).toBe("Today");
    expect(cleanForSpeech("Run `npm test` first")).toBe("Run npm test first");
    expect(cleanForSpeech("snake_case_name stays")).toBe("snake_case_name stays");
    expect(cleanForSpeech("_gently_ emphasised")).toBe("gently emphasised");
    expect(cleanForSpeech("| a | b |")).toBe(", a, b,");
    expect(cleanForSpeech("---")).toBe("");
    expect(cleanForSpeech("🚀")).toBe("");
  });

  it("skips fenced code blocks entirely", () => {
    const text = "Here is the plan.\n```sh\nnpm run build\nrm -rf nothing\n```\nThat is all.";
    expect(splitSentences(text)).toEqual(["Here is the plan.", "That is all."]);
    expect(stream(text, 2)).toEqual(["Here is the plan.", "That is all."]);
  });

  it("never emits empty or punctuation-only chunks", () => {
    expect(splitSentences("...\n!!!\n---\n\n")).toEqual([]);
  });

  it("reset() forgets held text and an open code fence", () => {
    const c = new SentenceChunker();
    c.push("```\nunfinished");
    c.reset();
    expect(c.push("Fresh start here. ")).toEqual(["Fresh start here."]);
  });
});
