// ═══════════════════════════════════════════════════════════════
// simulador.js — Simulador de reajuste e proposta para laboratório
// ═══════════════════════════════════════════════════════════════
//
// Reajuste: aplica uma regra (percentual, levar ao piso, margem desejada,
//   sugerido, desconto sobre a referência) aos preços salvos de uma tabela,
//   mostra o impacto e leva o resultado ao rascunho do usuário (→ proposta).
// Proposta para laboratório (antiga aba 01.LAB da Lamic-to-Lab): preço
//   proposto × volume mensal por exame, filtro por prazo, margem ponderada e
//   viabilidade pelo piso da tabela. Simulações ficam em simulacoes/{id}.

const SIM_POR_PAG = 50;
let simAba = 'reajuste';
SUBNAV_GANCHO.simulador = p => { simAba = p; renderSimulador(); };

// Arredonda para cima no múltiplo m (0 = centavos)
const arredSim = (v, m) => v == null ? null : m ? Math.ceil(v / m - 1e-9) * m : Math.round(v * 100) / 100;
const alvosSimulaveis = () => ['particular', ...tabelasLista().map(t => t.id), ...lista(ESTADO.laboratorios, porNome).map(l => 'lab:' + l.id)];
const OPCOES_ARRED = [
  { valor: '0', rotulo: 'Centavos', icone: 'fa-coins', desc: 'Sem arredondar' },
  { valor: '1', rotulo: 'R$ 1,00', icone: 'fa-coins', desc: 'Para cima, sem centavos' },
  { valor: '5', rotulo: 'R$ 5,00', icone: 'fa-coins', desc: 'Múltiplo de 5, para cima' },
  { valor: '10', rotulo: 'R$ 10,00', icone: 'fa-coins', desc: 'Múltiplo de 10, para cima' }
];

function renderSimulador() {
  const el = document.getElementById('s-simulador');
  const salvas = lista(ESTADO.simulacoes).length;
  el.innerHTML = `
    <div class="h-row"><div><h2>Simulador</h2><p>Veja o impacto antes de aplicar. Nenhum preço muda até a proposta ser aprovada.</p></div></div>
    <div class="subnav" data-grupo="simulador">
      <button data-p="reajuste" class="${simAba === 'reajuste' ? 'on' : ''}"><i class="fa-solid fa-arrow-trend-up"></i>Reajuste de tabela</button>
      <button data-p="lab" class="${simAba === 'lab' ? 'on' : ''}"><i class="fa-solid fa-handshake"></i>Proposta para laboratório${salvas ? `<span class="n-sub">${salvas}</span>` : ''}</button>
    </div>
    <div class="pane ${simAba === 'reajuste' ? 'on' : ''}" id="simulador-reajuste"></div>
    <div class="pane ${simAba === 'lab' ? 'on' : ''}" id="simulador-lab"></div>`;
  iniciarSubnav();
  if (simAba === 'reajuste') desenharSimReajuste();
  else desenharSimLab();
}

// ═══ Reajuste de tabela ══════════════════════════════════════
const rj = { alvo: 'particular', tipo: 'pct', p: 5, m: null, d: null, escopo: 'todos', naoReduzir: true, filtro: 'alt', q: '', pag: 1, ordem: 'var', dir: -1 };

const TIPOS_REAJUSTE = {
  pct:  { nome: 'Percentual',          icone: 'fa-percent',               desc: 'Aplica % sobre o preço atual' },
  piso: { nome: 'Levar ao piso',       icone: 'fa-arrow-up',              desc: 'Só os abaixo do piso de margem' },
  marg: { nome: 'Margem desejada',     icone: 'fa-bullseye',              desc: 'Preço que atinge a margem informada' },
  sug:  { nome: 'Aplicar sugerido',    icone: 'fa-wand-magic-sparkles',   desc: 'Margem alvo de cada setor', so: 'base' },
  desc: { nome: 'Desconto s/ referência', icone: 'fa-tags',               desc: 'Referência menos o percentual', so: 'ref' }
};
const tiposDe = cx => Object.keys(TIPOS_REAJUSTE).filter(t => !TIPOS_REAJUSTE[t].so || (TIPOS_REAJUSTE[t].so === 'base' ? cx.base : !cx.base && cx.ref));

function desenharSimReajuste() {
  const el = document.getElementById('simulador-reajuste');
  if (!ctxAlvo(rj.alvo)) rj.alvo = 'particular';
  el.innerHTML = `<div class="sim-grid">
      <div class="card form" id="rj-form"></div>
      <div class="card sim-res">
        <div class="impact" id="rj-imp"></div>
        <div class="toolbar">
          <div class="search"><i class="fa-solid fa-magnifying-glass"></i><input id="rj-q" value="${esc(rj.q)}" placeholder="Buscar exame…" oninput="rj.q=this.value;rj.pag=1;desenharResultadoReajuste()"></div>
          <div class="chips sem-pad" id="rj-chips"></div>
        </div>
        <div class="tbl-wrap"><table><thead id="rj-head"></thead><tbody id="rj-body"></tbody></table></div>
        <div class="foot" id="rj-foot"></div>
      </div></div>`;
  desenharFormReajuste();
}

