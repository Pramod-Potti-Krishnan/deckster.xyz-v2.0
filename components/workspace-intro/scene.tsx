'use client';

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import type { WorkspaceIntroScreen } from './types';
import './scene.css';

type Props = { screen: WorkspaceIntroScreen; paused: boolean; reduced: boolean };
type Point = { x: number; y: number; z: number };
type SceneNode = Point & { label?: string; kind: 'hub' | 'source' | 'core' | 'task'; size: number; group: number };
const placement = (x: number, y: number, z: number, rotateX = 0, rotateY = 0, rotateZ = 0, delay = 0): CSSProperties => ({
  '--wis-x': `${x}px`, '--wis-y': `${y}px`, '--wis-z': `${z}px`, '--wis-rx': `${rotateX}deg`, '--wis-ry': `${rotateY}deg`, '--wis-rz': `${rotateZ}deg`, '--wis-delay': `${delay}ms`,
  '--wis-from-x': `${x * 1.12}px`, '--wis-from-y': `${y + 75}px`, '--wis-from-z': `${z - 190}px`,
} as CSSProperties);

function SlideObject({ kind = 'cover', tone = 'ivory', title = 'A clearer\ndirection.' }: { kind?: 'cover' | 'chart' | 'flow' | 'quote'; tone?: 'ivory' | 'mint' | 'ink'; title?: string }) {
  return <div className={`wis-slide wis-slide-${kind} wis-tone-${tone}`}>
    <div className="wis-slide-kicker"><i />NORTHSTAR / STRATEGY</div>
    {kind === 'cover' ? <><h3>{title}</h3><p>A shared ambition.<br />A purposeful next chapter.</p><div className="wis-cover-art"><i /><i /><i /></div></> : kind === 'chart' ? <><h3>Progress, made visible.</h3><div className="wis-chart"><span /><span /><span /><span />{[31, 46, 42, 62, 76, 92].map((height, index) => <i key={index} style={{ height: `${height}%` }} />)}</div><div className="wis-chart-caption">A SIGNAL. A PATTERN. A POSSIBILITY.</div></> : kind === 'flow' ? <><h3>One story. Three moves.</h3><div className="wis-flow">{['Understand', 'Connect', 'Act'].map((text, index) => <div key={text}><b>0{index + 1}</b><strong>{text}</strong><i /><i /></div>)}</div></> : <><div className="wis-quote-mark">“</div><h3>{title}</h3><div className="wis-quote-rule" /></>}
    <div className="wis-slide-footer"><span>THOUGHTFULLY CONNECTED</span><span>0{kind === 'cover' ? 1 : kind === 'chart' ? 3 : kind === 'flow' ? 5 : 7}</span></div>
  </div>;
}

function BuilderScene() {
  return <>
    <div className="wis-orbit-line wis-orbit-wide" />
    <div className="wis-object wis-slide-object wis-builder-back" style={placement(-48, -53, -115, 5, -9, -11, 120)}><SlideObject kind="chart" tone="mint" /></div>
    <div className="wis-object wis-slide-object wis-builder-middle" style={placement(-17, -19, -35, 3, -5, -6, 300)}><SlideObject kind="flow" /></div>
    <div className="wis-object wis-slide-object wis-builder-main" style={placement(35, 29, 80, 0, -5, -2, 530)}><SlideObject title={'Ideas become\ndirection.'} /></div>
    <div className="wis-object wis-brief-object" style={placement(-233, 89, 125, 1, 12, -6, 1000)}><span className="wis-object-label">THE BRIEF</span><div className="wis-brief-message"><i /><i /><i /></div><div className="wis-brief-response"><span>✦</span><i /><i /></div><div className="wis-brief-cursor" /></div>
    <div className="wis-object wis-mini-slide wis-builder-satellite" style={placement(246, -106, -10, 3, -16, 9, 1250)}><SlideObject kind="chart" tone="ink" /></div>
    <div className="wis-object wis-status-object" style={placement(195, 187, 135, 0, -5, -2, 1650)}><span className="wis-status-dot" /><span>BRIEF <i /> STORY <i /> SLIDES</span></div>
  </>;
}

