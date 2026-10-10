// ═══════════════════════════════════════════════════════════════
// tabelas.js — Tabelas de preço: ambiente comercial com edição
// manual, rascunho por usuário e envio como proposta
// ═══════════════════════════════════════════════════════════════
//
// Alvos de edição (mesma grade para todos):
//   'particular'   preço praticado dos exames (tabela base)
//   {id}           tabela de preço: preço próprio por exame
//   'lab:{id}'     laboratório apoiado: valores diferenciados
//   'conv:{id}'    conveniado: valores diferenciados sobre a tabela base
// Laboratório e conveniado compartilham o comportamento (cx.lab); cx.conv distingue o conveniado
// e cx.ent / cx.caminho apontam para o cadastro dono dos valores.
// Cada tabela tem perfil de custo e piso de margem próprios. As edições
// ficam no rascunho do usuário (rascunhos/) até virarem proposta.

const TB_POR_PAG = 50;
let tabAba = 'tabelas', tabSel = 'particular', labSel = null, convSel = null;
SUBNAV_GANCHO.tabelas = p => { tabAba = p; renderTabelas(); };

const grade = { alvo: 'particular', q: '', filtro: '', pag: 1, ordem: 'mn', dir: 1, sel: new Set() };

const tabelasLista = (todas = true) => lista(ESTADO.tabelas, (a, b) => (a.ordem ?? 99) - (b.ordem ?? 99) || porNome(a, b))
  .filter(t => todas || t.ativa !== false);
const tabelaLabPadrao = () => tabelasLista().find(t => t.tipo === 'lab' && t.ativa !== false) || tabelasLista().find(t => t.tipo === 'lab') || null;
const ehLab = alvo => String(alvo).startsWith('lab:');
const ehConv = alvo => String(alvo).startsWith('conv:');
// Leva a aba Tabelas de preço para o alvo (tabela, laboratório ou conveniado)
function focarAlvo(alvo) {
  if (ehLab(alvo)) { tabAba = 'labs'; labSel = alvo.slice(4); }
  else if (ehConv(alvo)) { tabAba = 'conv'; convSel = alvo.slice(5); }
  else { tabAba = 'tabelas'; tabSel = alvo; }
}

// Contexto de um alvo: de onde vem o preço salvo, referência e regras de margem
function ctxAlvo(alvo) {
  if (alvo === 'particular') return {
    alvo, base: true, nome: 'Particular', icone: 'fa-user', cor: '#00a8cc', tab: null, descRef: 0,
    salvo: k => ESTADO.exames[k]?.precoPraticado || null,
    sistema: k => ESTADO.exames[k]?.precoSistema ?? null,
    ref: null, piso: parametro('margemMinima'), pisoNome: 'mínimo', todos: true
  };
  if (ehLab(alvo)) {
    const id = alvo.slice(4), l = ESTADO.laboratorios[id];
    if (!l) return null;
    const t = ESTADO.tabelas[l.tabelaId] || tabelaLabPadrao();
    return {
      alvo, lab: true, id, ent: l, caminho: CAMINHOS.laboratorios, rotulo: 'Laboratório apoiado', nome: l.nome, icone: 'fa-building-user', cor: t?.cor || '#8b5cf6', tab: t ? { ...t, id: l.tabelaId || t.id } : null, descRef: 0, margemSug: t?.margemSugerida ?? null,
      salvo: k => l.precos?.[k] ?? null, sistema: () => null,
      ref: t ? { nome: t.nome, valor: k => t.precos?.[k] ?? null } : null,
      piso: t?.piso ?? parametro('margemMinima'), pisoNome: 'piso', todos: false
    };
  }
  if (ehConv(alvo)) {
    const id = alvo.slice(5), c = ESTADO.conveniados[id];
    if (!c) return null;
    const t = ESTADO.tabelas[c.tabelaId] || null;    // sem tabela = base Particular
    return {
      alvo, lab: true, conv: true, id, ent: c, caminho: CAMINHOS.conveniados, rotulo: 'Conveniado', nome: c.nome, icone: 'fa-handshake', cor: t?.cor || '#2a9d8f',
      tab: t ? { ...t, id: c.tabelaId } : null, descRef: 0, margemSug: t?.margemSugerida ?? null,
      salvo: k => c.precos?.[k] ?? null, sistema: () => null,
      ref: t ? { nome: t.nome, valor: k => t.precos?.[k] ?? null } : { nome: 'Particular', valor: k => ESTADO.exames[k]?.precoPraticado || null },
      piso: t?.piso ?? parametro('margemMinima'), pisoNome: t ? 'piso' : 'mínimo', todos: false
    };
  }
  const t = ESTADO.tabelas[alvo];
  if (!t) return null;
  return {
    alvo, tabela: true, id: alvo, nome: t.nome, icone: t.icone, cor: t.cor, tab: t, descRef: t.descontoRef || 0, margemSug: t.margemSugerida ?? null,
    salvo: k => t.precos?.[k] ?? null, sistema: k => t.sistema?.[k] ?? null,
    ref: { nome: 'Particular', valor: k => ESTADO.exames[k]?.precoPraticado || null },
    piso: t.piso ?? parametro('margemMinima'), pisoNome: 'piso', todos: true
  };
}
const ctxAtual = () => ctxAlvo(grade.alvo);

function resumoPerfil(t) {
  const p = t?.perfil || {}, partes = [];
  lista(ESTADO.custosFixos, (a, b) => (a.ordem ?? 99) - (b.ordem ?? 99)).forEach(f => {
    if (p[f.id] === false) partes.push(`sem ${f.nome}`);
    else if (typeof p[f.id] === 'number') partes.push(`${f.nome} ${fmt(p[f.id])}`);
  });
  return partes.length ? partes.join(' · ') : 'custos fixos padrão';
}