function desenharFormReajuste() {
  const el = document.getElementById('rj-form'), cx = ctxAlvo(rj.alvo);
  if (!el || !cx) return;
  const tipos = tiposDe(cx);
  if (!tipos.includes(rj.tipo)) rj.tipo = 'pct';
  if (rj.m == null) rj.m = Math.round(((cx.base ? parametro('margemAlvo') : cx.margemSug ?? cx.piso + 0.1)) * 1000) / 10;
  if (rj.d == null) rj.d = Math.round((cx.descRef || 0.1) * 1000) / 10;
  const cria = pode('simulador', 'criar');
  const param = rj.tipo === 'pct' ? `<span class="f-label">Percentual</span>
      <div class="range-row"><input type="range" min="-20" max="50" step="0.5" value="${rj.p}" oninput="rj.p=+this.value;document.getElementById('rj-p').value=this.value;recalcReajuste()">
        <div class="inp" style="width:90px"><input id="rj-p" type="number" step="0.5" value="${rj.p}" oninput="rj.p=parseFloat(this.value)||0;this.closest('.range-row').querySelector('input[type=range]').value=rj.p;recalcReajuste()"><span class="suf">%</span></div></div>
      <span class="hint">Negativo reduz o preço</span>`
    : rj.tipo === 'marg' ? `<span class="f-label">Margem desejada</span>
      <div class="inp" style="width:130px"><input type="number" step="0.5" value="${rj.m}" oninput="rj.m=parseFloat(this.value)||0;recalcReajuste()"><span class="suf">%</span></div>
      <span class="hint">${cx.base ? `Alvo geral ${pct(parametro('margemAlvo'))}` : cx.margemSug != null ? `Sugestão de margem da tabela: ${pct(cx.margemSug, 0)}` : `Piso da tabela: ${pct(cx.piso, 0)}`} · exames sem custo ficam de fora</span>`
    : rj.tipo === 'desc' ? `<span class="f-label">Desconto sobre ${esc(cx.ref?.nome || 'a referência')}</span>
      <div class="inp" style="width:130px"><input type="number" step="0.5" value="${rj.d}" oninput="rj.d=parseFloat(this.value)||0;recalcReajuste()"><span class="suf">%</span></div>
      <span class="hint">${cx.descRef ? `Desconto de referência da tabela: ${pct(cx.descRef, 0)}` : ''}</span>`
    : rj.tipo === 'piso' ? `<span class="f-label">Regra</span><div class="hint"><i class="fa-solid fa-circle-info"></i> Exames abaixo de ${pct(cx.piso, 0)} sobem até o ${cx.pisoNome}; os demais não mudam.</div>`
    : `<span class="f-label">Regra</span><div class="hint"><i class="fa-solid fa-circle-info"></i> Preço = custo total ÷ (1 − imposto − margem alvo do setor).</div>`;
  el.innerHTML = `
    <div class="fg"><span class="f-label">Tabela</span><div id="pop-rjalvo" class="block"></div></div>
    <div class="fg"><span class="f-label">Setor</span><div id="pop-rjsetor" class="block"></div></div>
    <div class="fg"><span class="f-label">Aplicar em</span>
      <div class="seg"><button class="${rj.escopo === 'todos' ? 'on' : ''}" onclick="rj.escopo='todos';desenharFormReajuste()" title="Todos os exames com preço"><i class="fa-solid fa-list"></i>Todos</button><button class="${rj.escopo === 'abaixo' ? 'on' : ''}" onclick="rj.escopo='abaixo';desenharFormReajuste()" title="Só os exames abaixo de ${pct(cx.piso, 0)}"><i class="fa-solid fa-circle-xmark"></i>Abaixo do ${cx.pisoNome}</button></div></div>
    <div class="fg"><span class="f-label">Arredondamento</span><div id="pop-rjarred" class="block"></div></div>
    <div class="fg full"><span class="f-label">Tipo de reajuste</span>
      <div class="opt-cards">${tipos.map(t => { const T = TIPOS_REAJUSTE[t]; return `<button type="button" class="oc ${rj.tipo === t ? 'on' : ''}" onclick="rj.tipo='${t}';rj.pag=1;desenharFormReajuste()">
        <span class="po-ic"><i class="fa-solid ${T.icone}"></i></span><span><b>${t === 'piso' ? `Levar ao ${cx.pisoNome}` : T.nome}</b><small>${t === 'piso' ? `Só os abaixo de ${pct(cx.piso, 0)}` : t === 'desc' ? `${esc(cx.ref?.nome || 'Referência')} menos o percentual` : T.desc}</small></span><i class="fa-solid fa-circle-check ck"></i></button>`; }).join('')}</div></div>
    <div class="fg">${param}</div>
    <div class="fg"><span class="f-label">Proteção</span>
      <div class="casc"><div class="casc-r"><div class="lft"><i class="fa-solid fa-shield"></i><div>Não reduzir preços<div class="s">mantém o atual quando a regra daria menos</div></div></div>${chave(rj.naoReduzir, 'rj.naoReduzir=!rj.naoReduzir;this.classList.toggle(\'on\');recalcReajuste()')}</div></div></div>
    ${cria ? `<div class="fg sim-acoes">
      <button class="btn" onclick="levarReajuste(false)"><i class="fa-solid fa-pen"></i>Levar ao meu rascunho</button>
      <button class="btn pri" onclick="levarReajuste(true)"><i class="fa-solid fa-paper-plane"></i>Enviar como proposta</button></div>`
      : '<div class="fg hint sim-acoes"><i class="fa-solid fa-lock"></i> Seu grupo só pode visualizar simulações.</div>'}`;
  criarPop('pop-rjalvo', {
    rotulo: 'Tabela', titulo: 'Tabela a simular', icone: 'fa-table-list', padrao: 'particular', busca: 'Buscar tabela…',
    opcoes: () => alvosSimulaveis().map(a => {
      const c = ctxAlvo(a);
      return { valor: a, rotulo: c.nome, icone: c.icone, cor: c.cor, grupo: c.lab ? 'Laboratórios apoiados' : 'Tabelas', desc: c.base ? 'Preço praticado' : `piso ${pct(c.piso, 0)}` };
    }),
    aoMudar: a => { rj.alvo = a; rj.m = null; rj.d = null; rj.pag = 1; desenharFormReajuste(); }
  });
  criarPop('pop-rjsetor', {
    rotulo: 'Setor', titulo: 'Escopo do reajuste', icone: 'fa-bullseye', busca: 'Buscar setor…', limpavel: true,
    opcoes: () => opcoesSetorPop('Todos os setores', [{ valor: '__sem', rotulo: 'Sem setor', icone: 'fa-triangle-exclamation', cor: 'var(--amber)' }]),
    aoMudar: () => { rj.pag = 1; recalcReajuste(); }
  });
  criarPop('pop-rjarred', {
    rotulo: 'Arredondar', titulo: 'Arredondamento do novo preço', icone: 'fa-coins', padrao: '1', opcoes: OPCOES_ARRED,
    aoMudar: () => recalcReajuste()
  });
  recalcReajuste();
}

// Novo preço de um exame pela regra escolhida (undefined = não muda)
function novoPrecoReajuste(cx, x) {
  const { atual, c, ref } = x;
  let v;
  if (rj.tipo === 'pct') v = atual * (1 + (rj.p || 0) / 100);
  else if (rj.tipo === 'piso') v = c.status === 'r' ? c.minimo : undefined;
  else if (rj.tipo === 'marg') v = precoParaMargem(c, (rj.m || 0) / 100);
  else if (rj.tipo === 'sug') v = c.sugerido || undefined;
  else if (rj.tipo === 'desc') v = ref != null ? ref * (1 - (rj.d || 0) / 100) : undefined;
  if (v == null || isNaN(v) || v <= 0) return undefined;
  v = arredSim(v, +valorPop('pop-rjarred') || 0);
  if (rj.naoReduzir && v < atual) return undefined;
  return Math.abs(v - atual) < 0.005 ? undefined : v;
}

let _rjLinhas = [], _rjSimbolicos = 0;
function calcularReajuste() {
  const cx = ctxAlvo(rj.alvo), fs = valorPop('pop-rjsetor');
  _rjSimbolicos = 0;
  _rjLinhas = examesVisiveis().filter(e => e.ativo !== false)
    .filter(e => fs === '__sem' ? !ESTADO.setores[e.setorId] : !fs || e.setorId === fs)
    .map(e => {
      const atual = cx.salvo(e.id);
      if (atual == null) return null;
      if (precoSimbolico(atual)) { _rjSimbolicos++; return null; }
      const c = calcular(e, atual, cx.tab);
      if (rj.escopo === 'abaixo' && c.status !== 'r') return null;
      const x = { e, k: e.id, atual, c, ref: cx.ref?.valor(e.id) ?? null };
      const v = novoPrecoReajuste(cx, x);
      x.alt = v !== undefined;
      x.novo = x.alt ? v : atual;
      x.c1 = x.alt ? calcular(e, x.novo, cx.tab) : c;
      x.var = x.novo / atual - 1;
      return x;
    }).filter(Boolean);
  return _rjLinhas;
}

