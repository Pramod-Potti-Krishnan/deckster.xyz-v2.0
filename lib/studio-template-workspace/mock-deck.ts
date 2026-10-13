// PASS2-PK-FOUR item 4 (frontend-2): the MOCK template deck, dev/test only. Loaded only by ./mock-source.ts, which the adapter imports
// only when NEXT_PUBLIC_STUDIO_TEMPLATE_WORKSPACE_MOCK is "true" at build time; otherwise this file is not in the bundle.
//
// "Tidewell" is an invented logistics company and its 30-slide QBR deck was drawn for the approved design frames
// (streams/ops/PASS2/PK4-4-template-wow/src/slides.js). All content is fictional. Each slide is static HTML at 960x540; elements carry
// data-el="kind|role|policy" so the workspace can measure their boxes from the rendered slide, as it will for the real as-is deck.
/* eslint-disable */
// @ts-nocheck -- a verbatim port of the frames' drawing code (string templates only, no DOM, no network)
const build = () => {
  const NAVY = '#14284B', CORAL = '#F0643C', INK = '#1E2733', GREY = '#6B7280', WARM = '#F6F3EE', LINE = '#E4DFD7', NAVY2 = '#DCE3EF', CORAL2 = '#FDE4DA';
  const F = "'Avenir Next','Helvetica Neue',Arial,sans-serif";

  const logo = (light) => `<div data-el="Logo|Logo|fixed" style="position:absolute;left:44px;top:30px;display:flex;align-items:center;gap:8px;font:600 15px ${F};letter-spacing:.2px;color:${light ? '#fff' : NAVY}">
    <svg width="22" height="22" viewBox="0 0 22 22"><circle cx="11" cy="11" r="11" fill="${CORAL}"/><path d="M3 12c2.5-3 5-3 7.5 0s5 3 8 0" stroke="#fff" stroke-width="2.2" fill="none" stroke-linecap="round"/></svg>tidewell</div>`;
  const footer = (n, light) => `<div data-el="Text|Footer|fixed" style="position:absolute;left:44px;right:44px;bottom:22px;display:flex;justify-content:space-between;font:500 10px ${F};letter-spacing:.6px;color:${light ? '#c9d2e3' : GREY}">
    <span>TIDEWELL · Q3 2026 BUSINESS REVIEW · CONFIDENTIAL</span><span>${n}</span></div>`;
  const head = (eyebrow, title) => `<div style="position:absolute;left:44px;top:72px;right:44px">
    <div data-el="Text|Eyebrow|fillable" style="font:700 11px ${F};letter-spacing:2px;color:${CORAL};display:inline-block">${eyebrow}</div>
    <div data-el="Text|Title|fillable" style="font:700 30px/1.15 ${F};color:${NAVY};margin-top:8px;letter-spacing:-.3px">${title}</div></div>`;
  const page = (n, body, bg = '#fff', light = false) => `<div class="stw-fixture-slide" style="background:${bg}">${logo(light)}${body}${footer(n, light)}</div>`;

  const L = {
    title: (n) => `<div class="stw-fixture-slide" style="background:${NAVY}">${logo(true)}
      <svg data-el="Shape|Decoration|fixed" style="position:absolute;right:0;top:0" width="430" height="540" viewBox="0 0 430 540"><circle cx="330" cy="270" r="210" fill="${CORAL}"/><circle cx="330" cy="270" r="128" fill="${NAVY}"/><path d="M150 300c40-40 80-40 120 0s80 40 120 0s80-40 120 0" stroke="#fff" stroke-width="10" fill="none" opacity=".9"/></svg>
      <div style="position:absolute;left:44px;top:170px;width:470px">
        <div data-el="Text|Eyebrow|fillable" style="font:700 12px ${F};letter-spacing:2.4px;color:${CORAL};display:inline-block">QUARTERLY BUSINESS REVIEW</div>
        <div data-el="Text|Title|fillable" style="font:700 50px/1.05 ${F};color:#fff;margin-top:14px;letter-spacing:-.8px;width:max-content">Q3 2026<br>Business Review</div>
        <div data-el="Text|Subtitle|fillable" style="font:400 17px/1.4 ${F};color:#c9d2e3;margin-top:18px;width:max-content">Operations, customers and the quarter ahead</div>
        <div data-el="Text|Date line|fillable" style="font:500 11px ${F};letter-spacing:1px;color:#9fb0cc;margin-top:34px;width:max-content">14 OCTOBER 2026 · LEADERSHIP TEAM</div></div></div>`,
    agenda: (n) => `<div class="stw-fixture-slide" style="background:#fff"><div style="position:absolute;left:0;top:0;bottom:0;width:300px;background:${NAVY}"></div>${logo(true)}
      <div style="position:absolute;left:44px;top:190px;font:700 40px ${F};color:#fff">Agenda</div>
      <div style="position:absolute;left:44px;top:250px;width:200px;font:400 13px/1.5 ${F};color:#c9d2e3">Five parts, about 40 minutes with questions.</div>
      <div data-el="Text|List|fillable" style="position:absolute;left:360px;top:110px;right:60px">${['Performance', 'Customers', 'Operations', 'Outlook', 'Decisions we need'].map((t, i) => `<div style="display:flex;align-items:baseline;gap:22px;padding:15px 0;border-bottom:1px solid ${LINE}"><span style="font:700 22px ${F};color:${CORAL};width:34px">0${i + 1}</span><span style="font:600 21px ${F};color:${NAVY}">${t}</span></div>`).join('')}</div>${footer(n)}</div>`,
    section: (n, num, t, s) => `<div class="stw-fixture-slide" style="background:#fff"><div style="position:absolute;left:0;top:0;bottom:0;width:380px;background:${CORAL}"></div>${logo(true)}
      <div data-el="Text|Section number|fillable" style="position:absolute;left:44px;top:150px;font:700 170px/1 ${F};color:#fff;letter-spacing:-6px">${num}</div>
      <div data-el="Text|Section title|fillable" style="position:absolute;left:440px;top:200px;right:60px"><div style="font:700 44px ${F};color:${NAVY};letter-spacing:-.6px">${t}</div><div style="font:400 17px/1.45 ${F};color:${GREY};margin-top:14px">${s}</div></div>${footer(n)}</div>`,
    kpi: (n, eb, t, tiles) => page(n, head(eb, t) + `<div style="position:absolute;left:44px;right:44px;top:190px;display:grid;grid-template-columns:repeat(${tiles.length},1fr);gap:18px">${tiles.map(([v, l, d], i) => `<div data-el="Text|Metric|fillable" style="background:${i === 0 ? NAVY : WARM};border-radius:10px;padding:24px 22px;height:190px;box-sizing:border-box"><div style="font:700 ${tiles.length > 3 ? 34 : 44}px ${F};color:${i === 0 ? '#fff' : NAVY};letter-spacing:-1px;white-space:nowrap">${v}</div><div style="font:500 14px/1.35 ${F};color:${i === 0 ? '#c9d2e3' : GREY};margin-top:10px">${l}</div><div style="font:700 13px ${F};color:${CORAL};margin-top:22px">${d}</div></div>`).join('')}</div>
      <div data-el="Text|Source note|fillable" style="position:absolute;left:44px;top:410px;right:44px;font:400 13px/1.5 ${F};color:${GREY}">Source: Tidewell operations dashboard, 30 September 2026. Sample figures.</div>`),
    bars: (n, eb, t, vals, take) => page(n, head(eb, t) + `<div data-el="Chart|Chart · columns|fillable" style="position:absolute;left:44px;top:170px;width:540px;height:260px;border-bottom:2px solid ${LINE};display:flex;align-items:flex-end;gap:16px;padding:0 10px;box-sizing:border-box">${vals.map((v, i) => `<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:6px"><span style="font:600 11px ${F};color:${INK}">${v}</span><div style="width:100%;height:${v * 2.2}px;background:${i >= vals.length - 2 ? CORAL : NAVY};border-radius:3px 3px 0 0"></div></div>`).join('')}</div>
      <div style="position:absolute;left:54px;top:438px;width:520px;display:flex;justify-content:space-around;font:500 11px ${F};color:${GREY}">${['N1', 'N2', 'N3', 'C1', 'C2', 'S1', 'S2', 'S3'].slice(0, vals.length).map(x => `<span>${x}</span>`).join('')}</div>
      <div data-el="Text|Takeaway|fillable" style="position:absolute;right:44px;top:170px;width:270px;height:260px;background:${NAVY};border-radius:10px;padding:26px;box-sizing:border-box"><div style="font:700 11px ${F};letter-spacing:2px;color:${CORAL}">TAKEAWAY</div><div style="font:600 21px/1.35 ${F};color:#fff;margin-top:12px">${take}</div></div>
      <div data-el="Text|Source note|fillable" style="position:absolute;left:44px;top:466px;font:400 11px ${F};color:${GREY}">Thousand TEU per lane. Sample data.</div>`),
    line: (n, eb, t) => page(n, head(eb, t) + `<svg style="position:absolute;left:44px;top:170px" width="872" height="270" viewBox="0 0 872 270"><g stroke="${LINE}" stroke-width="1">${[0, 1, 2, 3, 4].map(i => `<line x1="40" x2="872" y1="${20 + i * 55}" y2="${20 + i * 55}"/>`).join('')}</g><path d="M40 200 L180 180 L320 186 L460 140 L600 120 L740 92 L860 70 L860 240 L40 240Z" fill="${CORAL2}"/><path d="M40 200 L180 180 L320 186 L460 140 L600 120 L740 92 L860 70" stroke="${CORAL}" stroke-width="4" fill="none"/><path d="M40 170 L180 168 L320 160 L460 150 L600 146 L740 140 L860 136" stroke="${NAVY}" stroke-width="3" fill="none" stroke-dasharray="8 6"/>${['Q1 25', 'Q2', 'Q3', 'Q4', 'Q1 26', 'Q2', 'Q3'].map((x, i) => `<text x="${40 + i * 137}" y="265" font-family="Avenir Next,Arial" font-size="12" fill="${GREY}">${x}</text>`).join('')}</svg>
      <div style="position:absolute;right:44px;top:120px;display:flex;gap:18px;font:600 12px ${F};color:${INK}"><span><i style="display:inline-block;width:16px;height:4px;background:${CORAL};vertical-align:middle;margin-right:6px"></i>Margin</span><span><i style="display:inline-block;width:16px;height:3px;background:${NAVY};vertical-align:middle;margin-right:6px"></i>Plan</span></div>`),
    table: (n, eb, t, rows) => page(n, head(eb, t) + `<div style="position:absolute;left:44px;right:44px;top:175px;font:500 14px ${F};color:${INK}"><div style="display:grid;grid-template-columns:2fr 1fr 1fr 1fr;background:${NAVY};color:#fff;font-weight:700;border-radius:8px 8px 0 0">${['Line', 'Plan', 'Actual', 'Variance'].map(h => `<div style="padding:12px 16px">${h}</div>`).join('')}</div>${rows.map((r, i) => `<div style="display:grid;grid-template-columns:2fr 1fr 1fr 1fr;background:${i % 2 ? WARM : '#fff'};border-bottom:1px solid ${LINE}">${r.map((c, j) => `<div style="padding:12px 16px;${j === 3 ? `color:${String(c).startsWith('-') ? CORAL : NAVY};font-weight:700` : ''}">${c}</div>`).join('')}</div>`).join('')}</div>`),
    quote: (n, q, who) => page(n, `<div style="position:absolute;left:90px;top:90px;font:700 150px/1 Georgia,serif;color:${CORAL}">“</div><div style="position:absolute;left:110px;right:120px;top:190px;font:500 30px/1.35 ${F};color:${NAVY};letter-spacing:-.3px">${q}</div><div style="position:absolute;left:110px;top:400px;font:600 14px ${F};color:${GREY}">${who}</div>`, WARM),
    donut: (n, eb, t) => page(n, head(eb, t) + `<svg style="position:absolute;left:70px;top:170px" width="250" height="250" viewBox="0 0 42 42"><circle cx="21" cy="21" r="15.9" fill="none" stroke="${NAVY2}" stroke-width="6"/><circle cx="21" cy="21" r="15.9" fill="none" stroke="${NAVY}" stroke-width="6" stroke-dasharray="72 28" stroke-dashoffset="25"/><circle cx="21" cy="21" r="15.9" fill="none" stroke="${CORAL}" stroke-width="6" stroke-dasharray="14 86" stroke-dashoffset="53"/><text x="21" y="23.5" text-anchor="middle" font-family="Avenir Next,Arial" font-weight="700" font-size="7" fill="${NAVY}">+42</text></svg>
      <div style="position:absolute;left:390px;right:44px;top:185px;display:grid;grid-template-columns:1fr 1fr;gap:18px">${[['94%', 'Gross retention', '+2 pts'], ['31', 'New accounts', '+9 vs Q2'], ['4.6', 'Support rating', 'of 5'], ['11 d', 'Onboarding time', '-3 days']].map(([v, l, d]) => `<div style="border-top:3px solid ${CORAL};padding-top:12px"><div style="font:700 34px ${F};color:${NAVY}">${v}</div><div style="font:500 13px ${F};color:${GREY};margin-top:4px">${l} · <b style="color:${CORAL}">${d}</b></div></div>`).join('')}</div>`),
    logos: (n, eb, t) => page(n, head(eb, t) + `<div style="position:absolute;left:44px;right:44px;top:180px;display:grid;grid-template-columns:repeat(4,1fr);gap:16px">${['Alder Foods', 'Brightmoor', 'Castell Retail', 'Dunmere', 'Eastholm', 'Fenwick Tools', 'Garrow Health', 'Harbourline'].map(x => `<div style="height:100px;border:1px solid ${LINE};border-radius:10px;display:grid;place-items:center;font:700 16px ${F};color:${GREY};letter-spacing:.3px">${x}</div>`).join('')}</div>`),
    twocol: (n, eb, t) => page(n, head(eb, t) + [['What worked', NAVY, ['Night slots cut dwell time 18%', 'Two new cold-chain lanes', 'Fewer manual bookings']], ['What did not', CORAL, ['Port fees up in the south', 'Driver hiring lagged plan', 'Late invoices from 3 partners']]].map(([h, c, items], i) => `<div data-el="Text|Column|fillable" style="position:absolute;top:175px;left:${44 + i * 446}px;width:426px;height:270px;background:${WARM};border-radius:10px;border-top:5px solid ${c};padding:24px;box-sizing:border-box"><div style="font:700 20px ${F};color:${c}">${h}</div>${items.map(x => `<div style="font:500 16px/1.4 ${F};color:${INK};margin-top:16px;padding-left:18px;position:relative"><span style="position:absolute;left:0;top:8px;width:7px;height:7px;border-radius:50%;background:${c}"></span>${x}</div>`).join('')}</div>`).join('')),
    process: (n, eb, t) => page(n, head(eb, t) + `<div style="position:absolute;left:44px;right:44px;top:200px;display:flex;gap:10px">${['Book', 'Load', 'Move', 'Deliver'].map((x, i) => `<div style="flex:1;height:120px;background:${i === 3 ? CORAL : NAVY};clip-path:polygon(0 0,88% 0,100% 50%,88% 100%,0 100%,12% 50%);display:grid;place-items:center;font:700 22px ${F};color:#fff">${x}</div>`).join('')}</div><div style="position:absolute;left:44px;right:44px;top:350px;display:flex;gap:10px">${['2.1 h median', '46 min', '31 h door to door', '98.2% on time'].map(x => `<div style="flex:1;text-align:center;font:600 15px ${F};color:${GREY}">${x}</div>`).join('')}</div>`),
    map: (n, eb, t) => page(n, head(eb, t) + `<svg style="position:absolute;left:44px;top:160px" width="560" height="300" viewBox="0 0 560 300"><rect width="560" height="300" rx="10" fill="${WARM}"/>${Array.from({ length: 120 }, (_, i) => { const x = 20 + (i % 15) * 36, y = 20 + Math.floor(i / 15) * 34; const on = ((i * 7) % 11) < 6; return on ? `<circle cx="${x}" cy="${y}" r="5" fill="${NAVY2}"/>` : ''; }).join('')}<circle cx="128" cy="88" r="16" fill="${CORAL}"/><circle cx="380" cy="160" r="22" fill="${NAVY}"/><circle cx="270" cy="232" r="12" fill="${CORAL}"/></svg>
      <div style="position:absolute;right:44px;top:170px;width:270px">${[['North', '41%'], ['Central', '33%'], ['South', '26%']].map(([r, v]) => `<div style="display:flex;justify-content:space-between;padding:16px 0;border-bottom:1px solid ${LINE};font:600 18px ${F};color:${NAVY}"><span>${r}</span><span style="color:${CORAL}">${v}</span></div>`).join('')}</div>`),
    timeline: (n, eb, t) => page(n, head(eb, t) + `<div style="position:absolute;left:70px;right:70px;top:280px;height:4px;background:${NAVY2}"></div>${['Jan · New TMS live', 'Apr · Cold-chain pilot', 'Jul · South hub opens', 'Oct · Partner portal'].map((x, i) => `<div style="position:absolute;top:262px;left:${70 + i * 262}px;width:40px;height:40px;border-radius:50%;background:${i === 3 ? CORAL : NAVY};border:6px solid #fff;box-sizing:border-box"></div><div style="position:absolute;top:${i % 2 ? 320 : 190}px;left:${Math.min(50 + i * 262, 690)}px;width:200px;font:600 16px/1.35 ${F};color:${NAVY};text-align:${i === 3 ? 'right' : 'left'}">${x}</div>`).join('')}`),
    team: (n, eb, t) => page(n, head(eb, t) + `<div style="position:absolute;left:44px;right:44px;top:185px;display:grid;grid-template-columns:repeat(4,1fr);gap:18px">${[['MQ', 'Mara Quinn', 'Operations'], ['DO', 'Dev Okafor', 'Network'], ['LS', 'Lena Strand', 'Customers'], ['RP', 'Rui Paiva', 'Finance']].map(([i, nm, r], k) => `<div data-el="Text|Person|fillable" style="text-align:center"><div style="width:110px;height:110px;border-radius:50%;margin:0 auto;background:${k % 2 ? CORAL2 : NAVY2};display:grid;place-items:center;font:700 30px ${F};color:${k % 2 ? CORAL : NAVY}">${i}</div><div style="font:700 17px ${F};color:${NAVY};margin-top:16px">${nm}</div><div style="font:500 13px ${F};color:${GREY};margin-top:4px">${r}</div></div>`).join('')}</div>`),
    big: (n, v, s) => page(n, `<div style="position:absolute;left:44px;top:140px;font:700 190px/1 ${F};color:${CORAL};letter-spacing:-8px">${v}</div><div style="position:absolute;left:52px;top:350px;width:640px;font:600 26px/1.35 ${F};color:${NAVY}">${s}</div>`),
    cards: (n, eb, t, items) => page(n, head(eb, t) + `<div style="position:absolute;left:44px;right:44px;top:180px;display:grid;grid-template-columns:repeat(3,1fr);gap:18px">${items.map(([h, b], i) => `<div data-el="Text|Card|fillable" style="height:250px;border:1px solid ${LINE};border-radius:10px;padding:24px;box-sizing:border-box"><div style="width:36px;height:36px;border-radius:8px;background:${i === 0 ? CORAL : NAVY};color:#fff;display:grid;place-items:center;font:700 16px ${F}">${i + 1}</div><div style="font:700 19px ${F};color:${NAVY};margin-top:18px">${h}</div><div style="font:400 14px/1.5 ${F};color:${GREY};margin-top:10px">${b}</div></div>`).join('')}</div>`),
    stacked: (n, eb, t) => page(n, head(eb, t) + `<div style="position:absolute;left:44px;right:300px;top:180px">${[['People', 46, 22], ['Fleet', 30, 18], ['Hubs', 18, 9], ['Systems', 12, 6]].map(([l, a, b]) => `<div style="display:flex;align-items:center;gap:14px;margin-bottom:22px"><span style="width:80px;font:600 14px ${F};color:${INK}">${l}</span><div style="height:34px;width:${a * 9}px;background:${NAVY};border-radius:4px 0 0 4px"></div><div style="height:34px;width:${b * 9}px;background:${CORAL};border-radius:0 4px 4px 0;margin-left:-14px"></div></div>`).join('')}</div><div style="position:absolute;right:44px;top:180px;width:220px;font:500 15px/1.5 ${F};color:${GREY}"><div style="font:700 36px ${F};color:${NAVY}">$18.4 m</div>Q4 budget, run plus change. Sample figures.</div>`),
    image: (n, eb, t) => page(n, `<div style="position:absolute;right:0;top:0;bottom:0;width:470px;background:linear-gradient(160deg,#9cc3d8 0%,#4c7ea0 45%,${NAVY} 100%)"><svg width="470" height="540" viewBox="0 0 470 540" style="position:absolute;inset:0"><path d="M0 380c60-30 120-30 180 0s120 30 180 0s80-20 110-10V540H0Z" fill="#fff" opacity=".18"/><rect x="150" y="250" width="170" height="80" rx="4" fill="${CORAL}" opacity=".85"/><rect x="170" y="230" width="60" height="22" fill="#fff" opacity=".6"/></svg></div><div style="position:absolute;left:44px;top:72px;width:400px"><div style="font:700 11px ${F};letter-spacing:2px;color:${CORAL}">${eb}</div><div style="font:700 30px/1.15 ${F};color:${NAVY};margin-top:8px">${t}</div><div style="font:400 15px/1.55 ${F};color:${GREY};margin-top:20px">The south hub opened in July and now handles a quarter of our volume, with room to double by 2027.</div></div>`),
    checklist: (n, eb, t) => page(n, head(eb, t) + `<div style="position:absolute;left:44px;right:44px;top:180px">${['Approve the Q4 hiring plan for drivers', 'Pick the partner-portal pricing model', 'Confirm the cold-chain lane budget', 'Agree the next review date'].map((x, i) => `<div style="display:flex;gap:16px;align-items:center;padding:16px 0;border-bottom:1px solid ${LINE};font:600 19px ${F};color:${NAVY}"><span style="width:28px;height:28px;border-radius:6px;border:2px solid ${i === 0 ? CORAL : NAVY};box-sizing:border-box"></span>${x}</div>`).join('')}</div>`),
    closing: (n) => `<div class="stw-fixture-slide" style="background:${NAVY}">${logo(true)}<svg style="position:absolute;right:-60px;bottom:-60px" width="360" height="360"><circle cx="180" cy="180" r="170" fill="none" stroke="${CORAL}" stroke-width="26"/></svg><div style="position:absolute;left:44px;top:200px;font:700 56px ${F};color:#fff;letter-spacing:-1px">Thank you</div><div style="position:absolute;left:46px;top:280px;font:400 18px ${F};color:#c9d2e3">Questions and discussion</div><div style="position:absolute;left:46px;top:440px;font:500 12px ${F};letter-spacing:1px;color:#9fb0cc">LEADERSHIP@TIDEWELL.EXAMPLE</div></div>`,
  };

  const D = [
    ['Title', n => L.title(n)],
    ['Agenda', n => L.agenda(n)],
    ['Section', n => L.section(n, '01', 'Performance', 'Volume, margin and plan against actual.')],
    ['KPI dashboard', n => L.kpi(n, 'PERFORMANCE', 'The quarter at a glance', [['$42.6 m', 'Revenue, Q3', '+12% vs Q2'], ['18.4%', 'Operating margin', '+1.6 pts'], ['98.2%', 'On-time delivery', 'best in 2 years'], ['1.31 m', 'TEU moved', '+9%']])],
    ['Chart + takeaway', n => L.bars(n, 'PERFORMANCE', 'Revenue by region', [62, 70, 81, 55, 58, 49, 74, 88], 'North and the new south lanes drove most of the growth.')],
    ['Line chart', n => L.line(n, 'PERFORMANCE', 'Margin is ahead of plan')],
    ['Table', n => L.table(n, 'PERFORMANCE', 'Plan against actual', [['Freight', '31.0', '33.4', '+2.4'], ['Warehousing', '6.2', '5.9', '-0.3'], ['Cold chain', '2.1', '2.6', '+0.5'], ['Other services', '0.8', '0.7', '-0.1']])],
    ['Section', n => L.section(n, '02', 'Customers', 'Retention, new accounts and what they tell us.')],
    ['Quote', n => L.quote(n, 'Tidewell moved our peak season without a single missed store delivery.', 'Head of Supply, Alder Foods (sample)')],
    ['Donut + KPIs', n => L.donut(n, 'CUSTOMERS', 'Customers are staying longer')],
    ['Logo grid', n => L.logos(n, 'CUSTOMERS', 'Accounts we added this quarter')],
    ['Two columns', n => L.twocol(n, 'CUSTOMERS', 'What worked, and what did not')],
    ['Section', n => L.section(n, '03', 'Operations', 'Network, fleet and the new south hub.')],
    ['Process', n => L.process(n, 'OPERATIONS', 'From booking to delivery')],
    ['KPI dashboard', n => L.kpi(n, 'OPERATIONS', 'Fleet and hubs', [['87%', 'Fleet utilisation', '+4 pts'], ['46 min', 'Average load time', '-9 min'], ['3', 'Hubs over capacity', 'down from 5']])],
    ['Map', n => L.map(n, 'OPERATIONS', 'Where the volume comes from')],
    ['Timeline', n => L.timeline(n, 'OPERATIONS', 'What we shipped this year')],
    ['KPI dashboard', n => L.kpi(n, 'OPERATIONS', 'Safety and service', [['0', 'Lost-time incidents', '90 days'], ['4.6', 'Driver rating', 'of 5'], ['2.1 h', 'Median booking time', '-35 min']])],
    ['Chart + takeaway', n => L.bars(n, 'OPERATIONS', 'Volume by lane, Q3', [48, 66, 72, 40, 52, 61, 84, 91], 'The two new southern lanes now carry more than any northern lane.')],
    ['Three cards', n => L.cards(n, 'OPERATIONS', 'Three options for the south', [['Expand the hub', 'Add 40% capacity by Q2 2027.'], ['Partner up', 'Share space with a regional carrier.'], ['Hold', 'Wait for Q1 demand before deciding.']])],
    ['Team', n => L.team(n, 'OPERATIONS', 'Who leads each area')],
    ['Section', n => L.section(n, '04', 'Outlook', 'Budget, risks and our Q4 priorities.')],
    ['Big number', n => L.big(n, '+18%', 'Volume we expect in Q4, led by the south hub and cold chain.')],
    ['Table', n => L.table(n, 'OUTLOOK', 'Risks we are watching', [['Port fees', 'Medium', 'High', 'Hedge'], ['Driver supply', 'High', 'Medium', 'Hire'], ['Fuel price', 'Medium', 'Medium', 'Index'], ['IT cutover', 'Low', 'High', 'Pilot']])],
    ['Three cards', n => L.cards(n, 'OUTLOOK', 'Q4 priorities', [['Hire 60 drivers', 'Close the gap before peak season.'], ['Launch the portal', 'Self-serve booking for partners.'], ['Price cold chain', 'Move pilots to contracts.']])],
    ['Stacked bars', n => L.stacked(n, 'OUTLOOK', 'Where the Q4 budget goes')],
    ['Picture + text', n => L.image(n, 'OUTLOOK', 'The south hub, three months in')],
    ['Checklist', n => L.checklist(n, 'DECISIONS', 'What we need from you today')],
    ['Section', n => L.section(n, 'A', 'Appendix', 'Detail tables and definitions.')],
    ['Closing', n => L.closing(n)],
  ];

  const LAYOUT_IDS = ['title', 'agenda', 'section', 'kpi', 'chart_takeaway', 'line_chart', 'table', 'section', 'quote', 'kpi', 'three_cards', 'two_columns',
    'section', 'three_cards', 'kpi', 'picture_text', 'timeline', 'kpi', 'chart_takeaway', 'three_cards', 'team', 'section', 'big_number', 'table', 'three_cards',
    'chart_takeaway', 'picture_text', 'agenda', 'section', 'title'];
  return { D, LAYOUT_IDS };
};

let built = null;
const deck = () => (built ||= build());

export const TEMPLATE_MOCK_DESIGNS = 30;

/** 0-based slide index -> design (the 30 designs repeat for longer mock decks). */
const design = (index: number): number => ((index % TEMPLATE_MOCK_DESIGNS) + TEMPLATE_MOCK_DESIGNS) % TEMPLATE_MOCK_DESIGNS;

export function mockSlideLabel(index: number): string {
  return deck().D[design(index)][0];
}

export function mockSlideLayout(index: number): string {
  return deck().LAYOUT_IDS[design(index)];
}

/** The slide's HTML, with a stable id on every element (s<n>-e<k>) so events can name elements. */
export function mockSlideHtml(index: number): string {
  let k = 0;
  return deck().D[design(index)][1](index + 1).replace(/data-el="/g, () => `data-el-id="s${index + 1}-e${++k}" data-el="`);
}

/** The elements of a slide, in drawing order: id, kind, role, policy. */
export function mockSlideElements(index: number): Array<{ id: string; kind: string; role: string; policy: 'fixed' | 'fillable' }> {
  const out: Array<{ id: string; kind: string; role: string; policy: 'fixed' | 'fillable' }> = [];
  const re = /data-el-id="([^"]+)" data-el="([^"|]+)\|([^"|]+)\|([^"|]+)"/g;
  const html = mockSlideHtml(index);
  let m;
  while ((m = re.exec(html))) out.push({ id: m[1], kind: m[2], role: m[3], policy: m[4] === 'fixed' ? 'fixed' : 'fillable' });
  return out;
}