function DecksScene() {
  return <>
    <div className="wis-orbit-line wis-gallery-orbit" /><div className="wis-orbit-line wis-gallery-orbit second" />
    <div className="wis-object wis-gallery-card wis-gallery-back" style={placement(-231, -117, -135, 7, 16, -9, 150)}><SlideObject kind="flow" tone="mint" /></div>
    <div className="wis-object wis-gallery-card" style={placement(229, -128, -130, 7, -17, 8, 350)}><SlideObject kind="chart" tone="ink" /></div>
    <div className="wis-object wis-gallery-card" style={placement(-246, 139, -115, -2, 17, -6, 600)}><SlideObject kind="quote" title={'Small moves.\nLasting impact.'} /></div>
    <div className="wis-object wis-gallery-card" style={placement(249, 133, -105, -2, -13, 8, 800)}><SlideObject kind="cover" tone="mint" title={'The next\nchapter.'} /></div>
    <div className="wis-object wis-slide-object wis-gallery-main" style={placement(4, 12, 95, 0, -4, -2, 1150)}><SlideObject title={'Stories worth\nreturning to.'} /><div className="wis-gallery-tab"><span className="wis-status-dot" />YOUR WORKSPACE</div></div>
  </>;
}

function BlueprintPlane({ kind }: { kind: 'sequence' | 'structure' | 'intent' }) {
  return <div className={`wis-blueprint wis-blueprint-${kind}`}>
    <div className="wis-blueprint-header"><span>{kind === 'sequence' ? 'DECK / STORY ARC' : kind === 'structure' ? 'SLIDE / COMPOSITION' : 'ELEMENT / INTENT'}</span><span>32 × 18</span></div>
    {kind === 'sequence' ? <div className="wis-blueprint-sequence">{['Context', 'Evidence', 'Decision'].map((title, index) => <div key={title}><span>0{index + 1}</span><strong>{title}</strong><i /><i /><i /></div>)}</div> : kind === 'structure' ? <><div className="wis-blueprint-heading">The evidence behind the idea.</div><div className="wis-blueprint-slots"><div><span>01</span><i /><i /><i /><small>EVIDENCE</small></div><div><span>02</span><i /><i /><small>CONTEXT</small></div><div><span>03</span><i /><small>IMPLICATION</small></div></div></> : <><div className="wis-blueprint-intent"><span>✦</span><div><strong>A role for every element.</strong><i /><i /></div></div><div className="wis-blueprint-rules"><span><b>KEEP</b> Structure & purpose</span><span><b>ADAPT</b> Content & evidence</span></div></>}
    <svg className="wis-blueprint-measures" viewBox="0 0 420 260" fill="none"><path d="M16 45V235M12 45h8M12 235h8M35 242H398M35 238v8M398 238v8" /><path className="wis-line-reveal" pathLength="1" d="M27 45H402M27 235H402" /></svg>
    <div className="wis-blueprint-corner top" /><div className="wis-blueprint-corner bottom" />
  </div>;
}

function TemplatesScene() {
  return <>
    <div className="wis-template-ground" />
    <div className="wis-object wis-blueprint-object" style={placement(-49, -98, -155, 13, -12, -4, 160)}><BlueprintPlane kind="sequence" /></div>
    <div className="wis-object wis-blueprint-object wis-blueprint-central" style={placement(-5, -8, -15, 10, -9, -3, 640)}><BlueprintPlane kind="structure" /></div>
    <div className="wis-object wis-blueprint-object wis-blueprint-front" style={placement(63, 113, 135, 6, -6, -2, 1150)}><BlueprintPlane kind="intent" /></div>
    <div className="wis-object wis-axis-label" style={placement(-267, -30, 65, 0, 5, -3, 1400)}><i /><span>DECK</span><i /><span>SLIDE</span><i /><span>ELEMENT</span></div>
    <div className="wis-object wis-blueprint-pin" style={placement(258, -101, 65, 0, -10, 6, 1600)}><span>↗</span><small>REUSABLE<br />BY DESIGN</small></div>
  </>;
}

