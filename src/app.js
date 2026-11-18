import { h, render, Component } from 'preact';
import htm from 'htm';
import { store, uid } from './store.js';
import { drawAtom, drawDust, drawTime, makeDust } from './canvas.js';
const html = htm.bind(h);

const TYPES = { trabalho: { l: 'Trabalho', c: '#8CC2FF' }, pessoal: { l: 'Pessoal', c: '#8EF0C4' }, ideia: { l: 'Ideia', c: '#D4B8FF' }, versiculo: { l: 'Versículo', c: '#F2D27A' } };
const PRIOS = { urgente: { l: 'Urgente', c: '#FF5A5F', o: 0 }, importante: { l: 'Importante', c: '#FFA53D', o: 1 }, normal: { l: 'Normal', c: '#4EA8FF', o: 2 }, umdia: { l: 'Um dia', c: '#9AA6BC', o: 3 } };
const MOODS = {
  paz: { l: 'Em paz', e: [140, 240, 255], net: [79, 168, 255], c: ['#1E4FD8', '#4FA8FF', '#1B2F8A'] },
  animado: { l: 'Animado', e: [255, 210, 120], net: [255, 140, 180], c: ['#C2410C', '#FF8CB4', '#9D174D'] },
  focado: { l: 'Focado', e: [120, 220, 255], net: [150, 130, 255], c: ['#5B21B6', '#9682FF', '#1E3A8A'] },
  grato: { l: 'Grato', e: [255, 215, 120], net: [90, 225, 180], c: ['#047857', '#5AE1B4', '#A16207'] },
  cansado: { l: 'Cansado', e: [190, 200, 230], net: [140, 155, 190], c: ['#1E293B', '#8C9BBE', '#334155'] },
  preocupado: { l: 'Preocupado', e: [190, 140, 255], net: [235, 125, 100], c: ['#7F1D1D', '#EB7D64', '#3B0764'] }
};
const WD = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'], WL = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
const MO = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'], ML = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const pad = n => ('0' + n).slice(-2);
const iso = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
const parse = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const addDays = (s, n) => { const d = parse(s); d.setDate(d.getDate() + n); return iso(d); };
const today = () => iso(new Date());
const info = s => { const d = parse(s); return { w: WD[d.getDay()], wl: WL[d.getDay()], n: d.getDate(), m: MO[d.getMonth()], ml: ML[d.getMonth()] }; };
const nowHM = () => { const d = new Date(); return pad(d.getHours()) + ':' + pad(d.getMinutes()); };
const SLOTS = [[960, 380], [320, 380], [880, 620], [400, 620], [900, 110], [380, 110], [1130, 250], [1130, 500], [640, 600], [640, 100], [200, 250], [200, 520]];
function freeSlot(list) {
  for (const s of SLOTS) if (list.every(c => Math.abs(c.x - s[0]) >= 220 || Math.abs(c.y - s[1]) >= 100)) return s;
  return [300 + Math.random() * 680, 120 + Math.random() * 480];
}
function clean(src) {
  const d = new DOMParser().parseFromString('<div>' + (src || '') + '</div>', 'text/html');
  d.querySelectorAll('script,style,iframe,object,embed,link,meta,img,svg').forEach(n => n.remove());
  d.querySelectorAll('*').forEach(el => [...el.attributes].forEach(a => { if (/^on/i.test(a.name) || /javascript:/i.test(a.value) || a.name === 'class' || a.name === 'id') el.removeAttribute(a.name); }));
  return d.body.firstChild.innerHTML;
}
const fmt = (cmd, val) => e => { e.preventDefault(); try { document.execCommand('styleWithCSS', false, true); document.execCommand(cmd, false, val); } catch (_) { } };
const F = { B: fmt('bold'), I: fmt('italic'), U: fmt('underline'), H: fmt('hiliteColor', 'rgba(232,196,106,.38)'), S: fmt('fontSize', '2'), L: fmt('fontSize', '5') };

class Editable extends Component {
  componentDidMount() { this.el.innerHTML = clean(this.props.html); if (this.props.elRef) this.props.elRef(this.el); }
  shouldComponentUpdate(np) { if (np.ph !== this.props.ph && this.el) this.el.setAttribute('data-ph', np.ph); return false; }
  render(p) {
    return html`<div ref=${e => this.el = e} class="ed" contenteditable="true" data-ph=${p.ph} aria-label=${p.label} style=${p.style}
      onInput=${e => { clearTimeout(this.t); const v = e.currentTarget.innerHTML; this.t = setTimeout(() => p.onChange && p.onChange(v), 400); }}
      onBlur=${e => { clearTimeout(this.t); p.onChange && p.onChange(e.currentTarget.innerHTML); }}></div>`;
  }
}
class TitleEdit extends Component {
  componentDidMount() { this.el.textContent = this.props.text; }
  shouldComponentUpdate() { return false; }
  render(p) {
    return html`<div ref=${e => this.el = e} contenteditable="true" aria-label="Título" style=${p.style}
      onKeyDown=${e => { if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur(); } }}
      onBlur=${e => { const t = e.currentTarget.textContent.trim(); if (t && t !== p.text) p.onChange(t); else e.currentTarget.textContent = p.text; }}></div>`;
  }
}
const Toolbar = ({ full }) => html`<div style="display:flex;gap:6px;flex-wrap:wrap;justify-content:inherit">
  <button class="chip" onMouseDown=${F.B} aria-label="Negrito" style="font-weight:800">B</button>
  <button class="chip" onMouseDown=${F.I} aria-label="Itálico" style="font-style:italic">I</button>
  <button class="chip" onMouseDown=${F.U} aria-label="Sublinhar" style="text-decoration:underline">U</button>
  <button class="chip" onMouseDown=${F.H} style="background:rgba(232,196,106,.18);color:#F2D78E;font-size:13px">Grifar</button>
  ${full && html`<button class="chip" onMouseDown=${F.S} aria-label="Diminuir letra" style="font-size:12px">A−</button>
  <button class="chip" onMouseDown=${F.L} aria-label="Aumentar letra" style="font-size:16px">A+</button>`}
</div>`;
const Chev = ({ d }) => html`<svg width="12" height="12" viewBox="0 0 14 14" aria-hidden="true"><path d=${d ? 'M5 2l5 5-5 5' : 'M9 2L4 7l5 5'} fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"></path></svg>`;
const Star = ({ s = 16 }) => html`<svg width=${s} height=${s} viewBox="0 0 16 16" aria-hidden="true" style="flex-shrink:0;margin-top:5px;filter:drop-shadow(0 0 6px #FFC24D)"><path d="M8 1l1.8 4.6L14.5 6l-3.6 3 1.2 4.8L8 11.3 3.9 13.8 5.1 9 1.5 6l4.7-.4z" fill="#FFC24D"></path></svg>`;
const Gear = () => html`<svg width="15" height="15" viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="2.3" fill="none" stroke="currentColor" stroke-width="1.4"></circle><path d="M8 1.5v2M8 12.5v2M1.5 8h2M12.5 8h2M3.4 3.4l1.4 1.4M11.2 11.2l1.4 1.4M3.4 12.6l1.4-1.4M11.2 4.8l1.4-1.4" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"></path></svg>`;

class App extends Component {
  constructor() {
    super();
    this.state = { phase: 'sleep', view: 'mente', day: today(), sel: null, draft: '', subDraft: '', baseDraft: '', moodOpen: false, clock: nowHM(), diaryOpen: null, pendOpen: false, settings: false, v: 0, ...this.measure() };
    this.anim = { at: 0, as: 1.25, cy: 330, wakeT: 0 };
    this.drag = null;
    this.dustPC = makeDust(130, 1280, 800); this.dustM = makeDust(60, 390, 900);
  }
  measure() {
    const W = window.innerWidth, H = window.innerHeight, mobile = W < 760;
    if (mobile) { const s = W / 390; return { mobile, scale: s, SW: 390, SH: Math.max(640, H / s) }; }
    return { mobile, scale: Math.min(W / 1280, H / 800), SW: 1280, SH: 800 };
  }
  componentDidMount() {
    this.unsub = store.on(() => this.setState({ v: this.state.v + 1 }));
    this.onResize = () => this.setState(this.measure()); window.addEventListener('resize', this.onResize);
    this.clk = setInterval(() => this.setState({ clock: nowHM() }), 15000);
    const loop = () => { this.frame(); this.raf = requestAnimationFrame(loop); }; this.raf = requestAnimationFrame(loop);
  }
  componentWillUnmount() { this.unsub(); clearInterval(this.clk); cancelAnimationFrame(this.raf); window.removeEventListener('resize', this.onResize); }