function recalcReajuste() {
  const cx = ctxAlvo(rj.alvo), ls = calcularReajuste(), alt = ls.filter(x => x.alt);
  const media = (arr, f) => { const v = arr.map(f).filter(n => n != null && !isNaN(n)); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; };
  const m0 = media(ls, x => x.c.margem), m1 = media(ls, x => x.c1.margem);
  const ab0 = ls.filter(x => x.c.status === 'r').length, ab1 = ls.filter(x => x.c1.status === 'r').length;
  const saem = ls.filter(x => x.c.status === 'r' && x.c1.status !== 'r').length;
  const sobe = alt.filter(x => x.novo > x.atual).length, desce = alt.length - sobe;
  const s0 = ls.reduce((s, x) => s + x.atual, 0), s1 = ls.reduce((s, x) => s + x.novo, 0);
  const semCusto = ls.filter(x => x.c.semCusto).length;
  const imp = (ic, rot, v, d, cls = '') => `<div class="imp"><div class="l"><i class="fa-solid ${ic}"></i>${rot}</div><div class="v">${v}</div><div class="d ${cls}">${d}</div></div>`;
  document.getElementById('rj-imp').innerHTML =
    imp('fa-flask-vial', 'Exames alterados', `${num(alt.length, 0)}<small> de ${num(ls.length, 0)}</small>`, `<span class="muted">${[sobe && `${sobe} sobem`, desce && `${desce} descem`].filter(Boolean).join(' · ') || 'nenhuma alteração'}</span>`)
    + imp('fa-tags', 'Variação média', alt.length ? `${media(alt, x => x.var) >= 0 ? '+' : ''}${pct(media(alt, x => x.var))}` : '—', `<span class="muted">no escopo ${s0 ? `${s1 >= s0 ? '+' : ''}${pct(s1 / s0 - 1)}` : '—'}</span>`)
    + imp('fa-percent', 'Margem média', m1 != null ? pct(m1) : '—', `<i class="fa-solid fa-clock-rotate-left"></i>antes ${m0 != null ? pct(m0) : '—'}`, m1 == null || m0 == null ? 'muted' : m1 >= m0 ? 'up' : 'dn')
    + imp('fa-life-ring', `Abaixo do ${cx.pisoNome}`, num(ab1, 0), `<span class="muted">antes ${ab0}${saem ? ` · <b style="color:var(--green)">${saem} saem</b>` : ''}</span>`)
    + (semCusto ? imp('fa-circle-question', 'Sem custo', num(semCusto, 0), '<span class="muted">margem desconhecida</span>') : '')
    + (_rjSimbolicos ? imp('fa-ban', 'Ignorados', num(_rjSimbolicos, 0), `<span class="muted">preço abaixo de ${fmt(PRECO_MIN_VARIACAO)}</span>`) : '');
  desenharResultadoReajuste();
}

const FILTROS_RJ = {
  alt:   { nome: 'Alterados',       f: x => x.alt, icone: 'fa-pen' },
  todos: { nome: 'Todos no escopo', f: () => true, icone: 'fa-list' },
  r:     { nome: 'Abaixo depois',   f: x => x.c1.status === 'r', cor: 'var(--red)' },
  saem:  { nome: 'Saem do vermelho', f: x => x.c.status === 'r' && x.c1.status !== 'r', cor: 'var(--green)' }
};

function desenharResultadoReajuste() {
  const body = document.getElementById('rj-body');
  if (!body) return;
  const cx = ctxAlvo(rj.alvo), base = _rjLinhas.filter(x => contem(x.e.mn + ' ' + x.e.descricao, rj.q));
  document.getElementById('rj-chips').innerHTML = Object.entries(FILTROS_RJ).map(([k, F]) => {
    const n = base.filter(F.f).length;
    if (!n && k !== rj.filtro && k !== 'alt' && k !== 'todos') return '';
    return `<button class="chip ${rj.filtro === k ? 'on' : ''}" onclick="rj.filtro='${k}';rj.pag=1;desenharResultadoReajuste()">${F.cor ? `<span class="d" style="background:${F.cor}"></span>` : `<i class="fa-solid ${F.icone}"></i>`}${k === 'r' ? `Abaixo do ${cx.pisoNome} depois` : F.nome} <b>${n}</b></button>`;
  }).join('');
  const ls = base.filter(FILTROS_RJ[rj.filtro].f);
  const val = { mn: x => x.e.mn.toUpperCase(), desc: x => normalizar(x.e.descricao), custo: x => x.c.custo ?? -1, atual: x => x.atual, novo: x => x.novo,
    var: x => x.var, m0: x => x.c.margem ?? -9, m1: x => x.c1.margem ?? -9 }[rj.ordem] || (x => x.e.mn);
  ls.sort((a, b) => { const va = val(a), vb = val(b); return (va < vb ? -1 : va > vb ? 1 : 0) * rj.dir; });
  const n = Math.max(1, Math.ceil(ls.length / SIM_POR_PAG));
  if (rj.pag > n) rj.pag = n;
  const th = (r, k, cls) => thOrdem(r, k, rj.ordem, rj.dir, 'ordenarReajuste', cls);
  document.getElementById('rj-head').innerHTML = `<tr>${th('MN', 'mn')}${th('Descrição', 'desc')}${th('Custo total', 'custo', 'num')}${th('Atual', 'atual', 'num')}${th('Novo', 'novo', 'num')}${th('Variação', 'var', 'num')}${th('Margem atual', 'm0', 'num')}${th('Nova margem', 'm1', 'num')}<th>Situação</th></tr>`;
  body.innerHTML = ls.slice((rj.pag - 1) * SIM_POR_PAG, rj.pag * SIM_POR_PAG).map(x => `<tr class="${x.alt ? '' : 'fora'}">
      <td class="mn"><a href="#" class="lk-mn" onclick="abrirFicha('${esc(x.k)}');return false">${esc(x.e.mn)}</a></td>
      <td class="desc" title="${esc(x.e.descricao)}">${esc(x.e.descricao)}</td>
      <td class="num">${celulaCusto(x.c)}</td>
      <td class="num muted">${fmt(x.atual)}</td>
      <td class="num"><b>${fmt(x.novo)}</b></td>
      <td class="num ${x.var > 0.0001 ? 'delta-dn' : x.var < -0.0001 ? 'delta-up' : 'muted'}">${x.alt ? `${x.var > 0 ? '+' : ''}${pct(x.var)}` : '—'}</td>
      <td class="num" style="color:${x.c.status === 'r' ? 'var(--red)' : 'inherit'}">${x.c.margem != null ? pct(x.c.margem) : '—'}</td>
      <td class="num" style="color:${x.c1.status === 'r' ? 'var(--red)' : 'inherit'}"><b>${x.c1.margem != null ? pct(x.c1.margem) : '—'}</b></td>
      <td>${situacaoSim(cx, x.c1)}</td></tr>`).join('')
    || `<tr><td colspan="9">${vazio('fa-sliders', _rjLinhas.length ? 'Nenhum exame com esse filtro' : `Nenhum exame com preço em ${esc(cx.nome)} neste escopo`)}</td></tr>`;
  document.getElementById('rj-foot').innerHTML = paginacao(ls.length, rj.pag, SIM_POR_PAG, 'paginaReajuste');
}
const situacaoSim = (cx, c) => cx.base || c.status === 'x' ? tagStatus(c.status) : c.status === 'r' ? tagSt('r', 'fa-circle-xmark', 'Abaixo do piso') : tagSt('g', 'fa-circle-check', 'OK');
function paginaReajuste(p) { rj.pag = p; desenharResultadoReajuste(); }
function ordenarReajuste(k) { rj.dir = rj.ordem === k ? -rj.dir : (k === 'var' ? -1 : 1); rj.ordem = k; desenharResultadoReajuste(); }