function BrandScene() {
  const colors = ['#e8ecdb', '#a8d8c7', '#3c7972', '#d1b275', '#847b98'];
  return <>
    <div className="wis-orbit-line wis-brand-orbit" />
    <div className="wis-object wis-type-card wis-type-card-back" style={placement(-83, -38, -85, 4, -14, -8, 120)}><span className="wis-object-label">VISUAL IDENTITY / 01</span><b>Aa</b><div className="wis-type-lines"><i /><i /><i /></div></div>
    <div className="wis-object wis-type-card" style={placement(-78, -4, 50, 2, -7, -3, 500)}><span className="wis-object-label">A DISTINCTIVE VOICE</span><b>Aa<span>.</span></b><strong>Considered.<br />Confident. Clear.</strong><div className="wis-type-card-foot"><span>EDITORIAL SERIF</span><i /></div></div>
    {colors.map((color, index) => <div key={color} className="wis-object wis-color-blade" style={{ ...placement(93 + index * 35, 7 + index * 14, 35 + index * 15, 2, -7, 6 + index * 10, 700 + index * 190), '--wis-swatch': color } as CSSProperties}><div /><span>0{index + 1}<b>{color.toUpperCase()}</b></span></div>)}
    <div className="wis-object wis-brand-seal" style={placement(-221, 152, 100, -4, 9, -8, 1700)}><span>✳</span><div>YOUR<br />SIGNATURE</div></div>
  </>;
}

function DetailsScene() {
  return <>
    <div className="wis-orbit-line wis-identity-orbit" />
    <div className="wis-object wis-identity-back" style={placement(53, -69, -95, 5, -9, 8, 200)}><span className="wis-object-label">PRESENTER DETAILS</span>{['AUTHOR', 'ORGANIZATION', 'CONTACT', 'SIGNATURE'].map((label, index) => <div key={label}><span>{label}</span><i style={{ width: `${58 - index * 6}%` }} /></div>)}</div>
    <div className="wis-object wis-identity-card" style={placement(-16, 22, 85, 2, -5, -4, 700)}><div className="wis-identity-top"><span>PERSONAL / PROFILE</span><i>✳</i></div><div className="wis-identity-main"><div className="wis-portrait"><svg viewBox="0 0 100 100" fill="none"><circle cx="50" cy="37" r="19" /><path d="M16 97V85c0-39 68-39 68 0v12Z" /></svg><i /></div><div><small>INTRODUCING</small><h3>Your name.</h3><p>Perspective. Experience. A point of view.</p><span className="wis-signature">Your signature</span></div></div><div className="wis-identity-bottom"><span>hello@yourbrand.com</span><span>YOUR ORGANIZATION</span></div></div>
    <div className="wis-object wis-footer-card" style={placement(61, 173, 140, 0, -5, -4, 1450)}><span>YOUR NEXT PRESENTATION</span><div><i /><span>YOUR NAME · YOUR ORGANIZATION</span><b>01</b></div></div>
    <div className="wis-object wis-identity-seal" style={placement(-223, -107, 65, 0, 8, -6, 1100)}><svg viewBox="0 0 48 48" fill="none"><circle cx="24" cy="24" r="20" /><path d="m15 24 6 6 13-14" /></svg><span>YOURS,<br />EVERY TIME.</span></div>
  </>;
}

function rotate(point: Point, angle: number, tilt: number): Point {
  const x = point.x * Math.cos(angle) + point.z * Math.sin(angle);
  const z = -point.x * Math.sin(angle) + point.z * Math.cos(angle);
  return { x, y: point.y * Math.cos(tilt) - z * Math.sin(tilt), z: point.y * Math.sin(tilt) + z * Math.cos(tilt) };
}
function graphData(variant: 'knowledge' | 'models'): { nodes: SceneNode[]; edges: [number, number][] } {
  if (variant === 'models') {
    const nodes: SceneNode[] = [{ x: 0, y: 0, z: 0, label: 'DECKSTER', kind: 'core', size: 47, group: 0 }];
    ['PLANNING', 'WRITING', 'RESEARCH', 'IMAGERY', 'VOICE'].forEach((label, index) => {
      const a = index * Math.PI * 2 / 5 - Math.PI / 2;
      nodes.push({ x: Math.cos(a) * 1.06, y: Math.sin(a) * .87, z: Math.sin(index * 1.9) * .35, label, kind: 'task', size: 31, group: index });
    });
    return { nodes, edges: [[0,1],[0,2],[0,3],[0,4],[0,5]] };
  }
  const nodes: SceneNode[] = [{ x: 0, y: 0, z: .08, label: 'CONNECTED IDEAS', kind: 'core', size: 30, group: 0 }];
  const edges: [number, number][] = [];
  ['STRATEGY', 'PEOPLE', 'PRODUCT', 'EVIDENCE', 'MARKETS', 'RESEARCH'].forEach((label, index) => {
    const a = index * Math.PI / 3 - .6;
    const hub = nodes.length;
    const point = { x: Math.cos(a) * .72, y: Math.sin(a) * .72, z: Math.sin(index * 1.7) * .56 };
    nodes.push({ ...point, label, kind: 'hub', size: 13 + index % 3 * 3, group: index }); edges.push([0, hub]);
    for (let j = 0; j < 5; j++) {
      const offset = a + j * 1.28;
      nodes.push({ x: point.x + Math.cos(offset) * (.24 + j % 2 * .1), y: point.y + Math.sin(offset) * (.24 + j % 2 * .09), z: point.z + Math.sin(j * 2 + index) * .33, kind: 'source', size: j % 2 ? 5 : 7, group: index });
      edges.push([hub, nodes.length - 1]);
      if (j > 1) edges.push([nodes.length - 2, nodes.length - 1]);
    }
  });
  [1,7,13,19,25,31].forEach((hub, index, hubs) => edges.push([hub, hubs[(index + 1) % hubs.length]]));
  return { nodes, edges };
}