// ── Rascunho (por usuário, gravado em rascunhos/{alvo}/{usuario}) ──
const RASC = {};                    // alvo → { chave: valor | null (retirar) }
let _rascCarregado = {}, _rascUsuario = null;
const _rascPend = {}, _rascTimer = {};
const rasc = alvo => RASC[alvo] ??= {};
const editado = (cx, k) => k in rasc(cx.alvo);
const precoAtual = (cx, k) => editado(cx, k) ? rasc(cx.alvo)[k] : cx.salvo(k);

async function carregarRascunho(alvo) {
  const u = usuarioAtual();
  if (_rascUsuario !== u.id) { _rascUsuario = u.id; _rascCarregado = {}; Object.keys(RASC).forEach(k => delete RASC[k]); }
  if (_rascCarregado[alvo]) return false;
  _rascCarregado[alvo] = true;
  const v = await DB.ler(`rascunhos/${alvo}/${u.id}`) || {};
  RASC[alvo] = Object.fromEntries(Object.entries(v).map(([k, x]) => [k, x < 0 ? null : x]));
  return Object.keys(v).length > 0;
}

// v: número · null (retirar da tabela) · undefined (desfazer)
function definirRasc(cx, k, v) {
  const r = rasc(cx.alvo), s = cx.salvo(k);
  if (v === undefined || (v == null && s == null) || (v != null && s != null && Math.abs(v - s) < 0.005)) delete r[k];
  else r[k] = v == null ? null : Math.round(v * 100) / 100;
  (_rascPend[cx.alvo] ??= new Set()).add(k);
  clearTimeout(_rascTimer[cx.alvo]);
  _rascTimer[cx.alvo] = setTimeout(() => gravarRasc(cx.alvo), 500);
}
function gravarRasc(alvo) {
  const ks = _rascPend[alvo];
  if (!ks?.size) return Promise.resolve();
  _rascPend[alvo] = new Set();
  const r = rasc(alvo), upd = {};
  ks.forEach(k => { upd[k] = !(k in r) ? null : r[k] == null ? -1 : r[k]; });
  return DB.mesclar(`rascunhos/${alvo}/${usuarioAtual().id}`, upd);
}
function limparRasc(alvo) {
  RASC[alvo] = {};
  clearTimeout(_rascTimer[alvo]); _rascPend[alvo] = new Set();
  return DB.remover(`rascunhos/${alvo}/${usuarioAtual().id}`);
}
// Substitui o rascunho inteiro (importação da coluna PROPOSTA, reabrir proposta)
async function substituirRasc(alvo, valores) {
  const cx = ctxAlvo(alvo);
  RASC[alvo] = {};
  Object.entries(valores).forEach(([k, v]) => {
    const s = cx.salvo(k);
    if ((v == null && s == null) || (v != null && s != null && Math.abs(v - s) < 0.005)) return;
    RASC[alvo][k] = v == null ? null : Math.round(v * 100) / 100;
  });
  _rascCarregado[alvo] = true;
  const obj = Object.fromEntries(Object.entries(RASC[alvo]).map(([k, v]) => [k, v == null ? -1 : v]));
  await DB.gravar(`rascunhos/${alvo}/${usuarioAtual().id}`, Object.keys(obj).length ? obj : null);
  return Object.keys(obj).length;
}

// ── Tela ──────────────────────────────────────────────────────
function renderTabelas() {
  const el = document.getElementById('s-tabelas');
  if (tabSel !== 'particular' && !ESTADO.tabelas[tabSel]) tabSel = 'particular';
  if (labSel && !ESTADO.laboratorios[labSel]) labSel = null;
  if (convSel && !ESTADO.conveniados[convSel]) convSel = null;
  const pend = lista(ESTADO.propostas).filter(p => p.status === 'pendente').length, nQuebras = mapaQuebras().length;
  const botoes = tabAba === 'tabelas' ? (pode('tabelas', 'criar') ? `<button class="btn pri" onclick="abrirConfigTabela()"><i class="fa-solid fa-plus"></i>Nova tabela</button>` : '')
    : tabAba === 'labs' ? `${pode('tabelas', 'editar') ? `<button class="btn" onclick="abrirImportNegociados()"><i class="fa-solid fa-file-import"></i>Importar aba Negociados</button>` : ''}
        ${pode('tabelas', 'criar') ? `<button class="btn pri" onclick="abrirLaboratorio()"><i class="fa-solid fa-plus"></i>Novo laboratório</button>` : ''}`
    : tabAba === 'conv' ? (pode('tabelas', 'criar') ? `<button class="btn pri" onclick="abrirConveniado()"><i class="fa-solid fa-plus"></i>Novo conveniado</button>` : '') : '';
  el.innerHTML = `
    <div class="h-row"><div><h2>Tabelas de preço</h2><p>Edite os preços direto na tabela. As alterações ficam no seu rascunho até serem enviadas para aprovação.</p></div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">${botoes}</div></div>
    <div class="subnav" data-grupo="tabelas">
      <button data-p="tabelas" class="${tabAba === 'tabelas' ? 'on' : ''}"><i class="fa-solid fa-table-list"></i>Tabelas</button>
      <button data-p="labs" class="${tabAba === 'labs' ? 'on' : ''}"><i class="fa-solid fa-building-user"></i>Laboratórios apoiados</button>
      <button data-p="conv" class="${tabAba === 'conv' ? 'on' : ''}"><i class="fa-solid fa-handshake"></i>Conveniados</button>
      <button data-p="propostas" class="${tabAba === 'propostas' ? 'on' : ''}"><i class="fa-solid fa-stamp"></i>Propostas${pend ? `<span class="n-sub">${pend}</span>` : ''}</button>
      <button data-p="hierarquia" class="${tabAba === 'hierarquia' ? 'on' : ''}"><i class="fa-solid fa-stairs"></i>Hierarquia${nQuebras ? `<span class="n-sub aviso">${nQuebras}</span>` : ''}</button>
    </div>
    <div class="pane ${tabAba === 'tabelas' ? 'on' : ''}" id="tabelas-tabelas"></div>
    <div class="pane ${tabAba === 'labs' ? 'on' : ''}" id="tabelas-labs"></div>
    <div class="pane ${tabAba === 'conv' ? 'on' : ''}" id="tabelas-conv"></div>
    <div class="pane ${tabAba === 'propostas' ? 'on' : ''}" id="tabelas-propostas"></div>
    <div class="pane ${tabAba === 'hierarquia' ? 'on' : ''}" id="tabelas-hierarquia"></div>`;
  iniciarSubnav();
  if (tabAba === 'tabelas') desenharPaneTabelas();
  if (tabAba === 'labs') desenharPaneLabs();
  if (tabAba === 'conv') desenharPaneConv();
  if (tabAba === 'propostas') desenharPropostas();
  if (tabAba === 'hierarquia') desenharPaneHierarquia();
}

