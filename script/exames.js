// ═══════════════════════════════════════════════════════════════
// exames.js — Lista de exames — COMERCIAL LAMIC
// ═══════════════════════════════════════════════════════════════

const EX_POR_PAG = 50;
const exF = { q: '', status: '', pag: 1, ordem: 'mn', dir: 1, inativos: false };

const tagSetor = id => {
  const s = ESTADO.setores[id];
  return s ? `<span class="tag"><i class="fa-solid ${s.icone}" style="color:${s.cor}"></i>${esc(s.nome)}</span>`
    : '<span class="warn-i"><i class="fa-solid fa-triangle-exclamation"></i>sem setor</span>';
};
const iconesExame = e =>
  (e.auditar ? ' <i class="fa-solid fa-magnifying-glass-dollar flag" style="color:var(--amber)" title="Valor a auditar"></i>' : '') +
  (e.origem === 'apoio' && negociadoExame(e) ?' <i class="fa-solid fa-handshake flag" style="color:var(--green)" title="Apoio com negociação"></i>' : '') +
  (e.foraDoSistema ? ' <i class="fa-solid fa-plug-circle-xmark flag" style="color:var(--text-muted)" title="Fora do sistema"></i>' : '');

function opcoesSetorPop(rotuloTodos, extras = [], contar = null) {
  const n = id => contar ? contar(id) : null;
  return [
    { valor: '', rotulo: rotuloTodos, icone: 'fa-layer-group', desc: 'Sem filtro de setor', qtd: contar ? contar('') : null },
    ...extras,
    ...Object.keys(CATEGORIAS).flatMap(cat => lista(ESTADO.setores, porNome).filter(s => s.categoria === cat)
      .map(s => ({ valor: s.id, rotulo: s.nome, icone: s.icone, cor: s.cor, qtd: n(s.id), grupo: CATEGORIAS[cat].nome })))
  ];
}

function renderExames() {
  const el = document.getElementById('s-exames');
  el.innerHTML = `
    <div class="h-row"><div><h2>Exames</h2><p>Clique em um exame para ver a composição do preço</p></div>
      <div style="display:flex;gap:8px">${pode('exames', 'criar') ? `<button class="btn pri" onclick="abrirDadosExame()"><i class="fa-solid fa-plus"></i>Novo exame</button>` : ''}</div></div>
    <div class="card">
      <div class="toolbar">
        <div class="search"><i class="fa-solid fa-magnifying-glass"></i><input id="q-ex" value="${esc(exF.q)}" placeholder="Buscar mnemônico ou descrição…" oninput="exF.q=this.value;exF.pag=1;desenharExames()"></div>
        <div id="pop-exsetor"></div>
        <div id="pop-exorigem"></div>
      </div>
      <div class="chips" id="ex-chips"></div>
      <div class="tbl-wrap" style="margin-top:10px"><table><thead id="ex-head"></thead><tbody id="ex-body"></tbody></table></div>
      <div class="foot" id="ex-foot"></div>
    </div>`;
  const vis = examesVisiveis().filter(e => exF.inativos || e.ativo !== false);
  criarPop('pop-exsetor', {
    rotulo: 'Setor', titulo: 'Filtrar por setor', icone: 'fa-filter', busca: 'Buscar setor…', limpavel: true,
    opcoes: () => opcoesSetorPop('Todos os setores',
      [{ valor: '__sem', rotulo: 'Sem setor', icone: 'fa-triangle-exclamation', cor: 'var(--amber)', desc: 'Pendente de classificação', qtd: vis.filter(e => !ESTADO.setores[e.setorId]).length }],
      id => id ? vis.filter(e => e.setorId === id).length : vis.length),
    aoMudar: () => { exF.pag = 1; desenharExames(); }
  });
  criarPop('pop-exorigem', {
    rotulo: 'Origem', titulo: 'Onde o exame é feito', icone: 'fa-route', limpavel: true,
    opcoes: () => [
      { valor: '', rotulo: 'Todas', icone: 'fa-layer-group', desc: 'Internos e apoio', qtd: vis.length },
      { valor: 'interno', rotulo: 'Interno', icone: 'fa-microscope', cor: 'var(--green)', desc: 'Executado no LAMIC', qtd: vis.filter(e => e.origem !== 'apoio').length },
      { valor: 'apoio', rotulo: 'Apoio', icone: 'fa-truck-medical', cor: 'var(--cyan)', desc: 'Enviado a laboratório de apoio', qtd: vis.filter(e => e.origem === 'apoio').length }],
    aoMudar: () => { exF.pag = 1; desenharExames(); }
  });
  desenharExames();
}

function linhasExames() {
  const fs = valorPop('pop-exsetor'), fo = valorPop('pop-exorigem');
  return examesVisiveis()
    .filter(e => (exF.inativos ? e.ativo === false : e.ativo !== false))
    .filter(e => fs === '__sem' ? !ESTADO.setores[e.setorId] : !fs || e.setorId === fs)
    .filter(e => !fo || (fo === 'apoio' ? e.origem === 'apoio' : e.origem !== 'apoio'))
    .filter(e => contem(e.mn + ' ' + e.descricao, exF.q))
    .map(e => ({ e, c: calcular(e) }));
}

