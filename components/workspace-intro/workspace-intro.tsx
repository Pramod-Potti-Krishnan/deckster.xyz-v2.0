'use client';
import { useEffect, useLayoutEffect, useRef, useState, useId, type CSSProperties, type RefObject } from 'react';
import { ArrowRight, Pause, Play, RotateCcw } from 'lucide-react';
import { createPortal } from 'react-dom';
import type { WorkspaceIntroScreen as Screen, WorkspaceIntroPhase } from './types';
import IntroScene from './scene';
import './workspace-intro.css';

const STORAGE = 'deckster-studio-workspace-intros-v2';
const DURATION = 10500;
const COPY: Record<Screen, { name: string; title: string; emphasis: string; text: string; accent: string; steps: string[] }> = {
  builder: { name: 'Studio', title: 'Every great story', emphasis: 'starts with a spark.', text: 'An idea becomes a conversation. A conversation becomes a story worth sharing.', accent: '#a9e4ce', steps: ['The spark', 'The story', 'Your stage'] },
  decks: { name: 'Your decks', title: 'A world of stories.', emphasis: 'Entirely yours.', text: 'The ideas you are shaping. The stories you have shared. Your next chapter starts here.', accent: '#b2d3f0', steps: ['Gather', 'Find your story', 'Keep creating'] },
  templates: { name: 'Templates', title: 'Great structure.', emphasis: 'Endless possibility.', text: 'Give your best ideas a form you can return to. Create the starting point for what comes next.', accent: '#e8c99c', steps: ['The blueprint', 'The building blocks', 'Make it yours'] },
  brand: { name: 'Themes & brand', title: 'Make your mark.', emphasis: 'In every detail.', text: 'Color, type, and a point of view. Bring them together in a visual language that feels like you.', accent: '#dfbfe9', steps: ['Find a feeling', 'Shape a language', 'Own your identity'] },
  knowledge: { name: 'Second Brain', title: 'Nothing you know', emphasis: 'stands alone.', text: 'Watch your sources become connections, and your connections become a new perspective.', accent: '#a9e4d9', steps: ['Gather the signals', 'Connect the ideas', 'See the possibility'] },
  models: { name: 'Intelligence', title: 'Different minds.', emphasis: 'One creative vision.', text: 'Bring the right intelligence to every task. You choose the minds behind your work.', accent: '#c2cdf5', steps: ['Explore intelligence', 'Connect the right minds', 'Take the controls'] },
  details: { name: 'Your details', title: 'Behind every story,', emphasis: 'there is you.', text: 'Your name. Your perspective. Your signature. Give every presentation a personal presence.', accent: '#ccdfa9', steps: ['Your identity', 'Your signature', 'Your presence'] },
};
type Visit = { key: string; elapsed: number };
type IntroWindow = Window & { __decksterWorkspaceIntrosV2?: Set<Screen> };
function seenWorkspaces() {
  const host = window as IntroWindow;
  const seen = host.__decksterWorkspaceIntrosV2 ||= new Set<Screen>();
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(STORAGE) || '[]');
    if (Array.isArray(stored)) stored.forEach(value => { if (typeof value === 'string' && value in COPY) seen.add(value as Screen); });
  } catch { /* Memory keeps repeat visits quiet when storage is unavailable. */ }
  return seen;
}

export type WorkspaceIntroProps = {
  screen: Screen
  enabled?: boolean
  replay?: number
  autoStart?: boolean
  /** Locates the destination inside its full working frame; rail and header stay live. */
  targetSelector?: string
  returnFocusRef?: RefObject<HTMLElement | null>
  onActiveChange?: (active: boolean) => void
  id?: string
}

