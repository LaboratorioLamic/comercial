// ═══════════════════════════════════════════════════════════════
// inicio.js — Tela inicial (painel) — COMERCIAL LAMIC
// ═══════════════════════════════════════════════════════════════

const ICONE_HIST = { conveniados: 'fa-handshake', exames: 'fa-flask-vial', tabelas: 'fa-table-list', simulador: 'fa-calculator', grupos: 'fa-user-shield', usuarios: 'fa-users',
  custos: 'fa-coins', reagentes: 'fa-vials', setores: 'fa-sitemap', parametros: 'fa-sliders', apoio: 'fa-truck-medical', instrucoes: 'fa-book-medical' };
let _iniHist = null, _iniHistEm = 0;

// ── Sininho: propostas aguardando aprovação ───────────────────
let _sinoAberto = false, _sinoFiltro = '';
const sinoPendentes = () => lista(ESTADO.propostas, (a, b) => (b.em || 0) - (a.em || 0)).filter(p => p.status === 'pendente');
const propostaMinha = p => { const u = usuarioAtual(); return p.autorId === u.id || p.autor === u.nome; };

function haQuanto(ts) {
  if (!ts) return '—';
  const m = Math.floor((Date.now() - ts) / 60000);
  if (m < 1) return 'agora';
  if (m < 60) return `há ${m} min`;
  if (m < 1440) return `há ${Math.floor(m / 60)} h`;
  const d = Math.floor(m / 1440);
  return d < 30 ? `há ${d} dia${d > 1 ? 's' : ''}` : dataHora(ts);
}

// Resumo da proposta contra os preços de hoje: quantos sobem/descem, variação média e abaixo do piso
function resumoProposta(p) {
  const cx = ctxAlvo(p.alvo);
  let sobe = 0, desce = 0, soma = 0, nv = 0, abaixo = 0;
  Object.entries(p.itens || {}).forEach(([k, it]) => {
    const e = ESTADO.exames[k], de = cx && e ? cx.salvo(k) : it.de;
    if (de > 0 && it.para != null) { const d = it.para / de - 1; if (d > 0) sobe++; else if (d < 0) desce++; soma += d; nv++; }
    if (cx && e && it.para != null && calcular(e, it.para, cx.tab).status === 'r') abaixo++;
  });
  return { n: p.n || Object.keys(p.itens || {}).length, sobe, desce, media: nv ? soma / nv : null, abaixo, pisoNome: cx?.pisoNome || 'piso' };
}

function sinoPainel() {
  const todas = sinoPendentes(), minhas = todas.filter(propostaMinha).length;
  if (!minhas || minhas === todas.length) _sinoFiltro = '';
  const ls = todas.filter(p => !_sinoFiltro || (_sinoFiltro === 'minhas') === propostaMinha(p));
  const precos = todas.reduce((s, p) => s + (p.n || Object.keys(p.itens || {}).length), 0);
  const antiga = todas.length ? Math.min(...todas.map(p => p.em || Date.now())) : null;
  const chip = (f, nome, n) => `<button class="chip ${_sinoFiltro === f ? 'on' : ''}" onclick="_sinoFiltro='${f}';document.getElementById('sino-pan').innerHTML=sinoPainel()">${nome} <b>${n}</b></button>`;
  return `
    <div class="sino-h"><span class="sino-ic"><i class="fa-solid fa-stamp"></i></span>
      <div><b>Propostas pendentes</b><span>${todas.length ? `${num(precos, 0)} preço(s) aguardando · mais antiga ${haQuanto(antiga)}` : 'Nada aguardando aprovação'}</span></div>
      <button class="pop-x" onclick="fecharSino()" title="Fechar"><i class="fa-solid fa-xmark"></i></button></div>
    ${_sinoFiltro || (minhas && minhas < todas.length) ? `<div class="chips sino-chips">${chip('', 'Todas', todas.length)}${chip('minhas', 'Minhas', minhas)}${chip('outros', 'De outros', todas.length - minhas)}</div>` : ''}
    <div class="sino-l">${ls.map((p, i) => {
      const a = alvoInfo(p.alvo), r = resumoProposta(p), velha = Date.now() - (p.em || 0) > 3 * 864e5;
      return `<button class="sino-it" style="animation-delay:${Math.min(i, 8) * 35}ms" onclick="fecharSino();abrirProposta('${p.id}')">
        <span class="avatar" style="background:${corAvatar(p.autorId || p.autor)}">${esc(iniciais(p.autor))}</span>
        <span class="sino-c">
          <span class="sino-t"><i class="fa-solid ${a.icone}" style="color:${a.cor}"></i><b>${esc(a.nome)}</b><em class="${velha ? 'velha' : ''}" title="${dataHora(p.em)}">${velha ? '<i class="fa-solid fa-clock"></i> ' : ''}${haQuanto(p.em)}</em></span>
          <span class="sino-s">${esc(p.autor)}${propostaMinha(p) ? ' (você)' : ''} · ${num(r.n, 0)} preço(s)</span>
          <span class="sino-m">
            ${r.sobe ? `<span class="up" title="Preços que sobem"><i class="fa-solid fa-arrow-up"></i>${r.sobe}</span>` : ''}
            ${r.desce ? `<span class="dn" title="Preços que descem"><i class="fa-solid fa-arrow-down"></i>${r.desce}</span>` : ''}
            ${r.media != null ? `<span title="Variação média sobre o preço de hoje">média ${r.media > 0 ? '+' : ''}${pct(r.media)}</span>` : ''}
            ${r.abaixo ? `<span class="bad" title="Preços abaixo do ${r.pisoNome}"><i class="fa-solid fa-circle-xmark"></i>${r.abaixo} abaixo do ${r.pisoNome}</span>` : ''}
          </span>
          ${p.justificativa ? `<span class="sino-j">${esc(p.justificativa)}</span>` : ''}
        </span>
        <i class="fa-solid fa-chevron-right sino-go"></i></button>`; }).join('')
      || `<div class="sino-vazio"><i class="fa-solid fa-circle-check"></i><b>Tudo em dia</b><span>Nenhuma proposta aguardando aprovação.</span></div>`}</div>
    <div class="sino-f"><span>${pode('tabelas', 'aprovar') ? 'Clique para revisar e aprovar' : 'Clique para ver os detalhes'}</span>
      <button onclick="fecharSino();tabAba='propostas';irPara('tabelas')">Ver todas <i class="fa-solid fa-arrow-right"></i></button></div>`;
}

