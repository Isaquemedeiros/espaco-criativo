// Armazenamento local (IndexedDB) + sincronização com Turso (API HTTP).
// Tabelas: items, diary, base, moods. Cada registro: {id, upd, del, ...campos}
const DBNAME = 'espaco-criativo', KEY = 'state-v1';
const TABLES = ['items', 'diary', 'base', 'moods'];

function idbOpen() {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DBNAME, 1);
    r.onupgradeneeded = () => r.result.createObjectStore('kv');
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
async function idbGet(k) {
  const db = await idbOpen();
  return new Promise((res, rej) => {
    const q = db.transaction('kv').objectStore('kv').get(k);
    q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error);
  });
}
async function idbSet(k, v) {
  const db = await idbOpen();
  return new Promise((res, rej) => {
    const tx = db.transaction('kv', 'readwrite');
    tx.objectStore('kv').put(v, k);
    tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error);
  });
}

export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

class Store {
  constructor() {
    this.data = { items: {}, diary: {}, base: {}, moods: {} };
    this.meta = { lastSeq: 0, outbox: [], url: '', token: '' };
    this.listeners = new Set();
    this.status = 'local'; // local | ok | sync | erro
    this.statusMsg = '';
    this.saveT = null; this.syncT = null; this.syncing = false;
  }
  async load() {
    try {
      const s = await idbGet(KEY);
      if (s) { this.data = Object.assign(this.data, s.data || {}); this.meta = Object.assign(this.meta, s.meta || {}); }
    } catch (e) { console.warn('load', e); }
    if (!this.meta.seeded && !Object.keys(this.data.base).length && !Object.keys(this.data.items).length) {
      this.meta.seeded = true; // primeira vez: começa vazio
    }
    if (this.meta.url && this.meta.token) this.status = 'sync';
    this.emit();
    this.sync();
    setInterval(() => this.sync(), 20000);
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => this.sync());
      document.addEventListener('visibilitychange', () => { if (!document.hidden) this.sync(); });
    }
  }
  on(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  emit() { this.listeners.forEach(f => f()); }
  persist() {
    clearTimeout(this.saveT);
    this.saveT = setTimeout(() => idbSet(KEY, { data: this.data, meta: this.meta }).catch(e => console.warn(e)), 250);
  }
  list(t) { return Object.values(this.data[t]).filter(r => !r.del); }
  get(t, id) { const r = this.data[t][id]; return r && !r.del ? r : null; }
  put(t, rec) {
    const r = Object.assign({}, this.data[t][rec.id] || {}, rec, { upd: Date.now() });
    if (r.del == null) r.del = 0;
    this.data[t][r.id] = r;
    const key = t + '|' + r.id;
    if (!this.meta.outbox.includes(key)) this.meta.outbox.push(key);
    this.persist(); this.emit(); this.soon();
    return r;
  }
  patch(t, id, fields) { const r = this.data[t][id]; if (!r) return; return this.put(t, Object.assign({}, r, fields)); }
  remove(t, id) { return this.patch(t, id, { del: 1 }); }
  soon() { clearTimeout(this.syncT); this.syncT = setTimeout(() => this.sync(), 1500); }

  // ---------- Turso ----------
  setConfig(url, token) {
    url = (url || '').replace(/\s+/g, '').replace(/^libsql:\/\//i, 'https://').replace(/^wss?:\/\//i, 'https://').replace(/\/+$/, '');
    if (url && !/^https?:\/\//i.test(url)) url = 'https://' + url;
    this.meta.url = url; this.meta.token = (token || '').replace(/\s+/g, '').replace(/^Bearer/i, ''); this.meta.lastSeq = 0;
    // reenvia tudo para o banco novo
    this.meta.outbox = [];
    TABLES.forEach(t => Object.keys(this.data[t]).forEach(id => this.meta.outbox.push(t + '|' + id)));
    this.meta.schemaOk = false;
    this.persist(); this.status = url ? 'sync' : 'local'; this.emit();
    return this.sync();
  }
  async pipeline(stmts) {
    const body = { requests: stmts.map(s => ({ type: 'execute', stmt: s })).concat([{ type: 'close' }]) };
    const headers = { 'Authorization': 'Bearer ' + this.meta.token, 'Content-Type': 'application/json' };
    let status, txt = '';
    try {
      if (typeof window !== 'undefined' && window.ecNet) { const r = await window.ecNet.post(this.meta.url + '/v2/pipeline', headers, JSON.stringify(body)); status = r.status; txt = r.body || ''; }
      else { const r = await fetch(this.meta.url + '/v2/pipeline', { method: 'POST', headers, body: JSON.stringify(body) }); status = r.status; txt = await r.text(); }
    } catch (e) { throw new Error('não conectou — confira o endereço e a internet'); }
    let j = null; try { j = JSON.parse(txt); } catch (_) { }
    if (status === 401 || status === 403) throw new Error('token inválido ou sem permissão');
    if (status === 404) throw new Error('endereço do banco não encontrado');
    if (status !== 200 || !j) throw new Error('o banco respondeu com erro ' + status + (txt ? ' — ' + String((j && (j.message || j.error)) || txt).slice(0, 120) : ''));
    const out = [];
    for (const res of j.results) {
      if (res.type !== 'ok') throw new Error((res.error && res.error.message) || 'erro no banco');
      if (res.response && res.response.type === 'execute') out.push(res.response.result);
    }
    return out;
  }
  async sync() {
    if (!this.meta.url || !this.meta.token || this.syncing) return;
    if (/[^A-Za-z0-9._-]/.test(this.meta.token)) { this.status = 'erro'; this.statusMsg = 'o token colado tem caracteres estranhos (provavelmente veio cortado) — gere e cole de novo'; this.emit(); return; }
    if (typeof navigator !== 'undefined' && navigator.onLine === false) { this.status = 'erro'; this.statusMsg = 'sem internet'; this.emit(); return; }
    this.syncing = true;
    try {
      if (!this.meta.schemaOk) {
        await this.pipeline([{ sql: 'CREATE TABLE IF NOT EXISTS recs (t TEXT NOT NULL, id TEXT NOT NULL, upd INTEGER NOT NULL, seq INTEGER NOT NULL, data TEXT NOT NULL, PRIMARY KEY (t, id))' },
          { sql: 'CREATE INDEX IF NOT EXISTS recs_seq ON recs(seq)' }]);
        this.meta.schemaOk = true;
      }
      // envia pendentes em lotes
      while (this.meta.outbox.length) {
        const batch = this.meta.outbox.slice(0, 40);
        const stmts = [], sent = {};
        for (const key of batch) {
          const [t, id] = key.split('|'); const r = this.data[t] && this.data[t][id]; if (!r) continue; sent[key] = r.upd;
          stmts.push({
            sql: 'INSERT INTO recs (t,id,upd,seq,data) VALUES (?,?,?,(SELECT COALESCE(MAX(seq),0)+1 FROM recs),?) ON CONFLICT(t,id) DO UPDATE SET upd=excluded.upd, seq=excluded.seq, data=excluded.data WHERE excluded.upd >= recs.upd',
            args: [{ type: 'text', value: t }, { type: 'text', value: id }, { type: 'integer', value: String(r.upd) }, { type: 'text', value: JSON.stringify(r) }]
          });
        }
        if (stmts.length) await this.pipeline(stmts);
        this.meta.outbox = this.meta.outbox.filter(k => { if (!batch.includes(k)) return true; const [t, id] = k.split('|'); const r = this.data[t] && this.data[t][id]; return r && sent[k] !== undefined && r.upd !== sent[k]; });
        this.persist();
      }
      // recebe novidades
      const [res] = await this.pipeline([{ sql: 'SELECT t, id, upd, seq, data FROM recs WHERE seq > ? ORDER BY seq LIMIT 2000', args: [{ type: 'integer', value: String(this.meta.lastSeq || 0) }] }]);
      let changed = false;
      for (const row of res.rows) {
        const [t, id, upd, seq, data] = row.map(c => c.value);
        const u = Number(upd);
        if (TABLES.includes(t)) {
          const cur = this.data[t][id];
          if (!cur || cur.upd < u) { this.data[t][id] = JSON.parse(data); changed = true; const k = t + '|' + id; this.meta.outbox = this.meta.outbox.filter(x => x !== k); }
        }
        this.meta.lastSeq = Math.max(this.meta.lastSeq, Number(seq));
      }
      this.persist();
      this.status = 'ok'; this.statusMsg = 'sincronizado ' + new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      this.emit();
      if (res.rows.length >= 2000) { this.syncing = false; return this.sync(); }
    } catch (e) {
      this.status = 'erro'; this.statusMsg = String(e.message || e); this.emit();
    }
    this.syncing = false;
  }

  exportJSON() { return JSON.stringify({ app: 'espaco-criativo', v: 1, at: new Date().toISOString(), data: this.data }, null, 1); }
  importJSON(txt) {
    const j = JSON.parse(txt); if (!j.data) throw new Error('arquivo inválido');
    TABLES.forEach(t => Object.values(j.data[t] || {}).forEach(r => {
      const cur = this.data[t][r.id];
      if (!cur || cur.upd < r.upd) { this.data[t][r.id] = r; const key = t + '|' + r.id; if (!this.meta.outbox.includes(key)) this.meta.outbox.push(key); }
    }));
    this.persist(); this.emit(); this.soon();
  }
}

export const store = new Store();