// Vai para a grade da tabela (filtro "No rascunho")
function irParaGrade(alvo) {
  if (ehLab(alvo)) { tabAba = 'labs'; labSel = alvo.slice(4); }
  else { tabAba = 'tabelas'; tabSel = alvo; }
  grade.alvo = null; grade.proxFiltro = 'ed';
  irPara('tabelas');
}

// Soma valores ao rascunho do usuário (os mesmos exames são substituídos)
async function levarAoRascunho(alvo, valores, origem) {
  const cx = ctxAlvo(alvo), ks = Object.keys(valores);
  await carregarRascunho(alvo);
  const outros = Object.keys(rasc(alvo)).filter(k => !(k in valores)).length;
  if (outros) {
    const ok = await confirmar({ titulo: 'Somar ao rascunho?', texto: `Seu rascunho de <b>${esc(cx.nome)}</b> já tem ${outros} outra(s) alteração(ões). Os ${ks.length} valores simulados serão somados a ele.`, botao: 'Somar' });
    if (!ok) return false;
  }
  ks.forEach(k => definirRasc(cx, k, valores[k]));
  clearTimeout(_rascTimer[alvo]);
  await gravarRasc(alvo);
  registrar('tabelas', `${cx.nome}: ${ks.length} preço(s) do simulador (${origem}) levados ao rascunho`);
  return true;
}

async function levarReajuste(enviar) {
  const alt = _rjLinhas.filter(x => x.alt);
  if (!alt.length) return toast('Nenhum preço muda com essa regra', 'erro');
  const T = TIPOS_REAJUSTE[rj.tipo], origem = rj.tipo === 'pct' ? `${rj.p > 0 ? '+' : ''}${num(rj.p, 1)}%` : rj.tipo === 'marg' ? `margem ${num(rj.m, 1)}%` : rj.tipo === 'desc' ? `desconto ${num(rj.d, 1)}%` : T.nome.toLowerCase();
  const ok = await levarAoRascunho(rj.alvo, Object.fromEntries(alt.map(x => [x.k, x.novo])), origem);
  if (!ok) return;
  irParaGrade(rj.alvo);
  if (enviar) abrirEnvioProposta();
  else toast(`${alt.length} preço(s) no seu rascunho`);
}

// ═══ Proposta para laboratório (01.LAB) ═══════════════════════
const pl = { id: null, nome: '', labId: '', tabelaId: null, base: 'tab', d: 10, itens: {}, pdf: null, filtro: 'tab', prazo: 0, q: '', pag: 1, ordem: 'mn', dir: 1, sujo: false };
const PRAZOS_LAB = [[0, 'Todos'], [1, '24h'], [2, '48h'], [4, '96h'], [5, '5 dias'], [30, '30 dias']];

// dias do cadastro (0 = 24 horas); texto antigo: "24 H" → 0 · "48h" → 2 · "4 Dias" → 4 · "N/A" → null
function diasPrazo(k) {
  const c = ESTADO.catalogo?.[k];
  const d = c?.prazoDias ?? ESTADO.exames[k]?.prazoDias;
  if (d != null && !isNaN(d)) return +d;
  const t = String(c?.prazo || ESTADO.exames[k]?.prazo || '');
  let m = t.match(/(\d+)\s*h/i);
  if (m) return +m[1] <= 24 ? 0 : Math.ceil(+m[1] / 24);
  m = t.match(/(\d+)\s*d/i);
  return m ? +m[1] : null;
}
const textoPrazo = k => { const c = ESTADO.catalogo?.[k], e = ESTADO.exames[k]; return prazoTexto(c?.prazoDias ?? e?.prazoDias) || c?.prazo || e?.prazo || ''; };

// Contexto: tabela de referência (perfil de custo, piso) e laboratório vinculado
function ctxLabSim() {
  const t = ESTADO.tabelas[pl.tabelaId] || null, l = ESTADO.laboratorios[pl.labId] || null;
  return {
    t, l, tab: t ? { ...t, id: pl.tabelaId } : null, piso: t?.piso ?? parametro('margemMinima'), margemSug: t?.margemSugerida ?? null,
    // preço simbólico (abaixo de R$ 1,00) não serve de referência
    ref: k => { const v = t ? t.precos?.[k] ?? null : ESTADO.exames[k]?.precoPraticado || null; return precoSimbolico(v) ? null : v; },
    refNome: t?.nome || 'Particular'
  };
}

function precoPadraoLab(cl, e, ref) {
  const atualLab = cl.l?.precos?.[e.id];
  if (pl.base === 'tab') return atualLab ?? ref;
  if (pl.base === 'desc') return ref != null ? Math.round(ref * (1 - (pl.d || 0) / 100)) : null;
  if (pl.base === 'msug') { const c = calcular(e, null, cl.tab); return precoParaMargem(c, cl.margemSug) ?? null; }
  return ref;
}

function linhaLab(cl, e) {
  const k = e.id, it = pl.itens[k] || {}, ref = cl.ref(k), padrao = precoPadraoLab(cl, e, ref);
  const preco = it.p ?? padrao, vol = it.v || 0, c = calcular(e, preco, cl.tab);
  const lucro = c.lucro != null ? c.lucro * vol : null;
  return { e, k, ref, padrao, preco, man: it.p != null, vol, c, receita: preco != null ? preco * vol : 0, lucro, prazo: diasPrazo(k), desc: ref && preco != null ? 1 - preco / ref : null };
}

function resumoLab(cl) {
  const s = { n: 0, vol: 0, receita: 0, lucro: 0, semCusto: 0, ab: 0, refT: 0, recC: 0 };
  Object.entries(pl.itens).forEach(([k, it]) => {
    const e = ESTADO.exames[k];
    if (!e || !(it.v > 0)) return;
    const x = linhaLab(cl, { ...e, id: k });
    if (x.preco == null) return;
    s.n++; s.vol += x.vol; s.receita += x.receita;
    if (x.c.semCusto) s.semCusto++;
    else { s.lucro += x.lucro; s.recC += x.receita; if (x.c.status === 'r') s.ab++; }
    if (x.ref) s.refT += x.ref * x.vol;
  });
  s.margem = s.recC ? s.lucro / s.recC : null;
  s.desc = s.refT ? 1 - s.receita / s.refT : null;
  s.viavel = s.margem != null && s.margem >= cl.piso;
  return s;
}