function desenharExames() {
  if (!document.getElementById('ex-body')) return;
  const todas = linhasExames();
  // contagem por status (antes do filtro de status)
  const cont = { '': todas.length };
  todas.forEach(({ c }) => { cont[c.status] = (cont[c.status] || 0) + 1; });
  const nInat = examesVisiveis().filter(e => e.ativo === false).length;
  document.getElementById('ex-chips').innerHTML =
    `<button class="chip ${!exF.status ? 'on' : ''}" onclick="exF.status='';exF.pag=1;desenharExames()"><i class="fa-solid fa-list"></i>Todos <b>${cont['']}</b></button>` +
    ['r', 'a', 'g', 'x', 'p'].filter(k => cont[k] || exF.status === k).map(k => `<button class="chip ${exF.status === k ? 'on' : ''}" onclick="exF.status='${k}';exF.pag=1;desenharExames()"><span class="d" style="background:${STATUS[k].cor}"></span>${STATUS[k].nome} <b>${cont[k] || 0}</b></button>`).join('') +
    (nInat ? `<button class="chip ${exF.inativos ? 'on' : ''}" style="margin-left:auto" onclick="exF.inativos=!exF.inativos;exF.pag=1;exF.status='';desenharExames()"><i class="fa-solid fa-eye-slash"></i>Inativos <b>${nInat}</b></button>` : '');

  const linhas = todas.filter(({ c }) => !exF.status || c.status === exF.status);
  const val = {
    mn: x => x.e.mn.toUpperCase(), desc: x => normalizar(x.e.descricao), setor: x => normalizar(ESTADO.setores[x.e.setorId]?.nome || 'zzz'),
    custo: x => x.c.custo ?? -1, sug: x => x.c.sugerido ?? -1, preco: x => x.e.precoPraticado ?? -1, margem: x => x.c.margem ?? -9
  }[exF.ordem];
  linhas.sort((a, b) => { const va = val(a), vb = val(b); return (va < vb ? -1 : va > vb ? 1 : 0) * exF.dir; });
  const n = Math.max(1, Math.ceil(linhas.length / EX_POR_PAG));
  if (exF.pag > n) exF.pag = n;
  const pagina = linhas.slice((exF.pag - 1) * EX_POR_PAG, exF.pag * EX_POR_PAG);

  const th = (r, k, cls) => thOrdem(r, k, exF.ordem, exF.dir, 'ordenarExames', cls);
  document.getElementById('ex-head').innerHTML = `<tr>${th('MN', 'mn')}${th('Descrição', 'desc')}${th('Setor', 'setor')}${th('Custo total', 'custo', 'num')}${th('Sugerido', 'sug', 'num')}${th('Praticado', 'preco', 'num')}${th('Margem', 'margem', 'num')}<th>Status</th></tr>`;
  document.getElementById('ex-body').innerHTML = pagina.map(({ e, c }) => `
    <tr class="row" onclick="abrirFicha('${e.id}')">
      <td class="mn">${esc(e.mn)}${iconesExame(e)}</td>
      <td class="desc" title="${esc(e.descricao)}">${esc(e.descricao)}</td>
      <td>${tagSetor(e.setorId)}</td>
      <td class="num">${celulaCusto(c)}</td>
      <td class="num">${c.sugerido ? fmt(c.sugerido) : '—'}</td>
      <td class="num">${e.precoPraticado ? fmt(e.precoPraticado) : '—'}${pendenciasExame(e, c).includes('div') ? ` <i class="fa-solid fa-code-compare flag" style="color:var(--amber)" title="Sistema: ${fmt(e.precoSistema)}"></i>` : ''}</td>
      <td class="num" style="color:${c.status === 'r' ? 'var(--red)' : 'inherit'}">${c.margem != null ? pct(c.margem) : '—'}</td>
      <td>${tagStatus(c.status)}</td></tr>`).join('')
    || `<tr><td colspan="8">${Object.keys(ESTADO.exames).length ? vazio('fa-magnifying-glass', 'Nenhum exame encontrado com esses filtros')
      : vazio('fa-file-import', `<b>Nenhum exame cadastrado</b><br>Faça a migração da planilha em <a href="#" onclick="irPara('importar');return false">Importar / Exportar</a>.`)}</td></tr>`;
  document.getElementById('ex-foot').innerHTML = paginacao(linhas.length, exF.pag, EX_POR_PAG, 'paginaExames');
}

function paginaExames(p) { exF.pag = p; desenharExames(); document.getElementById('s-exames').scrollIntoView({ block: 'start' }); }
function ordenarExames(k) { exF.dir = exF.ordem === k ? -exF.dir : 1; exF.ordem = k; desenharExames(); }