// Estatísticas de um alvo (preços salvos)
function statsAlvo(cx) {
  const st = { n: 0, ab: 0, sm: 0, km: 0, sd: 0, kd: 0, div: 0 };
  const exs = cx.base ? examesVisiveis().filter(e => e.ativo !== false)
    : Object.keys((cx.lab ? cx.ent?.precos : ESTADO.tabelas[cx.id]?.precos) || {}).map(k => ESTADO.exames[k] && { ...ESTADO.exames[k], id: k }).filter(e => e && exameVisivel(e));
  exs.forEach(e => {
    const p = cx.salvo(e.id);
    if (p == null) return;
    st.n++;
    const c = calcular(e, p, cx.tab);
    if (c.status === 'r') st.ab++;
    if (c.margem != null) { st.sm += c.margem; st.km++; }
    const ref = cx.ref?.valor(e.id);
    if (ref && !precoSimbolico(ref) && !precoSimbolico(p)) { st.sd += 1 - p / ref; st.kd++; }
    const s = cx.sistema(e.id);
    if (s != null && Math.abs(s - p) > 0.004) st.div++;
  });
  st.media = st.km ? st.sm / st.km : null;
  st.desc = st.kd ? st.sd / st.kd : null;
  st.pend = lista(ESTADO.propostas).filter(p => p.status === 'pendente' && p.alvo === cx.alvo).length;
  st.rasc = Object.keys(rasc(cx.alvo)).length;
  return st;
}

function htmlCardAlvo(cx, on, clique) {
  const s = statsAlvo(cx), t = cx.tab;
  const sub = cx.base ? 'Tabela base · preço praticado' : cx.lab ? `${esc(cx.ent?.razaoSocial || cx.rotulo)}${cx.conv ? ` · base ${esc(cx.ref.nome)}` : ''}`
    : `${TIPOS_TABELA[t.tipo]?.nome || 'Tabela'} · piso ${pct(cx.piso, 0)}`;
  const badges = [
    cx.base ? '<span class="badge-s base"><i class="fa-solid fa-star"></i>base</span>' : '',
    t && t.ativa === false && !cx.lab ? '<span class="badge-s off">inativa</span>' : '',
    s.ab ? `<span class="badge-s bad"><i class="fa-solid fa-circle-xmark"></i>${s.ab} abaixo do ${cx.pisoNome}</span>` : s.n ? '<span class="badge-s ok"><i class="fa-solid fa-check"></i>ok</span>' : '',
    s.pend ? `<span class="badge-s warn"><i class="fa-solid fa-stamp"></i>${s.pend} proposta(s)</span>` : '',
    s.rasc ? `<span class="badge-s base"><i class="fa-solid fa-pen"></i>${s.rasc} no rascunho</span>` : ''
  ].join('');
  const st2 = cx.base ? [num(s.div, 0), 'divergem do sistema'] : [s.desc != null ? pct(s.desc) : '—', `desc. médio s/ ${cx.ref?.nome || 'ref.'}`];
  return `<button class="card tcard ${on ? 'on' : ''} ${t && t.ativa === false && !cx.lab ? 'desab' : ''}" onclick="${clique}">
    <div class="tc-h"><span class="tc-ic" style="--c:${cx.cor}"><i class="fa-solid ${cx.icone}"></i></span><div><div class="tc-n">${esc(cx.nome)}</div><div class="tc-s">${sub}</div>
      <div class="tc-b">${badges}</div></div></div>
    <div class="tc-stats"><div><b>${num(s.n, 0)}</b><span>exames</span></div><div><b>${st2[0]}</b><span>${st2[1]}</span></div><div><b>${s.media != null ? pct(s.media) : '—'}</b><span>margem média</span></div></div></button>`;
}

function desenharPaneTabelas() {
  const el = document.getElementById('tabelas-tabelas');
  const alvos = ['particular', ...tabelasLista().map(t => t.id)];
  el.innerHTML = `<div class="cards" id="tab-cards">${alvos.map(a => htmlCardAlvo(ctxAlvo(a), a === tabSel, `selecionarTabela('${a}')`)).join('')}</div>
    <div class="card" style="margin-top:14px" id="tab-detalhe"></div>`;
  abrirGrade(tabSel, 'tab-detalhe');
}

function selecionarTabela(a) {
  if (a === tabSel) return;
  tabSel = a;
  document.querySelectorAll('#tab-cards .tcard').forEach((b, i) => b.classList.toggle('on', ['particular', ...tabelasLista().map(t => t.id)][i] === a));
  abrirGrade(a, 'tab-detalhe');
}