function Constellation({ variant, paused, reduced }: { variant: 'knowledge' | 'models'; paused: boolean; reduced: boolean }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const elapsed = useRef(0);
  useEffect(() => {
    const element = canvas.current; if (!element) return;
    const context = element.getContext('2d'); if (!context) return;
    const { nodes, edges } = graphData(variant);
    let width = 0, height = 0, animation = 0, lastTime = 0, lastDraw = 0;
    const colors = ['#aedbc8', '#89b8b8', '#d1c9a5', '#8bb4c8', '#aac995', '#b0a5c0'];
    const draw = (seconds: number) => {
      if (!width || !height) return;
      const ctx = context;
      ctx.clearRect(0, 0, width, height);
      const assembly = reduced ? 1 : Math.min(1, seconds / 2.8);
      const ease = 1 - Math.pow(1 - assembly, 3);
      const angle = reduced ? -.14 : -.4 + seconds * (variant === 'models' ? .055 : .065);
      const tilt = reduced ? -.09 : -.1 + Math.sin(seconds * .3) * .09;
      const scale = Math.min(width / 2.95, height / 2.55);
      const centerX = width * .5, centerY = height * .49;
      const project = (p: Point) => { const r = rotate(p, angle, tilt); const perspective = 3.8 / (3.8 + r.z); return { x: centerX + r.x * scale * perspective, y: centerY + r.y * scale * perspective, z: r.z, p: perspective }; };
      const projected = nodes.map((node, index) => {
        const spread = 1 + (1 - ease) * .48;
        const p = project({ x: node.x * spread, y: node.y * spread + (1 - ease) * .35, z: node.z + (1 - ease) * .6 });
        return { ...p, node, index, alpha: reduced ? 1 : Math.max(0, Math.min(1, (seconds - (node.kind === 'core' ? 0 : .25 + index * .015)) / 1.1)) };
      });
      const ambient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, scale * 1.32);
      ambient.addColorStop(0, variant === 'models' ? '#93c9c51a' : '#8fc9b812'); ambient.addColorStop(1, '#8fc9b800');
      ctx.fillStyle = ambient; ctx.fillRect(0, 0, width, height);
      // Projected orbital rings are genuinely rotated through depth, not flat icon halos.
      for (let ring = 0; ring < (variant === 'models' ? 3 : 2); ring++) {
        ctx.beginPath();
        for (let i = 0; i <= 96; i++) {
          const a = i / 96 * Math.PI * 2;
          const r = variant === 'models' ? .38 + ring * .1 : 1.15 + ring * .1;
          const p = project({ x: Math.cos(a) * r, y: Math.sin(a) * r * (ring === 1 ? .65 : .3), z: Math.sin(a) * r * (ring === 1 ? .3 : .85) });
          if (i) ctx.lineTo(p.x, p.y); else ctx.moveTo(p.x, p.y);
        }
        ctx.strokeStyle = variant === 'models' ? '#b2e5d938' : '#a0d6cb14'; ctx.lineWidth = ring ? .8 : 1.2; ctx.globalAlpha = ease; ctx.stroke();
      }
      edges.forEach(([start, end], index) => {
        const a = projected[start], b = projected[end];
        const alpha = Math.min(a.alpha, b.alpha) * Math.max(.15, .7 - (a.z + b.z) * .14);
        ctx.globalAlpha = alpha;
        const bend = variant === 'models' ? (index % 2 ? 1 : -1) * 25 : (index % 3 - 1) * 11;
        const mx = (a.x + b.x) / 2 + bend, my = (a.y + b.y) / 2 - Math.abs(bend) * .3;
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.quadraticCurveTo(mx, my, b.x, b.y);
        ctx.strokeStyle = variant === 'models' ? '#a4d8ca' : '#91bcb6'; ctx.lineWidth = variant === 'models' ? 1.4 : start === 0 ? 1.1 : .65; ctx.stroke();
        if (assembly > .55 && (variant === 'models' || index % 4 === 0)) {
          const t = reduced ? .54 : (seconds * .15 + index * .21) % 1;
          const x = (1-t)*(1-t)*a.x+2*(1-t)*t*mx+t*t*b.x, y = (1-t)*(1-t)*a.y+2*(1-t)*t*my+t*t*b.y;
          ctx.beginPath(); ctx.arc(x, y, variant === 'models' ? 2.4 : 1.7, 0, Math.PI * 2); ctx.fillStyle = '#daf9e9'; ctx.shadowColor = '#b5e5ce'; ctx.shadowBlur = 9; ctx.fill(); ctx.shadowBlur = 0;
        }
      });
      projected.sort((a, b) => b.z - a.z).forEach(({ x, y, z, p, node, index, alpha }) => {
        ctx.globalAlpha = alpha * Math.max(.38, 1 - Math.max(0, z) * .32);
        const sizeScale = Math.min(width / 640, height / 500);
        const radius = node.size * p * Math.max(.6, sizeScale);
        const color = colors[node.group % colors.length];
        if (node.kind === 'task') {
          const w = 112 * p * Math.max(.68, sizeScale), h = 62 * p * Math.max(.68, sizeScale);
          ctx.save(); ctx.translate(x, y); ctx.transform(1, -.05 * (index - 3), -.07, 1, 0, 0);
          ctx.shadowColor = '#00000066'; ctx.shadowBlur = 24; ctx.shadowOffsetY = 12;
          ctx.beginPath(); ctx.roundRect(-w/2, -h/2, w, h, 9); const fill = ctx.createLinearGradient(-w/2, -h/2, w/2, h/2); fill.addColorStop(0, '#244d4d'); fill.addColorStop(1, '#173336'); ctx.fillStyle = fill; ctx.fill(); ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
          ctx.strokeStyle = color + 'a0'; ctx.lineWidth = 1; ctx.stroke();
          ctx.fillStyle = color; ctx.font = `${Math.max(9, 11 * sizeScale)}px Arial,sans-serif`; ctx.textAlign = 'center'; ctx.fillText(node.label!, 0, 5);
          ctx.fillStyle = '#b4c9c680'; ctx.font = `${Math.max(7, 8 * sizeScale)}px Arial,sans-serif`; ctx.fillText(`TASK / 0${index}`, 0, -h/2 + 14);
          ctx.restore();
        } else if (node.kind === 'core' && variant === 'models') {
          ctx.save(); ctx.translate(x, y);
          for (let layer = 3; layer >= 0; layer--) {
            ctx.beginPath(); const r = radius + layer * 4;
            for (let corner = 0; corner < 6; corner++) { const a = corner * Math.PI / 3 - Math.PI / 6; const px = Math.cos(a) * r, py = Math.sin(a) * r * .78 + layer * 7; if (!corner) ctx.moveTo(px, py); else ctx.lineTo(px, py); } ctx.closePath();
            ctx.fillStyle = layer ? '#173739' : '#c0e4d3'; ctx.strokeStyle = layer ? '#88c9bc70' : '#e3f5e7'; ctx.lineWidth = 1.2; ctx.shadowColor = '#9adbc390'; ctx.shadowBlur = layer ? 0 : 22; ctx.fill(); ctx.stroke();
          }
          ctx.shadowBlur = 0; ctx.fillStyle = '#204d49'; ctx.textAlign = 'center'; ctx.font = `600 ${Math.max(9, 11 * sizeScale)}px Arial,sans-serif`; ctx.fillText('DECKSTER', 0, -2); ctx.font = `${Math.max(7, 8 * sizeScale)}px Arial,sans-serif`; ctx.fillText('INTELLIGENCE', 0, 12); ctx.restore();
        } else if (node.kind === 'source') {
          ctx.save(); ctx.translate(x, y); ctx.rotate((index % 5 - 2) * .12);
          ctx.fillStyle = '#a9d1c526'; ctx.strokeStyle = color + 'b0'; ctx.lineWidth = .8; ctx.beginPath(); ctx.roundRect(-radius*.75, -radius, radius*1.5, radius*2, 2); ctx.fill(); ctx.stroke();
          ctx.strokeStyle = '#d1e9dd95'; ctx.beginPath(); ctx.moveTo(-radius*.38,-radius*.3);ctx.lineTo(radius*.38,-radius*.3);ctx.moveTo(-radius*.38,radius*.2);ctx.lineTo(radius*.25,radius*.2);ctx.stroke(); ctx.restore();
        } else {
          const glow = ctx.createRadialGradient(x - radius*.3, y - radius*.4, 1, x, y, radius);
          glow.addColorStop(0, node.kind === 'core' ? '#eff8e4' : '#d1e8d5'); glow.addColorStop(.5, color); glow.addColorStop(1, '#366d66');
          ctx.beginPath(); ctx.arc(x, y, radius, 0, Math.PI * 2); ctx.fillStyle = glow; ctx.shadowColor = color + '55'; ctx.shadowBlur = radius * .7; ctx.fill(); ctx.shadowBlur = 0;
          ctx.strokeStyle = '#e6f6e455'; ctx.lineWidth = .8; ctx.stroke();
          if (node.label) { ctx.textAlign = 'center'; ctx.font = `${node.kind === 'core' ? 600 : 400} ${Math.max(8, (node.kind === 'core' ? 10 : 9) * sizeScale)}px Arial,sans-serif`; ctx.fillStyle = '#d6e7dd'; ctx.fillText(node.label, x, y + radius + 17 * Math.max(.7, sizeScale)); }
        }
      });
      ctx.globalAlpha = 1;
    };
    const resize = () => {
      const rect = element.getBoundingClientRect(); width = rect.width; height = rect.height;
      const dpr = Math.min(window.devicePixelRatio || 1, 2); element.width = Math.round(width * dpr); element.height = Math.round(height * dpr); context.setTransform(dpr, 0, 0, dpr, 0, 0);
      draw(reduced ? 4 : elapsed.current);
    };
    resize(); const observer = new ResizeObserver(resize); observer.observe(element);
    const tick = (time: number) => {
      if (lastTime) elapsed.current += Math.min((time - lastTime) / 1000, .07); lastTime = time;
      if (time - lastDraw > 1000 / 30) { draw(elapsed.current); lastDraw = time; }
      animation = requestAnimationFrame(tick);
    };
    if (!paused && !reduced) animation = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(animation); observer.disconnect(); };
  }, [variant, paused, reduced]);
  return <canvas ref={canvas} className="wis-constellation" aria-hidden="true" />;
}

