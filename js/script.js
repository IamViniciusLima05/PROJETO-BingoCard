/* BingoCard — cartelas geradas a partir de um código (dá para conferir depois), sorteio com voz e verificação */

const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const banco = {
  ler(k, padrao) { try { const v = JSON.parse(localStorage.getItem(k)); return v ?? padrao; } catch { return padrao; } },
  salvar(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* sem storage */ } }
};
const escapar = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const LETRAS = ['B', 'I', 'N', 'G', 'O'], CORES = ['var(--b)', 'var(--i)', 'var(--n)', 'var(--g)', 'var(--o)'];
const letraDe = (n) => LETRAS[Math.floor((n - 1) / 15)], corDe = (n) => CORES[Math.floor((n - 1) / 15)];
const ALFA = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sem letras que confundem (0/O, 1/I)

/* ---------- Cartela a partir do código ---------- */
function gerador(seed) { let s = 0; for (const c of seed) s = (s * 31 + c.charCodeAt(0)) >>> 0; return () => { s = (s + 0x6D2B79F5) >>> 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t ^= t + Math.imul(t ^ (t >>> 7), 61 | t); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function cartela(codigo) {
  const r = gerador('bingo-' + codigo);
  // 5 colunas: B 1–15, I 16–30, N 31–45 (centro livre), G 46–60, O 61–75
  return LETRAS.map((_, col) => {
    const nums = Array.from({ length: 15 }, (_, k) => col * 15 + k + 1);
    for (let i = nums.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [nums[i], nums[j]] = [nums[j], nums[i]]; }
    return nums.slice(0, 5).sort((a, b) => a - b);
  });
}
function novoCodigo() { const b = new Uint32Array(4); crypto.getRandomValues(b); return [...b].map((x) => ALFA[x % ALFA.length]).join(''); }
const valido = (c) => new RegExp(`^[${ALFA}]{4}$`).test(c);

/* ---------- Sorteio ---------- */
let jogo = banco.ler('bg_jogo', { sorteadas: [] }), autoT = null;
const salvarJogo = () => banco.salvar('bg_jogo', jogo);
function sortear() {
  const resta = Array.from({ length: 75 }, (_, i) => i + 1).filter((n) => !jogo.sorteadas.includes(n));
  if (!resta.length) { pararAuto(); return toast('Todas as 75 bolas já saíram!'); }
  const b = new Uint32Array(1); crypto.getRandomValues(b);
  const n = resta[b[0] % resta.length]; jogo.sorteadas.push(n); salvarJogo();
  mostrarBola(n, true); renderPainel(); narrar(n);
}
function mostrarBola(n, animar) {
  const bola = $('#bola');
  bola.style.setProperty('--cor', n ? corDe(n) : 'var(--azul)');
  $('#bola-letra').textContent = n ? letraDe(n) : 'B'; $('#bola-num').textContent = n || '?';
  bola.setAttribute('aria-label', n ? `${letraDe(n)} ${n}` : 'Nenhuma bola sorteada');
  if (animar) { bola.classList.remove('gira'); void bola.offsetWidth; bola.classList.add('gira'); }
}
function renderPainel() {
  const ult = jogo.sorteadas.at(-1);
  $('#painel').innerHTML = LETRAS.map((l, c) => `<div class="linha" style="--c:${CORES[c]}"><span class="letra">${l}</span>${Array.from({ length: 15 }, (_, k) => { const n = c * 15 + k + 1; return `<span class="n${jogo.sorteadas.includes(n) ? ' saiu' : ''}${n === ult ? ' ultima' : ''}">${n}</span>`; }).join('')}</div>`).join('');
  $('#ultimas').innerHTML = jogo.sorteadas.slice(-6, -1).reverse().map((n) => `<span class="mini" style="--c:${corDe(n)}" title="${letraDe(n)} ${n}">${n}</span>`).join('');
  $('#info').textContent = `${jogo.sorteadas.length} de 75 bolas sorteadas`;
  $('#sortear').disabled = jogo.sorteadas.length >= 75;
}
// narração no estilo de bingo: "B, 7" — e alguns apelidos tradicionais
const APELIDOS = { 1: 'começou o jogo', 11: 'um atrás do outro', 22: 'dois patinhos na lagoa', 33: 'idade de Cristo', 44: 'quatro quatro', 45: 'fim do primeiro tempo', 51: 'boa ideia', 66: 'um tapinha não dói', 69: 'de cabeça pra baixo', 75: 'fim de linha' };
function narrar(n) {
  if (!$('#voz').checked || !('speechSynthesis' in window)) return;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(`${letraDe(n)}... ${n}${APELIDOS[n] ? ', ' + APELIDOS[n] : ''}`); u.lang = 'pt-BR'; u.rate = 0.95;
  const voz = speechSynthesis.getVoices().find((v) => v.lang.startsWith('pt')); if (voz) u.voice = voz;
  speechSynthesis.speak(u);
}
function pararAuto() { clearInterval(autoT); autoT = null; $('#auto').setAttribute('aria-pressed', 'false'); $('#auto').textContent = '▶ Automático'; }
$('#sortear').addEventListener('click', sortear);
$('#auto').addEventListener('click', () => {
  if (autoT) return pararAuto();
  sortear(); autoT = setInterval(sortear, +$('#intervalo').value * 1000);
  $('#auto').setAttribute('aria-pressed', 'true'); $('#auto').textContent = '⏸ Pausar';
});
$('#intervalo').addEventListener('change', () => { if (autoT) { pararAuto(); $('#auto').click(); } });
let reiniciarT;
$('#reiniciar').addEventListener('click', (e) => {
  const b = e.currentTarget;
  if (!b.dataset.conf && jogo.sorteadas.length) { b.dataset.conf = 1; b.textContent = 'Tem certeza? Toque de novo'; reiniciarT = setTimeout(() => { delete b.dataset.conf; b.textContent = 'Novo jogo'; }, 3000); return; }
  clearTimeout(reiniciarT); delete b.dataset.conf; b.textContent = 'Novo jogo';
  pararAuto(); jogo = { sorteadas: [] }; salvarJogo(); mostrarBola(null); renderPainel(); toast('Novo jogo — bolas zeradas');
});
document.addEventListener('keydown', (e) => { if (e.code === 'Space' && !$('#aba-sorteio').hidden && !e.target.closest('input, select, button')) { e.preventDefault(); sortear(); } });

/* ---------- Cartelas ---------- */
let cfg = { titulo: 'Bingo da Família', qtd: 8, porFolha: 4, cor: '#e63946', premio: '', ...banco.ler('bg_cfg', {}) };
let codigos = banco.ler('bg_codigos', []);
function htmlCartela(cod, marcar = [], faltam = []) {
  const c = cartela(cod);
  return `<article class="cartela" style="--cc:${escapar(cfg.cor)}"><h3>${escapar(cfg.titulo)}</h3><table><tr>${LETRAS.map((l) => `<th>${l}</th>`).join('')}</tr>
    ${[0, 1, 2, 3, 4].map((lin) => `<tr>${c.map((col, ci) => (ci === 2 && lin === 2 ? '<td class="livre">★<br>LIVRE</td>' : `<td class="${marcar.includes(col[lin]) ? 'marcada' : ''}${faltam.includes(col[lin]) ? ' falta' : ''}">${col[lin]}</td>`)).join('')}</tr>`).join('')}</table>
    <footer><span>${cfg.premio ? '🎁 ' + escapar(cfg.premio) : 'Boa sorte!'}</span><span>Código <b>${cod}</b></span></footer></article>`;
}
function garantirCodigos() {
  while (codigos.length < cfg.qtd) { const c = novoCodigo(); if (!codigos.includes(c)) codigos.push(c); }
  codigos = codigos.slice(0, cfg.qtd); banco.salvar('bg_codigos', codigos);
}
function renderCartelas() { garantirCodigos(); $('#cartelas').innerHTML = codigos.map((c) => htmlCartela(c)).join(''); }
function lerCfg() {
  cfg = { titulo: $('#titulo').value.trim() || 'Bingo', qtd: Math.max(1, Math.min(60, +$('#qtd').value || 1)), porFolha: +$('#por-folha').value, cor: $('#cor').value, premio: $('#premio').value.trim() };
  banco.salvar('bg_cfg', cfg); renderCartelas();
}
['#titulo', '#qtd', '#por-folha', '#cor', '#premio'].forEach((s) => $(s).addEventListener('input', lerCfg));
$('#gerar').addEventListener('click', () => { codigos = []; renderCartelas(); toast('Novas cartelas geradas'); });
$('#imprimir').addEventListener('click', () => {
  const cols = cfg.porFolha === 1 ? 1 : 2;
  $('#impressao').style.setProperty('--cols', cols);
  $('#impressao').innerHTML = codigos.map((c, i) => htmlCartela(c) + ((i + 1) % cfg.porFolha === 0 && i < codigos.length - 1 ? '<div class="quebra"></div>' : '')).join('');
  print();
});

/* ---------- Conferir ---------- */
function conferir(cod) {
  cod = cod.toUpperCase().trim();
  if (!valido(cod)) { $('#resultado').innerHTML = '<div class="veredito nao"><h2>Código inválido</h2><p>O código tem 4 caracteres, como aparece no rodapé da cartela.</p></div>'; return; }
  const c = cartela(cod), s = new Set(jogo.sorteadas), saiu = (lin, col) => (col === 2 && lin === 2) || s.has(c[col][lin]);
  const linhas = [];
  for (let i = 0; i < 5; i++) {
    if ([0, 1, 2, 3, 4].every((j) => saiu(i, j))) linhas.push(`linha ${i + 1}`);
    if ([0, 1, 2, 3, 4].every((j) => saiu(j, i))) linhas.push(`coluna ${LETRAS[i]}`);
  }
  if ([0, 1, 2, 3, 4].every((k) => saiu(k, k))) linhas.push('diagonal ↘'); if ([0, 1, 2, 3, 4].every((k) => saiu(k, 4 - k))) linhas.push('diagonal ↙');
  const todos = c.flat().filter((n, i) => i !== 12), marcados = todos.filter((n) => s.has(n)), cheia = marcados.length === 24;
  // o que falta para a linha mais perto de completar
  let melhor = null;
  const grupos = [...[0, 1, 2, 3, 4].map((i) => [0, 1, 2, 3, 4].map((j) => [i, j])), ...[0, 1, 2, 3, 4].map((i) => [0, 1, 2, 3, 4].map((j) => [j, i])), [0, 1, 2, 3, 4].map((k) => [k, k]), [0, 1, 2, 3, 4].map((k) => [k, 4 - k])];
  grupos.forEach((g) => { const f = g.filter(([l, col]) => !saiu(l, col)).map(([l, col]) => c[col][l]); if (f.length && (!melhor || f.length < melhor.length)) melhor = f; });
  $('#resultado').innerHTML = `<div>${htmlCartela(cod, marcados, linhas.length || cheia ? [] : melhor || [])}</div>
    <div class="veredito ${linhas.length ? 'ganhou' : 'nao'}">${cheia ? '<h2>🏆 CARTELA CHEIA!</h2>' : linhas.length ? '<h2>🎉 BINGO!</h2>' : '<h2>Ainda não…</h2>'}
      <p>${marcados.length} de 24 números já saíram (${jogo.sorteadas.length} bolas sorteadas).</p>
      ${linhas.length ? `<p>Completou: ${linhas.join(', ')}.</p>` : melhor ? `<p>Falta${melhor.length > 1 ? 'm' : ''} <b>${melhor.length}</b> para fechar uma linha: ${melhor.map((n) => `${letraDe(n)}-${n}`).join(', ')}.</p>` : ''}</div>`;
}
$('#form-conferir').addEventListener('submit', (e) => { e.preventDefault(); conferir($('#codigo').value); });

/* ---------- Abas ---------- */
$$('[data-aba]').forEach((b) => b.addEventListener('click', () => {
  $$('[data-aba]').forEach((x) => x.setAttribute('aria-selected', x === b)); $$('.aba').forEach((s) => { s.hidden = s.id !== 'aba-' + b.dataset.aba; });
  if (b.dataset.aba === 'cartelas') renderCartelas(); if (b.dataset.aba === 'conferir' && $('#codigo').value) conferir($('#codigo').value);
}));
let toastT;
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => { t.hidden = true; }, 2200); }

$('#titulo').value = cfg.titulo; $('#qtd').value = cfg.qtd; $('#por-folha').value = cfg.porFolha; $('#cor').value = cfg.cor; $('#premio').value = cfg.premio;
mostrarBola(jogo.sorteadas.at(-1)); renderPainel();