function desenharSimLab() {
  const el = document.getElementById('simulador-lab');
  if (pl.tabelaId == null || (pl.tabelaId && !ESTADO.tabelas[pl.tabelaId])) pl.tabelaId = tabelaLabPadrao()?.id || '';
  if (pl.labId && !ESTADO.laboratorios[pl.labId]) pl.labId = '';
  const cria = pode('simulador', 'criar'), sv = pl.id ? ESTADO.simulacoes[pl.id] : null;
  el.innerHTML = `<div class="card">
      <div class="sec-card-h"><span class="tc-ic" style="--c:#8b5cf6"><i class="fa-solid fa-handshake"></i></span>
        <div style="min-width:0;flex:1"><h3>${esc(pl.nome || 'Nova proposta')}${pl.sujo ? ' <span class="badge-s warn">não salva</span>' : sv ? ' <span class="badge-s ok">salva</span>' : ''}</h3>
          <div class="sub">${sv ? `${esc(sv.autor)} · ${dataHora(sv.atualizadoEm || sv.em)}` : 'Preço proposto × volume mensal por exame · margem pelo perfil de custo da tabela de referência'}</div></div>
        <div class="rt"><div id="pop-plsalvas"></div>
          <button class="btn sm" onclick="novaSimLab()"><i class="fa-solid fa-file"></i>Nova</button>
          <button class="btn sm" onclick="exportarSimLab()"><i class="fa-solid fa-file-csv"></i>Exportar</button>
          <button class="btn sm" onclick="abrirPdfLab()" title="Proposta em PDF com texto de apresentação"><i class="fa-solid fa-file-pdf"></i>PDF</button>
          <button class="btn sm" onclick="abrirModeloPdf()" title="Texto padrão do PDF, vale para todas as propostas"><i class="fa-solid fa-file-signature"></i>Texto padrão</button>
          ${sv && (usuarioAtual().admin || sv.autorId === usuarioAtual().id || pode('simulador', 'aprovar')) ? `<button class="btn sm perigo-txt" onclick="excluirSimLab()" title="Excluir simulação"><i class="fa-solid fa-trash"></i></button>` : ''}
          ${cria ? `<button class="btn sm pri" onclick="salvarSimLab()"><i class="fa-solid fa-floppy-disk"></i>Salvar</button>` : ''}</div></div>
      <div class="fgrid pl-dados">
        ${campo('pl-nome', 'Nome da proposta', pl.nome, { tipo: 'text', ph: 'Ex.: Lab. Vida — out/2026', aoMudar: 'pl.nome=this.value;pl.sujo=true' })}
        <div class="field"><label>Laboratório</label><div id="pop-pllab" class="block"></div></div>
        <div class="field"><label>Tabela de referência</label><div id="pop-pltab" class="block"></div></div>
        <div class="field"><label>Preço inicial</label><div id="pop-plbase" class="block"></div></div>
        ${pl.base === 'desc' ? campo('pl-d', 'Desconto', pl.d, { suf: '%', passo: '0.5', aoMudar: 'pl.d=parseFloat(this.value)||0;pl.sujo=true;desenharTabelaLab()' }) : ''}
      </div>
      <div class="impact" id="pl-imp" style="padding-top:0"></div>
      <div class="toolbar">
        <div class="search"><i class="fa-solid fa-magnifying-glass"></i><input id="pl-q" value="${esc(pl.q)}" placeholder="Buscar exame…" oninput="pl.q=this.value;pl.pag=1;desenharTabelaLab()"></div>
        <div id="pop-plsetor"></div>
        <div class="seg" title="Prazo de liberação máximo">${PRAZOS_LAB.map(([d, r]) => `<button class="${pl.prazo === d ? 'on' : ''}" onclick="pl.prazo=${d};pl.pag=1;desenharSimLab()">${d ? '<i class="fa-solid fa-clock"></i>' : ''}${d ? 'até ' : ''}${r}</button>`).join('')}</div>
        <span class="hint"><i class="fa-solid fa-keyboard"></i> Enter / ↑ ↓ navegam</span>
      </div>
      <div class="chips" id="pl-chips"></div>
      <div class="bulk on" id="pl-bulk"></div>
      <div class="tbl-wrap"><table class="tab-edit"><thead id="pl-head"></thead><tbody id="pl-body"><tr><td colspan="12"><div class="vazio"><i class="fa-solid fa-circle-notch fa-spin"></i>Carregando…</div></td></tr></tbody></table></div>
      <div class="foot" id="pl-foot"></div></div>`;
  criarPop('pop-pllab', {
    rotulo: 'Laboratório', titulo: 'Laboratório da proposta', icone: 'fa-building-user', padrao: '', busca: 'Buscar laboratório…',
    opcoes: () => [{ valor: '', rotulo: 'Prospecção (sem cadastro)', icone: 'fa-user-plus', desc: 'Laboratório ainda não atendido' },
      ...lista(ESTADO.laboratorios, porNome).map(l => ({ valor: l.id, rotulo: l.nome, icone: 'fa-building-user', cor: ESTADO.tabelas[l.tabelaId]?.cor, desc: `${Object.keys(l.precos || {}).length} valor(es) diferenciado(s)` }))],
    aoMudar: v => { pl.labId = v; pl.sujo = true; if (v && ESTADO.laboratorios[v].tabelaId && ESTADO.tabelas[ESTADO.laboratorios[v].tabelaId]) pl.tabelaId = ESTADO.laboratorios[v].tabelaId; desenharSimLab(); }
  });
  POPS['pop-pllab'].valor = pl.labId; desenharBotaoPop('pop-pllab');
  criarPop('pop-pltab', {
    rotulo: 'Tabela', titulo: 'Tabela de referência', icone: 'fa-table-list', padrao: '',
    opcoes: () => [...tabelasLista().map(t => ({ valor: t.id, rotulo: t.nome, icone: t.icone, cor: t.cor, grupo: TIPOS_TABELA[t.tipo]?.nome, desc: `piso ${pct(t.piso ?? parametro('margemMinima'), 0)} · ${resumoPerfil(t)}` })),
      { valor: '', rotulo: 'Particular', icone: 'fa-user', cor: '#00a8cc', grupo: 'Base', desc: 'Preço praticado e custos fixos padrão' }],
    aoMudar: v => { pl.tabelaId = v; pl.sujo = true; desenharSimLab(); }
  });
  POPS['pop-pltab'].valor = pl.tabelaId; desenharBotaoPop('pop-pltab');
  const cl = ctxLabSim();
  criarPop('pop-plbase', {
    rotulo: 'Preço inicial', titulo: 'Preço dos exames não digitados', icone: 'fa-tag', padrao: 'tab',
    opcoes: () => [{ valor: 'tab', rotulo: `Valor da ${cl.refNome}`, icone: 'fa-equals', desc: pl.labId ? 'ou o valor diferenciado atual do laboratório' : 'Preço da tabela de referência' },
      { valor: 'desc', rotulo: 'Desconto sobre a tabela', icone: 'fa-percent', desc: 'Tabela menos o percentual, sem centavos' },
      { valor: 'msug', rotulo: 'Sugestão de margem', icone: 'fa-bullseye', desc: cl.margemSug != null ? `Preço que atinge ${pct(cl.margemSug, 0)}` : 'Defina em Configurar da tabela' }],
    aoMudar: v => { pl.base = v; pl.sujo = true; desenharSimLab(); }
  });
  POPS['pop-plbase'].valor = pl.base; desenharBotaoPop('pop-plbase');
  criarPop('pop-plsetor', {
    rotulo: 'Setor', titulo: 'Filtrar por setor', icone: 'fa-filter', busca: 'Buscar setor…', limpavel: true,
    opcoes: () => opcoesSetorPop('Todos os setores'), aoMudar: () => { pl.pag = 1; desenharTabelaLab(); }
  });
  criarPop('pop-plsalvas', {
    rotulo: 'Salvas', titulo: 'Simulações salvas', icone: 'fa-folder-open', padrao: '', busca: 'Buscar…',
    opcoes: () => [{ valor: '', rotulo: lista(ESTADO.simulacoes).length ? 'Abrir…' : 'Nenhuma salva', icone: 'fa-folder-open' },
      ...lista(ESTADO.simulacoes, (a, b) => (b.atualizadoEm || b.em || 0) - (a.atualizadoEm || a.em || 0)).map(s => ({
        valor: s.id, rotulo: s.nome || 'Sem nome', icone: 'fa-handshake', cor: '#8b5cf6',
        desc: `${s.resumo ? `${s.resumo.n} exames · ${num(s.resumo.vol, 0)}/mês · ${fmt(s.resumo.receita)}` : ''} · ${esc(s.autor || '')} ${dataHora(s.atualizadoEm || s.em)}` }))],
    aoMudar: id => { POPS['pop-plsalvas'].valor = ''; if (id) abrirSimLab(id); }
  });
  garantirCatalogo().then(() => desenharTabelaLab());
}