const sinoHtml = n => `<div class="sino ${_sinoAberto ? 'open' : ''}" id="sino">
    <button class="sino-btn ${n ? 'tem' : ''}" onclick="event.stopPropagation();alternarSino()" title="Propostas pendentes" aria-haspopup="true" aria-expanded="${_sinoAberto}">
      <i class="fa-solid fa-bell"></i>${n ? `<span class="sino-n">${n > 99 ? '99+' : n}</span>` : ''}</button>
    <div class="sino-pan" id="sino-pan" onclick="event.stopPropagation()">${_sinoAberto ? sinoPainel() : ''}</div></div>`;

// Sino na barra do topo: redesenha a cada mudança nos dados
function atualizarSino() {
  const el = document.getElementById('tb-sino');
  if (el) el.innerHTML = usuarioAtual() && pode('tabelas') ? sinoHtml(sinoPendentes().length) : '';
}

function alternarSino() {
  const el = document.getElementById('sino');
  if (!el) return;
  fecharPop();
  _sinoAberto = !_sinoAberto;
  if (_sinoAberto) document.getElementById('sino-pan').innerHTML = sinoPainel();
  el.classList.toggle('open', _sinoAberto);
  el.querySelector('.sino-btn').setAttribute('aria-expanded', _sinoAberto);
}
function fecharSino() { if (_sinoAberto) alternarSino(); _sinoAberto = false; }
document.addEventListener('click', fecharSino);
document.addEventListener('keydown', e => { if (e.key === 'Escape') fecharSino(); });

function renderInicio() {
  const u = usuarioAtual();
  const exames = examesVisiveis().filter(e => e.ativo !== false).map(e => ({ e, c: calcular(e) }));
  const comMargem = exames.filter(x => x.c.margem != null);
  const media = comMargem.length ? comMargem.reduce((s, x) => s + x.c.margem, 0) / comMargem.length : null;
  const cont = s => exames.filter(x => x.c.status === s).length;
  const pend = mapaPendencias();
  const kpi = (icone, cor, fundo, rotulo, valor, sub, acao) => `
    <div class="card kpi ${acao ? 'clicavel' : ''}" ${acao ? `onclick="${acao}"` : ''}>
      <div class="kpi-l"><span class="ic" style="background:${fundo};color:${cor}"><i class="fa-solid ${icone}"></i></span>${rotulo}</div>
      <div class="kpi-v" style="${cor === 'var(--red)' && valor ? 'color:var(--red)' : ''}">${valor}</div><div class="kpi-s">${sub}</div></div>`;
  const irPend = k => pode('pendencias') ? `pendAba='${k}';pendPag=1;irPara('pendencias')` : '';
  const irTab = aba => pode('tabelas') ? `tabAba='${aba}';irPara('tabelas')` : '';
  const mMin = parametro('margemMinima'), mAlvo = parametro('margemAlvo');
  const propostas = lista(ESTADO.propostas).filter(p => p.status === 'pendente');
  const minhas = propostas.filter(p => p.autorId === u.id || p.autor === u.nome).length;

  // Situação dos exames (barra empilhada)
  const dist = ['g', 'a', 'r', 'x', 'p'].map(s => ({ s, n: cont(s) })).filter(d => d.n);

  // Margem média por setor (só setores com exames com margem)
  const porSetor = {};
  comMargem.forEach(x => { const s = ESTADO.setores[x.e.setorId]; if (!s) return; (porSetor[x.e.setorId] ??= []).push(x.c.margem); });
  const barras = Object.entries(porSetor).map(([id, ms]) => ({ s: ESTADO.setores[id], m: ms.reduce((a, b) => a + b, 0) / ms.length, n: ms.length }))
    .sort((a, b) => b.n - a.n).slice(0, 14).sort((a, b) => b.m - a.m);
  const escala = Math.max(0.8, ...barras.map(b => b.m));
  const pos = v => Math.max(0, Math.min(100, v / escala * 100));

  // Tabelas de preço: exames, margem média, abaixo do piso e divergências com o Unilab
  const tabs = pode('tabelas') ? ['particular', ...tabelasLista(false).map(t => t.id)].map(a => { const cx = ctxAlvo(a); return { cx, s: statsAlvo(cx) }; }) : [];
  const divTotal = tabs.length ? tabs.reduce((s, t) => s + t.s.div, 0) : pend.div.length;

  document.getElementById('s-inicio').innerHTML = `
    <div class="h-row"><div><h2>Olá, ${esc((u?.nome || '').split(' ')[0])}</h2><p>Imposto ${pct(parametro('imposto'))} · margem mínima ${pct(mMin)} · alvo ${pct(mAlvo)}</p></div>
      <div style="display:flex;gap:8px;align-items:center">${!exames.length && pode('importar', 'importar') ? `<button class="btn pri" onclick="irPara('importar')"><i class="fa-solid fa-file-import"></i>Migrar planilha</button>` : ''}</div></div>
    <div class="kpis">
      ${kpi('fa-percent', 'var(--cyan)', 'var(--cyan-light)', 'Margem média', media != null ? pct(media) : '—', `${num(comMargem.length, 0)} de ${num(exames.length, 0)} exames com custo e preço`, pode('exames') ? "irPara('exames')" : '')}
      ${kpi('fa-circle-xmark', 'var(--red)', 'var(--red-bg)', 'Abaixo do mínimo', cont('r'), `margem menor que ${pct(mMin)}`, irPend('min'))}
      ${kpi('fa-circle-question', 'var(--gray)', 'var(--gray-bg)', 'Sem custo', cont('x'), 'margem desconhecida', irPend('custo'))}
      ${kpi('fa-code-compare', 'var(--amber)', 'var(--amber-bg)', 'Divergência c/ Unilab', num(divTotal, 0), tabs.length ? 'todas as tabelas · preço LAMIC ≠ Unilab' : 'praticado ≠ sistema', irPend('div'))}
      ${kpi('fa-stamp', 'var(--amber)', 'var(--amber-bg)', 'Propostas pendentes', propostas.length, minhas ? `${minhas} enviada(s) por você` : 'aguardando aprovação', irTab('propostas'))}
      ${kpi('fa-stairs', 'var(--amber)', 'var(--amber-bg)', 'Quebra de hierarquia', pend.hier.length, 'tabela acima de outra que deveria ser maior', irTab('hierarquia'))}
      ${kpi('fa-circle-exclamation', 'var(--amber)', 'var(--amber-bg)', 'Abaixo do alvo', cont('a'), 'acima do mínimo, abaixo da margem alvo', pode('exames') ? "irPara('exames')" : '')}
      ${kpi('fa-magnifying-glass-dollar', 'var(--cyan)', 'var(--cyan-light)', 'A auditar', pend.aud.length, 'valores marcados para auditoria', irPend('aud'))}
    </div>
    ${dist.length ? `<div class="card" style="margin-bottom:14px">
      <div class="card-h"><h3><i class="fa-solid fa-chart-pie"></i>Situação dos exames</h3><span>${num(exames.length, 0)} exames ativos · tabela Particular</span></div>
      <div class="dist"><div class="dist-bar">${dist.map(d => `<div style="flex:${d.n};background:${STATUS[d.s].cor}" title="${STATUS[d.s].nome}: ${d.n}"></div>`).join('')}</div>
        <div class="dist-leg">${dist.map(d => `<span><b style="background:${STATUS[d.s].cor}"></b>${STATUS[d.s].nome} <strong>${num(d.n, 0)}</strong> <em>${pct(d.n / exames.length, 0)}</em></span>`).join('')}</div></div>
    </div>` : ''}
    <div class="grid2">
      <div class="card">
        <div class="card-h"><h3><i class="fa-solid fa-chart-simple"></i>Margem média por setor</h3><span>maiores setores</span></div>
        ${barras.length ? `<div class="bars">${barras.map(b => `
          <div class="bar-row" title="${esc(b.s.nome)} · ${b.n} exames"><span class="nm"><i class="fa-solid ${b.s.icone}" style="color:${b.s.cor}"></i> ${esc(b.s.nome)}</span>
            <div class="bar-track"><div class="bar-fill" style="width:${pos(b.m)}%;background:${b.m < mMin ? 'var(--red)' : b.m < (b.s.margemAlvo ?? mAlvo) ? 'var(--amber)' : 'var(--green)'}"></div>
              <div class="bar-min" style="left:${pos(mMin)}%"></div><div class="bar-alvo" style="left:${pos(mAlvo)}%"></div></div>
            <span class="bar-v">${pct(b.m)}</span></div>`).join('')}</div>
          <div class="legend"><span><b style="background:var(--red)"></b>Mínimo ${pct(mMin)}</span><span><b style="background:var(--green)"></b>Alvo ${pct(mAlvo)}</span></div>`
        : vazio('fa-chart-simple', 'Sem exames com custo e preço ainda')}
      </div>
      <div class="card">
        <div class="card-h"><h3><i class="fa-solid fa-triangle-exclamation"></i>Pendências</h3><span>por categoria</span></div>
        <div class="ini-list">${Object.entries(PENDENCIAS).map(([k, p]) => `
          <div class="ini-row ${pode('pendencias') ? 'clicavel' : ''}" ${pode('pendencias') ? `onclick="${irPend(k)}"` : ''} title="${esc(p.desc)}">
            <i class="fa-solid ${p.icone}"></i><span class="nm">${p.nome}</span><b class="${pend[k].length ? '' : 'zero'}">${num(pend[k].length, 0)}</b></div>`).join('')}</div>
      </div>
    </div>
    <div class="grid2" style="margin-top:14px">
      ${tabs.length ? `<div class="card">
        <div class="card-h"><h3><i class="fa-solid fa-table-list"></i>Tabelas de preço</h3><span>preços publicados</span></div>
        <div class="tbl-wrap" style="margin-top:8px"><table><thead><tr><th>Tabela</th><th class="num">Exames</th><th class="num">Margem média</th><th class="num">Abaixo do piso</th><th class="num col-opt">≠ Unilab</th><th class="num col-opt">Propostas</th></tr></thead>
          <tbody>${tabs.map(({ cx, s }) => `<tr class="row" onclick="tabAba='tabelas';tabSel='${cx.alvo}';irPara('tabelas')">
            <td><i class="fa-solid ${cx.icone}" style="color:${cx.cor};width:18px"></i> ${esc(cx.nome)}</td><td class="num">${num(s.n, 0)}</td>
            <td class="num">${s.media != null ? pct(s.media) : '—'}</td><td class="num">${s.ab ? `<b style="color:var(--red)">${num(s.ab, 0)}</b>` : '0'}</td>
            <td class="num col-opt">${s.div ? `<b style="color:var(--amber)">${num(s.div, 0)}</b>` : '0'}</td><td class="num col-opt">${s.pend || '0'}</td></tr>`).join('')}</tbody></table></div>
      </div>` : ''}
      <div class="card">
        <div class="card-h"><h3><i class="fa-solid fa-clock-rotate-left"></i>Últimas alterações</h3><span>todo o sistema</span></div>
        <div class="ini-hist" id="ini-hist">${htmlHistInicio()}</div>
      </div>
    </div>`;
  carregarHistInicio();
}

function htmlHistInicio() {
  if (!_iniHist) return '<div class="muted" style="font-size:12px"><i class="fa-solid fa-circle-notch fa-spin"></i> carregando…</div>';
  return _iniHist.map(h => `<div class="hist-i"><div class="avatar" style="width:26px;height:26px;font-size:10px;flex-shrink:0;background:${corAvatar(h.usuarioId || h.usuario)}">${esc(iniciais(h.usuario))}</div>
    <div style="min-width:0"><div><i class="fa-solid ${ICONE_HIST[h.entidade] || 'fa-pen'} muted" style="font-size:11px"></i> ${esc(h.descricao)}</div><div class="t">${esc(h.usuario)} · ${dataHora(h.em)}</div></div></div>`).join('')
    || '<div class="muted" style="font-size:12.5px">Nenhuma alteração registrada ainda.</div>';
}

// Últimos registros de historico/ (chaves em ordem cronológica); refaz a leitura no máximo a cada 20 s
async function carregarHistInicio() {
  if (_iniHist && Date.now() - _iniHistEm < 20000) return;
  _iniHistEm = Date.now();
  try {
    const v = (await DB.ref('historico').orderByKey().limitToLast(12).get()).val();
    _iniHist = lista(v).reverse();
  } catch (e) { console.error(e); _iniHist = _iniHist || []; }
  const el = document.getElementById('ini-hist');
  if (el) el.innerHTML = htmlHistInicio();
}
