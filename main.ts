import Phaser from 'phaser';
import './style.css';

type Action = { label: string; xp: number; trust: number; performance: number; integrity: number; cost: number; note: string };
type CaseData = { id: number; title: string; type: string; description: string; location: string; actions: Action[] };
type SaveState = { day: number; xp: number; trust: number; budget: number; performance: number; integrity: number; resolvedIds: number[]; tutorialDone: boolean; equipment: number };
const SAVE_KEY = 'pmt-save-v2';
const initialState: SaveState = { day: 1, xp: 0, trust: 65, budget: 1000, performance: 50, integrity: 80, resolvedIds: [], tutorialDone: false, equipment: 0 };
const cases: CaseData[] = [
  { id: 1, title: 'Aduan gangguan kejiranan', type: 'ADUAN AWAM', location: 'Kawasan perumahan', description: 'Penduduk melaporkan pertengkaran dan bunyi bising. Keadaan belum diketahui sepenuhnya.', actions: [
    { label: 'Siasat & mediasi', xp: 25, trust: 8, performance: 8, integrity: 3, cost: 40, note: 'Anda mendengar kedua-dua pihak dan merekodkan aduan dengan tertib.' },
    { label: 'Beri amaran segera', xp: 12, trust: -2, performance: 2, integrity: -2, cost: 15, note: 'Keadaan reda buat sementara, tetapi punca aduan belum disahkan.' }
  ]},
  { id: 2, title: 'Kemalangan kecil di simpang', type: 'TRAFIK', location: 'Persimpangan utama', description: 'Dua kenderaan terlibat dalam kemalangan kecil. Aliran trafik mula perlahan.', actions: [
    { label: 'Kawal trafik & bantu', xp: 25, trust: 6, performance: 9, integrity: 2, cost: 60, note: 'Anda memastikan kawasan selamat dan mengurus aliran trafik.' },
    { label: 'Rekod laporan sahaja', xp: 10, trust: -3, performance: 1, integrity: 0, cost: 20, note: 'Laporan direkodkan, namun kawalan trafik lewat dilaksanakan.' }
  ]},
  { id: 3, title: 'Laporan kehilangan telefon', type: 'SIASATAN', location: 'Medan niaga', description: 'Seorang pengunjung melaporkan telefon hilang di kawasan kedai. Maklumat saksi masih diperlukan.', actions: [
    { label: 'Temu bual & rekod bukti', xp: 30, trust: 7, performance: 7, integrity: 4, cost: 35, note: 'Anda merekodkan keterangan dan maklumat bukti untuk tindakan lanjut.' },
    { label: 'Tangguh untuk semakan', xp: 8, trust: -2, performance: -1, integrity: 0, cost: 5, note: 'Laporan diterima tetapi tindakan susulan ditangguhkan.' }
  ]}
];
let state = loadState();
let toastTimer: number | undefined;
let tutorialStep = 0;
let sceneRef: DistrictScene | undefined;
function loadState(): SaveState {
  try { const raw = localStorage.getItem(SAVE_KEY); if (raw) { const value = JSON.parse(raw) as Partial<SaveState>; if (typeof value.day === 'number' && Array.isArray(value.resolvedIds)) return { ...initialState, ...value }; } } catch { /* storage can be unavailable */ }
  return { ...initialState };
}
function saveState() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(state)); } catch { showToast('Simpanan browser tidak tersedia. Kemajuan mungkin tidak kekal.'); } }
function clamp(value: number) { return Math.max(0, Math.min(100, value)); }
function money(value: number) { return `RM ${value.toLocaleString('en-MY')}`; }
function showToast(message: string) {
  const element = document.getElementById('toast'); if (!element) return;
  element.textContent = message; element.classList.add('show');
  if (toastTimer) window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => element.classList.remove('show'), 2800);
}
function tutorial(message: string) {
  const panel = document.getElementById('tutorial'); if (!panel) return;
  panel.querySelector('p')!.textContent = message; panel.classList.add('visible');
}
function render() {
  const set = (id: string, value: string) => { const element = document.getElementById(id); if (element) element.textContent = value; };
  set('day', String(state.day).padStart(2, '0'));
  set('xp', `${state.xp % 100} / 100 XP`);
  const bar = document.getElementById('xp-bar'); if (bar) bar.style.width = `${state.xp % 100}%`;
  set('trust', String(state.trust)); set('budget', money(state.budget)); set('performance', String(state.performance)); set('integrity', String(state.integrity));
  set('rank', state.xp >= 300 ? 'Lans Koperal' : 'Konstabel');
  set('next-rank', state.xp >= 300 ? 'Koperal (sasaran seterusnya)' : state.xp >= 100 ? 'Lans Koperal' : 'Lans Koperal');
  set('case-count', `${cases.filter(item => !state.resolvedIds.includes(item.id)).length} tugasan`);
  set('equipment', String(state.equipment));
  const active = cases.filter(item => !state.resolvedIds.includes(item.id));
  const container = document.getElementById('cases'); if (!container) return;
  if (!active.length) {
    container.innerHTML = '<div class="case"><div class="case-title">Semua tugasan selesai</div><p>Daerah terkawal. Tamatkan syif untuk menerima peruntukan seterusnya.</p></div>';
  } else {
    container.innerHTML = active.map(item => `<article class="case"><div class="case-top"><span class="case-title">${item.title}</span><span class="case-type">${item.type}</span></div><p>${item.description}</p><div class="case-location">⌖ ${item.location}</div><div class="case-actions">${item.actions.map((action, index) => `<button class="action-button" data-case="${item.id}" data-action="${index}">${action.label}<small>+${action.xp} XP · ${money(action.cost)}</small></button>`).join('')}</div></article>`).join('');
  }
  container.querySelectorAll<HTMLButtonElement>('[data-case]').forEach(button => button.addEventListener('click', () => resolveCase(Number(button.dataset.case), Number(button.dataset.action))));
  document.getElementById('next-day')!.textContent = active.length ? 'Tamatkan syif (selesaikan tugasan dahulu)' : 'Tamatkan syif →';
  document.getElementById('next-day')!.toggleAttribute('disabled', active.length > 0);
  document.getElementById('tutorial')?.classList.toggle('visible', !state.tutorialDone);
}
function resolveCase(id: number, index: number) {
  const item = cases.find(entry => entry.id === id); if (!item || state.resolvedIds.includes(id)) return;
  const action = item.actions[index]; if (!action) return;
  if (state.budget < action.cost) { showToast('Bajet tidak mencukupi. Pilih tindakan lain atau tamatkan syif.'); return; }
  state.budget -= action.cost; state.xp += action.xp; state.trust = clamp(state.trust + action.trust); state.performance = clamp(state.performance + action.performance); state.integrity = clamp(state.integrity + action.integrity); state.resolvedIds.push(id);
  saveState(); render(); sceneRef?.setIncidentState(id, true); showToast(`${action.note} +${action.xp} XP`);
  if (!state.tutorialDone) tutorial('Bagus. Tugasan selesai! Pantau kesan keputusan pada status dan bajet anda.');
}
function endShift() {
  if (cases.some(item => !state.resolvedIds.includes(item.id))) { showToast('Selesaikan semua tugasan aktif sebelum tamatkan syif.'); return; }
  state.day += 1; state.resolvedIds = []; state.budget += 250; state.performance = clamp(state.performance + 2); saveState(); render();
  cases.forEach(item => sceneRef?.setIncidentState(item.id, false)); showToast('Syif selesai. Peruntukan operasi baharu: RM 250.');
}
class DistrictScene extends Phaser.Scene {
  private player!: Phaser.GameObjects.Container;
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private playerX = 0;
  private playerY = 0;
  private markerMap = new Map<number, Phaser.GameObjects.Container>();
  private destination?: { x: number; y: number };
  private moveVector = { x: 0, y: 0 };
  constructor() { super('district'); }
  create() {
    sceneRef = this;
    const g = this.add.graphics();
    const w = this.scale.width, h = this.scale.height;
    g.fillGradientStyle(0x17382d, 0x17382d, 0x102820, 0x102820, 1); g.fillRect(0, 0, w, h);
    const tileW = Math.min(w / 8.6, 72), tileH = tileW * .48, originX = w * .5, originY = h * .39;
    for (let row = 0; row < 11; row++) for (let col = 0; col < 13; col++) {
      const x = originX + (col - row) * tileW * .5, y = originY + (col + row) * tileH * .5;
      if (x < -tileW || x > w + tileW || y > h + tileH) continue;
      const palette = (row + col) % 4 === 0 ? 0x244b3a : (row + col) % 3 === 0 ? 0x1e4234 : 0x204634;
      g.fillStyle(palette, 1); g.lineStyle(1, 0x315641, .7); g.beginPath(); g.moveTo(x, y); g.lineTo(x + tileW * .5, y + tileH * .5); g.lineTo(x, y + tileH); g.lineTo(x - tileW * .5, y + tileH * .5); g.closePath(); g.fillPath(); g.strokePath();
    }
    // Diagonal streets and crossings.
    g.lineStyle(30, 0x34463e, 1); g.beginPath(); g.moveTo(w * .02, h * .82); g.lineTo(w * .95, h * .22); g.strokePath();
    g.lineStyle(2, 0x9aab91, .65); g.beginPath(); g.moveTo(w * .02, h * .82); g.lineTo(w * .95, h * .22); g.strokePath();
    g.lineStyle(21, 0x34463e, 1); g.beginPath(); g.moveTo(w * .12, h * .20); g.lineTo(w * .90, h * .78); g.strokePath();
    this.building(g, w * .48, h * .39, tileW * 1.35, tileH * 1.65, 0xc7d8b1, 0x56785a);
    this.add.text(w * .48, h * .29, 'BALAI POLIS', { fontFamily: 'Arial', fontSize: '10px', fontStyle: 'bold', color: '#e6f2d9', stroke: '#173326', strokeThickness: 3 }).setOrigin(.5);
    this.building(g, w * .24, h * .53, tileW * .72, tileH * .95, 0x9fbca0, 0x526d58);
    this.building(g, w * .75, h * .30, tileW * .7, tileH * .9, 0xb7c5a2, 0x63795e);
    this.building(g, w * .77, h * .68, tileW * .76, tileH * .95, 0x7ca18d, 0x3e6756);
    this.building(g, w * .25, h * .76, tileW * .7, tileH * .85, 0x9baf92, 0x596c53);
    for (const [x, y] of [[.14, .35], [.38, .27], [.61, .68], [.87, .43], [.53, .78], [.12, .65]]) this.tree(g, w * x, h * y, tileW * .22);
    this.car(g, w * .58, h * .56, tileW * .45);
    const incidentPoints = [{ id: 1, x: w * .83, y: h * .51 }, { id: 2, x: w * .64, y: h * .77 }, { id: 3, x: w * .22, y: h * .36 }];
    for (const point of incidentPoints) {
      const marker = this.add.container(point.x, point.y).setSize(34, 34).setInteractive({ useHandCursor: true });
      const ring = this.add.circle(0, 0, 12, 0xe6a16d, .24).setStrokeStyle(2, 0xe6a16d, 1);
      marker.add([ring, this.add.circle(0, 0, 4, 0xffc38c, 1)]); this.tweens.add({ targets: ring, scale: 1.6, alpha: .08, duration: 1000, yoyo: true, repeat: -1 });
      marker.on('pointerdown', () => { this.destination = { x: point.x - 14, y: point.y + 18 }; showToast(`Lokasi dipilih: ${cases.find(c => c.id === point.id)?.location ?? 'lokasi kejadian'}. Bergerak ke penanda.`); });
      this.add.text(point.x, point.y + 19, `KES ${point.id}`, { fontFamily: 'Arial', fontSize: '8px', fontStyle: 'bold', color: '#ffc38c', stroke: '#142b21', strokeThickness: 3 }).setOrigin(.5);
      this.markerMap.set(point.id, marker);
    }
    this.add.text(14, 14, 'PETA DAERAH / SERI MAJU', { fontFamily: 'Arial', fontSize: '9px', fontStyle: 'bold', color: '#a8c8b0', backgroundColor: '#10271fbb', padding: { x: 8, y: 6 } });
    this.add.text(w - 14, h - 14, 'SIMULASI FIKSYEN', { fontFamily: 'Arial', fontSize: '8px', color: '#89a795' }).setOrigin(1, 1);
    this.playerX = w * .49; this.playerY = h * .59; this.player = this.makePlayer(this.playerX, this.playerY);
    this.cursors = this.input.keyboard!.createCursorKeys();
    this.keys = this.input.keyboard!.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT') as Record<string, Phaser.Input.Keyboard.Key>;
    this.scale.on('resize', () => this.scene.restart());
    document.querySelectorAll<HTMLButtonElement>('[data-move]').forEach(button => {
      const setVector = (active: boolean) => { const dir = button.dataset.move!; const values: Record<string, [number, number]> = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }; const vector = values[dir]; this.moveVector.x = active ? vector[0] : 0; this.moveVector.y = active ? vector[1] : 0; };
      button.addEventListener('pointerdown', event => { event.preventDefault(); setVector(true); });
      for (const name of ['pointerup', 'pointerleave', 'pointercancel']) button.addEventListener(name, () => setVector(false));
    });
    this.add.text(14, h - 34, 'WASD / ARROW KEYS · PILIH PENANDA UNTUK BERGERAK', { fontFamily: 'Arial', fontSize: '8px', color: '#d0e2d2', backgroundColor: '#10271fbb', padding: { x: 8, y: 6 } });
    for (const item of cases) this.setIncidentState(item.id, state.resolvedIds.includes(item.id));
  }
  update(_time: number, delta: number) {
    const x = Number(this.keys?.A?.isDown || this.keys?.LEFT?.isDown || this.cursors?.left.isDown) * -1 + Number(this.keys?.D?.isDown || this.keys?.RIGHT?.isDown || this.cursors?.right.isDown) + this.moveVector.x;
    const y = Number(this.keys?.W?.isDown || this.keys?.UP?.isDown || this.cursors?.up.isDown) * -1 + Number(this.keys?.S?.isDown || this.keys?.DOWN?.isDown || this.cursors?.down.isDown) + this.moveVector.y;
    const length = Math.hypot(x, y); const speed = 0.16 * delta;
    if (length > 0) { this.playerX += (x / length) * speed; this.playerY += (y / length) * speed; this.destination = undefined; }
    else if (this.destination) { const dx = this.destination.x - this.playerX, dy = this.destination.y - this.playerY, distance = Math.hypot(dx, dy); if (distance < 4) this.destination = undefined; else { this.playerX += dx / distance * speed * .8; this.playerY += dy / distance * speed * .8; } }
    this.playerX = Phaser.Math.Clamp(this.playerX, 25, this.scale.width - 25); this.playerY = Phaser.Math.Clamp(this.playerY, 65, this.scale.height - 35);
    this.player.setPosition(this.playerX, this.playerY); this.player.setDepth(this.playerY);
  }
  setIncidentState(id: number, resolved: boolean) { const marker = this.markerMap.get(id); if (marker) { marker.setAlpha(resolved ? .22 : 1); marker.disableInteractive(); if (!resolved) marker.setInteractive({ useHandCursor: true }); } }
  private makePlayer(x: number, y: number) {
    const player = this.add.container(x, y);
    player.add(this.add.ellipse(0, 9, 20, 9, 0x071710, .45));
    player.add(this.add.ellipse(0, 0, 14, 18, 0x294a3c, 1).setStrokeStyle(1, 0xc2e5a0, .8));
    player.add(this.add.rectangle(0, -5, 11, 13, 0xc3d4b7, 1).setStrokeStyle(1, 0x203a2b, 1));
    player.add(this.add.circle(0, -15, 5, 0xd5ad8a, 1));
    player.add(this.add.rectangle(0, -20, 12, 3, 0x21392e, 1));
    player.add(this.add.rectangle(-4, 8, 4, 8, 0x263b31, 1)); player.add(this.add.rectangle(4, 8, 4, 8, 0x263b31, 1));
    player.add(this.add.circle(0, -26, 3, 0xc6e39f, .9));
    return player;
  }
  private building(g: Phaser.GameObjects.Graphics, x: number, y: number, tw: number, th: number, roof: number, wall: number) {
    g.fillStyle(0x0b1d15, .45); g.fillEllipse(x, y + th * .8, tw * 1.25, th * .75);
    g.fillStyle(wall, 1); g.beginPath(); g.moveTo(x - tw * .5, y); g.lineTo(x, y + th * .5); g.lineTo(x, y + th * 1.35); g.lineTo(x - tw * .5, y + th * .85); g.closePath(); g.fillPath();
    g.fillStyle(Phaser.Display.Color.ValueToColor(wall).darken(22).color, 1); g.beginPath(); g.moveTo(x, y + th * .5); g.lineTo(x + tw * .5, y); g.lineTo(x + tw * .5, y + th * .85); g.lineTo(x, y + th * 1.35); g.closePath(); g.fillPath();
    g.fillStyle(roof, 1); g.lineStyle(1, 0xe2e9c8, .4); g.beginPath(); g.moveTo(x - tw * .5, y); g.lineTo(x, y - th * .55); g.lineTo(x + tw * .5, y); g.lineTo(x, y + th * .5); g.closePath(); g.fillPath(); g.strokePath();
    g.fillStyle(0x263d30, 1); g.fillRect(x - tw * .06, y + th * .38, tw * .12, th * .45);
  }
  private tree(g: Phaser.GameObjects.Graphics, x: number, y: number, size: number) { g.fillStyle(0x0b1b13, .35); g.fillEllipse(x, y + size * .55, size * 1.4, size * .55); g.fillStyle(0x795d3e, 1); g.fillRect(x - size * .08, y, size * .16, size * .7); g.fillStyle(0x4d8a58, 1); g.fillCircle(x, y - size * .1, size * .55); g.fillStyle(0x73a768, 1); g.fillCircle(x - size * .2, y - size * .3, size * .32); }
  private car(g: Phaser.GameObjects.Graphics, x: number, y: number, size: number) { g.fillStyle(0x0c1d15, .4); g.fillEllipse(x, y + size * .32, size * 1.5, size * .55); g.fillStyle(0xd9e6d1, 1); g.fillRoundedRect(x - size * .52, y - size * .2, size * 1.05, size * .45, 4); g.fillStyle(0x254a3a, 1); g.fillRoundedRect(x - size * .2, y - size * .17, size * .4, size * .28, 3); g.fillStyle(0xc7e69f, 1); g.fillRect(x - size * .05, y - size * .25, size * .1, size * .12); g.fillStyle(0x182820, 1); g.fillCircle(x - size * .3, y + size * .2, size * .12); g.fillCircle(x + size * .3, y + size * .2, size * .12); }
}
new Phaser.Game({ type: Phaser.CANVAS, parent: 'game-canvas', width: 760, height: 520, backgroundColor: '#142e27', scene: [DistrictScene], scale: { mode: Phaser.Scale.RESIZE, autoCenter: Phaser.Scale.CENTER_BOTH }, render: { antialias: true, pixelArt: false } });
render();
document.getElementById('next-day')!.addEventListener('click', endShift);
document.getElementById('buy-equipment')!.addEventListener('click', () => {
  const cost = 200;
  if (state.budget < cost) { showToast('Bajet tidak mencukupi untuk membeli peralatan.'); return; }
  state.budget -= cost; state.equipment += 1; state.performance = clamp(state.performance + 3); saveState(); render();
  showToast('Peralatan operasi ditambah. Prestasi kesiapsiagaan meningkat.');
});
document.getElementById('reset')!.addEventListener('click', () => { if (confirm('Padam kemajuan Polis Malaysia Tycoon dan mulakan semula?')) { state = { ...initialState }; saveState(); render(); cases.forEach(item => sceneRef?.setIncidentState(item.id, false)); showToast('Simulasi dimulakan semula.'); } });
document.getElementById('tutorial-next')!.addEventListener('click', () => {
  tutorialStep += 1;
  if (tutorialStep === 1) tutorial('Langkah 2: gerakkan anggota dengan WASD / anak panah atau pad kawalan telefon. Anda juga boleh pilih penanda kes pada peta.');
  else if (tutorialStep === 2) tutorial('Langkah 3: pilih tindakan pada papan tugasan. XP, kepercayaan, prestasi, disiplin dan bajet akan berubah.');
  else { state.tutorialDone = true; saveState(); render(); showToast('Tutorial selesai. Selamat bertugas!'); }
});