const FILTROS_PL = {
  tab:   { nome: 'Na tabela',     f: (x, cl) => x.ref != null, icone: 'fa-table-list' },
  vol:   { nome: 'Na proposta',   f: x => x.vol > 0, icone: 'fa-cart-shopping' },
  todos: { nome: 'Todos',         f: () => true, icone: 'fa-list' },
  man:   { nome: 'Preço digitado', f: x => x.man, cor: 'var(--cyan)' },
  r:     { nome: 'Abaixo do piso', f: x => x.c.status === 'r', cor: 'var(--red)' },
  x:     { nome: 'Sem custo',     f: x => x.preco != null && x.c.semCusto, cor: 'var(--gray)' }
};

let _plLinhas = [];
function desenharTabelaLab() {
  const body = document.getElementById('pl-body');
  if (!body) return;
  const cl = ctxLabSim(), fs = valorPop('pop-plsetor');
  const base = examesVisiveis().filter(e => e.ativo !== false)
    .filter(e => !fs || e.setorId === fs)
    .filter(e => contem(e.mn + ' ' + e.descricao, pl.q))
    .map(e => linhaLab(cl, e))
    .filter(x => !pl.prazo || (x.prazo != null && x.prazo <= pl.prazo));
  document.getElementById('pl-chips').innerHTML = Object.entries(FILTROS_PL).map(([k, F]) => {
    const n = base.filter(x => F.f(x, cl)).length;
    if (!n && k !== pl.filtro && !['tab', 'vol', 'todos'].includes(k)) return '';
    return `<button class="chip ${pl.filtro === k ? 'on' : ''}" onclick="pl.filtro='${k}';pl.pag=1;desenharTabelaLab()">${F.cor ? `<span class="d" style="background:${F.cor}"></span>` : `<i class="fa-solid ${F.icone}"></i>`}${F.nome} <b>${n}</b></button>`;
  }).join('');
  const ls = base.filter(x => FILTROS_PL[pl.filtro].f(x, cl));
  const val = { mn: x => x.e.mn.toUpperCase(), desc: x => normalizar(x.e.descricao), prazo: x => x.prazo ?? 999, custo: x => x.c.custo ?? -1, ref: x => x.ref ?? -1,
    preco: x => x.preco ?? -1, margem: x => x.c.margem ?? -9, vol: x => x.vol, receita: x => x.receita }[pl.ordem] || (x => x.e.mn);
  ls.sort((a, b) => { const va = val(a), vb = val(b); return (va < vb ? -1 : va > vb ? 1 : 0) * pl.dir; });
  _plLinhas = ls;
  const n = Math.max(1, Math.ceil(ls.length / SIM_POR_PAG));
  if (pl.pag > n) pl.pag = n;
  const th = (r, k, cls) => thOrdem(r, k, pl.ordem, pl.dir, 'ordenarLab', cls);
  document.getElementById('pl-head').innerHTML = `<tr>${th('MN', 'mn')}${th('Descrição', 'desc')}${th('Prazo', 'prazo', 'col-opt')}${th('Custo total', 'custo', 'num')}${th(esc(cl.refNome), 'ref', 'num')}
    ${th('Proposta', 'preco', 'num')}<th class="num col-opt">Desc.</th>${th('Margem', 'margem', 'num')}${th('Volume/mês', 'vol', 'num')}${th('Receita/mês', 'receita', 'num')}<th>Situação</th></tr>`;
  body.innerHTML = ls.slice((pl.pag - 1) * SIM_POR_PAG, pl.pag * SIM_POR_PAG).map(x => htmlLinhaLab(cl, x)).join('')
    || `<tr><td colspan="11">${vazio('fa-magnifying-glass', pl.filtro === 'vol' ? 'Nenhum exame na proposta ainda: informe o volume mensal dos exames.' : 'Nenhum exame com esses filtros')}</td></tr>`;
  document.getElementById('pl-foot').innerHTML = paginacao(ls.length, pl.pag, SIM_POR_PAG, 'paginaLab');
  desenharBulkLab(ls.length);
  desenharImpactoLab();
}