// ── Grade de edição ───────────────────────────────────────────
async function abrirGrade(alvo, contId) {
  const mudou = grade.alvo !== alvo;
  if (mudou) Object.assign(grade, { alvo, q: '', pag: 1, ordem: 'mn', dir: 1, sel: new Set(), filtro: grade.proxFiltro ?? (alvo === 'particular' || ehLab(alvo) || ehConv(alvo) ? '' : 'tab') });
  if (grade.proxQ != null) { grade.q = grade.proxQ; grade.pag = 1; }
  delete grade.proxFiltro; delete grade.proxQ;
  const cx = ctxAlvo(alvo), el = document.getElementById(contId);
  if (!cx || !el) return;
  el.innerHTML = htmlCabGrade(cx) + `
    <div class="toolbar">
      <div class="search"><i class="fa-solid fa-magnifying-glass"></i><input id="gr-q" value="${esc(grade.q)}" placeholder="Buscar exame…" oninput="grade.q=this.value;grade.pag=1;desenharGrade()"></div>
      <div id="pop-grsetor"></div>
      ${cx.lab && pode('tabelas', 'editar') ? '<div id="pop-gradd"></div>' : ''}
      <span class="hint"><i class="fa-solid fa-keyboard"></i> Enter / ↑ ↓ navegam entre preços</span>
    </div>
    <div class="chips" id="gr-chips"></div>
    <div class="bulk" id="gr-bulk"></div>
    <div class="tbl-wrap" style="margin-top:10px"><table class="tab-edit"><thead id="gr-head"></thead><tbody id="gr-body"><tr><td colspan="11"><div class="vazio"><i class="fa-solid fa-circle-notch fa-spin"></i>Carregando…</div></td></tr></tbody></table></div>
    <div class="foot" id="gr-foot"></div>
    <div class="draft-bar" id="gr-bar"></div>`;
  criarPop('pop-grsetor', {
    rotulo: 'Setor', titulo: 'Filtrar por setor', icone: 'fa-filter', busca: 'Buscar setor…', limpavel: true,
    opcoes: () => opcoesSetorPop('Todos os setores', [{ valor: '__sem', rotulo: 'Sem setor', icone: 'fa-triangle-exclamation', cor: 'var(--amber)' }]),
    aoMudar: () => { grade.pag = 1; desenharGrade(); }
  });
  if (cx.lab && pode('tabelas', 'editar')) criarPopAdicionarExame(cx);
  await carregarRascunho(alvo);
  if (grade.alvo !== alvo) return;
  desenharGrade();
}

function htmlCabGrade(cx) {
  const t = cx.tab, l = cx.lab ? cx.ent : null;
  const sub = cx.base ? `Tabela base: o valor editado aqui é o preço praticado do exame · mínimo ${pct(cx.piso)} · alvo do setor ou ${pct(parametro('margemAlvo'))}`
    : cx.lab ? `${[l.razaoSocial, l.cnpj ? 'CNPJ ' + l.cnpj : '', l.codConvenio ? 'convênio ' + l.codConvenio : ''].filter(Boolean).map(esc).join(' · ') || cx.rotulo}<br>${cx.conv ? `Tabela base <b>${esc(cx.ref.nome)}</b>: exame sem valor diferenciado segue o preço dela · ` : ''}Margem pelo perfil da ${esc(t?.nome || 'Particular')}: ${cx.pisoNome} ${pct(cx.piso, 0)}${cx.margemSug != null ? ` · sugestão de margem ${pct(cx.margemSug, 0)}` : ''} · ${resumoPerfil(t)}`
    : `Piso ${pct(cx.piso, 0)}${cx.margemSug != null ? ` · sugestão de margem ${pct(cx.margemSug, 0)}` : ''} · desconto de referência ${pct(cx.descRef, 0)} sobre a Particular · ${resumoPerfil(t)}`;
  const bts = [];
  if (cx.base && pode('tabelas', 'editar')) bts.push(`<button class="btn sm" onclick="abrirImportUnilabParticular()" title="CSV da tabela Particular exportado do Unilab"><i class="fa-solid fa-file-import"></i>Importar do Unilab</button>`);
  if (cx.tabela && pode('tabelas', 'editar')) bts.push(`<button class="btn sm" onclick="abrirImportTabela('${cx.id}')"><i class="fa-solid fa-file-import"></i>Importar</button>`);
  if (cx.lab && pode('tabelas', 'exportar')) bts.push(`<button class="btn sm" onclick="${cx.conv ? 'exportarConveniado' : 'exportarLaboratorio'}('${cx.id}')"><i class="fa-solid fa-file-csv"></i>Exportar lista</button>`);
  if (!cx.lab && pode('tabelas', 'exportar')) bts.push(`<button class="btn sm" onclick="exportarTabelaUnilab('${cx.alvo}')"><i class="fa-solid fa-file-csv"></i>Exportar p/ Unilab</button>`);
  if (pode('tabelas', 'exportar')) bts.push(`<button class="btn sm" onclick="abrirPdfTabela('${cx.alvo}')" title="PDF com os preços publicados"><i class="fa-solid fa-file-pdf"></i>PDF</button>`);
  if (cx.tabela && (pode('tabelas', 'editar') || pode('tabelas', 'criar'))) bts.push(`<button class="btn sm" onclick="abrirConfigTabela('${cx.id}')"><i class="fa-solid fa-gear"></i>Configurar</button>`);
  if (cx.lab && pode('tabelas', 'editar')) bts.push(`<button class="btn sm" onclick="${cx.conv ? 'abrirConveniado' : 'abrirLaboratorio'}('${cx.id}')"><i class="fa-solid fa-pen"></i>Dados</button>`);
  return `<div class="sec-card-h"><span class="tc-ic" style="--c:${cx.cor}"><i class="fa-solid ${cx.icone}"></i></span><div style="min-width:0;flex:1"><h3>${esc(cx.nome)}</h3><div class="sub">${sub}</div></div>
    <div class="rt">${bts.join('')}</div></div>`;
}

// Linha da grade: preço atual (rascunho ou salvo) e cálculo
function linhaGrade(cx, e) {
  const k = e.id, preco = precoAtual(cx, k);
  const hier = cx.lab ? [] : quebrasHierarquia(k, (a, kk) => a === cx.alvo ? preco : precoSalvoHier(a, kk))
    .filter(q => q.alvo === cx.alvo || q.teto.alvo === cx.alvo);
  const ref = cx.ref?.valor(k) ?? null;
  // desconto sobre a referência (negativo = preço acima dela); descRef = desconto de referência da tabela
  return { e, k, preco, c: calcular(e, preco, cx.tab), ed: editado(cx, k), salvo: cx.salvo(k), ref, sist: cx.sistema(k), hier,
    desc: ref && preco != null ? 1 - preco / ref : null, descRef: cx.descRef || 0 };
}

