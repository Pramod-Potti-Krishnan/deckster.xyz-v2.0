/**
 * PASS2 #8 (NEXT_PUBLIC_STUDIO_SESSION_HYGIENE): the CSS of the builder skeleton, the session problem card and the 404 page.
 *
 * It is a string rendered in an inline <style> by the views themselves, NOT a .css import: a stylesheet imported anywhere in
 * a route's module graph is linked from that route's document, flag on or off, so with the flag off the Builder and the 404
 * page would gain a stylesheet and stop being byte-identical to uat. As a string it exists only in the pages that render a
 * view, and the views are only rendered with the flag on.
 *
 * Every rule is scoped to a data-studio-* attribute that only these views render, so nothing here can touch the Builder,
 * the account pages or the marketing site. Colours are the Studio shell tokens (--ss-*) with their values as fallbacks.
 */
export const STUDIO_SESSION_HYGIENE_CSS = `[data-studio-skeleton="true"],
[data-studio-session-problem],
[data-studio-not-found="true"] {
  --sk-frame: var(--ss-frame, #e8f0ed);
  --sk-panel: var(--ss-panel, #ffffff);
  --sk-surface: var(--ss-surface, #f5f7f6);
  --sk-line: var(--ss-line, #dde5e2);
  --sk-text: var(--ss-text, #243438);
  --sk-muted: var(--ss-muted, #566965);
  --sk-accent: var(--ss-accent, #6a4fc0);
  --sk-action: var(--ss-action, #223a3f);
  --sk-on-action: var(--ss-on-action, #ffffff);
  --sk-soft: var(--ss-soft, #edf2f0);
  --sk-base: color-mix(in srgb, var(--sk-line) 82%, var(--sk-panel));
  --sk-high: color-mix(in srgb, var(--sk-line) 34%, var(--sk-panel));
  box-sizing: border-box;
  display: flex;
  width: 100%;
  background: var(--sk-frame);
  color: var(--sk-text);
}
[data-studio-skeleton="true"],
[data-studio-session-problem] { height: 100dvh; overflow: hidden; }
[data-studio-not-found="true"] { min-height: 100dvh; }

/* ---------- skeleton ---------- */
.studio-skel-block {
  display: block;
  box-sizing: border-box;
  height: 12px;
  border-radius: 6px;
  background: linear-gradient(90deg, var(--sk-base) 0%, var(--sk-high) 50%, var(--sk-base) 100%);
  background-size: 220% 100%;
  animation: studio-skel-shimmer 1.6s ease-in-out infinite;
}
@keyframes studio-skel-shimmer { from { background-position: 120% 0; } to { background-position: -120% 0; } }

/* The rail and header sit on the frame colour, so their placeholders need a little more contrast than the ones on panels. */
[data-studio-skel-rail="true"] .studio-skel-block,
[data-studio-skel-header="true"] .studio-skel-block {
  --sk-base: color-mix(in srgb, var(--sk-line) 80%, var(--sk-muted));
  --sk-high: color-mix(in srgb, var(--sk-line) 90%, var(--sk-muted));
}
[data-studio-skel-rail="true"] {
  flex: 0 0 var(--ss-rail-width, 56px);
  display: flex; flex-direction: column; align-items: center; gap: 16px;
  padding: 8px 0; height: 100%; box-sizing: border-box;
}
[data-studio-skel-brand="true"] {
  display: flex; align-items: center; justify-content: center;
  width: 32px; height: 32px; border-radius: 9px; color: #ffffff; background: var(--sk-accent);
  box-shadow: 0 3px 10px rgb(106 79 192 / 18%);
}
[data-studio-skel-nav="true"] { display: flex; flex-direction: column; align-items: center; gap: 8px; }
[data-studio-skel-nav-item] { display: flex; align-items: center; justify-content: center; width: 40px; height: 40px; border-radius: 9px; }
[data-studio-skel-nav-item="active"] { background: var(--sk-panel); box-shadow: 0 1px 4px rgb(36 52 56 / 8%); }
[data-studio-skel-nav-item] > i { width: 18px; height: 18px; border-radius: 5px; }
[data-studio-skel-avatar="true"] { margin-top: auto; width: 30px; height: 30px; border-radius: 50%; }

[data-studio-skel-column="true"] { flex: 1; min-width: 0; display: flex; flex-direction: column; }
[data-studio-skel-header="true"] { flex: 0 0 48px; display: flex; align-items: center; gap: 10px; padding: 0 10px; }
[data-studio-skel-icon="true"] { width: 18px; height: 18px; border-radius: 5px; }
[data-studio-skel-title="true"] { width: clamp(120px, 14vw, 200px); height: 12px; }
[data-studio-skel-actions="true"] { margin-left: auto; display: flex; align-items: center; gap: 8px; }
[data-studio-skel-actions="true"] > i { height: 32px; border-radius: 9px; background-color: var(--sk-panel); border: 1px solid var(--sk-line); animation: none; background-image: none; }
[data-studio-skel-actions="true"] > i[data-w="108"] { width: 108px; }
[data-studio-skel-actions="true"] > i[data-w="92"] { width: 92px; }
[data-studio-skel-actions="true"] > i[data-w="88"] { width: 88px; }
[data-studio-skel-actions="true"] > i[data-strong="true"] { background-color: var(--sk-action); border-color: var(--sk-action); opacity: .78; }

[data-studio-skel-workspace="true"] {
  flex: 1; min-height: 0; min-width: 0; margin: 0 10px 10px 0; display: flex; overflow: hidden;
  border: 1px solid var(--sk-line); border-radius: 14px; background: var(--sk-surface);
}

/* chat */
[data-studio-skel-chat="true"] {
  flex: 0 0 clamp(300px, 30vw, 440px); display: flex; flex-direction: column; gap: 18px;
  padding: 16px; box-sizing: border-box; background: var(--sk-panel); border-right: 1px solid var(--sk-line);
}
[data-studio-skel-chat-head="true"] { display: flex; align-items: center; gap: 10px; }
[data-studio-skel-chat-head="true"] > i { flex: none; width: 32px; height: 32px; border-radius: 50%; }
[data-studio-skel-chat-head="true"] > span { display: flex; flex-direction: column; gap: 7px; }
[data-studio-skel-messages="true"] { flex: 1; min-height: 0; display: flex; flex-direction: column; gap: 22px; overflow: hidden; padding-top: 8px; }
[data-studio-skel-msg] { display: flex; flex-direction: column; gap: 8px; }
[data-studio-skel-msg] > i { height: 10px; }
[data-studio-skel-msg] > i[data-short="true"] { width: 62%; }
[data-studio-skel-msg] > i[data-w="64"] { width: 64px; height: 8px; }
[data-studio-skel-msg="user"] { align-self: flex-end; width: 72%; padding: 12px 14px; border-radius: 12px 12px 3px 12px; background: var(--sk-surface); }
[data-studio-skel-composer="true"] {
  flex: none; display: flex; flex-direction: column; justify-content: space-between; gap: 18px; height: 96px; box-sizing: border-box;
  padding: 14px; border: 1px solid var(--sk-line); border-radius: 12px; background: var(--ss-field, var(--sk-surface));
}
[data-studio-skel-composer="true"] > i[data-w="170"] { width: 170px; height: 9px; }
[data-studio-skel-composer="true"] > span { display: flex; align-items: center; gap: 10px; }
[data-studio-skel-composer="true"] > span > i { width: 18px; height: 18px; border-radius: 50%; }
[data-studio-skel-composer="true"] > span > i[data-send="true"] { margin-left: auto; width: 28px; height: 28px; }

/* canvas */
[data-studio-skel-canvas="true"] { flex: 1; min-width: 0; display: flex; flex-direction: column; align-items: center; gap: 18px; padding: 16px 20px; box-sizing: border-box; }
[data-studio-skel-toolbar="true"] {
  flex: none; display: flex; align-items: center; justify-content: center; gap: 22px; width: min(430px, 90%); height: 36px; box-sizing: border-box;
  padding: 0 18px; border: 1px solid var(--sk-line); border-radius: 10px; background: var(--sk-panel);
}
[data-studio-skel-toolbar="true"] > i { width: 54px; height: 9px; }
[data-studio-skel-stage="true"] { flex: 1; min-height: 0; width: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 18px; }
[data-studio-skel-slide="true"] {
  position: relative; box-sizing: border-box; width: min(100%, calc((100dvh - 250px) * 16 / 9)); aspect-ratio: 16 / 9;
  padding: 7% 7%; display: flex; flex-direction: column; gap: 3.2%; border: 1px solid var(--sk-line); border-radius: 6px;
  background: var(--sk-panel); box-shadow: 0 10px 34px rgb(36 52 56 / 7%);
}
[data-studio-skel-slide="true"] > i { height: 8px; }
[data-studio-skel-slide="true"] > i[data-title="true"] { height: 22px; margin-top: 8%; border-radius: 8px; }
[data-studio-skel-slide="true"] > i[data-thin="true"] { height: 8px; }
[data-studio-skel-slide="true"] > i[data-art="true"] { position: absolute; right: 7%; bottom: 9%; width: 28%; height: 46%; border-radius: 12px; }
[data-studio-skel-status="true"] { margin: 0; display: inline-flex; align-items: center; gap: 9px; font-size: 13px; line-height: 1.5; color: var(--sk-muted); }
[data-studio-skel-status="true"] > span {
  width: 14px; height: 14px; box-sizing: border-box; border: 2px solid var(--sk-line); border-top-color: var(--sk-accent); border-radius: 50%;
  animation: studio-skel-spin 1s linear infinite;
}
@keyframes studio-skel-spin { to { transform: rotate(360deg); } }

/* slide rail */
[data-studio-skel-slides="true"] { flex: 0 0 104px; display: flex; flex-direction: column; gap: 12px; padding: 14px 12px; box-sizing: border-box; background: var(--sk-panel); border-left: 1px solid var(--sk-line); overflow: hidden; }
[data-studio-skel-slides="true"] > i[data-w="44"] { width: 44px; height: 8px; margin-bottom: 2px; }
[data-studio-skel-slides="true"] > i[data-thumb] { width: 100%; height: auto; aspect-ratio: 16 / 9; border-radius: 4px; flex: none; }
[data-studio-skel-slides="true"] > i[data-thumb="active"] { outline: 2px solid var(--sk-accent); outline-offset: 1px; }

@media (max-width: 1000px) { [data-studio-skel-chat="true"] { flex-basis: 280px; } }
@media (max-width: 860px) { [data-studio-skel-slides="true"] { display: none; } }
@media (max-width: 700px) {
  [data-studio-skel-chat="true"] { display: none; }
  [data-studio-skel-actions="true"] > i:not([data-strong="true"]) { display: none; }
}
@media (max-width: 780px) { [data-studio-skel-rail="true"] { flex-basis: 48px; } }
@media (prefers-reduced-motion: reduce) {
  .studio-skel-block, [data-studio-skel-status="true"] > span { animation: none; }
}

/* ---------- problem card (session problem + 404) ---------- */
[data-studio-problem-main="true"] {
  flex: 1; min-width: 0; min-height: 0; display: flex; align-items: center; justify-content: center; box-sizing: border-box; padding: 24px;
  margin: 0 10px 10px 0; border: 1px solid var(--sk-line); border-radius: 14px; background: var(--sk-surface); overflow: auto;
}
[data-studio-problem-main="true"][data-standalone="true"] { margin: 0; border: 0; border-radius: 0; background: var(--sk-frame); }
[data-studio-session-problem] > [data-studio-problem-main="true"] { margin-top: 48px; }
[data-studio-problem-card="true"] {
  box-sizing: border-box; width: 100%; max-width: 540px; padding: 44px 44px 40px; text-align: center;
  border: 1px solid var(--sk-line); border-radius: 18px; background: var(--sk-panel); box-shadow: 0 14px 44px rgb(36 52 56 / 7%);
}
[data-studio-problem-art="true"] { display: block; width: 132px; height: auto; margin: 0 auto 22px; }
[data-studio-problem-art="true"] .back { fill: var(--sk-soft); stroke: var(--sk-line); stroke-width: 1; }
[data-studio-problem-art="true"] .front { fill: var(--sk-panel); stroke: var(--sk-muted); stroke-opacity: .55; stroke-width: 1.2; stroke-dasharray: 4 3; }
[data-studio-problem-art="true"] .line { fill: var(--sk-accent); opacity: .5; }
[data-studio-problem-art="true"] .line.soft { fill: var(--sk-muted); opacity: .22; }
[data-studio-problem-art="true"] .badge { fill: var(--sk-accent); }
[data-studio-problem-art="true"] .mark { fill: none; stroke: #ffffff; stroke-width: 2.2; stroke-linecap: round; stroke-linejoin: round; }
[data-studio-problem-art="true"] .dot { fill: #ffffff; }
[data-studio-problem-eyebrow="true"] { margin: 0 0 12px; font-size: 11px; font-weight: 600; line-height: 1.4; letter-spacing: .16em; text-transform: uppercase; color: var(--sk-accent); }
[data-studio-problem-card="true"] h1 { margin: 0; font: 400 34px/1.15 Georgia, "Times New Roman", serif; letter-spacing: -.02em; color: var(--sk-text); }
[data-studio-problem-body="true"] { margin: 14px auto 0; max-width: 410px; font-size: 14px; line-height: 1.7; color: var(--sk-muted); }
[data-studio-problem-actions="true"] { display: flex; flex-wrap: wrap; align-items: center; justify-content: center; gap: 10px; margin-top: 28px; }
[data-studio-problem-action] {
  display: inline-flex; align-items: center; justify-content: center; box-sizing: border-box; height: 40px; padding: 0 20px;
  border: 1px solid var(--sk-line); border-radius: 10px; background: var(--sk-panel); color: var(--sk-text);
  font: 500 13px/1 Arial, Helvetica, sans-serif; text-decoration: none; cursor: pointer;
}
[data-studio-problem-action]:hover { background: var(--ss-active, var(--sk-soft)); }
[data-studio-problem-action="primary"] { background: var(--sk-action); border-color: var(--sk-action); color: var(--sk-on-action); }
[data-studio-problem-action="primary"]:hover { background: var(--ss-action-hover, var(--sk-action)); filter: brightness(1.12); }
[data-studio-problem-action]:focus-visible { outline: 2px solid var(--sk-accent); outline-offset: 2px; }

@media (max-width: 520px) {
  [data-studio-problem-card="true"] { padding: 32px 22px 28px; }
  [data-studio-problem-card="true"] h1 { font-size: 28px; }
}

/* The 404 page is outside the builder, where studio-shell.css is not loaded: same values as the shell tokens, light and dark. */
.dark [data-studio-not-found="true"] {
  --ss-frame: #1a2624; --ss-panel: #1b2426; --ss-surface: #141c1e; --ss-line: #334245; --ss-text: #e2ebe8; --ss-muted: #a0b1ad;
  --ss-accent: #b4a0f2; --ss-soft: #243034; --ss-action: #3d5c63; --ss-active: #1d3634; --ss-field: #222d30;
}
`