export default function IntroScene({ screen, paused, reduced }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(.8);
  useEffect(() => {
    const node = host.current; if (!node) return;
    const observer = new ResizeObserver(([entry]) => setScale(Math.min(entry.contentRect.width / 760, entry.contentRect.height / 560)));
    observer.observe(node); return () => observer.disconnect();
  }, []);
  const graph = screen === 'knowledge' || screen === 'models';
  return <div ref={host} className={`wis-scene wis-scene-${screen} ${paused ? 'wis-paused' : ''} ${reduced ? 'wis-reduced' : ''}`} aria-hidden="true">
    <div className="wis-ambient wis-ambient-one" /><div className="wis-ambient wis-ambient-two" /><div className="wis-scene-grain" />
    {graph ? <Constellation variant={screen} paused={paused} reduced={reduced} /> : <div className="wis-perspective"><div className="wis-stage" style={{ '--wis-scale': scale } as CSSProperties}><div className="wis-world">
      <div className="wis-stage-shadow" />
      {screen === 'builder' ? <BuilderScene /> : screen === 'decks' ? <DecksScene /> : screen === 'templates' ? <TemplatesScene /> : screen === 'brand' ? <BrandScene /> : <DetailsScene />}
    </div></div></div>}
    <div className="wis-light-line" />
  </div>;
}