const NAVIGATION = '[data-studio-v4-shell-header], [data-studio-v4-rail]'
const OPEN_EVENT = 'deckster:workspace-intro-open'
const MODAL = '[role="dialog"][data-state="open"], [role="alertdialog"][data-state="open"]'
const locks = new WeakMap<HTMLElement, { count: number; inert: boolean; overflow: string }>()
function lockSurface(body: HTMLElement) {
  const entry = locks.get(body) ?? { count: 0, inert: body.inert, overflow: body.style.overflow }
  entry.count++; locks.set(body, entry); body.inert = true; body.style.overflow = 'hidden'
  return () => { if (--entry.count === 0) { body.inert = entry.inert; body.style.overflow = entry.overflow; locks.delete(body) } }
}
function workingSurface(selector?: string) {
  const target = document.querySelector<HTMLElement>(selector || '[data-studio-v4-shell-workspace]')
  return target?.closest<HTMLElement>('[data-studio-v4-shell-workspace]') ?? target
}

/** Accepted cinematic scene, outside its inert working surface. No workspace children are unmounted. */
export default function WorkspaceIntro({ screen, enabled = true, replay = 0, autoStart = true, targetSelector, returnFocusRef, onActiveChange, id }: WorkspaceIntroProps) {
  const owner = useId()
  const callback = useRef(onActiveChange); callback.current = onActiveChange
  const focusRef = useRef(returnFocusRef); focusRef.current = returnFocusRef

  const [show, setShow] = useState(false);
  const [paused, setPaused] = useState(false);
  const [reduced, setReduced] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [phase, setPhase] = useState<WorkspaceIntroPhase>(0);
  const [run, setRun] = useState(0);
  const [hidden, setHidden] = useState(false);
  const [rect, setRect] = useState<{ left: number; top: number; width: number; height: number } | null>(null);
  const surface = useRef<HTMLElement>(null);
  const skip = useRef<HTMLButtonElement>(null);
  const visit = useRef<Visit | null>(null);
  const lastReplay = useRef(replay);
  const returnFocus = useRef<HTMLElement | null>(null);
  const ownsFocus = useRef(false);
  const leaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef({ paused, reduced, leaving }); latest.current = { paused, reduced, leaving };
  const active = enabled && show && visit.current?.key === `${screen}:${replay}`;
  const finish = (animate = true) => {
    if (animate && latest.current.leaving) return;
    if (leaveTimer.current) clearTimeout(leaveTimer.current);
    const close = () => { visit.current = null; setShow(false); setLeaving(false); };
    if (animate && !latest.current.reduced) { setLeaving(true); leaveTimer.current = setTimeout(close, 650); }
    else close();
  };
  const finishRef = useRef(finish); finishRef.current = finish;

  useEffect(() => {
    const visibility = () => setHidden(document.hidden);
    visibility(); document.addEventListener('visibilitychange', visibility);
    return () => document.removeEventListener('visibilitychange', visibility);
  }, []);

  useEffect(() => {
    if (leaveTimer.current) { clearTimeout(leaveTimer.current); leaveTimer.current = null; }
    if (!enabled) { visit.current = null; setShow(false); setLeaving(false); return; }
    const key = `${screen}:${replay}`;
    const explicitReplay = replay !== lastReplay.current; lastReplay.current = replay;
    if (!autoStart && !explicitReplay && !visit.current) { setShow(false); return; }
    if (!workingSurface(targetSelector) || document.querySelector(MODAL)) { visit.current = null; setShow(false); return; }
    const seen = seenWorkspaces();
    if (!explicitReplay && seen.has(screen) && visit.current?.key !== key) { setShow(false); return; }
    if (visit.current?.key !== key) {
      visit.current = { key, elapsed: 0 };
      // The visit ref alone does not schedule a render during rapid navigation.
      setRun(value => value + 1);
      returnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      window.dispatchEvent(new CustomEvent(OPEN_EVENT, { detail: owner }));
      seen.add(screen);
      try { localStorage.setItem(STORAGE, JSON.stringify([...seen])); } catch { /* No account data is stored here. */ }
    }
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const motion = () => { const progress = (visit.current?.elapsed || 0) / DURATION; setReduced(media.matches); setPhase(media.matches ? 2 : progress < .3 ? 0 : progress < .7 ? 1 : 2); };
    motion(); media.addEventListener('change', motion);
    setPaused(false); setLeaving(false); setShow(true);
    return () => { media.removeEventListener('change', motion); if (leaveTimer.current) clearTimeout(leaveTimer.current); };
  }, [screen, enabled, replay, autoStart, targetSelector, owner]);

  useLayoutEffect(() => {
    if (!active) return;
    const body = workingSurface(targetSelector);
    if (!body) return;
    const measure = () => {
      const box = body.getBoundingClientRect(), viewport = window.visualViewport;
      const viewLeft = viewport?.offsetLeft || 0, viewTop = viewport?.offsetTop || 0;
      const left = Math.max(box.left, viewLeft), top = Math.max(box.top, viewTop);
      const next = { left, top, width: Math.max(0, Math.min(box.right, viewLeft + (viewport?.width || window.innerWidth)) - left), height: Math.max(0, Math.min(box.bottom, viewTop + (viewport?.height || window.innerHeight)) - top) };
      setRect(previous => previous && Object.entries(next).every(([key, value]) => previous[key as keyof typeof next] === value) ? previous : next);
    };
    measure();
    const observer = new ResizeObserver(measure); observer.observe(body);
    window.addEventListener('resize', measure); window.addEventListener('scroll', measure, true); window.visualViewport?.addEventListener('resize', measure); window.visualViewport?.addEventListener('scroll', measure);
    const unlock = lockSurface(body);
    return () => {
      observer.disconnect(); window.removeEventListener('resize', measure); window.removeEventListener('scroll', measure, true); window.visualViewport?.removeEventListener('resize', measure); window.visualViewport?.removeEventListener('scroll', measure);
      unlock();
    };
  }, [active, targetSelector]);

  useEffect(() => {
    if (!active || !rect) return;
    const surfaceNode = surface.current;
    const trigger = returnFocus.current;
    const focus = (event: FocusEvent) => { ownsFocus.current = !!surfaceNode?.contains(event.target as Node); };
    document.addEventListener('focusin', focus, true);
    // This is a non-modal region: the top bar and navigation remain reachable.
    skip.current?.focus({ preventScroll: true });
    ownsFocus.current = !!surfaceNode?.contains(document.activeElement);
    const key = (event: KeyboardEvent) => {
      if (!surfaceNode?.contains(event.target as Node)) return;
      if (event.key === 'Escape') { event.preventDefault(); finishRef.current(); }
      event.stopPropagation();
    };
    const headerAction = (event: Event) => {
      if ((event.target as Element)?.closest(NAVIGATION)) {
        ownsFocus.current = false;
        if (!(event.target as Element)?.closest('[data-studio-intro-replay]')) finishRef.current(false);
      }
    };
    window.addEventListener('keydown', key, true); document.addEventListener('pointerdown', headerAction, true); document.addEventListener('click', headerAction, true);
    return () => {
      window.removeEventListener('keydown', key, true); document.removeEventListener('pointerdown', headerAction, true); document.removeEventListener('click', headerAction, true); document.removeEventListener('focusin', focus, true);
      // Keep the captured node: React clears surface.current before passive cleanup.
      if (!document.querySelector(MODAL) && (ownsFocus.current || surfaceNode?.contains(document.activeElement))) {
        const fallback = focusRef.current?.current;
        const destination = trigger?.isConnected && trigger !== document.body && !trigger.closest('[inert]') ? trigger : fallback?.isConnected && !fallback.closest('[inert]') ? fallback : null;
        destination?.focus({ preventScroll: true });
      }
      ownsFocus.current = false;
    };
  }, [active, !!rect, screen, replay]);

  useEffect(() => {
    callback.current?.(active)
    if (!active) return
    const another = (event: Event) => { if ((event as CustomEvent).detail !== owner) { ownsFocus.current = false; finishRef.current(false) } }
    const modal = () => { if (document.querySelector(MODAL)) { ownsFocus.current = false; finishRef.current(false) } }
    const observer = new MutationObserver(modal)
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-state', 'role'] })
    window.addEventListener(OPEN_EVENT, another)
    return () => { observer.disconnect(); window.removeEventListener(OPEN_EVENT, another); callback.current?.(false) }
  }, [active, owner])

  useEffect(() => {
    if (!active) return;
    let frame = 0, previous = performance.now(), lastPhase = -1;
    const tick = (now: number) => {
      const delta = Math.min(100, now - previous); previous = now;
      if (visit.current && !latest.current.paused && !latest.current.reduced && !latest.current.leaving && !document.hidden) {
        visit.current.elapsed += delta;
        const progress = Math.min(1, visit.current.elapsed / DURATION);
        surface.current?.style.setProperty('--wi-progress', String(progress));
        const nextPhase = progress < .3 ? 0 : progress < .7 ? 1 : 2;
        if (nextPhase !== lastPhase) { lastPhase = nextPhase; setPhase(nextPhase); }
        if (progress === 1) { finishRef.current(); return; }
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [active, screen, replay, run]);

  if (!active || !rect) return null;
  const copy = COPY[screen];
  return createPortal(<section id={id} ref={surface} key={`${screen}:${replay}`} className={`workspace-intro wi-cinematic ${paused || hidden ? 'wi-paused' : ''} ${reduced ? 'wi-reduced' : ''} ${leaving ? 'wi-leaving' : ''}`} data-phase={phase} style={{ '--wi-accent': copy.accent, ...rect } as CSSProperties} role="region" aria-label={`${copy.name} cinematic introduction`}>
    <div className="wi-atmosphere" aria-hidden="true"><i/><i/><i/></div>
    <div className="wi-studio-grid" aria-hidden="true"/>
    <div className="wi-masthead"><span><i/>DECKSTER <b>/</b> {copy.name.toUpperCase()}</span><button type="button" ref={skip} className="wi-skip" onClick={() => finish()} aria-label="Skip introduction">Skip intro <ArrowRight size={14}/></button></div>
    <div className="wi-scene-stage"><IntroScene key={run} screen={screen} phase={phase} paused={paused || leaving || hidden} reduced={reduced}/></div>
    <div className="wi-story-copy"><span className="wi-kicker">A SPACE FOR YOUR NEXT POSSIBILITY</span><h1>{copy.title}<br/><em>{copy.emphasis}</em></h1><p>{copy.text}</p><button type="button" className="wi-enter" onClick={() => finish()}>Enter {screen === 'builder' ? 'the Studio' : copy.name}<ArrowRight size={15}/></button></div>
    <footer className="wi-footer"><div className="wi-chapters" aria-label={`Introduction stage ${phase + 1} of 3`}>{copy.steps.map((step, index) => <div key={step} className={index <= phase ? 'is-active' : ''}><i/><span><small>0{index + 1}</small>{step}</span></div>)}</div><div className="wi-playback">{!reduced && <button type="button" onClick={() => setPaused(value => !value)} aria-label={paused ? 'Resume introduction' : 'Pause introduction'}>{paused ? <Play size={14}/> : <Pause size={14}/>}<span>{paused ? 'Resume' : 'Pause'}</span></button>}<button type="button" aria-label="Restart introduction" title="Restart introduction" onClick={() => { if (leaveTimer.current) { clearTimeout(leaveTimer.current); leaveTimer.current = null; } if (visit.current) visit.current.elapsed = 0; setPhase(reduced ? 2 : 0); setPaused(false); setLeaving(false); setRun(value => value + 1); surface.current?.style.setProperty('--wi-progress', '0'); }}><RotateCcw size={14}/></button></div></footer>
    <div className="wi-progress" aria-hidden="true"/>
  </section>, document.body);
}
