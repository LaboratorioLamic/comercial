// ═══════════════════════════════════════════════════════════════
// instrucoes.js — Catálogo do exame (nome, material, prazo) e
// instruções com checklist de publicação (Site, Unilab, Revisado)
// ═══════════════════════════════════════════════════════════════
//
// Planilha "BD - TABELAS CH PARTICULARES", aba Exames (CSV):
//   A Mnemônico · B Material Biológico · C Nome do Exame · D Prazo (dias) · E Prazo (texto)
//   H Site · I Unilab · J Revisado · K Mnemônico (espelho) · L Instrução
//   (A–E e H–L são tabelas independentes: o vínculo é pelo mnemônico)

const CHECKS = {
  site:     { nome: 'Site',     icone: 'fa-globe',       acao: 'editar' },
  unilab:   { nome: 'Unilab',   icone: 'fa-desktop',     acao: 'editar' },
  revisado: { nome: 'Revisado', icone: 'fa-user-check',  acao: 'aprovar' }
};
const INS_POR_PAG = 50;
const ins = { q: '', filtro: '', pag: 1, imp: { passo: 0, texto: null, nome: '', analise: null, erro: '' } };

// ── Importação ────────────────────────────────────────────────
function analisarCatalogo(texto) {
  const linhas = lerCSV(texto);
  if (normalizar(linhas[0]?.[0]) !== 'mnemonico') throw new Error('Arquivo inválido: a coluna A da primeira linha deve ser "Mnemônico" (aba Exames).');
  const cat = {};
  const reg = mn => (cat[chaveExame(mn)] ??= { mn });
  linhas.slice(1).forEach(l => {
    const mn = String(l[0] || '').trim();
    if (mn && normalizar(mn) !== 'mnemonico') {
      const r = reg(mn), dias = parseInt(l[3], 10);
      Object.assign(r, { cadastro: true, nome: String(l[2] || '').trim(), material: String(l[1] || '').trim(), prazoDias: isNaN(dias) ? null : dias, prazo: String(l[4] || '').trim() || null });
    }
    const mn2 = String(l[10] || '').trim();
    if (mn2 && normalizar(mn2) !== 'mnemonico') {
      const r = reg(mn2), txt = String(l[11] || '').trim();
      Object.assign(r, { instrucao: txt || null, site: verdadeiro(l[7]), unilab: verdadeiro(l[8]), revisado: verdadeiro(l[9]) });
    }
  });
  const ls = Object.values(cat);
  if (!ls.length) throw new Error('Nenhum exame encontrado.');
  const exames = new Set(Object.values(ESTADO.exames).map(e => e.mn.toUpperCase()));
  return { cat, resumo: {
    total: ls.length, comCadastro: ls.filter(r => r.cadastro).length, comInstrucao: ls.filter(r => r.instrucao).length,
    site: ls.filter(r => r.site).length, unilab: ls.filter(r => r.unilab).length, revisado: ls.filter(r => r.revisado).length,
    soInstrucao: ls.filter(r => !r.cadastro).length, semInstrucao: ls.filter(r => r.cadastro && !r.instrucao).length,
    naBase: ls.filter(r => exames.has(r.mn.toUpperCase())).length,
    precosForaDoCatalogo: [...exames].filter(m => !cat[chaveExame(m)]).length
  } };
}

async function gravarCatalogo(cat) {
  const u = usuarioAtual(), agora = Date.now(), dados = {};
  Object.entries(cat).forEach(([k, r]) => {
    const x = { ...r, atualizadoEm: agora, atualizadoPor: u.nome };
    Object.keys(x).forEach(c => (x[c] === null || x[c] === undefined) && delete x[c]);
    dados[k] = x;
  });
  await DB.gravar('catalogo', dados);
  registrar('catalogo', `Catálogo importado: ${Object.keys(cat).length} exames`, { arquivo: ins.imp.nome });
}

// ── Tela ──────────────────────────────────────────────────────
async function renderInstrucoes() {
  const el = document.getElementById('s-instrucoes');
  if (!ESTADO.catalogo) {
    el.innerHTML = `<div class="card">${vazio('fa-circle-notch fa-spin', 'Carregando catálogo…')}</div>`;
    await garantirCatalogo();
    if (telaAtual !== 'instrucoes') return;
  }
  const cat = lista(ESTADO.catalogo), n = cat.length;
  const qtd = k => cat.filter(r => r[k]).length;
  const barra = (rot, v, ic, cor) => `<div class="prog"><div class="prog-l"><i class="fa-solid ${ic}" style="color:${cor}"></i>${rot}<b>${num(v, 0)} / ${num(n, 0)}</b><span>${n ? pct(v / n, 0) : '—'}</span></div><div class="barra"><div style="width:${n ? v / n * 100 : 0}%;background:${cor}"></div></div></div>`;
  el.innerHTML = `
    <div class="h-row"><div><h2>Instruções</h2><p>Catálogo do exame (nome, material, prazo) e instruções de coleta com checklist de publicação</p></div>
      ${pode('instrucoes', 'importar') ? `<button class="btn" onclick="ins.imp.passo=1;ins.imp.erro='';renderInstrucoes()"><i class="fa-solid fa-file-import"></i>Importar planilha</button>` : ''}</div>
    ${ins.imp.passo ? `<div class="card" style="margin-bottom:14px" id="ins-imp">${htmlImportCatalogo()}</div>` : ''}
    ${n ? `<div class="card progs">
      ${barra('Com instrução', qtd('instrucao'), 'fa-file-lines', 'var(--cyan)')}
      ${barra('Revisados', qtd('revisado'), CHECKS.revisado.icone, 'var(--green)')}
      ${barra('Publicados no site', qtd('site'), CHECKS.site.icone, '#6366f1')}
      ${barra('Publicados no Unilab', qtd('unilab'), CHECKS.unilab.icone, 'var(--amber)')}
    </div>` : ''}
    <div class="card" style="margin-top:14px">
      <div class="toolbar"><div class="search"><i class="fa-solid fa-magnifying-glass"></i><input id="q-ins" value="${esc(ins.q)}" placeholder="Buscar mnemônico, nome ou material…" oninput="ins.q=this.value;ins.pag=1;desenharInstrucoes()"></div></div>
      <div class="chips" id="ins-chips"></div>
      <div class="tbl-wrap" style="margin-top:10px"><table><thead><tr><th>MN</th><th>Nome do exame</th><th>Material</th><th>Prazo</th>${Object.values(CHECKS).map(c => `<th style="text-align:center" title="${c.nome}"><i class="fa-solid ${c.icone}"></i> ${c.nome}</th>`).join('')}<th></th></tr></thead><tbody id="ins-body"></tbody></table></div>
      <div class="foot" id="ins-foot"></div>
    </div>`;
  desenharInstrucoes();
}

const FILTROS_INS = {
  semins:  { nome: 'Sem instrução',  f: r => !r.instrucao },
  naorev:  { nome: 'Não revisado',   f: r => r.instrucao && !r.revisado },
  semsite: { nome: 'Falta no site',  f: r => r.revisado && !r.site },
  semuni:  { nome: 'Falta no Unilab', f: r => r.revisado && !r.unilab },
  semcad:  { nome: 'Sem cadastro',   f: r => !r.cadastro },
  semnome: { nome: 'Sem nome',       f: r => r.cadastro && !r.nome }
};

function desenharInstrucoes() {
  const body = document.getElementById('ins-body');
  if (!body) return;
  const todos = lista(ESTADO.catalogo).filter(r => contem(`${r.mn} ${r.nome || ''} ${r.material || ''}`, ins.q));
  document.getElementById('ins-chips').innerHTML = `<button class="chip ${!ins.filtro ? 'on' : ''}" onclick="ins.filtro='';ins.pag=1;desenharInstrucoes()"><i class="fa-solid fa-list"></i>Todos <b>${todos.length}</b></button>` +
    Object.entries(FILTROS_INS).map(([k, x]) => `<button class="chip ${ins.filtro === k ? 'on' : ''}" onclick="ins.filtro='${k}';ins.pag=1;desenharInstrucoes()">${x.nome} <b>${todos.filter(x.f).length}</b></button>`).join('');
  const ls = todos.filter(r => !ins.filtro || FILTROS_INS[ins.filtro].f(r)).sort((a, b) => a.mn.localeCompare(b.mn));
  const n = Math.max(1, Math.ceil(ls.length / INS_POR_PAG)); if (ins.pag > n) ins.pag = n;
  body.innerHTML = ls.slice((ins.pag - 1) * INS_POR_PAG, ins.pag * INS_POR_PAG).map(r => `
    <tr class="row" onclick="abrirInstrucao('${r.id}')">
      <td class="mn">${esc(r.mn)}</td><td class="desc" title="${esc(r.nome || '')}">${r.nome ? esc(r.nome) : `<span class="warn-i"><i class="fa-solid fa-triangle-exclamation"></i>${r.cadastro ? 'sem nome' : 'sem cadastro'}</span>`}</td>
      <td>${r.material ? `<span class="tag"><i class="fa-solid fa-vial"></i>${esc(r.material)}</span>` : '—'}</td><td>${esc(prazoDe(r) || '—')}</td>
      ${Object.entries(CHECKS).map(([k, c]) => `<td style="text-align:center" onclick="event.stopPropagation()"><button class="cb ${r[k] ? 'on' : ''}" ${pode('instrucoes', c.acao) ? '' : 'disabled'} title="${c.nome}" onclick="marcarCheck('${r.id}','${k}')"><i class="fa-solid fa-check"></i></button></td>`).join('')}
      <td>${r.instrucao ? '<i class="fa-solid fa-file-lines muted" title="Tem instrução"></i>' : ''}</td></tr>`).join('')
    || `<tr><td colspan="8">${Object.keys(ESTADO.catalogo).length ? vazio('fa-magnifying-glass', 'Nada encontrado') : vazio('fa-book-medical', '<b>Catálogo vazio</b><br>Importe a planilha de instruções (aba Exames, .csv).')}</td></tr>`;
  document.getElementById('ins-foot').innerHTML = paginacao(ls.length, ins.pag, INS_POR_PAG, 'paginaInstrucoes');
}
function paginaInstrucoes(p) { ins.pag = p; desenharInstrucoes(); }

async function marcarCheck(id, k) {
  const r = ESTADO.catalogo[id], u = usuarioAtual(), v = !r[k];
  await DB.mesclar(`catalogo/${id}`, { [k]: v, [`${k}Por`]: v ? u.nome : null, [`${k}Em`]: v ? DB.agora() : null });
  toast(`${r.mn}: ${CHECKS[k].nome} ${v ? 'marcado' : 'desmarcado'}`);
}

// ── Importação (cartão) ───────────────────────────────────────
function htmlImportCatalogo() {
  const im = ins.imp;
  const cab = `<div class="sec-card-h"><span class="tc-ic" style="--c:#1d7044"><i class="fa-solid fa-file-excel"></i></span><div><h3>Importar catálogo e instruções</h3><div class="sub">Planilha "BD - TABELAS CH PARTICULARES", aba Exames → Arquivo → Fazer download → .csv</div></div>
    <div class="rt"><button class="btn sm" onclick="ins.imp={passo:0};renderInstrucoes()"><i class="fa-solid fa-xmark"></i></button></div></div>`;
  if (im.passo === 1) return cab + `<div class="wz-body">
      <label class="drop ${im.nome ? 'ok' : ''}" for="ins-arq"><input type="file" id="ins-arq" accept=".csv,text/csv" onchange="lerArquivoCatalogo(this)"><i class="fa-solid ${im.nome ? 'fa-circle-check' : 'fa-cloud-arrow-up'}"></i><b>Aba Exames (.csv)</b><div class="drop-s">${im.nome ? esc(im.nome) : 'Clique para escolher'}</div></label>
      ${im.erro ? `<div class="alert r" style="margin-top:12px"><i class="fa-solid fa-circle-xmark"></i><div>${esc(im.erro)}</div></div>` : ''}</div>
    <div class="wz-f"><span class="muted" style="font-size:12px">Nada é gravado nesta etapa</span><button class="btn pri" ${im.texto ? '' : 'disabled'} onclick="analisarArquivoCatalogo()">Analisar<i class="fa-solid fa-arrow-right"></i></button></div>`;
  if (im.passo === 2) {
    const r = im.analise.resumo, atual = Object.keys(ESTADO.catalogo || {}).length;
    const kp = (ic, cor, rot, v, s = '') => `<div class="imp"><div class="l"><i class="fa-solid ${ic}" style="color:${cor}"></i>${rot}</div><div class="v">${num(v, 0)}</div>${s ? `<div class="d muted">${s}</div>` : ''}</div>`;
    return cab + `<div class="wz-body"><div class="sumgrid">
        ${kp('fa-list', 'var(--text-muted)', 'Exames', r.total, `${r.comCadastro} com cadastro (A–E)`)}
        ${kp('fa-file-lines', 'var(--cyan)', 'Com instrução', r.comInstrucao, `${r.semInstrucao} cadastrados sem instrução`)}
        ${kp('fa-user-check', 'var(--green)', 'Revisados', r.revisado)}
        ${kp('fa-globe', '#6366f1', 'No site', r.site)}
        ${kp('fa-desktop', 'var(--amber)', 'No Unilab', r.unilab)}
        ${kp('fa-link', 'var(--green)', 'Na base de preços', r.naBase)}
        ${kp('fa-triangle-exclamation', 'var(--amber)', 'Só instrução', r.soInstrucao, 'sem cadastro em A–E')}
        ${kp('fa-plug-circle-xmark', 'var(--red)', 'Preços fora do catálogo', r.precosForaDoCatalogo, 'exames com preço sem cadastro')}
      </div>
      <div class="alert ${atual ? 'a' : 'x'}"><i class="fa-solid fa-circle-info"></i><div>${atual ? `O catálogo atual (${num(atual, 0)} exames) será <b>substituído</b>, inclusive checklists marcados no sistema.` : 'Primeira importação do catálogo.'}</div></div></div>
      <div class="wz-f"><button class="btn" onclick="ins.imp.passo=1;renderInstrucoes()"><i class="fa-solid fa-arrow-left"></i>Voltar</button><button class="btn pri" onclick="confirmarCatalogo()"><i class="fa-solid fa-check"></i>Gravar catálogo</button></div>`;
  }
  return cab + `<div class="wz-body"><div class="done-box"><i class="fa-solid fa-circle-check"></i><h3>Catálogo importado</h3><p>${esc(im.resultado || '')}</p></div></div>`;
}

function lerArquivoCatalogo(input) {
  const f = input.files[0]; if (!f) return;
  const rd = new FileReader();
  rd.onload = () => { ins.imp.texto = rd.result; ins.imp.nome = f.name; ins.imp.erro = ''; renderInstrucoes(); };
  rd.readAsText(f, 'UTF-8');
}
function analisarArquivoCatalogo() {
  try { ins.imp.analise = analisarCatalogo(ins.imp.texto); ins.imp.passo = 2; ins.imp.erro = ''; }
  catch (e) { ins.imp.erro = e.message; }
  renderInstrucoes();
}
async function confirmarCatalogo() {
  const atual = Object.keys(ESTADO.catalogo || {}).length;
  if (atual && !(await confirmar({ titulo: 'Substituir o catálogo?', texto: `${num(atual, 0)} exames serão substituídos pelos da planilha.`, botao: 'Substituir', perigo: true }))) return;
  await gravarCatalogo(ins.imp.analise.cat);
  ins.imp.resultado = `${num(ins.imp.analise.resumo.total, 0)} exames gravados`;
  ins.imp.passo = 3; ins.imp.texto = null;
  renderInstrucoes();
}

// ── Editor (gaveta) ───────────────────────────────────────────
let _iEd = null;
async function abrirInstrucao(id, voltarFicha = null) {
  await garantirCatalogo();
  const r = ESTADO.catalogo[id] || { mn: ESTADO.exames[id]?.mn || id };
  const editar = pode('instrucoes', 'editar');
  _iEd = { id, voltar: voltarFicha, checks: { site: !!r.site, unilab: !!r.unilab, revisado: !!r.revisado } };
  const quem = k => r[k] && r[`${k}Por`] ? `${esc(r[`${k}Por`])} · ${dataHora(r[`${k}Em`])}` : r[k] ? 'importado da planilha' : 'pendente';
  abrirGaveta({
    sobre: r.mn, titulo: r.nome || 'Instrução do exame',
    meta: `${r.material ? `<span class="tag"><i class="fa-solid fa-vial"></i>${esc(r.material)}</span>` : ''}${prazoDe(r) ? `<span class="tag"><i class="fa-solid fa-clock"></i>${esc(prazoDe(r))}</span>` : ''}`,
    corpo: `<div class="form-col">
      ${campo('in-nome', 'Nome do exame', r.nome || '', { tipo: 'text', desab: !editar })}
      <div class="fgrid sem-pad" style="grid-template-columns:2fr 1fr">
        ${campo('in-mat', 'Material biológico', r.material || '', { tipo: 'text', desab: !editar })}
        ${campo('in-dias', 'Prazo (dias)', diasPrazo(id) ?? '', { passo: '1', desab: !editar, dica: '0 = 24 Horas' })}
      </div>
      <div class="field"><label><i class="fa-solid fa-file-lines"></i>Instrução</label>
        <textarea id="in-txt" class="txt-grande" ${editar ? '' : 'disabled'} placeholder="Jejum, preparo, coleta, conservação…">${esc(r.instrucao || '')}</textarea></div>
      <div class="sec-t"><i class="fa-solid fa-list-check"></i>Publicação</div>
      <div class="casc">${Object.entries(CHECKS).map(([k, c]) => `<div class="casc-r"><div class="lft"><i class="fa-solid ${c.icone}"></i><div>${c.nome === 'Revisado' ? 'Revisado' : 'Publicado no ' + c.nome}<div class="s">${quem(k)}</div></div></div>${chave(_iEd.checks[k], `_iEd.checks['${k}']=!_iEd.checks['${k}'];this.classList.toggle('on')`, !pode('instrucoes', c.acao))}</div>`).join('')}</div>
    </div>`,
    rodape: `${voltarFicha ? `<button class="btn" style="margin-right:auto" onclick="abrirFicha('${voltarFicha}','instrucoes')"><i class="fa-solid fa-arrow-left"></i>Ficha do exame</button>` : ''}
      <button class="btn" onclick="fecharGaveta()">${editar ? 'Cancelar' : 'Fechar'}</button>
      ${editar || pode('instrucoes', 'aprovar') ? `<button class="btn pri" onclick="gravarInstrucao()"><i class="fa-solid fa-floppy-disk"></i>Salvar</button>` : ''}`
  });
}

async function gravarInstrucao() {
  const r = ESTADO.catalogo[_iEd.id] || {}, u = usuarioAtual(), dados = { mn: r.mn || ESTADO.exames[_iEd.id]?.mn || _iEd.id, cadastro: true };
  if (pode('instrucoes', 'editar')) {
    const dias = parseInt(valorCampo('in-dias'), 10);
    Object.assign(dados, { nome: valorCampo('in-nome').trim() || null, material: valorCampo('in-mat').trim() || null, prazoDias: isNaN(dias) ? null : Math.max(0, dias),
      prazo: isNaN(dias) ? (r.prazo ?? null) : null, instrucao: valorCampo('in-txt').trim() || null });
    // texto mudou → volta a precisar de revisão
    if ((dados.instrucao || '') !== (r.instrucao || '') && r.revisado && _iEd.checks.revisado) _iEd.checks.revisado = false;
  }
  Object.entries(_iEd.checks).forEach(([k, v]) => {
    if (!pode('instrucoes', CHECKS[k].acao) || !!r[k] === v) return;
    Object.assign(dados, { [k]: v, [`${k}Por`]: v ? u.nome : null, [`${k}Em`]: v ? DB.agora() : null });
  });
  dados.atualizadoEm = DB.agora(); dados.atualizadoPor = u.nome;
  await DB.mesclar(`catalogo/${_iEd.id}`, dados);
  // o exame guarda o mesmo prazo em dias
  if (dados.prazoDias != null && ESTADO.exames[_iEd.id]) await DB.mesclar(`${CAMINHOS.exames}/${_iEd.id}`, { prazoDias: dados.prazoDias, prazo: null });
  toast(`Instrução de ${dados.mn} salva${dados.revisado === false && r.revisado ? ' · precisa de nova revisão' : ''}`);
  if (_iEd.voltar) abrirFicha(_iEd.voltar, 'instrucoes'); else fecharGaveta();
}

// Seção da ficha do exame
async function desenharCatalogoFicha(id) {
  const el = document.getElementById('fx-cat');
  if (!el) return;
  await garantirCatalogo();
  if (_fxId !== id || !document.getElementById('fx-cat')) return;
  const r = ESTADO.catalogo[id];
  el.innerHTML = !r ? `<div class="muted" style="font-size:12.5px"><i class="fa-solid fa-triangle-exclamation" style="color:var(--amber)"></i> Exame fora do catálogo de instruções. ${pode('instrucoes', 'editar') ? `<a href="#" onclick="abrirInstrucao('${id}','${id}');return false">Cadastrar</a>` : ''}</div>`
    : `<div class="casc">
      <div class="casc-r"><div class="lft"><i class="fa-solid fa-vial"></i><div>${esc(r.material || '—')}<div class="s">${esc(r.nome || '')}</div></div></div><span class="tag"><i class="fa-solid fa-clock"></i>${esc(prazoDe(r) || '—')}</span></div>
      <div class="casc-r"><div class="lft"><i class="fa-solid fa-file-lines"></i><div class="ins-prev">${r.instrucao ? esc(r.instrucao.slice(0, 220)) + (r.instrucao.length > 220 ? '…' : '') : '<span class="muted">sem instrução</span>'}</div></div></div>
      <div class="casc-r"><div class="lft">${Object.entries(CHECKS).map(([k, c]) => `<span class="badge-s ${r[k] ? 'ok' : 'off'}"><i class="fa-solid ${r[k] ? 'fa-check' : c.icone}"></i>${c.nome}</span>`).join(' ')}</div>
        <button class="btn sm" onclick="abrirInstrucao('${id}','${id}')"><i class="fa-solid fa-book-medical"></i>Abrir</button></div></div>`;
}
