// ═══════════════════════════════════════════════════════════════
// setores.js — Cadastro de setores: categoria, cor, ícone, etapas
// padrão e margem alvo própria — COMERCIAL LAMIC
// ═══════════════════════════════════════════════════════════════

let buscaSetor = '';

const tagCategoria = k => {
  const c = CATEGORIAS[k];
  return c ? `<span class="badge-s" style="background:color-mix(in srgb,${c.cor} 14%,transparent);color:${c.cor}"><i class="fa-solid ${c.icone}"></i>${c.nome}</span>` : '';
};
const tagModelo = s => s.categoria !== 'apoio' ? '' : MODELOS_APOIO[s.modeloImportacao]
  ? `<div class="tag-mod"><span class="tag" title="Modelo de importação: ${esc(MODELOS_APOIO[s.modeloImportacao].nome)}"><i class="fa-solid ${MODELOS_APOIO[s.modeloImportacao].icone}" style="color:${MODELOS_APOIO[s.modeloImportacao].cor}"></i>${esc(MODELOS_APOIO[s.modeloImportacao].nome)}</span></div>`
  : '<div class="tag-mod"><span class="tag muted" title="Custos informados manualmente"><i class="fa-solid fa-pen"></i>sem modelo</span></div>';
const passaEtapa = (s, k) => s.etapas?.[k] !== false;

function renderSetores() {
  painelConfig().innerHTML = `<div class="card">
    <div class="toolbar">
      <div class="search"><i class="fa-solid fa-magnifying-glass"></i><input id="q-set" value="${esc(buscaSetor)}" placeholder="Buscar setor…" oninput="buscaSetor=this.value;desenharTabelaSetores()"></div>
      <div id="pop-scat"></div>
      ${pode('params', 'editar') ? `<button class="btn pri" onclick="abrirSetor()"><i class="fa-solid fa-plus"></i>Novo setor</button>` : ''}
    </div>
    <div class="tbl-wrap"><table><thead><tr><th>Setor</th><th>Categoria</th><th>Etapas padrão</th><th class="num">Exames</th><th class="num">Margem alvo</th><th></th></tr></thead><tbody id="setores-body"></tbody></table></div>
    <div class="foot"><span id="set-count"></span><span></span></div></div>`;
  criarPop('pop-scat', {
    rotulo: 'Categoria', titulo: 'Filtrar por categoria', icone: 'fa-shapes', limpavel: true,
    opcoes: () => [{ valor: '', rotulo: 'Todas', icone: 'fa-layer-group', qtd: Object.keys(ESTADO.setores).length },
      ...Object.entries(CATEGORIAS).map(([k, c]) => ({ valor: k, rotulo: c.nome, desc: c.desc, icone: c.icone, cor: c.cor, qtd: lista(ESTADO.setores).filter(s => s.categoria === k).length }))],
    aoMudar: desenharTabelaSetores
  });
  desenharTabelaSetores();
}

function desenharTabelaSetores() {
  const cat = valorPop('pop-scat'), ordemCat = Object.keys(CATEGORIAS);
  const todos = lista(ESTADO.setores);
  const qtd = {};
  Object.values(ESTADO.exames).forEach(e => { if (e.setorId) qtd[e.setorId] = (qtd[e.setorId] || 0) + 1; });
  const ss = todos.filter(s => (!cat || s.categoria === cat) && contem(s.nome, buscaSetor))
    .sort((a, b) => ordemCat.indexOf(a.categoria) - ordemCat.indexOf(b.categoria) || porNome(a, b));
  document.getElementById('setores-body').innerHTML = ss.map(s => `
    <tr class="row" onclick="abrirSetor('${s.id}')">
      <td><div class="ucell"><span class="po-ic" style="--c:${s.cor}"><i class="fa-solid ${s.icone}"></i></span><b style="font-weight:500">${esc(s.nome)}</b></div></td>
      <td>${tagCategoria(s.categoria)}${tagModelo(s)}</td>
      <td>${Object.entries(ETAPAS).map(([k, e]) => `<span class="tag ${passaEtapa(s, k) ? '' : 'riscado'}"><i class="fa-solid ${e.icone}"></i>${e.nome}</span>`).join(' ')}</td>
      <td class="num">${qtd[s.id] || 0}</td>
      <td class="num">${s.margemAlvo != null ? `<b>${pct(s.margemAlvo)}</b> <span class="badge-s warn">próprio</span>` : `<span class="muted">${pct(parametro('margemAlvo'))} global</span>`}</td>
      <td><i class="fa-solid fa-chevron-right muted"></i></td></tr>`).join('') || `<tr><td colspan="6">${vazio('fa-sitemap', 'Nenhum setor encontrado')}</td></tr>`;
  document.getElementById('set-count').textContent = `${ss.length} de ${todos.length} setores`;
}

