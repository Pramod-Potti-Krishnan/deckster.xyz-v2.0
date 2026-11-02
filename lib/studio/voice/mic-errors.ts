/** Plain-language help for microphone problems (pure: error name in, words out). */

export interface MicHelp {
  kind: "denied" | "not_found" | "in_use" | "insecure" | "unsupported" | "unknown";
  title: string;
  /** Short steps, in order. */
  steps: string[];
}

export interface MicHelpContext {
  /** The host application is a native Mac wrapper. */
  macApp?: boolean;
  /** navigator.platform / userAgent says macOS. */
  mac?: boolean;
}

const MAC_STEPS = [
  "Open System Settings, then Privacy & Security, then Microphone.",
];

/** Map a `getUserMedia` rejection (DOMException name) to help the founder can follow. */
export function describeMicError(name: string | null | undefined, ctx: MicHelpContext = {}): MicHelp {
  const n = name ?? "";
  const mac = ctx.macApp || ctx.mac;
  if (n === "NotAllowedError" || n === "PermissionDeniedError" || n === "SecurityError") {
    if (ctx.macApp) {
      return {
        kind: "denied",
        title: "Deckster can't use your microphone yet",
        steps: [
          ...MAC_STEPS,
          "Turn on the switch next to Deckster. If it isn't in the list, quit and reopen Deckster, then start the call again to be asked.",
          "Come back and press Try again.",
        ],
      };
    }
    return {
      kind: "denied",
      title: "Your browser blocked the microphone",
      steps: [
        "Click the lock or tune icon at the left of the address bar, set Microphone to Allow, then reload the page.",
        ...(mac ? ["If it still doesn't work, open System Settings, then Privacy & Security, then Microphone, and turn on your browser."] : []),
        "Then press Try again.",
      ],
    };
  }
  if (n === "NotFoundError" || n === "DevicesNotFoundError" || n === "OverconstrainedError") {
    return {
      kind: "not_found",
      title: "No microphone found",
      steps: ["Plug in or turn on a microphone (a headset works well).", ...(mac ? ["Check System Settings, then Sound, then Input, shows one."] : []), "Then press Try again."],
    };
  }
  if (n === "NotReadableError" || n === "TrackStartError" || n === "AbortError") {
    return {
      kind: "in_use",
      title: "The microphone is busy",
      steps: ["Close other apps or tabs that are using the microphone (a meeting, a recorder).", "Then press Try again."],
    };
  }
  if (n === "InsecureContext") {
    return {
      kind: "insecure",
      title: "Calls need a secure address",
      steps: ["Open Deckster over https (or at localhost). Browsers only allow microphones on secure pages."],
    };
  }
  if (n === "Unsupported") {
    return {
      kind: "unsupported",
      title: "This browser can't record audio",
      steps: ["Use the Deckster Mac app, or a current Chrome, Edge, Safari or Firefox."],
    };
  }
  return {
    kind: "unknown",
    title: "Couldn't start the microphone",
    steps: ["Check that a microphone is connected and allowed for this page.", "Then press Try again."],
  };
}