const FILTROS_GRADE = {
  tab:  { nome: 'Na tabela',        icone: 'fa-table-list',          f: x => x.preco != null },
  '':   { nome: 'Todos',            icone: 'fa-list',                f: () => true },
  fora: { nome: 'Fora da tabela',   icone: 'fa-circle-minus',        f: x => x.preco == null },
  r:    { nome: 'Abaixo do piso',   icone: 'fa-circle-xmark',        f: x => x.c.status === 'r', cor: 'var(--red)' },
  a:    { nome: 'Abaixo do alvo',   icone: 'fa-circle-exclamation',  f: x => x.c.status === 'a', cor: 'var(--amber)' },
  x:    { nome: 'Sem custo',        icone: 'fa-circle-question',     f: x => x.preco != null && x.c.semCusto, cor: 'var(--gray)' },
  div:  { nome: 'Diverge do Unilab', icone: 'fa-code-compare',       f: x => x.sist != null && x.preco != null && Math.abs(x.sist - x.preco) > 0.004, cor: 'var(--amber)' },
  dref: { nome: 'Desconto referência', icone: 'fa-percent',          f: x => x.desc != null && x.desc > x.descRef + 0.0005, cor: 'var(--amber)' },
  dneg: { nome: 'Desconto negativo', icone: 'fa-arrow-trend-up',     f: x => x.desc != null && x.desc < -0.0005, cor: 'var(--red)' },
  hier: { nome: 'Quebra hierarquia', icone: 'fa-stairs',            f: x => x.hier.length > 0, cor: 'var(--amber)' },
  ed:   { nome: 'No rascunho',      icone: 'fa-pen',                 f: x => x.ed, cor: 'var(--cyan)' }
};
const filtrosDe = cx => cx.base ? ['', 'r', 'a', 'x', 'div', 'hier', 'ed'] : cx.lab ? ['', 'r', 'x', 'dneg', 'ed'] : ['tab', '', 'fora', 'r', 'x', 'div', 'dref', 'dneg', 'hier', 'ed'];

function linhasGradeBase(cx) {
  const fs = valorPop('pop-grsetor');
  let exs = examesVisiveis().filter(e => e.ativo !== false);
  if (!cx.todos) exs = examesVisiveis().filter(e => cx.salvo(e.id) != null || editado(cx, e.id));
  return exs.filter(e => fs === '__sem' ? !ESTADO.setores[e.setorId] : !fs || e.setorId === fs)
    .filter(e => contem(e.mn + ' ' + e.descricao, grade.q))
    .map(e => linhaGrade(cx, e));
}

function desenharGrade() {
  const cx = ctxAtual(), body = document.getElementById('gr-body');
  if (!cx || !body) return;
  const todas = linhasGradeBase(cx), fls = filtrosDe(cx);
  if (!fls.includes(grade.filtro)) grade.filtro = fls[0];
  const cont = {};
  fls.forEach(f => { cont[f] = todas.filter(FILTROS_GRADE[f].f).length; });
  document.getElementById('gr-chips').innerHTML = fls.filter(f => cont[f] || f === grade.filtro || f === '' || f === 'tab').map(f => {
    const F = FILTROS_GRADE[f], nome = f === 'r' && cx.base ? 'Abaixo do mínimo' : f === 'fora' && cx.lab ? 'Sem valor' : F.nome;
    const dica = f === 'dref' ? `Desconto maior que o de referência da tabela (${pct(cx.descRef, 0)})` : f === 'dneg' ? `Preço acima de ${cx.ref?.nome || 'a referência'}` : '';
    return `<button class="chip ${grade.filtro === f ? 'on' : ''}" title="${esc(dica)}" onclick="grade.filtro='${f}';grade.pag=1;desenharGrade()">${F.cor ? `<span class="d" style="background:${F.cor}"></span>` : `<i class="fa-solid ${F.icone}"></i>`}${nome} <b>${cont[f]}</b></button>`;
  }).join('');

  const linhas = todas.filter(FILTROS_GRADE[grade.filtro].f);
  const val = {
    mn: x => x.e.mn.toUpperCase(), desc: x => normalizar(x.e.descricao), custo: x => x.c.custo ?? -1,
    ref: x => (cx.base ? x.c.sugerido : x.ref) ?? -1, preco: x => x.preco ?? -1, margem: x => x.c.margem ?? -9, descp: x => x.desc ?? -9
  }[grade.ordem] || (x => x.e.mn.toUpperCase());
  linhas.sort((a, b) => { const va = val(a), vb = val(b); return (va < vb ? -1 : va > vb ? 1 : 0) * grade.dir; });
  grade.linhas = linhas;
  const n = Math.max(1, Math.ceil(linhas.length / TB_POR_PAG));
  if (grade.pag > n) grade.pag = n;
  const pagina = linhas.slice((grade.pag - 1) * TB_POR_PAG, grade.pag * TB_POR_PAG);
  const edit = pode('tabelas', 'editar');

  const th = (r, k, cls) => thOrdem(r, k, grade.ordem, grade.dir, 'ordenarGrade', cls);
  const todasSel = linhas.length > 0 && linhas.every(x => grade.sel.has(x.k));
  document.getElementById('gr-head').innerHTML = `<tr>
    <th style="width:40px">${edit ? `<button class="cb ${todasSel ? 'on' : ''}" title="Selecionar todos os ${linhas.length} filtrados" onclick="selTodas(${!todasSel})"><i class="fa-solid fa-check"></i></button>` : ''}</th>
    ${th('MN', 'mn')}${th('Descrição', 'desc')}${th('Custo total', 'custo', 'num')}
    ${cx.base ? th('Sugerido', 'ref', 'num') : th(esc(cx.ref?.nome || 'Ref.'), 'ref', 'num') + th('Desc.', 'descp', 'num col-opt')}
    ${cx.lab ? '' : '<th class="num col-opt">Unilab</th>'}
    ${th(cx.base ? 'Preço praticado' : cx.lab ? 'Valor diferenciado' : 'Preço na tabela', 'preco', 'num')}${th('Margem', 'margem', 'num')}<th>Situação</th><th></th></tr>`;
  body.innerHTML = pagina.map(x => htmlLinhaGrade(cx, x, edit)).join('')
    || `<tr><td colspan="11">${cx.lab && !todas.length ? vazio(cx.icone, `<b>Nenhum valor diferenciado</b><br>${edit ? 'Use "Adicionar exame" para incluir exames com valor próprio.' : ''}`)
      : vazio('fa-magnifying-glass', 'Nenhum exame com esses filtros')}</td></tr>`;
  document.getElementById('gr-foot').innerHTML = paginacao(linhas.length, grade.pag, TB_POR_PAG, 'paginaGrade');
  desenharBulk();
  desenharBarraRasc();
}