function htmlLinhaLab(cl, x) {
  const { e, k, ref, preco, man, vol, c, desc } = x;
  return `<tr data-k="${esc(k)}" class="${vol > 0 ? 'ed' : ''}">
    <td class="mn"><a href="#" class="lk-mn" onclick="abrirFicha(this.closest('tr').dataset.k);return false">${esc(e.mn)}</a></td>
    <td class="desc" title="${esc(e.descricao)}">${esc(e.descricao)}</td>
    <td class="nw muted col-opt">${esc(textoPrazo(k)) || '—'}</td>
    <td class="num">${celulaCusto(c)}</td>
    <td class="num muted">${ref != null ? fmt(ref) : '—'}</td>
    <td class="num"><div class="price-in ${man ? 'on' : ''}"><span>R$</span><input type="number" step="0.01" min="0" data-c="p" value="${preco != null ? preco.toFixed(2) : ''}" placeholder="—"
      oninput="editarLab(this)" onchange="chipsLabDepois()" onkeydown="teclaLab(event)" onfocus="this.select()"></div></td>
    <td class="num muted col-opt">${desc != null ? pct(desc) : '—'}</td>
    <td class="num" style="color:${c.status === 'r' ? 'var(--red)' : 'inherit'}">${c.margem != null ? pct(c.margem) : '—'}</td>
    <td class="num"><div class="price-in vol-in ${vol > 0 ? 'on' : ''}"><input type="number" step="1" min="0" data-c="v" value="${vol || ''}" placeholder="0"
      oninput="editarLab(this)" onchange="chipsLabDepois()" onkeydown="teclaLab(event)" onfocus="this.select()"></div></td>
    <td class="num">${vol > 0 && preco != null ? fmt(x.receita) : '<span class="muted">—</span>'}</td>
    <td>${preco == null ? tagSt('p', 'fa-circle-minus', 'Sem preço') : c.status === 'x' ? tagStatus('x') : c.status === 'r' ? tagSt('r', 'fa-circle-xmark', 'Inviável') : tagSt('g', 'fa-circle-check', 'Viável')}</td></tr>`;
}

function editarLab(inp) {
  const tr = inp.closest('tr'), k = tr.dataset.k, e = ESTADO.exames[k], cl = ctxLabSim();
  if (!e) return;
  const txt = inp.value.trim(), v = txt === '' ? null : parseFloat(txt);
  if (v != null && (isNaN(v) || v < 0)) return;
  const it = pl.itens[k] ??= {};
  if (inp.dataset.c === 'v') { if (v > 0) it.v = Math.round(v); else delete it.v; }
  else {
    const padrao = precoPadraoLab(cl, { ...e, id: k }, cl.ref(k));
    if (v == null || (padrao != null && Math.abs(v - padrao) < 0.005)) delete it.p; else it.p = Math.round(v * 100) / 100;
  }
  if (!Object.keys(it).length) delete pl.itens[k];
  pl.sujo = true;
  // redesenha a linha mantendo o campo em edição
  const tmp = document.createElement('tbody');
  tmp.innerHTML = htmlLinhaLab(cl, linhaLab(cl, { ...e, id: k }));
  const nova = tmp.firstElementChild;
  tr.className = nova.className;
  [...tr.children].forEach((td, i) => {
    const pin = td.querySelector('.price-in');
    if (pin) pin.className = nova.children[i].querySelector('.price-in').className;
    else td.innerHTML = nova.children[i].innerHTML;
  });
  desenharImpactoLab();
}

let _plChipsTimer = null;
function chipsLabDepois() { clearTimeout(_plChipsTimer); _plChipsTimer = setTimeout(() => { if (!document.activeElement?.closest('#pl-body')) desenharTabelaLab(); }, 300); }

function teclaLab(ev) {
  if (!['Enter', 'ArrowDown', 'ArrowUp'].includes(ev.key)) return;
  ev.preventDefault();
  const c = ev.target.dataset.c, ins = [...document.querySelectorAll(`#pl-body input[data-c="${c}"]`)], i = ins.indexOf(ev.target);
  ins[ev.key === 'ArrowUp' ? i - 1 : i + 1]?.focus();
}

function desenharImpactoLab() {
  const el = document.getElementById('pl-imp');
  if (!el) return;
  const cl = ctxLabSim(), s = resumoLab(cl);
  const imp = (ic, rot, v, d, cls = '') => `<div class="imp"><div class="l"><i class="fa-solid ${ic}"></i>${rot}</div><div class="v">${v}</div><div class="d ${cls}">${d}</div></div>`;
  el.innerHTML = !s.n ? `<div class="alert x" style="grid-column:1/-1;margin:0"><i class="fa-solid fa-circle-info"></i><div>Informe o <b>volume mensal</b> dos exames que o laboratório vai enviar. O preço começa no valor da ${esc(cl.refNome)} e pode ser editado; a margem usa o perfil de custo da tabela (piso ${pct(cl.piso, 0)}).</div></div>`
    : imp('fa-flask-vial', 'Exames na proposta', num(s.n, 0), `<span class="muted">${num(s.vol, 0)} exames/mês</span>`)
    + imp('fa-sack-dollar', 'Receita mensal', fmt(s.receita), `<span class="muted">${s.desc != null ? `desconto médio ${pct(s.desc)} s/ ${esc(cl.refNome)}` : ''}</span>`)
    + imp('fa-coins', 'Lucro mensal', fmt(s.lucro), `<span class="muted">após custo total e imposto${s.semCusto ? ` · ${s.semCusto} sem custo fora da conta` : ''}</span>`)
    + imp('fa-percent', 'Margem ponderada', s.margem != null ? pct(s.margem) : '—', `piso ${pct(cl.piso, 0)}`, s.margem == null ? 'muted' : s.viavel ? 'up' : 'dn')
    + `<div class="imp viab ${s.viavel ? 'ok' : 'bad'}"><div class="l"><i class="fa-solid ${s.viavel ? 'fa-circle-check' : 'fa-circle-xmark'}"></i>Viabilidade</div><div class="v">${s.margem == null ? '—' : s.viavel ? 'Viável' : 'Inviável'}</div>
      <div class="d">${s.ab ? `${s.ab} exame(s) abaixo do piso` : 'todos os exames acima do piso'}</div></div>`;
}

function desenharBulkLab(nFilt) {
  const el = document.getElementById('pl-bulk');
  if (!el) return;
  const nVol = Object.values(pl.itens).filter(i => i.v > 0).length, nMan = Object.values(pl.itens).filter(i => i.p != null).length;
  const l = ESTADO.laboratorios[pl.labId];
  el.innerHTML = `<b>${num(nFilt, 0)} filtrado(s)</b>
    <div class="inp" style="width:110px"><input id="pl-vlote" type="number" step="1" min="0" placeholder="Volume"><span class="suf">/mês</span></div>
    <button class="btn sm" onclick="volumeLoteLab()" title="Aplica o volume a todos os exames filtrados com preço"><i class="fa-solid fa-cart-plus"></i>Volume nos filtrados</button>
    ${nVol ? `<button class="btn sm" onclick="limparLab('v')"><i class="fa-solid fa-eraser"></i>Zerar volumes</button>` : ''}
    ${nMan ? `<button class="btn sm" onclick="limparLab('p')"><i class="fa-solid fa-rotate-left"></i>Desfazer ${nMan} preço(s) digitado(s)</button>` : ''}
    ${pode('simulador', 'criar') ? `<button class="btn sm" style="margin-left:auto" ${l && nVol ? '' : 'disabled'} onclick="levarSimLab()" title="${l ? `Preços dos exames da proposta viram rascunho de ${esc(l.nome)}` : 'Escolha um laboratório cadastrado'}"><i class="fa-solid fa-pen"></i>Levar ao rascunho${l ? ` de ${esc(l.nome)}` : ' do laboratório'}</button>` : ''}`;
}