  // ---------- dados ----------
  moodOf(d) { const m = store.get('moods', d); return m ? m.mood : null; }
  get mood() { return this.moodOf(today()) || 'paz'; }
  items(d) { return store.list('items').filter(i => i.day === d).sort((a, b) => (a.created || 0) - (b.created || 0)); }
  pendList() { const t = today(); return store.list('items').filter(i => i.day < t && !i.done && !i.pulled && !i.kept).sort((a, b) => a.day < b.day ? 1 : -1); }
  isPend(i) { return i.day < today() && !i.done && !i.pulled && !i.kept; }
  addThought(day, title, extra) { const x = freeSlot(this.items(day)); return store.put('items', Object.assign({ id: uid(), day, title, type: 'ideia', prio: 'normal', note: '', subs: [], done: 0, pulled: 0, kept: 0, x: x[0], y: x[1], created: Date.now() }, extra || {})); }
  pull(i) { this.addThought(today(), i.title, { type: i.type, prio: i.prio, note: i.note, subs: (i.subs || []).slice() }); store.patch('items', i.id, { pulled: 1 }); }
  wake = () => {
    if (this.state.phase !== 'sleep') return;
    this.setState({ phase: 'greet' });
    setTimeout(() => this.setState({ phase: this.moodOf(today()) ? 'awake' : 'mood' }), 1400);
  };
  pickMood(m) { store.put('moods', { id: today(), mood: m }); this.setState({ phase: 'awake', moodOpen: false }); }
  drop = () => { const t = this.state.draft.trim(); if (!t) return; this.addThought(this.state.day, t); this.setState({ draft: '' }); };
  saveDiary = () => {
    const el = this.diaryEl, t = el ? el.innerText.trim() : ''; if (!t) return;
    store.put('diary', { id: uid(), day: today(), time: nowHM(), mood: this.mood, html: clean(el.innerHTML) });
    el.innerHTML = '';
  };
  addBase = () => { const t = this.state.baseDraft.trim(); if (!t) return; store.put('base', { id: uid(), text: t, sub: 'PRINCÍPIO', ord: Date.now() }); this.setState({ baseDraft: '' }); };