function htmlLinhaGrade(cx, x, edit) {
  const { e, k, preco, c, ed, salvo, ref, sist } = x;
  const d = ed && preco != null && salvo != null ? preco - salvo : 0;
  const delta = !ed ? '' : salvo == null ? `<span class="delta-dn">${cx.lab ? 'novo valor' : 'entra na tabela'}</span>`
    : preco == null ? `<span class="delta-up">${cx.lab ? 'remover valor' : 'sai da tabela'}</span>`
    : Math.abs(d) > 0.004 ? `<span class="${d > 0 ? 'delta-dn' : 'delta-up'}">${d > 0 ? '+' : ''}${fmt(d)} (${d > 0 ? '+' : ''}${pct(d / salvo)})</span>` : '';
  const desc = ref && preco != null ? 1 - preco / ref : null;
  const divg = sist != null && preco != null && Math.abs(sist - preco) > 0.004;
  const b = (a, ic, t, off) => `<button title="${t}" ${off ? 'disabled' : ''} onclick="acaoLinha(this,'${a}')"><i class="fa-solid ${ic}"></i></button>`;
  const acoes = !edit ? '' : (cx.base ? b('sug', 'fa-wand-magic-sparkles', `Preço sugerido (alvo ${pct(c.alvo)})`, !c.sugerido)
      : b('ref', cx.lab ? 'fa-equals' : 'fa-percent', cx.lab ? `Usar valor da ${esc(cx.ref?.nome || 'tabela')}` : `Particular − ${pct(cx.descRef, 0)}`, ref == null))
    + (cx.base ? '' : b('msug', 'fa-bullseye', cx.margemSug != null ? `Sugestão de margem (${pct(cx.margemSug, 0)})` : 'Sugestão de margem: defina o percentual em Configurar', cx.margemSug == null || c.semCusto))
    + b('piso', 'fa-arrow-up', `Levar ao ${cx.pisoNome} (${pct(cx.piso, 0)})`, !c.minimo)
    + b('desf', 'fa-rotate-left', 'Desfazer alteração', !ed)
    + (cx.base ? '' : b('rem', 'fa-xmark', cx.lab ? 'Remover valor diferenciado' : 'Retirar da tabela', preco == null));
  const tag = cx.base || c.status === 'x' ? tagStatus(c.status)
    : c.status === 'p' ? tagSt('p', 'fa-circle-minus', cx.lab ? 'Sem valor' : 'Fora da tabela')
    : c.status === 'r' ? tagSt('r', 'fa-circle-xmark', 'Abaixo do piso') : tagSt('g', 'fa-circle-check', 'OK');
  return `<tr data-k="${esc(k)}" class="${ed ? 'ed' : ''} ${preco == null && !cx.base ? 'fora' : ''}">
    <td>${edit ? `<button class="cb ${grade.sel.has(k) ? 'on' : ''}" onclick="selLinha(this)"><i class="fa-solid fa-check"></i></button>` : ''}</td>
    <td class="mn"><a href="#" class="lk-mn" onclick="abrirFicha(this.closest('tr').dataset.k);return false" title="Abrir ficha do exame">${esc(e.mn)}</a></td>
    <td class="desc" title="${esc(e.descricao)}">${esc(e.descricao)}</td>
    <td class="num">${celulaCusto(c)}</td>
    ${cx.base ? `<td class="num muted">${c.sugerido ? fmt(c.sugerido) : '—'}</td>` : `<td class="num muted">${ref != null ? fmt(ref) : '—'}</td><td class="num muted col-opt">${desc != null ? pct(desc) : '—'}</td>`}
    ${cx.lab ? '' : `<td class="num col-opt ${divg ? 'aviso' : 'muted'}">${sist != null ? fmt(sist) : '—'}${divg ? ' <i class="fa-solid fa-code-compare" title="Diferente do preço na tabela"></i>' : ''}</td>`}
    <td class="num"><div class="price-in ${ed ? 'on' : ''}"><span>R$</span><input type="number" step="0.01" min="0" value="${preco != null ? preco.toFixed(2) : ''}" placeholder="—" ${edit ? '' : 'disabled'}
      oninput="editarPreco(this)" onchange="desenharChipsDepois()" onkeydown="teclaGrade(event)" onfocus="this.select()"></div><div class="delta">${delta}</div></td>
    <td class="num" style="color:${c.status === 'r' ? 'var(--red)' : 'inherit'}">${c.margem != null ? pct(c.margem) : '—'}</td>
    <td>${tag}${x.hier.length ? ` <i class="fa-solid fa-stairs flag hier-flag" title="Quebra a hierarquia: ${esc(x.hier.map(textoQuebra).join(' · '))}"></i>` : ''}</td>
    <td class="acts">${acoes}</td></tr>`;
}

// Atualiza uma linha; digitando = não recria o campo de preço (mantém o foco)
function atualizarLinha(k, digitando) {
  const cx = ctxAtual(), tr = [...document.querySelectorAll('#gr-body tr[data-k]')].find(t => t.dataset.k === k);
  const e = ESTADO.exames[k];
  if (!tr || !e) return;
  const tmp = document.createElement('tbody');
  tmp.innerHTML = htmlLinhaGrade(cx, linhaGrade(cx, { ...e, id: k }), pode('tabelas', 'editar'));
  const nova = tmp.firstElementChild;
  if (!digitando) tr.replaceWith(nova);
  else {
    tr.className = nova.className;
    [...tr.children].forEach((td, i) => {
      const inp = td.querySelector('input');
      if (inp) { td.querySelector('.price-in').className = nova.children[i].querySelector('.price-in').className; td.querySelector('.delta').innerHTML = nova.children[i].querySelector('.delta').innerHTML; }
      else if (i > 0) td.innerHTML = nova.children[i].innerHTML;
    });
  }
  desenharBarraRasc();
}

function editarPreco(inp) {
  const cx = ctxAtual(), k = inp.closest('tr').dataset.k, txt = inp.value.trim();
  const v = txt === '' ? null : parseFloat(txt);
  if (v != null && (isNaN(v) || v < 0)) return;
  definirRasc(cx, k, cx.base && v == null ? undefined : v);
  atualizarLinha(k, true);
}
let _chipsTimer = null;
function desenharChipsDepois() { clearTimeout(_chipsTimer); _chipsTimer = setTimeout(() => { if (!document.activeElement?.closest('#gr-body')) desenharGrade(); }, 300); }

function teclaGrade(ev) {
  if (!['Enter', 'ArrowDown', 'ArrowUp'].includes(ev.key)) return;
  ev.preventDefault();
  const ins = [...document.querySelectorAll('#gr-body input')], i = ins.indexOf(ev.target);
  const nx = ins[ev.key === 'ArrowUp' ? i - 1 : i + 1];
  if (nx) nx.focus();
}

// Preço que atinge a margem m: custo total ÷ (1 − imposto − m), arredondado para cima
const precoParaMargem = (c, m) => m == null || c.semCusto || 1 - parametro('imposto') - m <= 0 ? undefined : Math.ceil(c.custo / (1 - parametro('imposto') - m));

function valorAcao(cx, x, a, p = 0) {
  if (a === 'sug') return x.c.sugerido || undefined;
  if (a === 'msug') return precoParaMargem(x.c, cx.margemSug);
  if (a === 'ref') return x.ref != null ? (cx.lab ? x.ref : Math.round(x.ref * (1 - cx.descRef))) : undefined;
  if (a === 'piso') return x.c.minimo || undefined;
  if (a === 'pct') return x.preco != null ? Math.round(x.preco * (1 + p) * 100) / 100 : undefined;
  if (a === 'desc') return x.ref != null ? Math.round(x.ref * (1 - p)) : undefined;
  if (a === 'arr') return x.preco != null ? Math.ceil(x.preco - 0.004) : undefined;
  if (a === 'rem') return null;
}

function acaoLinha(btn, a) {
  const cx = ctxAtual(), k = btn.closest('tr').dataset.k, e = ESTADO.exames[k];
  if (!e) return;
  if (a === 'desf') definirRasc(cx, k, undefined);
  else {
    const v = valorAcao(cx, linhaGrade(cx, { ...e, id: k }), a);
    if (v === undefined) return;
    definirRasc(cx, k, v);
  }
  atualizarLinha(k, false);
}

// ── Seleção e ações em lote ───────────────────────────────────
function selLinha(btn) {
  const k = btn.closest('tr').dataset.k;
  grade.sel.has(k) ? grade.sel.delete(k) : grade.sel.add(k);
  btn.classList.toggle('on', grade.sel.has(k));
  desenharBulk();
}
function selTodas(on) {
  (grade.linhas || []).forEach(x => on ? grade.sel.add(x.k) : grade.sel.delete(x.k));
  desenharGrade();
}

function desenharBulk() {
  const el = document.getElementById('gr-bulk'), cx = ctxAtual();
  if (!el) return;
  el.classList.toggle('on', grade.sel.size > 0);
  if (!grade.sel.size) { el.innerHTML = ''; return; }
  const ant = valorCampo('gr-pct') || (cx.base ? 5 : Math.round(cx.descRef * 100) || 5);
  el.innerHTML = `<b>${grade.sel.size} selecionado(s)</b>
    <div class="inp" style="width:110px"><input id="gr-pct" type="number" step="0.5" value="${esc(ant)}"><span class="suf">%</span></div>
    <button class="btn sm" onclick="acaoLote('pct')" title="Aumenta (ou reduz, com valor negativo) o preço atual"><i class="fa-solid fa-arrow-trend-up"></i>Reajustar</button>
    ${cx.base ? '' : `<button class="btn sm" onclick="acaoLote('desc')" title="${esc(cx.ref?.nome || 'Referência')} menos o percentual"><i class="fa-solid fa-percent"></i>Desconto s/ ${esc(cx.ref?.nome || 'ref.')}</button>`}
    ${cx.base ? `<button class="btn sm" onclick="acaoLote('sug')"><i class="fa-solid fa-wand-magic-sparkles"></i>Sugerido</button>` : ''}
    ${!cx.base && cx.margemSug != null ? `<button class="btn sm" onclick="acaoLote('msug')" title="Preço que atinge ${pct(cx.margemSug, 0)} de margem"><i class="fa-solid fa-bullseye"></i>Sugestão de margem</button>` : ''}
    <button class="btn sm" onclick="acaoLote('piso')" title="Só os que estão abaixo"><i class="fa-solid fa-arrow-up"></i>Levar ao ${cx.pisoNome}</button>
    <button class="btn sm" onclick="acaoLote('arr')" title="Arredonda para cima, sem centavos"><i class="fa-solid fa-coins"></i>Arredondar</button>
    ${cx.base ? '' : `<button class="btn sm" onclick="acaoLote('rem')"><i class="fa-solid fa-xmark"></i>${cx.lab ? 'Remover' : 'Retirar da tabela'}</button>`}
    <button class="btn sm" onclick="acaoLote('desf')"><i class="fa-solid fa-rotate-left"></i>Desfazer</button>
    <button class="btn sm" style="margin-left:auto" onclick="grade.sel.clear();desenharGrade()"><i class="fa-solid fa-xmark"></i>Limpar seleção</button>`;
}

function acaoLote(a) {
  const cx = ctxAtual(), p = (parseFloat(String(valorCampo('gr-pct')).replace(',', '.')) || 0) / 100;
  let n = 0;
  grade.sel.forEach(k => {
    const e = ESTADO.exames[k];
    if (!e) return;
    const x = linhaGrade(cx, { ...e, id: k });
    if (a === 'desf') { if (x.ed) { definirRasc(cx, k, undefined); n++; } return; }
    if (a === 'piso' && x.c.status !== 'r') return;
    const v = valorAcao(cx, x, a, p);
    if (v === undefined) return;
    definirRasc(cx, k, v); n++;
  });
  desenharGrade();
  toast(`${n} preço(s) ${a === 'desf' ? 'restaurado(s)' : 'ajustado(s) no rascunho'}`);
}

function paginaGrade(p) { grade.pag = p; desenharGrade(); document.getElementById('gr-chips')?.scrollIntoView({ block: 'start' }); }
function ordenarGrade(k) { grade.dir = grade.ordem === k ? -grade.dir : 1; grade.ordem = k; desenharGrade(); }

// ── Barra do rascunho ─────────────────────────────────────────
function resumoRasc(cx) {
  const r = rasc(cx.alvo), s = { n: 0, m0: 0, m1: 0, k: 0, ab: 0, novos: 0, sai: 0, sobe: 0, desce: 0 };
  Object.entries(r).forEach(([k, v]) => {
    const e = ESTADO.exames[k];
    if (!e) return;
    s.n++;
    const o = cx.salvo(k), a = o != null ? calcular(e, o, cx.tab) : null, b = v != null ? calcular(e, v, cx.tab) : null;
    if (o == null) s.novos++; else if (v == null) s.sai++; else if (v > o) s.sobe++; else s.desce++;
    if (b?.status === 'r') s.ab++;
    if (a?.margem != null && b?.margem != null) { s.m0 += a.margem; s.m1 += b.margem; s.k++; }
  });
  return s;
}

function desenharBarraRasc() {
  const cx = ctxAtual(), bar = document.getElementById('gr-bar');
  if (!bar || !cx) return;
  const s = resumoRasc(cx);
  bar.classList.toggle('on', s.n > 0);
  if (!s.n) { bar.innerHTML = ''; return; }
  const partes = [s.sobe && `${s.sobe} sobem`, s.desce && `${s.desce} descem`, s.novos && `${s.novos} ${cx.lab ? 'novos' : 'entram'}`, s.sai && `${s.sai} ${cx.lab ? 'removidos' : 'saem'}`].filter(Boolean).join(' · ');
  bar.innerHTML = `<i class="fa-solid fa-pen-to-square"></i><div><b>${s.n} alteração(ões) no seu rascunho</b>
      <div class="s">${partes}${s.k ? ` · margem média dos alterados ${pct(s.m0 / s.k)} → <b>${pct(s.m1 / s.k)}</b>` : ''}${s.ab ? ` · <span style="color:var(--red)">${s.ab} abaixo do ${cx.pisoNome}</span>` : ''}</div></div>
    <div class="acoes"><button class="btn" onclick="descartarRasc()"><i class="fa-solid fa-trash-can"></i>Descartar</button>
      <button class="btn pri" onclick="abrirEnvioProposta()"><i class="fa-solid fa-paper-plane"></i>Revisar e enviar</button></div>`;
}

async function descartarRasc() {
  const cx = ctxAtual(), n = Object.keys(rasc(cx.alvo)).length;
  const ok = await confirmar({ titulo: 'Descartar rascunho?', texto: `${n} alteração(ões) em ${esc(cx.nome)} serão perdidas.`, botao: 'Descartar', perigo: true });
  if (!ok) return;
  await limparRasc(cx.alvo);
  desenharGrade();
  toast('Rascunho descartado');
}

// ── Laboratório: adicionar exame à lista de valores diferenciados ──
function criarPopAdicionarExame(cx) {
  criarPop('pop-gradd', {
    rotulo: 'Adicionar', titulo: 'Adicionar exame com valor diferenciado', icone: 'fa-plus', busca: 'Mnemônico ou nome…', padrao: '',
    opcoes: () => [{ valor: '', rotulo: 'Escolha o exame', icone: 'fa-plus' },
      ...examesVisiveis().filter(e => e.ativo !== false && precoAtual(cx, e.id) == null)
        .sort((a, b) => a.mn.localeCompare(b.mn))
        .map(e => ({ valor: e.id, rotulo: `${e.mn} · ${e.descricao}`, icone: 'fa-flask-vial', desc: cx.ref?.valor(e.id) != null ? `${cx.ref.nome} ${fmt(cx.ref.valor(e.id))}` : 'sem preço na tabela de referência' }))],
    aoMudar: k => {
      if (!k) return;
      const e = ESTADO.exames[k], ref = cx.ref?.valor(k);
      const v = ref ?? e.precoPraticado ?? calcular(e, null, cx.tab).minimo ?? 0;
      definirRasc(cx, k, v);
      POPS['pop-gradd'].valor = ''; desenharBotaoPop('pop-gradd');
      grade.q = ''; grade.filtro = 'ed'; grade.pag = 1;
      document.getElementById('gr-q').value = '';
      desenharGrade();
      setTimeout(() => { const tr = [...document.querySelectorAll('#gr-body tr[data-k]')].find(t => t.dataset.k === k); tr?.querySelector('input')?.focus(); }, 30);
    }
  });
}