function volumeLoteLab() {
  const v = Math.round(numCampo('pl-vlote'));
  if (!(v >= 0)) return toast('Informe o volume', 'erro');
  let n = 0;
  _plLinhas.forEach(x => {
    if (x.preco == null) return;
    const it = pl.itens[x.k] ??= {};
    if (v > 0) it.v = v; else delete it.v;
    if (!Object.keys(it).length) delete pl.itens[x.k];
    n++;
  });
  pl.sujo = true;
  desenharTabelaLab();
  toast(`Volume ${v} em ${n} exame(s)`);
}

async function limparLab(c) {
  const ok = await confirmar({ titulo: c === 'v' ? 'Zerar volumes?' : 'Desfazer preços digitados?', texto: c === 'v' ? 'Todos os exames saem da proposta.' : 'Os exames voltam ao preço inicial escolhido.', botao: c === 'v' ? 'Zerar' : 'Desfazer', perigo: true });
  if (!ok) return;
  Object.keys(pl.itens).forEach(k => { delete pl.itens[k][c]; if (!Object.keys(pl.itens[k]).length) delete pl.itens[k]; });
  pl.sujo = true;
  desenharTabelaLab();
}

function paginaLab(p) { pl.pag = p; desenharTabelaLab(); }
function ordenarLab(k) { pl.dir = pl.ordem === k ? -pl.dir : (['vol', 'receita'].includes(k) ? -1 : 1); pl.ordem = k; desenharTabelaLab(); }

// ── Salvar, abrir, nova ───────────────────────────────────────
async function novaSimLab() {
  if (pl.sujo && !await confirmar({ titulo: 'Descartar a simulação atual?', texto: 'As alterações não salvas serão perdidas.', botao: 'Descartar', perigo: true })) return;
  Object.assign(pl, { id: null, nome: '', labId: '', tabelaId: null, base: 'tab', d: 10, itens: {}, pdf: null, filtro: 'tab', pag: 1, sujo: false });
  desenharSimLab();
}

async function abrirSimLab(id) {
  const s = ESTADO.simulacoes[id];
  if (!s) return;
  if (pl.sujo && id !== pl.id && !await confirmar({ titulo: 'Abrir outra simulação?', texto: 'As alterações não salvas da atual serão perdidas.', botao: 'Abrir', perigo: true })) return;
  Object.assign(pl, { id, nome: s.nome || '', labId: s.labId || '', tabelaId: s.tabelaId ?? '', base: s.base || 'tab', d: s.d ?? 10,
    itens: JSON.parse(JSON.stringify(s.itens || {})), pdf: s.pdf ? { ...s.pdf } : null, filtro: 'vol', pag: 1, sujo: false });
  desenharSimLab();
}

async function salvarSimLab() {
  const cl = ctxLabSim(), r = resumoLab(cl), u = usuarioAtual();
  pl.nome = (valorCampo('pl-nome') || pl.nome).trim();
  if (!pl.nome) { document.getElementById('pl-nome')?.focus(); return toast('Dê um nome à proposta', 'erro'); }
  if (!Object.keys(pl.itens).length) return toast('Nada para salvar: informe volumes ou preços', 'erro');
  const id = pl.id || DB.novaChave('simulacoes'), antes = ESTADO.simulacoes[id];
  const dados = { tipo: 'lab', nome: pl.nome, labId: pl.labId || null, tabelaId: pl.tabelaId || '', base: pl.base, d: pl.d, itens: pl.itens, pdf: pdfParaSalvar(pl.pdf),
    resumo: { n: r.n, vol: r.vol, receita: Math.round(r.receita * 100) / 100, margem: r.margem, viavel: r.viavel },
    autor: antes?.autor || u.nome, autorId: antes?.autorId || u.id, em: antes?.em || DB.agora(), atualizadoEm: DB.agora(), atualizadoPor: u.nome };
  await DB.gravar(`${CAMINHOS.simulacoes}/${id}`, dados);
  ESTADO.simulacoes[id] = { ...dados, em: antes?.em || Date.now(), atualizadoEm: Date.now() };
  pl.id = id; pl.sujo = false;
  registrar('simulador', `Proposta para laboratório "${pl.nome}" salva (${r.n} exames, ${fmt(r.receita)}/mês)`);
  desenharSimLab();
  toast('Simulação salva');
}

async function excluirSimLab() {
  const s = ESTADO.simulacoes[pl.id];
  if (!s || !await confirmar({ titulo: 'Excluir simulação?', texto: `"${esc(s.nome)}" será excluída.`, botao: 'Excluir', perigo: true })) return;
  await DB.remover(`${CAMINHOS.simulacoes}/${pl.id}`);
  delete ESTADO.simulacoes[pl.id];
  pl.id = null; pl.sujo = true;
  renderSimulador();
}

// ── Exportar e levar ao laboratório ───────────────────────────
function exportarSimLab() {
  const cl = ctxLabSim();
  let ls = Object.keys(pl.itens).filter(k => ESTADO.exames[k] && pl.itens[k].v > 0).map(k => linhaLab(cl, { ...ESTADO.exames[k], id: k }));
  if (!ls.length) ls = _plLinhas.filter(x => x.preco != null);
  if (!ls.length) return toast('Nenhum exame para exportar', 'erro');
  ls.sort((a, b) => a.e.mn.localeCompare(b.e.mn, 'pt-BR', { sensitivity: 'base' }));
  const dec = v => v == null ? '' : String(Math.round(v * 100) / 100).replace('.', ',');
  const q = s => `"${String(s || '').replace(/"/g, '""')}"`;
  const csv = [['Mnemônico', 'Exame', 'Prazo', cl.refNome, 'Proposta', 'Desconto', 'Volume/mês', 'Receita/mês'].join(';'),
    ...ls.map(x => [x.e.mn, q(x.e.descricao), q(textoPrazo(x.k)), dec(x.ref), dec(x.preco), x.desc != null ? pct(x.desc) : '', x.vol || '', x.vol ? dec(x.receita) : ''].join(';'))].join('\r\n') + '\r\n';
  baixarArquivo(`Proposta - ${pl.nome || 'laboratório'}.csv`, new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }));
}

async function levarSimLab() {
  const l = ESTADO.laboratorios[pl.labId], cl = ctxLabSim();
  if (!l) return;
  const valores = {};
  Object.entries(pl.itens).forEach(([k, it]) => {
    const e = ESTADO.exames[k];
    if (!e || !(it.v > 0)) return;
    const x = linhaLab(cl, { ...e, id: k });
    if (x.preco != null) valores[k] = x.preco;
  });
  if (!Object.keys(valores).length) return toast('Nenhum exame com volume e preço', 'erro');
  const ok = await levarAoRascunho('lab:' + pl.labId, valores, `proposta "${pl.nome || 'sem nome'}"`);
  if (!ok) return;
  irParaGrade('lab:' + pl.labId);
  toast(`${Object.keys(valores).length} valor(es) no rascunho de ${l.nome}`);
}