// ── Editor ────────────────────────────────────────────────────
let _sEd = null, _icoBusca = '';
function abrirSetor(id) {
  const s = id ? ESTADO.setores[id] : null;
  const editar = pode('params', 'editar');
  _icoBusca = '';
  _sEd = s ? { id, ...JSON.parse(JSON.stringify(s)) } : { id: null, nome: '', categoria: 'interno', icone: 'fa-vial', cor: '#00a8cc', etapas: { coleta: true, triagem: true }, margemAlvo: null };
  _sEd.etapas = { coleta: true, triagem: true, ..._sEd.etapas };
  Object.assign(_sEd, { aba: 'dados', sel: new Set(), qSem: '', qDo: '' });
  abrirGaveta({
    sobre: id ? 'Editar setor' : 'Novo setor', titulo: id ? s.nome : 'Cadastrar setor',
    corpo: `<div class="seg set-abas" id="set-abas"></div><div id="set-ed"></div>`,
    rodape: editar ? `${id ? `<button class="btn perigo-txt" style="margin-right:auto" onclick="excluirSetor()"><i class="fa-solid fa-trash"></i>Excluir</button>` : ''}
      <button class="btn" onclick="fecharGaveta()">Cancelar</button><button class="btn pri" onclick="gravarSetor()"><i class="fa-solid fa-floppy-disk"></i>Salvar setor</button>`
      : `<button class="btn" onclick="fecharGaveta()">Fechar</button>`
  });
  desenharEditorSetor();
}

function previaSetor() {
  document.getElementById('set-prev').innerHTML = `<span class="tc-ic" style="--c:${_sEd.cor};width:46px;height:46px;font-size:19px"><i class="fa-solid ${_sEd.icone}"></i></span>
    <div><div style="font-weight:600">${_sEd.nome ? esc(_sEd.nome) : '<span class="muted">Nome do setor</span>'}</div><div style="margin-top:4px">${tagCategoria(_sEd.categoria)}</div></div>
    <span class="tag" style="margin-left:auto"><i class="fa-solid ${_sEd.icone}" style="color:${_sEd.cor}"></i>${esc(_sEd.nome || 'SETOR')}</span>`;
}

function desenharAbasSetor() {
  const n = _sEd.id ? Object.values(ESTADO.exames).filter(e => e.setorId === _sEd.id).length : 0;
  document.getElementById('set-abas').innerHTML = [['dados', 'Dados do setor', 'fa-sliders'], ['exames', `Exames (${n})`, 'fa-flask-vial']]
    .map(([k, t, ic]) => `<button class="${_sEd.aba === k ? 'on' : ''}" onclick="_sEd.aba='${k}';desenharEditorSetor()"><i class="fa-solid ${ic}"></i>${t}</button>`).join('');
}

function desenharEditorSetor() {
  desenharAbasSetor();
  if (_sEd.aba === 'exames') return desenharExamesSetor();
  const d = pode('params', 'editar') ? '' : 'disabled';
  document.getElementById('set-ed').innerHTML = `
    <div class="set-prev" id="set-prev"></div>
    <div class="sec-t"><i class="fa-solid fa-font"></i>Nome</div>
    <div class="inp"><input class="txt" id="se-nome" value="${esc(_sEd.nome)}" placeholder="Ex.: IMUNOLOGIA" ${d} oninput="_sEd.nome=this.value.toUpperCase();previaSetor()" style="text-transform:uppercase"></div>
    <div class="sec-t"><i class="fa-solid fa-shapes"></i>Categoria</div>
    <div class="opt-cards">${Object.entries(CATEGORIAS).map(([k, c]) => `<button type="button" class="oc ${_sEd.categoria === k ? 'on' : ''}" ${d} onclick="escolherCategoria('${k}')"><span class="po-ic" style="--c:${c.cor}"><i class="fa-solid ${c.icone}"></i></span><span><b>${c.nome}</b><small>${c.desc}</small></span><i class="fa-solid fa-circle-check ck"></i></button>`).join('')}</div>
    ${_sEd.categoria === 'apoio' ? `<div class="sec-t"><i class="fa-solid fa-file-import"></i>Modelo de importação da tabela</div>
    <div class="opt-cards">${[['', { nome: 'Sem modelo', desc: 'Custo informado manualmente na ficha de cada exame', icone: 'fa-pen', cor: 'var(--gray)' }], ...Object.entries(MODELOS_APOIO)].map(([k, m]) =>
      `<button type="button" class="oc ${(_sEd.modeloImportacao || '') === k ? 'on' : ''}" ${d} onclick="_sEd.modeloImportacao='${k}';desenharEditorSetor()"><span class="po-ic" style="--c:${m.cor}"><i class="fa-solid ${m.icone}"></i></span><span><b>${esc(m.nome)}</b><small>${esc(m.desc)}</small></span><i class="fa-solid fa-circle-check ck"></i></button>`).join('')}</div>
    <div class="hint" style="margin-top:6px"><i class="fa-solid fa-circle-info"></i> Usado em Custos → Laboratórios de apoio → Importar tabela. Para um apoio novo, envie um arquivo de exemplo e o modelo entra nesta lista.</div>` : ''}
    <div class="sec-t"><i class="fa-solid fa-palette"></i>Cor</div>
    <div class="swatches">${PALETA.map(c => `<button type="button" class="sw ${_sEd.cor === c ? 'on' : ''}" style="--c:${c}" title="${c}" ${d} onclick="_sEd.cor='${c}';desenharEditorSetor()"></button>`).join('')}
      <label class="sw sw-custom ${PALETA.includes(_sEd.cor) ? '' : 'on'}" title="Cor personalizada"><input type="color" value="${_sEd.cor}" ${d} oninput="_sEd.cor=this.value;previaSetor();document.querySelectorAll('#ico-grid .ig').forEach(x=>x.style.setProperty('--c',this.value))" onchange="desenharEditorSetor()"><i class="fa-solid fa-eye-dropper"></i></label></div>
    <div class="sec-t"><i class="fa-solid fa-icons"></i>Ícone</div>
    <div class="pop-search" style="margin:0 0 8px"><i class="fa-solid fa-magnifying-glass"></i><input placeholder="Buscar ícone (ex.: sangue, urina, vírus)…" value="${esc(_icoBusca)}" ${d} oninput="_icoBusca=this.value;desenharIcones()"></div>
    <div class="icon-grid" id="ico-grid"></div>
    <div class="sec-t"><i class="fa-solid fa-route"></i>Etapas padrão dos exames</div>
    <div class="casc">${Object.entries(ETAPAS).map(([k, e]) => `<div class="casc-r"><div class="lft"><i class="fa-solid ${e.icone}"></i><div>Passa por ${e.nome.toLowerCase()}<div class="s">custos de ${e.nome.toLowerCase()} entram no preço</div></div></div>${chave(_sEd.etapas[k], `_sEd.etapas['${k}']=!_sEd.etapas['${k}'];this.classList.toggle('on')`, !!d)}</div>`).join('')}</div>
    <div class="sec-t"><i class="fa-solid fa-bullseye"></i>Margem alvo</div>
    <div class="casc"><div class="casc-r"><div class="lft"><i class="fa-solid fa-sliders"></i><div>Usar alvo próprio<div class="s">senão usa o global (${pct(parametro('margemAlvo'))})</div></div></div>${chave(_sEd.margemAlvo != null, `_sEd.margemAlvo=_sEd.margemAlvo!=null?null:parametro('margemAlvo');desenharEditorSetor()`, !!d)}</div></div>
    ${_sEd.margemAlvo != null ? `<div style="margin-top:10px">${campo('se-alvo', 'Margem alvo do setor', +(_sEd.margemAlvo * 100).toFixed(1), { suf: '%', aoMudar: '_sEd.margemAlvo=(parseFloat(this.value)||0)/100', desab: !!d })}</div>` : ''}`;
  previaSetor();
  desenharIcones();
}

// ── Aba Exames: exames do setor e vínculo de exames sem setor ──
const examesSemSetor = () => lista(ESTADO.exames).filter(e => !ESTADO.setores[e.setorId]).sort((a, b) => a.mn.localeCompare(b.mn));
const linhaExameSetor = (e, extra) => `<div class="casc-r lin-ex"><div class="lft">${extra.antes || ''}<div><span class="mn">${esc(e.mn)}</span>${e.ativo === false ? ' <span class="badge-s off">inativo</span>' : ''}<div class="s">${esc(e.descricao || '')}</div></div></div>${extra.depois || ''}</div>`;

function desenharExamesSetor() {
  const el = document.getElementById('set-ed');
  if (!_sEd.id) { el.innerHTML = vazio('fa-floppy-disk', '<b>Salve o setor primeiro</b><br>Depois volte a esta aba para vincular os exames.'); return; }
  const editar = pode('exames', 'editar'), nSem = examesSemSetor().length;
  el.innerHTML = `
    ${editar ? `<div class="sec-t"><i class="fa-solid fa-link"></i>Vincular exames sem setor <span class="badge-s warn">${nSem}</span></div>
    <div class="pop-search" style="margin:0 0 8px"><i class="fa-solid fa-magnifying-glass"></i><input placeholder="Buscar mnemônico ou nome…" value="${esc(_sEd.qSem)}" oninput="_sEd.qSem=this.value;desenharListaSemSetor()"></div>
    <div class="lista-ex-cab" id="set-sem-cab"></div>
    <div class="casc lista-ex" id="set-sem"></div>
    <div class="vinc-bar" id="set-vinc"></div>` : ''}
    <div class="sec-t" style="margin-top:18px"><i class="fa-solid fa-flask-vial"></i>Exames do setor</div>
    <div class="pop-search" style="margin:0 0 8px"><i class="fa-solid fa-magnifying-glass"></i><input placeholder="Buscar no setor…" value="${esc(_sEd.qDo)}" oninput="_sEd.qDo=this.value;desenharListaDoSetor()"></div>
    <div class="casc lista-ex" id="set-do"></div>`;
  if (editar) desenharListaSemSetor();
  desenharListaDoSetor();
}

function desenharListaSemSetor() {
  const ls = examesSemSetor().filter(e => contem(e.mn + ' ' + e.descricao, _sEd.qSem));
  const vis = ls.slice(0, 300), todos = ls.length > 0 && ls.every(e => _sEd.sel.has(e.id));
  document.getElementById('set-sem-cab').innerHTML = ls.length ? `<button class="cb ${todos ? 'on' : ''}" onclick="selTodosSemSetor(${!todos})"><i class="fa-solid fa-check"></i></button>
    <span>${todos ? 'Desmarcar' : 'Marcar'} ${_sEd.qSem ? 'os filtrados' : 'todos'} (${ls.length})</span>` : '';
  document.getElementById('set-sem').innerHTML = vis.map(e => linhaExameSetor(e, {
      antes: `<button class="cb ${_sEd.sel.has(e.id) ? 'on' : ''}" data-id="${esc(e.id)}" onclick="marcarSemSetor(this)"><i class="fa-solid fa-check"></i></button>`
    })).join('')
    + (ls.length > vis.length ? `<div class="casc-r muted" style="font-size:12px">+ ${ls.length - vis.length} exames: use a busca para encontrar</div>` : '')
    || `<div class="casc-r muted">${_sEd.qSem ? 'Nenhum exame sem setor com essa busca' : 'Todos os exames já têm setor'}</div>`;
  desenharBarraVinculo();
}

function marcarSemSetor(btn) {
  const id = btn.dataset.id;
  _sEd.sel.has(id) ? _sEd.sel.delete(id) : _sEd.sel.add(id);
  btn.classList.toggle('on', _sEd.sel.has(id));
  desenharBarraVinculo();
}
function selTodosSemSetor(on) {
  examesSemSetor().filter(e => contem(e.mn + ' ' + e.descricao, _sEd.qSem)).forEach(e => on ? _sEd.sel.add(e.id) : _sEd.sel.delete(e.id));
  desenharListaSemSetor();
}

function desenharBarraVinculo() {
  const n = _sEd.sel.size, el = document.getElementById('set-vinc');
  el.innerHTML = n ? `<span><b>${n}</b> exame(s) marcado(s)</span><button class="btn sm" onclick="_sEd.sel.clear();desenharListaSemSetor()">Limpar</button>
    <button class="btn sm pri" onclick="vincularExamesSetor()"><i class="fa-solid fa-link"></i>Vincular ao setor</button>` : '<span class="hint">Marque os exames que pertencem a este setor</span>';
}

function desenharListaDoSetor() {
  const editar = pode('exames', 'editar');
  const ls = lista(ESTADO.exames).filter(e => e.setorId === _sEd.id && contem(e.mn + ' ' + e.descricao, _sEd.qDo)).sort((a, b) => a.mn.localeCompare(b.mn));
  const vis = ls.slice(0, 300);
  document.getElementById('set-do').innerHTML = vis.map(e => linhaExameSetor(e, {
      depois: editar ? `<button class="pop-x" title="Desvincular (fica sem setor)" data-id="${esc(e.id)}" onclick="desvincularExameSetor(this.dataset.id)"><i class="fa-solid fa-link-slash"></i></button>` : ''
    })).join('')
    + (ls.length > vis.length ? `<div class="casc-r muted" style="font-size:12px">+ ${ls.length - vis.length} exames: use a busca para encontrar</div>` : '')
    || `<div class="casc-r muted">${_sEd.qDo ? 'Nenhum exame com essa busca' : 'Nenhum exame neste setor'}</div>`;
}

// Grava o setor (e a origem: apoio ou interno) nos exames
async function mudarSetorExames(ids, setorId) {
  const s = ESTADO.setores[setorId], u = usuarioAtual(), agora = DB.agora(), upd = {};
  ids.forEach(id => {
    const dados = { setorId: setorId || null, atualizadoEm: agora, atualizadoPor: u.nome };
    if (s) dados.origem = s.categoria === 'apoio' ? 'apoio' : 'interno';
    Object.entries(dados).forEach(([k, v]) => { upd[`${CAMINHOS.exames}/${id}/${k}`] = v; });
    upd[`historicoExames/${id}/${DB.novaChave('historicoExames')}`] = { descricao: s ? `Vinculado ao setor ${s.nome}` : `Desvinculado do setor ${ESTADO.setores[ESTADO.exames[id]?.setorId]?.nome || ''}`, usuario: u.nome, usuarioId: u.id, em: agora };
    ESTADO.exames[id] = { ...ESTADO.exames[id], ...dados, atualizadoEm: Date.now() };
  });
  await DB.mesclar('/', upd);
}

async function vincularExamesSetor() {
  const ids = [..._sEd.sel].filter(id => ESTADO.exames[id]), s = ESTADO.setores[_sEd.id];
  if (!ids.length) return;
  await mudarSetorExames(ids, _sEd.id);
  registrar('setores', `${ids.length} exame(s) vinculados ao setor ${s.nome}`, { exames: ids.map(id => ESTADO.exames[id].mn) });
  _sEd.sel.clear();
  desenharEditorSetor();
  toast(`${ids.length} exame(s) vinculados a ${s.nome}`);
}

async function desvincularExameSetor(id) {
  const e = ESTADO.exames[id], s = ESTADO.setores[_sEd.id];
  await mudarSetorExames([id], null);
  registrar('setores', `Exame ${e.mn} desvinculado do setor ${s.nome}`);
  desenharEditorSetor();
  toast(`${e.mn} agora está sem setor`);
}

function escolherCategoria(k) {
  _sEd.categoria = k;
  if (k === 'servico') _sEd.etapas = { coleta: false, triagem: false };
  desenharEditorSetor();
}

function desenharIcones() {
  const d = pode('params', 'editar') ? '' : 'disabled';
  const ls = ICONES.filter(([ic, k]) => contem(ic + ' ' + k, _icoBusca));
  document.getElementById('ico-grid').innerHTML = ls.map(([ic, k]) => `<button type="button" class="ig ${_sEd.icone === ic ? 'on' : ''}" style="--c:${_sEd.cor}" title="${k}" ${d}
      onclick="_sEd.icone='${ic}';document.querySelectorAll('#ico-grid .ig').forEach(x=>x.classList.toggle('on',x===this));previaSetor()"><i class="fa-solid ${ic}"></i></button>`).join('')
    || '<div class="pop-empty" style="grid-column:1/-1"><i class="fa-solid fa-icons"></i>Nenhum ícone encontrado</div>';
}

async function gravarSetor() {
  const nome = (_sEd.nome || '').trim();
  if (!nome) { document.getElementById('se-nome').focus(); return toast('Informe o nome do setor', 'erro'); }
  if (lista(ESTADO.setores).some(s => normalizar(s.nome) === normalizar(nome) && s.id !== _sEd.id)) return toast('Já existe um setor com esse nome', 'erro');
  if (_sEd.margemAlvo != null && (_sEd.margemAlvo <= 0 || _sEd.margemAlvo + parametro('imposto') >= 1)) return toast('Margem alvo inválida', 'erro');
  const { id, ...dados } = { ..._sEd, nome };
  if (dados.categoria !== 'apoio' || !MODELOS_APOIO[dados.modeloImportacao]) dados.modeloImportacao = dados.categoria === 'apoio' ? '' : null;
  const antes = id ? ESTADO.setores[id] : null;
  const chaveId = id || DB.novaChave(CAMINHOS.setores);
  await DB.gravar(`${CAMINHOS.setores}/${chaveId}`, dados);
  registrar('setores', `Setor ${nome} ${id ? 'alterado' : 'criado'}`, { antes, depois: dados });
  fecharGaveta();
  toast(`Setor ${nome} ${id ? 'atualizado' : 'criado'}`);
}

async function excluirSetor() {
  const s = ESTADO.setores[_sEd.id];
  const n = Object.values(ESTADO.exames).filter(e => e.setorId === _sEd.id).length;
  if (n) return toast(`${s.nome} tem ${n} exame(s): mova-os para outro setor antes de excluir`, 'aviso');
  const ok = await confirmar({ titulo: `Excluir o setor ${s.nome}?`, texto: 'Usuários com acesso restrito a este setor perdem a referência.', botao: 'Excluir', perigo: true });
  if (!ok) return;
  await DB.remover(`${CAMINHOS.setores}/${_sEd.id}`);
  registrar('setores', `Setor ${s.nome} excluído`, { antes: s });
  fecharGaveta();
  toast('Setor excluído');
}