  // ---------- canvas ----------
  frame() {
    const c = this.ctx; if (!c) return;
    const s = this.state, t = performance.now() / 1000, M = MOODS[this.mood], ns = M.net.join(','), es = M.e.join(','), awake = s.phase === 'awake', A = this.anim;
    const dpr = Math.min(2, (window.devicePixelRatio || 1) * s.scale), W = s.SW, H = s.SH;
    if (this.cv.width !== Math.round(W * dpr)) { this.cv.width = Math.round(W * dpr); this.cv.height = Math.round(H * dpr); }
    c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, W, H); c.globalCompositeOperation = 'lighter';
    if (s.phase !== 'sleep') A.wakeT = Math.min(1, A.wakeT + 0.008);
    let ta, ty, ox;
    if (s.mobile) { ta = awake ? 0.42 : 0.95; ty = awake ? 128 : H * 0.43; ox = 195; } else { ta = awake ? 0.85 : 1.25; ty = awake ? 345 : 330; ox = 640; }
    A.as += (ta - A.as) * 0.05; A.cy += (ty - A.cy) * 0.05;
    drawDust(c, t, ns, awake ? (s.view === 'mente' ? 1 : 0.6) : 0.35, s.mobile ? this.dustM : this.dustPC);
    if (!awake || s.view === 'mente') drawAtom(c, t, ns, es, s.phase === 'sleep', A, ox);
    if (awake && s.view === 'tempo') { const T = this.timeline(); drawTime(c, t, ns, T.pts, T.pend, T.today, s.mobile); }
  }
  timeline() {
    const t = today(), m = this.state.mobile, days = [];
    for (let i = -5; i <= 2; i++) days.push(addDays(t, i));
    const pts = days.map((d, i) => m ? [78 + Math.sin(i * 0.95 + 0.4) * 26, 200 + i * 72] : [150 + i * 140, 430 + Math.sin(i * 0.95 + 0.4) * 70]);
    const pend = days.map(d => this.items(d).filter(i => this.isPend(i)).length);
    return { days, pts, pend, today: 5 };
  }

  // ---------- arrastar (PC) ----------
  move = e => {
    const d = this.drag; if (!d) return;
    const r = this.stageEl.getBoundingClientRect(), k = r.width / 1280, dx = (e.clientX - d.sx) / k, dy = (e.clientY - d.sy) / k;
    if (!d.moved && Math.abs(dx) + Math.abs(dy) < 5) return; d.moved = true;
    d.x = Math.max(115, Math.min(1165, d.ox + dx)); d.y = Math.max(90, Math.min(640, d.oy + dy));
    if (d.el) { d.el.style.left = (d.x - 115) + 'px'; d.el.style.top = (d.y - 55) + 'px'; }
  };
  up = () => { const d = this.drag; if (!d) return; this.drag = null; if (d.moved) store.patch('items', d.id, { x: Math.round(d.x), y: Math.round(d.y) }); else this.setState({ sel: d.id, subDraft: '' }); };

  // ---------- partes comuns ----------
  common() {
    const s = this.state, M = MOODS[this.mood], acc = M.c[1];
    return { s, M, acc, a30: acc + '4D', a50: acc + '80', awake: s.phase === 'awake', sleep: s.phase === 'sleep' };
  }
  moodPicker(top) {
    return html`<div class="fadein" style=${`position:absolute;left:16px;right:16px;top:${top}px;z-index:7;display:flex;flex-direction:column;align-items:center;gap:14px`}>
      <div style="font-size:12px;letter-spacing:4px;color:rgba(232,238,248,.65)">COMO VOCÊ ESTÁ HOJE?</div>
      <div style="display:flex;gap:10px;flex-wrap:wrap;justify-content:center">
        ${Object.keys(MOODS).map(m => html`<button class="btn" onClick=${() => this.pickMood(m)} style=${`height:44px;padding:0 20px;border-radius:22px;border:0;background:rgba(255,255,255,.07);color:#F1F6FF;font-size:14px;display:flex;align-items:center;gap:10px;box-shadow:0 0 24px ${MOODS[m].c[1]}33`}><span style=${`width:10px;height:10px;border-radius:50%;background:${MOODS[m].c[1]};box-shadow:0 0 10px ${MOODS[m].c[1]}`}></span>${MOODS[m].l}</button>`)}
      </div></div>`;
  }
  syncDot() { const st = store.status; return st === 'ok' ? '#4ADE80' : st === 'erro' ? '#F87171' : st === 'sync' ? '#FBBF24' : 'rgba(255,255,255,.35)'; }
  settingsPanel() {
    const m = store.meta, s = this.state;
    const save = () => { store.setConfig(this.urlIn.value, this.tokIn.value); };
    const exp = () => { const b = new Blob([store.exportJSON()], { type: 'application/json' }); const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = 'espaco-criativo-backup-' + today() + '.json'; a.click(); };
    const imp = e => { const f = e.target.files[0]; if (!f) return; f.text().then(t => { try { store.importJSON(t); alertMsg('Backup importado.'); } catch (er) { alertMsg('Arquivo inválido.'); } }); };
    const alertMsg = t => this.setState({ setMsg: t });
    const stTxt = { local: 'Só neste aparelho (sem sincronização)', sync: 'Sincronizando…', ok: 'Conectado · ' + store.statusMsg, erro: 'Erro: ' + store.statusMsg }[store.status];
    return html`<div class="fadein" style="position:fixed;inset:0;z-index:50;background:rgba(3,5,12,.94);overflow-y:auto" onClick=${e => { if (e.target === e.currentTarget) this.setState({ settings: false }); }}>
      <div style="max-width:440px;margin:0 auto;padding:60px 24px;display:flex;flex-direction:column;gap:16px">
        <div class="sg" style="font-size:22px;font-weight:300;letter-spacing:5px">AJUSTES</div>
        <div style="font-size:11px;letter-spacing:3px;color:rgba(232,238,248,.55);margin-top:10px">SINCRONIZAÇÃO (TURSO)</div>
        <div style="display:flex;align-items:center;gap:8px;font-size:13px"><span style=${`width:8px;height:8px;border-radius:50%;background:${this.syncDot()}`}></span>${stTxt}</div>
        <label style="font-size:12px;color:rgba(232,238,248,.6)">Endereço do banco<input ref=${el => this.urlIn = el} class="field" placeholder="libsql://seu-banco.turso.io" value=${m.url} /></label>
        <label style="font-size:12px;color:rgba(232,238,248,.6)">Token<input ref=${el => this.tokIn = el} class="field" type="password" placeholder="cole o token aqui" value=${m.token} /></label>
        <button class="btn" onClick=${save} style="height:44px;border-radius:22px;border:0;background:rgba(79,168,255,.3);color:#fff;font-size:14px">Conectar e sincronizar</button>
        <div style="font-size:11px;letter-spacing:3px;color:rgba(232,238,248,.55);margin-top:18px">BACKUP</div>
        <button class="btn" onClick=${exp} style="height:44px;border-radius:22px;border:0;background:rgba(255,255,255,.08);color:#fff;font-size:14px">Baixar backup (arquivo)</button>
        <label class="btn" style="height:44px;border-radius:22px;background:rgba(255,255,255,.08);color:#fff;font-size:14px;display:flex;align-items:center;justify-content:center">Restaurar backup<input type="file" accept=".json,application/json" onChange=${imp} style="display:none" /></label>
        ${s.setMsg && html`<div style="font-size:13px;color:#8EF0C4">${s.setMsg}</div>`}
        <button class="btn" onClick=${() => this.setState({ settings: false, setMsg: '' })} style="height:44px;border-radius:22px;border:0;background:none;color:rgba(232,238,248,.7);font-size:14px;margin-top:10px">Fechar</button>
      </div></div>`;
  }

  // ---------- render ----------
  render() {
    const s = this.state, M = MOODS[this.mood];
    const stageStyle = s.mobile
      ? `position:absolute;left:0;top:0;width:390px;height:${s.SH}px;transform:scale(${s.scale});transform-origin:0 0;overflow:hidden;user-select:none`
      : `position:absolute;left:50%;top:50%;width:1280px;height:800px;margin-left:-640px;margin-top:-400px;transform:scale(${s.scale});overflow:hidden;user-select:none`;
    const neb = s.phase === 'sleep' ? 0.08 : 0.42;
    return html`<div style="position:fixed;inset:0;background:#02040A;overflow:hidden" onPointerMove=${this.move} onPointerUp=${this.up} onPointerCancel=${this.up}>
      <div aria-hidden="true" style="position:absolute;inset:0">
        <div class="drift" style=${`position:absolute;left:-15vw;top:-25vh;width:60vw;height:78vh;border-radius:50%;background:${M.c[0]};filter:blur(130px);opacity:${neb};transition:background-color 2.5s,opacity 2s`}></div>
        <div class="drift" style=${`position:absolute;left:55vw;top:48vh;width:60vw;height:70vh;border-radius:50%;background:${M.c[2]};filter:blur(140px);opacity:${neb};animation-delay:-12s;transition:background-color 2.5s,opacity 2s`}></div>
        <div style="position:absolute;inset:0;background:radial-gradient(ellipse at center,transparent 40%,rgba(1,2,6,.85) 100%)"></div>
      </div>
      <div ref=${el => this.stageEl = el} style=${stageStyle}>
        <canvas ref=${el => { this.cv = el; this.ctx = el ? el.getContext('2d') : null; }} aria-hidden="true" style=${`position:absolute;left:0;top:0;width:${s.SW}px;height:${s.SH}px;z-index:1;pointer-events:none`}></canvas>
        ${s.mobile ? this.renderMobile() : this.renderPC()}
      </div>
      ${s.settings && this.settingsPanel()}
    </div>`;
  }

  renderPC() {
    const { s, M, acc, a30, a50, awake, sleep } = this.common();
    const D = info(s.day), isToday = s.day === today(), list = this.items(s.day), sel = list.find(i => i.id === s.sel);
    const pend = this.pendList(), open = list.filter(c => !c.done && !c.pulled).length;
    return html`
      ${sleep && html`<button class="btn" aria-label="Acordar" onClick=${this.wake} style="position:absolute;left:440px;top:150px;width:400px;height:360px;border:0;background:none;z-index:4"></button>
        <div class="fadein" style="position:absolute;left:0;right:0;top:600px;text-align:center;z-index:5;pointer-events:none"><div class="sg" style="font-size:13px;letter-spacing:5px;color:rgba(232,238,248,.6)">TOQUE NO ÁTOMO PARA ACORDAR</div></div>`}
      ${(s.phase === 'mood' || (awake && s.moodOpen)) && this.moodPicker(awake ? 560 : 650)}
      ${awake && html`
        <div class="fadein" style="position:absolute;left:36px;top:28px;z-index:5;display:flex;align-items:center;gap:14px">
          ${s.view === 'mente' && html`<button class="btn" aria-label="Dia anterior" onClick=${() => this.setState({ day: addDays(s.day, -1), sel: null })} style="width:36px;height:36px;border-radius:50%;border:0;background:rgba(255,255,255,.06);color:#E8EEF8;display:flex;align-items:center;justify-content:center"><${Chev} /></button>`}
          <div><div class="sg" style=${`font-size:13px;letter-spacing:4px;color:${acc}`}>${D.w} · ${D.n} ${D.m}${isToday ? ' · HOJE' : ''}</div>
            <div class="sg" style="font-size:22px;font-weight:300;letter-spacing:1px">${s.clock}</div></div>
          ${s.view === 'mente' && html`<button class="btn" aria-label="Próximo dia" onClick=${() => this.setState({ day: addDays(s.day, 1), sel: null })} style="width:36px;height:36px;border-radius:50%;border:0;background:rgba(255,255,255,.06);color:#E8EEF8;display:flex;align-items:center;justify-content:center"><${Chev} d /></button>`}
          ${s.view === 'mente' && !isToday && html`<button class="btn" onClick=${() => this.setState({ day: today(), sel: null })} style="height:32px;padding:0 12px;border-radius:16px;border:0;background:rgba(255,255,255,.06);color:#E8EEF8;font-size:11px;letter-spacing:2px">HOJE</button>`}
        </div>
        <div class="fadein" style="position:absolute;right:36px;top:30px;z-index:5;display:flex;gap:10px">
          <button class="btn" onClick=${() => this.setState({ moodOpen: !s.moodOpen })} style="height:40px;padding:0 18px;border-radius:20px;border:0;background:rgba(255,255,255,.06);color:#E8EEF8;font-size:12px;letter-spacing:2px;display:flex;align-items:center;gap:10px"><span style=${`width:9px;height:9px;border-radius:50%;background:${acc};box-shadow:0 0 10px ${acc}`}></span>HUMOR · ${M.l.toUpperCase()}</button>
          <button class="btn" aria-label="Ajustes" onClick=${() => this.setState({ settings: true })} style="position:relative;width:40px;height:40px;border-radius:50%;border:0;background:rgba(255,255,255,.06);color:#E8EEF8;display:flex;align-items:center;justify-content:center"><${Gear} /><span style=${`position:absolute;right:6px;top:6px;width:7px;height:7px;border-radius:50%;background:${this.syncDot()}`}></span></button>
        </div>

        ${s.view === 'mente' && html`
          <div class="fadein" style="position:absolute;left:0;right:0;top:470px;text-align:center;z-index:2;pointer-events:none"><div class="sg" style="font-size:12px;letter-spacing:5px;color:rgba(232,238,248,.7)">${open} ${open === 1 ? 'PENSAMENTO VIVO' : 'PENSAMENTOS VIVOS'}</div></div>
          ${list.map((c, i) => {
            const p = PRIOS[c.prio], t = TYPES[c.type], pd = this.isPend(c);
            return html`<div key=${c.id} onPointerDown=${e => { e.stopPropagation(); this.drag = { id: c.id, sx: e.clientX, sy: e.clientY, ox: c.x, oy: c.y, x: c.x, y: c.y, moved: false, el: e.currentTarget }; }}
              style=${`position:absolute;left:${c.x - 115}px;top:${c.y - 55}px;width:230px;height:110px;z-index:3;opacity:${(c.done || c.pulled) ? 0.4 : (pd ? 0.75 : 1)};touch-action:none;cursor:grab;transition:opacity .4s`}>
              <div class="rise" style=${`position:absolute;inset:0;animation-delay:${(0.3 + i * 0.12).toFixed(2)}s`}>
                <div class="haze" style=${`position:absolute;left:-30px;right:-30px;top:-34px;bottom:-34px;border-radius:50%;background:radial-gradient(closest-side,${p.c}40,transparent);filter:blur(16px);animation-delay:${((i * 1.3) % 6).toFixed(1)}s`}></div>
                <div class="flt" style=${`position:relative;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;gap:5px;padding:0 10px;animation-delay:${((i * 1.3) % 6).toFixed(1)}s`}>
                  <span style=${`font-size:10px;letter-spacing:3px;text-transform:uppercase;color:${t.c}`}>${t.l}</span>
                  <span style=${`font-size:17px;font-weight:600;line-height:1.3;color:#fff;text-shadow:0 1px 14px rgba(0,0,0,.9),0 0 3px rgba(0,0,0,.7);text-decoration:${c.done ? 'line-through' : 'none'}`}>${c.title}</span>
                  <span style="font-size:11px;color:rgba(255,255,255,.8);text-shadow:0 1px 8px rgba(0,0,0,.8)">${pd ? 'ficou pra trás' : c.pulled ? 'puxado pra hoje' : (c.subs && c.subs.length ? c.subs.length + (c.subs.length === 1 ? ' sub-ideia' : ' sub-ideias') : '')}</span>
                </div></div></div>`;
          })}
          ${!list.length && html`<div class="fadein" style="position:absolute;left:0;right:0;top:560px;text-align:center;z-index:2;color:rgba(232,238,248,.5);font-size:14px">Mente livre. Solte um pensamento aqui embaixo.</div>`}
          ${isToday && pend.length > 0 && html`<div class="fadein noscroll" style="position:absolute;left:28px;top:160px;width:200px;max-height:520px;overflow-y:auto;z-index:5;display:flex;flex-direction:column;gap:22px;padding:10px 4px">
            <div style="font-size:10px;letter-spacing:3px;color:#FFB86B">FICOU PRA TRÁS</div>
            ${pend.map(o => { const di = info(o.day); return html`<div key=${o.id} style="position:relative;padding:6px 4px">
              <div aria-hidden="true" style="position:absolute;inset:-12px;border-radius:50%;background:radial-gradient(closest-side,rgba(255,165,61,.22),transparent);filter:blur(10px)"></div>
              <div style="position:relative;font-size:14px;color:rgba(241,246,255,.9);line-height:1.3">${o.title}</div>
              <div style="position:relative;font-size:11px;color:rgba(255,194,122,.8);margin-top:3px">de ${di.wl.toLowerCase()}, ${di.n} · ${PRIOS[o.prio].l.toLowerCase()}</div>
              <div style="position:relative;display:flex;gap:6px;margin-top:8px">
                <button class="btn" onClick=${() => this.pull(o)} style="height:30px;padding:0 12px;border-radius:15px;border:0;background:rgba(255,165,61,.2);color:#FFD3A1;font-size:12px">puxar pra hoje</button>
                <button class="btn" onClick=${() => store.patch('items', o.id, { kept: 1 })} style="height:30px;padding:0 12px;border-radius:15px;border:0;background:rgba(255,255,255,.06);color:rgba(232,238,248,.75);font-size:12px">deixar ir</button>
              </div></div>`; })}
          </div>`}
          ${!s.moodOpen && html`<div class="fadein" style="position:absolute;left:380px;width:520px;top:672px;z-index:5">
            <label for="drop" class="sr">Soltar pensamento</label>
            <input id="drop" class="drop" value=${s.draft} onInput=${e => this.setState({ draft: e.currentTarget.value })} onKeyDown=${e => { if (e.key === 'Enter') this.drop(); }} placeholder="Solte um pensamento e aperte Enter…" style=${`width:100%;height:44px;border:0;border-bottom:1px solid ${a50};background:transparent;color:#F1F6FF;font-size:16px;text-align:center;font-family:Inter,sans-serif;user-select:text`} />
            <div aria-hidden="true" style="height:1px;margin:0 120px;background:#FFC24D;box-shadow:0 0 14px #FFC24D"></div></div>`}
        `}
        ${s.view === 'tempo' && this.timePC(acc)}
        ${s.view === 'diario' && this.diaryPC(acc, a30)}
        ${s.view === 'base' && this.basePC()}
        <nav class="fadein" style="position:absolute;left:0;right:0;top:742px;z-index:5;display:flex;justify-content:center;gap:40px">
          ${[['mente', 'MENTE'], ['tempo', 'FIO DO TEMPO'], ['diario', 'DIÁRIO'], ['base', 'BASE']].map(n => { const on = s.view === n[0], dot = on ? (n[0] === 'base' ? '#FFC24D' : acc) : 'transparent'; return html`<button class="btn" onClick=${() => this.setState({ view: n[0], sel: null, moodOpen: false })} style=${`height:44px;border:0;background:none;color:${on ? '#F1F6FF' : 'rgba(232,238,248,.5)'};font-size:12px;letter-spacing:4px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px`}>${n[1]}<span style=${`width:5px;height:5px;border-radius:50%;background:${dot};box-shadow:0 0 8px ${dot}`}></span></button>`; })}
        </nav>
      `}
      ${sel && this.focusPC(sel)}`;
  }
  timePC(acc) {
    const T = this.timeline();
    return html`<div class="fadein" style="position:absolute;left:0;right:0;top:92px;text-align:center;z-index:5;pointer-events:none">
        <div class="sg" style="font-size:26px;font-weight:300;letter-spacing:6px">FIO DO TEMPO</div>
        <div style="font-size:13px;color:rgba(232,238,248,.55);margin-top:8px">Toque num dia para entrar nele · em laranja: o que ficou pra trás</div></div>
      ${T.days.map((d, i) => { const di = info(d), cnt = this.items(d).length, pn = T.pend[i], td = i === 5; return html`<button key=${d} class="btn fadein" onClick=${() => this.setState({ day: d, view: 'mente', sel: null })} style=${`position:absolute;left:${T.pts[i][0] - 60}px;top:${T.pts[i][1] - 60}px;width:120px;height:150px;border:0;background:none;color:#E8EEF8;padding:0;z-index:4;animation-delay:${(0.1 + i * 0.08).toFixed(2)}s`}>
        <div style="position:absolute;left:0;right:0;top:92px;text-align:center"><div class="sg" style=${`font-size:13px;letter-spacing:3px;color:${td ? acc : 'rgba(232,238,248,.85)'}`}>${di.w} ${di.n}</div>
        <div style=${`font-size:11px;color:${pn ? '#FFC27A' : 'rgba(232,238,248,.5)'};margin-top:4px`}>${td ? 'hoje' : pn ? pn + ' pra trás' : cnt + (cnt === 1 ? ' pensamento' : ' pensamentos')}</div></div></button>`; })}`;
  }
  diaryData() {
    const s = this.state, dk = s.diaryOpen || today(), all = store.list('diary');
    const entries = all.filter(e => e.day === dk).sort((a, b) => a.time < b.time ? -1 : 1);
    const byDay = {}; all.forEach(e => { if (e.day !== today()) (byDay[e.day] = byDay[e.day] || []).push(e); });
    const mem = Object.keys(byDay).sort().reverse().map(k => { const l = byDay[k].sort((a, b) => a.time < b.time ? -1 : 1), e = l[l.length - 1], di = info(k), tmp = document.createElement('div'); tmp.innerHTML = e.html; const tx = tmp.innerText || tmp.textContent || ''; return { k, date: (di.wl + ', ' + di.n + ' ' + di.m.toLowerCase()).toUpperCase(), n: l.length + (l.length === 1 ? ' registro' : ' registros'), snip: tx.length > 70 ? tx.slice(0, 70) + '…' : tx, c: (MOODS[e.mood] || MOODS.paz).c[1] }; });
    return { dk, entries, mem, di: info(dk), past: !!s.diaryOpen };
  }
  entryList(entries, di, big) {
    return entries.map(e => html`<div key=${e.id} class="risem" style="padding:14px 0 16px;border-bottom:1px solid rgba(255,255,255,.07)">
      <div style=${`display:flex;align-items:center;gap:8px;font-size:11px;letter-spacing:2px;color:${(MOODS[e.mood] || MOODS.paz).c[1]}`}><span style=${`width:6px;height:6px;border-radius:50%;background:${(MOODS[e.mood] || MOODS.paz).c[1]}`}></span>${(di.wl + ', ' + di.n + ' ' + di.m.toLowerCase() + ' · ' + e.time).toUpperCase()}</div>
      <div style=${`font-size:${big ? 17 : 16}px;line-height:1.7;font-weight:300;color:#F1F6FF;margin-top:6px;user-select:text;word-wrap:break-word`} dangerouslySetInnerHTML=${{ __html: clean(e.html) }}></div></div>`);
  }
  diaryPC(acc, a30) {
    const { dk, entries, mem, di, past } = this.diaryData(), M = MOODS[this.mood];
    const MP = [[880, 150], [960, 290], [880, 430], [960, 570]];
    return html`<div class="fadein" style="position:absolute;inset:0;z-index:3">
      <div class="noscroll" style="position:absolute;left:0;top:80px;width:840px;height:650px;overflow-y:auto">
        <div style="padding:20px 0 40px 120px;width:640px;display:flex;flex-direction:column;gap:14px">
          <div style=${`font-size:11px;letter-spacing:4px;color:${acc}`}>DIÁRIO</div>
          <div class="sg" style="font-size:36px;font-weight:300">${di.wl}, ${di.n} de ${di.ml}</div>
          ${this.entryList(entries, di, true)}
          ${!past && html`<${Toolbar} />
            <${Editable} key=${'diary-' + entries.length} elRef=${el => this.diaryEl = el} label="Escrever no diário" ph=${entries.length ? 'Quer acrescentar mais alguma coisa?' : 'O que está na sua mente hoje? Escreva sem pensar muito…'} style="min-height:200px;font-size:19px;line-height:1.8;font-weight:300;color:#F1F6FF;user-select:text;cursor:text" />
            <button class="btn" onClick=${this.saveDiary} style=${`align-self:flex-start;height:44px;padding:0 24px;border-radius:22px;border:0;background:${a30};color:#F1F6FF;font-size:14px;box-shadow:0 0 24px ${a30}`}>Guardar no diário</button>`}
          ${past && html`<button class="btn" onClick=${() => this.setState({ diaryOpen: null })} style="align-self:flex-start;height:40px;padding:0 20px;border-radius:20px;border:0;background:rgba(255,255,255,.07);color:#E8EEF8;font-size:13px;margin-top:10px">Voltar para hoje</button>`}
        </div></div>
      ${mem.length > 0 && html`<div style="position:absolute;left:880px;top:110px;font-size:11px;letter-spacing:4px;color:rgba(232,238,248,.5)">MEMÓRIAS</div>`}
      ${mem.slice(0, 4).map((e, i) => html`<button key=${e.k} class="btn" onClick=${() => this.setState({ diaryOpen: e.k })} style=${`position:absolute;left:${MP[i][0]}px;top:${MP[i][1]}px;width:260px;border:0;background:none;color:#E8EEF8;text-align:left;padding:10px;opacity:${(1 - i * 0.15).toFixed(2)}`}>
        <div aria-hidden="true" class="haze" style=${`position:absolute;inset:-10px;border-radius:50%;background:radial-gradient(closest-side,${e.c}33,transparent);filter:blur(14px)`}></div>
        <div style=${`position:relative;font-size:11px;letter-spacing:2px;color:${e.c}`}>${e.date} · ${e.n}</div>
        <div style="position:relative;font-size:14px;line-height:1.4;margin-top:4px;color:rgba(241,246,255,.85)">${e.snip}</div></button>`)}
    </div>`;
  }
  baseList() { return store.list('base').sort((a, b) => (a.ord || 0) - (b.ord || 0)); }
  basePC() {
    const s = this.state, BP = [[150, 190], [760, 175], [230, 330], [820, 320], [140, 470], [770, 465], [250, 600], [800, 600]], L = this.baseList();
    const many = L.length > 8;
    return html`<div class="fadein" style="position:absolute;inset:0;z-index:4">
      <div aria-hidden="true" class="haze" style="position:absolute;left:440px;top:200px;width:400px;height:400px;border-radius:50%;background:radial-gradient(closest-side,rgba(255,194,77,.22),transparent);filter:blur(30px)"></div>
      <div style="position:absolute;left:0;right:0;top:100px;text-align:center"><div class="sg" style="font-size:26px;font-weight:300;letter-spacing:8px;color:#FFD98A">BASE</div>
        <div style="font-size:13px;color:rgba(232,238,248,.6);margin-top:8px">Princípios da minha vida e o que estou vivendo agora</div></div>
      ${!many ? L.map((b, i) => this.baseItem(b, i, `position:absolute;left:${BP[i][0]}px;top:${BP[i][1]}px;width:330px`))
        : html`<div class="noscroll" style="position:absolute;left:140px;right:140px;top:170px;height:480px;overflow-y:auto;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:30px 80px;align-content:start">${L.map((b, i) => this.baseItem(b, i, ''))}</div>`}
      ${!L.length && html`<div style="position:absolute;left:0;right:0;top:360px;text-align:center;color:rgba(255,217,138,.6);font-size:15px">Escreva aqui embaixo os princípios que sustentam sua vida.</div>`}
      <div style="position:absolute;left:390px;width:500px;top:672px"><label for="nb" class="sr">Novo princípio</label>
        <input id="nb" class="drop" value=${s.baseDraft} onInput=${e => this.setState({ baseDraft: e.currentTarget.value })} onKeyDown=${e => { if (e.key === 'Enter') this.addBase(); }} placeholder="Escreva um princípio e aperte Enter…" style="width:100%;height:44px;border:0;border-bottom:1px solid rgba(255,194,77,.5);background:transparent;color:#FFF6E0;font-size:16px;text-align:center;font-family:Inter,sans-serif;user-select:text" /></div>
    </div>`;
  }
  baseItem(b, i, pos) {
    return html`<div key=${b.id} class="rise" style=${pos + `;animation-delay:${(0.1 + i * 0.12).toFixed(2)}s`}>
      <div class="flt" style=${`animation-delay:${(0.1 + i * 0.12).toFixed(2)}s;display:flex;gap:12px`}><${Star} />
        <div style="flex:1"><div style="font-size:19px;font-weight:300;line-height:1.4;color:#FFF6E0;text-shadow:0 0 18px rgba(255,194,77,.35)">${b.text}</div>
          <div style="display:flex;gap:12px;align-items:center;margin-top:4px"><span style="font-size:11px;letter-spacing:2px;color:rgba(255,217,138,.65)">${b.sub}</span>
          <button class="btn" onClick=${() => { if (confirm('Tirar da Base?')) store.remove('base', b.id); }} aria-label="Tirar da Base" style="border:0;background:none;color:rgba(255,217,138,.35);font-size:11px;padding:4px">remover</button></div></div></div></div>`;
  }
  focusBody(sel, mobile) {
    const s = this.state, p = PRIOS[sel.prio], inBase = this.baseList().some(b => b.text === sel.title);
    const addSub = () => { const t = s.subDraft.trim(); if (!t) return; store.patch('items', sel.id, { subs: (sel.subs || []).concat([t]) }); this.setState({ subDraft: '' }); };
    const a50 = MOODS[this.mood].c[1] + '80';
    return html`
      <div style=${`display:flex;gap:${mobile ? 14 : 18}px;flex-wrap:wrap;justify-content:${mobile ? 'flex-start' : 'center'}`}>
        ${Object.keys(TYPES).map(t => html`<button class="btn" onClick=${() => store.patch('items', sel.id, { type: t })} style=${`height:32px;border:0;background:none;padding:0;font-size:${mobile ? 10 : 11}px;letter-spacing:3px;text-transform:uppercase;color:${TYPES[t].c};opacity:${sel.type === t ? 1 : 0.4}`}>${TYPES[t].l}</button>`)}
      </div>
      <${TitleEdit} key=${'t' + sel.id} text=${sel.title} onChange=${t => store.patch('items', sel.id, { title: t })} style=${`font-family:'Space Grotesk',sans-serif;font-size:${mobile ? 26 : 34}px;font-weight:500;line-height:1.2;color:#fff;outline:none;${mobile ? '' : 'text-shadow:0 0 30px ' + p.c}`} />
      <div style=${`display:flex;gap:${mobile ? 8 : 12}px;flex-wrap:wrap;justify-content:${mobile ? 'flex-start' : 'center'}`}>
        ${Object.keys(PRIOS).map(k => html`<button class="btn" onClick=${() => store.patch('items', sel.id, { prio: k })} style=${`height:34px;padding:0 14px;border-radius:17px;border:0;background:${sel.prio === k ? PRIOS[k].c + '33' : 'rgba(255,255,255,.05)'};color:#E8EEF8;font-size:13px;display:flex;align-items:center;gap:8px;opacity:${sel.prio === k ? 1 : 0.6}`}><span style=${`width:9px;height:9px;border-radius:50%;background:${PRIOS[k].c};box-shadow:0 0 10px ${PRIOS[k].c}`}></span>${PRIOS[k].l}</button>`)}
      </div>
      <div style=${`display:flex;justify-content:${mobile ? 'flex-start' : 'center'}`}><${Toolbar} full /></div>
      <${Editable} key=${'n' + sel.id} html=${sel.note} label="Anotação" ph="Escreva livre aqui…" onChange=${v => store.patch('items', sel.id, { note: clean(v) })} style=${`width:100%;min-height:${mobile ? 130 : 140}px;font-size:${mobile ? 17 : 18}px;line-height:1.7;font-weight:300;color:#F1F6FF;user-select:text;cursor:text;text-align:left`} />
      ${mobile && (sel.subs || []).length > 0 && html`<div style="font-size:10px;letter-spacing:3px;color:rgba(232,238,248,.5)">SUB-IDEIAS</div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">${sel.subs.map((t, i) => html`<div class="risem" style=${`padding:10px 14px;border-radius:20px;background:rgba(255,255,255,.06);box-shadow:0 0 16px ${p.c}40;font-size:13px;animation-delay:${(0.05 + i * 0.06).toFixed(2)}s`}>${t}</div>`)}</div>`}
      <div style=${`width:${mobile ? '100%' : '360px'};align-self:center`}><label for="sub" class="sr">Nova sub-ideia</label>
        <input id="sub" class="drop" value=${s.subDraft} onInput=${e => this.setState({ subDraft: e.currentTarget.value })} onKeyDown=${e => { if (e.key === 'Enter') addSub(); }} placeholder=${mobile ? '+ sub-ideia' : '+ sub-ideia (Enter)'} style=${`width:100%;height:40px;border:0;border-bottom:1px solid ${a50};background:transparent;color:#F1F6FF;font-size:14px;text-align:${mobile ? 'left' : 'center'};font-family:Inter,sans-serif`} /></div>
      <div style=${`display:flex;gap:12px;flex-wrap:wrap;justify-content:center;margin-top:6px;${mobile ? 'flex-direction:column' : ''}`}>
        <button class="btn" onClick=${() => { if (!inBase) store.put('base', { id: uid(), text: sel.title, sub: TYPES[sel.type].l.toUpperCase(), ord: Date.now() }); }} style="height:44px;padding:0 20px;border-radius:22px;border:0;background:rgba(255,194,77,.16);color:#FFD98A;font-size:14px">${inBase ? 'Já está na Base' : 'Fixar na Base'}</button>
        <button class="btn" onClick=${() => store.patch('items', sel.id, { done: sel.done ? 0 : 1 })} style="height:44px;padding:0 22px;border-radius:22px;border:0;background:rgba(60,203,143,.2);color:#A6F0CB;font-size:14px">${sel.done ? 'Reabrir' : 'Concluir'}</button>
        ${!mobile && html`<button class="btn" onClick=${() => this.setState({ sel: null })} style="height:44px;padding:0 22px;border-radius:22px;border:0;background:rgba(255,255,255,.07);color:#E8EEF8;font-size:14px">Voltar à mente</button>`}
      </div>
      <button class="btn" onClick=${() => { if (confirm('Apagar este pensamento?')) { store.remove('items', sel.id); this.setState({ sel: null }); } }} style="align-self:center;border:0;background:none;color:rgba(232,238,248,.35);font-size:12px;padding:8px">apagar pensamento</button>`;
  }
  focusPC(sel) {
    const p = PRIOS[sel.prio];
    return html`<div class="fadein" onPointerDown=${e => { if (e.target === e.currentTarget) this.setState({ sel: null }); }} style="position:absolute;inset:0;z-index:20;background:rgba(4,7,16,.93);backdrop-filter:blur(20px)">
      ${(sel.subs || []).map((t, i) => { const right = i % 2 === 0, row = Math.floor(i / 2); return html`<div class="rise" style=${`position:absolute;left:${right ? 1060 : 90}px;top:${170 + row * 170}px;width:130px;height:130px;animation-delay:${(0.15 + i * 0.12).toFixed(2)}s`}>
        <div class="haze" aria-hidden="true" style=${`position:absolute;inset:-14px;border-radius:50%;background:radial-gradient(closest-side,${p.c}55,transparent);filter:blur(12px)`}></div>
        <div class="flt" style="position:relative;width:130px;height:130px;border-radius:50%;background:rgba(255,255,255,.05);display:flex;align-items:center;justify-content:center;text-align:center;padding:16px;font-size:13px;line-height:1.3">${t}</div></div>`; })}
      <div class="noscroll" style="position:absolute;left:320px;top:60px;width:640px;max-height:720px;overflow-y:auto;display:flex;flex-direction:column;align-items:center;gap:16px;text-align:center">${this.focusBody(sel, false)}</div>
    </div>`;
  }

  // ---------- celular ----------
  renderMobile() {
    const { s, M, acc, a30, a50, awake, sleep } = this.common(), H = s.SH;
    const D = info(s.day), isToday = s.day === today(), list = this.items(s.day), sel = list.find(i => i.id === s.sel), pend = this.pendList();
    const open = list.filter(c => !c.done && !c.pulled).length;
    const sorted = list.slice().sort((a, b) => ((a.done || a.pulled) ? 1 : 0) - ((b.done || b.pulled) ? 1 : 0) || PRIOS[a.prio].o - PRIOS[b.prio].o);
    const bottomNav = H - 64, inputTop = H - 118, listTop = 290, listH = inputTop - listTop - 6;
    return html`
      ${sleep && html`<button class="btn" aria-label="Acordar" onClick=${this.wake} style=${`position:absolute;left:45px;top:${H * 0.43 - 150}px;width:300px;height:300px;border:0;background:none;z-index:4`}></button>
        <div class="fadein sg" style=${`position:absolute;left:0;right:0;top:${H * 0.43 + 200}px;text-align:center;z-index:5;pointer-events:none;font-size:12px;letter-spacing:4px;color:rgba(232,238,248,.6)`}>TOQUE NO ÁTOMO</div>`}
      ${(s.phase === 'mood' || (awake && s.moodOpen)) && this.moodPicker(awake ? 300 : H * 0.43 + 190)}
      ${awake && html`
        <div class="fadein" style="position:absolute;left:20px;right:20px;top:40px;z-index:5;display:flex;align-items:center;justify-content:space-between">
          <div><div class="sg" style=${`font-size:11px;letter-spacing:3px;color:${acc}`}>${D.w} · ${D.n} ${D.m}${isToday ? ' · HOJE' : ''}</div><div class="sg" style="font-size:20px;font-weight:300">${s.clock}</div></div>
          <div style="display:flex;gap:8px">
            <button class="btn" onClick=${() => this.setState({ moodOpen: !s.moodOpen })} aria-label="Mudar humor" style="height:36px;padding:0 14px;border-radius:18px;border:0;background:rgba(255,255,255,.07);color:#E8EEF8;font-size:11px;letter-spacing:2px;display:flex;align-items:center;gap:8px"><span style=${`width:8px;height:8px;border-radius:50%;background:${acc};box-shadow:0 0 8px ${acc}`}></span>${M.l.toUpperCase()}</button>
            <button class="btn" aria-label="Ajustes" onClick=${() => this.setState({ settings: true })} style="position:relative;width:36px;height:36px;border-radius:50%;border:0;background:rgba(255,255,255,.07);color:#E8EEF8;display:flex;align-items:center;justify-content:center"><${Gear} /><span style=${`position:absolute;right:4px;top:4px;width:7px;height:7px;border-radius:50%;background:${this.syncDot()}`}></span></button>
          </div></div>
        ${s.view === 'mente' && !s.moodOpen && html`
          <div style="position:absolute;left:0;right:0;top:200px;text-align:center;z-index:3;display:flex;flex-direction:column;align-items:center;gap:10px">
            <div style="display:flex;align-items:center;gap:14px">
              <button class="btn" aria-label="Dia anterior" onClick=${() => this.setState({ day: addDays(s.day, -1) })} style="width:36px;height:36px;border-radius:50%;border:0;background:rgba(255,255,255,.06);color:#E8EEF8;display:flex;align-items:center;justify-content:center"><${Chev} /></button>
              <button class="btn sg" onClick=${() => this.setState({ day: today() })} style="border:0;background:none;font-size:11px;letter-spacing:4px;color:rgba(232,238,248,.75)">${open} ${open === 1 ? 'PENSAMENTO' : 'PENSAMENTOS'}</button>
              <button class="btn" aria-label="Próximo dia" onClick=${() => this.setState({ day: addDays(s.day, 1) })} style="width:36px;height:36px;border-radius:50%;border:0;background:rgba(255,255,255,.06);color:#E8EEF8;display:flex;align-items:center;justify-content:center"><${Chev} d /></button>
            </div>
            ${isToday && pend.length > 0 && html`<button class="btn" onClick=${() => this.setState({ pendOpen: true })} style="height:32px;padding:0 14px;border-radius:16px;border:0;background:rgba(255,165,61,.16);color:#FFC27A;font-size:12px;display:flex;align-items:center;gap:8px"><span style="width:7px;height:7px;border-radius:50%;background:#FFA53D"></span>${pend.length} ${pend.length === 1 ? 'ficou pra trás' : 'ficaram pra trás'}</button>`}
          </div>
          <div class="noscroll" style=${`position:absolute;left:0;right:0;top:${listTop}px;height:${listH}px;overflow-y:auto;z-index:3;-webkit-mask-image:linear-gradient(to bottom,transparent 0,#000 24px,#000 calc(100% - 30px),transparent 100%);mask-image:linear-gradient(to bottom,transparent 0,#000 24px,#000 calc(100% - 30px),transparent 100%)`}>
            <div style="padding:22px 0 40px;display:flex;flex-direction:column;gap:6px">
              ${sorted.map((c, i) => { const p = PRIOS[c.prio], t = TYPES[c.type], pd = this.isPend(c); return html`<button key=${c.id} class="btn risem" onClick=${() => this.setState({ sel: c.id, subDraft: '' })} style=${`position:relative;align-self:${i % 2 ? 'flex-end' : 'flex-start'};width:250px;margin:0 18px;min-height:86px;border:0;background:none;color:#fff;padding:0;opacity:${(c.done || c.pulled) ? 0.45 : 1};animation-delay:${(0.1 + i * 0.08).toFixed(2)}s`}>
                <div class="haze" aria-hidden="true" style=${`position:absolute;left:-20px;right:-20px;top:-16px;bottom:-16px;border-radius:50%;background:radial-gradient(closest-side,${p.c}40,transparent);filter:blur(12px);animation-delay:${((i * 1.3) % 6).toFixed(1)}s`}></div>
                <div class="fltm" style=${`position:relative;display:flex;flex-direction:column;align-items:center;gap:4px;padding:14px 8px;text-align:center;animation-delay:${((i * 1.3) % 6).toFixed(1)}s`}>
                  <span style=${`font-size:9px;letter-spacing:3px;text-transform:uppercase;color:${t.c}`}>${t.l}</span>
                  <span style=${`font-size:16px;font-weight:600;line-height:1.3;color:#fff;text-shadow:0 1px 12px rgba(0,0,0,.9);text-decoration:${c.done ? 'line-through' : 'none'}`}>${c.title}</span>
                  <span style="font-size:11px;color:rgba(255,255,255,.75)">${pd ? 'ficou pra trás' : c.pulled ? 'puxado pra hoje' : (c.subs && c.subs.length ? c.subs.length + (c.subs.length === 1 ? ' sub-ideia' : ' sub-ideias') : '')}</span></div></button>`; })}
              ${!list.length && html`<div style="text-align:center;color:rgba(232,238,248,.5);font-size:13px;padding-top:40px">Mente livre. Solte um pensamento.</div>`}
            </div></div>
          <div style=${`position:absolute;left:20px;right:20px;top:${inputTop}px;z-index:5;display:flex;align-items:center;gap:10px`}>
            <label for="mdrop" class="sr">Soltar pensamento</label>
            <input id="mdrop" class="drop" value=${s.draft} onInput=${e => this.setState({ draft: e.currentTarget.value })} onKeyDown=${e => { if (e.key === 'Enter') this.drop(); }} enterkeyhint="send" placeholder="Solte um pensamento…" style=${`flex:1;min-width:0;height:44px;border:0;border-bottom:1px solid ${a50};background:transparent;color:#F1F6FF;font-size:16px;font-family:Inter,sans-serif;user-select:text`} />
            <button class="btn" onClick=${this.drop} aria-label="Soltar" style=${`width:44px;height:44px;border-radius:50%;border:0;background:${a30};color:#fff;display:flex;align-items:center;justify-content:center;box-shadow:0 0 18px ${a30}`}><svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M8 13V3M3.5 7.5L8 3l4.5 4.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"></path></svg></button>
          </div>`}
        ${s.view === 'tempo' && this.timeM(acc)}
        ${s.view === 'diario' && this.diaryM(acc, a30, H)}
        ${s.view === 'base' && this.baseM(H)}
        <nav class="fadein" style=${`position:absolute;left:0;right:0;top:${bottomNav}px;height:52px;z-index:6;display:flex;justify-content:space-around;padding:0 10px`}>
          ${[['mente', 'MENTE'], ['tempo', 'TEMPO'], ['diario', 'DIÁRIO'], ['base', 'BASE']].map(n => { const on = s.view === n[0], dot = on ? (n[0] === 'base' ? '#FFC24D' : acc) : 'transparent'; return html`<button class="btn" onClick=${() => this.setState({ view: n[0], sel: null, moodOpen: false })} style=${`height:48px;border:0;background:none;color:${on ? '#F1F6FF' : 'rgba(232,238,248,.5)'};font-size:10px;letter-spacing:3px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px`}>${n[1]}<span style=${`width:4px;height:4px;border-radius:50%;background:${dot};box-shadow:0 0 8px ${dot}`}></span></button>`; })}
        </nav>`}
      ${s.pendOpen && html`<div class="fadein" onClick=${() => this.setState({ pendOpen: false })} style="position:absolute;inset:0;z-index:15;background:rgba(2,4,10,.6)"></div>
        <div class="sheet noscroll" style=${`position:absolute;left:0;right:0;bottom:0;max-height:${H * 0.75}px;overflow-y:auto;z-index:16;background:#0B0F1C;border-radius:24px 24px 0 0;padding:14px 22px 34px;display:flex;flex-direction:column;gap:16px`}>
          <div style="width:40px;height:4px;border-radius:2px;background:rgba(255,255,255,.2);align-self:center"></div>
          <div style="font-size:11px;letter-spacing:3px;color:#FFB86B">FICOU PRA TRÁS</div>
          ${pend.map(o => { const di = info(o.day); return html`<div key=${o.id} style="display:flex;flex-direction:column;gap:8px;padding-bottom:14px;border-bottom:1px solid rgba(255,255,255,.06)">
            <div style="font-size:15px;font-weight:500">${o.title}</div><div style="font-size:11px;color:rgba(255,194,122,.85)">de ${di.wl.toLowerCase()}, ${di.n} · ${PRIOS[o.prio].l.toLowerCase()}</div>
            <div style="display:flex;gap:8px"><button class="btn" onClick=${() => this.pull(o)} style="flex:1;height:40px;border-radius:20px;border:0;background:rgba(255,165,61,.22);color:#FFD3A1;font-size:13px">Puxar pra hoje</button>
            <button class="btn" onClick=${() => store.patch('items', o.id, { kept: 1 })} style="flex:1;height:40px;border-radius:20px;border:0;background:rgba(255,255,255,.06);color:rgba(232,238,248,.8);font-size:13px">Deixar ir</button></div></div>`; })}
          ${!pend.length && html`<div style="font-size:13px;color:rgba(232,238,248,.6)">Tudo decidido.</div>`}
        </div>`}
      ${sel && html`<div class="noscroll fadein" style="position:absolute;inset:0;z-index:20;background:#05081A;overflow-y:auto">
        <div style="padding:46px 22px 60px;display:flex;flex-direction:column;gap:16px">
          <button class="btn" aria-label="Voltar" onClick=${() => this.setState({ sel: null })} style="align-self:flex-start;width:40px;height:40px;border-radius:50%;border:0;background:rgba(255,255,255,.07);color:#E8EEF8;display:flex;align-items:center;justify-content:center"><${Chev} /></button>
          ${this.focusBody(sel, true)}</div></div>`}`;
  }
  timeM(acc) {
    const T = this.timeline();
    return html`<div class="fadein" style="position:absolute;left:24px;top:106px;z-index:5"><div class="sg" style="font-size:20px;font-weight:300;letter-spacing:5px">FIO DO TEMPO</div><div style="font-size:12px;color:rgba(232,238,248,.55);margin-top:4px">Toque num dia para entrar nele</div></div>
      ${T.days.map((d, i) => { const di = info(d), cnt = this.items(d).length, pn = T.pend[i], td = i === 5; return html`<button key=${d} class="btn fadein" onClick=${() => this.setState({ day: d, view: 'mente' })} style=${`position:absolute;left:${T.pts[i][0] + 26}px;top:${T.pts[i][1] - 28}px;width:220px;height:56px;border:0;background:none;color:#E8EEF8;padding:0 0 0 6px;z-index:4;text-align:left;display:flex;flex-direction:column;justify-content:center;animation-delay:${(0.1 + i * 0.06).toFixed(2)}s`}>
        <span class="sg" style=${`font-size:13px;letter-spacing:3px;color:${td ? acc : 'rgba(232,238,248,.85)'}`}>${di.w} ${di.n}</span>
        <span style=${`font-size:11px;color:${pn ? '#FFC27A' : 'rgba(232,238,248,.5)'};margin-top:3px`}>${td ? 'hoje' : pn ? pn + ' ficou pra trás' : cnt + (cnt === 1 ? ' pensamento' : ' pensamentos')}</span></button>`; })}`;
  }
  diaryM(acc, a30, H) {
    const { entries, mem, di, past } = this.diaryData();
    return html`<div class="noscroll fadein" style=${`position:absolute;left:0;right:0;top:100px;height:${H - 170}px;overflow-y:auto;z-index:4`}>
      <div style="padding:10px 24px 40px;display:flex;flex-direction:column;gap:12px">
        <div style=${`font-size:11px;letter-spacing:4px;color:${acc}`}>DIÁRIO</div>
        <div class="sg" style="font-size:26px;font-weight:300">${di.wl}, ${di.n} ${di.m.toLowerCase()}</div>
        ${this.entryList(entries, di, false)}
        ${!past && html`<${Toolbar} />
          <${Editable} key=${'diary-' + entries.length} elRef=${el => this.diaryEl = el} label="Escrever no diário" ph=${entries.length ? 'Quer acrescentar mais alguma coisa?' : 'O que está na sua mente hoje?'} style="min-height:150px;font-size:17px;line-height:1.7;font-weight:300;color:#F1F6FF;user-select:text;cursor:text" />
          <button class="btn" onClick=${this.saveDiary} style=${`height:44px;border-radius:22px;border:0;background:${a30};color:#F1F6FF;font-size:14px`}>Guardar no diário</button>
          ${mem.length > 0 && html`<div style="font-size:10px;letter-spacing:4px;color:rgba(232,238,248,.5);margin-top:18px">DIAS ANTERIORES</div>`}
          ${mem.map(e => html`<button key=${e.k} class="btn" onClick=${() => this.setState({ diaryOpen: e.k })} style="border:0;background:rgba(255,255,255,.04);border-radius:14px;color:#E8EEF8;text-align:left;padding:12px 14px">
            <div style=${`font-size:10px;letter-spacing:2px;color:${e.c}`}>${e.date} · ${e.n}</div><div style="font-size:14px;line-height:1.4;margin-top:4px;color:rgba(241,246,255,.85)">${e.snip}</div></button>`)}`}
        ${past && html`<button class="btn" onClick=${() => this.setState({ diaryOpen: null })} style="height:44px;border-radius:22px;border:0;background:rgba(255,255,255,.07);color:#E8EEF8;font-size:14px;margin-top:8px">Voltar para hoje</button>`}
      </div></div>`;
  }
  baseM(H) {
    const s = this.state, L = this.baseList();
    return html`<div class="noscroll fadein" style=${`position:absolute;left:0;right:0;top:100px;height:${H - 170}px;overflow-y:auto;z-index:4`}>
      <div style="padding:10px 28px 40px;display:flex;flex-direction:column;gap:24px">
        <div><div class="sg" style="font-size:22px;font-weight:300;letter-spacing:7px;color:#FFD98A">BASE</div><div style="font-size:12px;color:rgba(232,238,248,.6);margin-top:6px">Princípios da minha vida e o que estou vivendo</div></div>
        ${L.map((b, i) => html`<div key=${b.id} class="risem" style=${`display:flex;gap:12px;animation-delay:${(0.1 + i * 0.08).toFixed(2)}s`}><${Star} s=${14} />
          <div style="flex:1"><div style="font-size:18px;font-weight:300;line-height:1.4;color:#FFF6E0;text-shadow:0 0 16px rgba(255,194,77,.35)">${b.text}</div>
          <div style="display:flex;gap:12px;align-items:center;margin-top:4px"><span style="font-size:10px;letter-spacing:2px;color:rgba(255,217,138,.65)">${b.sub}</span><button class="btn" onClick=${() => { if (confirm('Tirar da Base?')) store.remove('base', b.id); }} style="border:0;background:none;color:rgba(255,217,138,.35);font-size:11px;padding:4px">remover</button></div></div></div>`)}
        <div><label for="mnb" class="sr">Novo princípio</label>
          <input id="mnb" class="drop" value=${s.baseDraft} onInput=${e => this.setState({ baseDraft: e.currentTarget.value })} onKeyDown=${e => { if (e.key === 'Enter') this.addBase(); }} enterkeyhint="done" placeholder="+ novo princípio" style="width:100%;height:44px;border:0;border-bottom:1px solid rgba(255,194,77,.5);background:transparent;color:#FFF6E0;font-size:16px;font-family:Inter,sans-serif;user-select:text" /></div>
      </div></div>`;
  }
}

store.load().then(() => render(html`<${App} />`, document.getElementById('app')));
if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => { });
