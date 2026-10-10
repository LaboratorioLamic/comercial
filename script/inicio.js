// ═══════════════════════════════════════════════════════════════
// inicio.js — Tela inicial (painel) — COMERCIAL LAMIC
// ═══════════════════════════════════════════════════════════════

const ICONE_HIST = { conveniados: 'fa-handshake', exames: 'fa-flask-vial', tabelas: 'fa-table-list', simulador: 'fa-calculator', grupos: 'fa-user-shield', usuarios: 'fa-users',
  custos: 'fa-coins', reagentes: 'fa-vials', setores: 'fa-sitemap', parametros: 'fa-sliders', apoio: 'fa-truck-medical', instrucoes: 'fa-book-medical' };
let _iniHist = null, _iniHistEm = 0;

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
      ${!exames.length && pode('importar', 'importar') ? `<button class="btn pri" onclick="irPara('importar')"><i class="fa-solid fa-file-import"></i>Migrar planilha</button>` : ''}</div>
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
