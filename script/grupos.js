// ═══════════════════════════════════════════════════════════════
// grupos.js — Grupos e matriz de permissões — COMERCIAL LAMIC
// ═══════════════════════════════════════════════════════════════

let grupoSel = null;

function renderGrupos() {
  const grupos = lista(ESTADO.grupos, (a, b) => (b.travado ? 1 : 0) - (a.travado ? 1 : 0) || porNome(a, b));
  if (!ESTADO.grupos[grupoSel]) grupoSel = grupos.find(g => !g.travado)?.id || grupos[0]?.id;
  const usuariosDo = id => lista(ESTADO.usuarios).filter(u => u.grupoId === id).length;
  painelConfig().innerHTML = `<div class="split">
    <div class="card"><div class="card-h"><h3><i class="fa-solid fa-user-shield"></i>Grupos</h3>${pode('usuarios', 'criar') ? `<button class="btn sm" onclick="abrirGrupo()"><i class="fa-solid fa-plus"></i>Novo</button>` : ''}</div>
      <div class="glist">${grupos.map(g => `<div class="gitem ${g.id === grupoSel ? 'on' : ''}" onclick="grupoSel='${g.id}';renderGrupos()">
        <span class="po-ic" style="--c:${g.cor}"><i class="fa-solid ${g.icone}"></i></span>
        <div style="flex:1;min-width:0"><div class="n">${esc(g.nome)}</div><div class="s">${usuariosDo(g.id)} usuário(s)</div></div>
        ${g.padrao ? '<span class="badge-s base">padrão</span>' : ''}${g.travado ? '<i class="fa-solid fa-lock muted" title="Acesso total"></i>' : ''}</div>`).join('')}</div></div>
    <div class="card" id="gperm"></div></div>`;
  desenharPermissoes();
}

function desenharPermissoes() {
  const el = document.getElementById('gperm');
  if (!ESTADO.grupos[grupoSel]) { el.innerHTML = vazio('fa-user-shield', 'Nenhum grupo'); return; }
  const g = { ...ESTADO.grupos[grupoSel], id: grupoSel };
  const editar = pode('usuarios', 'editar') && !g.travado;
  const tem = (m, a) => g.travado || (g.permissoes?.[m] || []).includes(a);
  el.innerHTML = `<div class="sec-card-h"><span class="tc-ic" style="--c:${g.cor}"><i class="fa-solid ${g.icone}"></i></span>
      <div><h3>${esc(g.nome)}</h3><div class="sub">${esc(g.descricao || '')}</div></div>
      <div class="rt"><div class="toggle-row">Padrão p/ novos ${chave(g.padrao, `definirGrupoPadrao('${g.id}')`, g.travado || !pode('usuarios', 'editar'))}</div>
        ${pode('usuarios', 'editar') && !g.travado ? `<button class="btn sm" onclick="abrirGrupo('${g.id}')"><i class="fa-solid fa-pen"></i>Editar</button>` : ''}
        ${pode('usuarios', 'excluir') && !g.travado ? `<button class="btn sm perigo-txt" onclick="excluirGrupo('${g.id}')"><i class="fa-solid fa-trash"></i></button>` : ''}</div></div>
    ${g.travado ? '<div style="padding:14px 18px 0"><div class="alert a" style="margin:0"><i class="fa-solid fa-lock"></i><div>Este grupo tem acesso total e não pode ser alterado.</div></div></div>' : ''}
    <div class="tbl-wrap"><table class="perm"><thead><tr><th>Módulo</th>${ACOES.map(a => `<th title="${a.nome}"><i class="fa-solid ${a.icone}"></i><div style="margin-top:4px">${a.nome}</div></th>`).join('')}</tr></thead><tbody>
      ${MODULOS.map(m => `<tr><td><i class="fa-solid ${m.icone}"></i>${m.nome}</td>${ACOES.map(a => m.acoes.includes(a.id)
        ? `<td><button class="cb ${tem(m.id, a.id) ? 'on' : ''}" ${editar ? '' : 'disabled'} onclick="alternarPermissao('${m.id}','${a.id}')"><i class="fa-solid fa-check"></i></button></td>`
        : '<td><span class="na">—</span></td>').join('')}</tr>`).join('')}
    </tbody></table></div>
    <div class="foot"><span><i class="fa-solid fa-circle-info"></i> Marcar uma ação liga "Ver"; desmarcar "Ver" limpa a linha. "Aprovar" libera publicar propostas de outros.</span><span></span></div>`;
}

async function alternarPermissao(m, a) {
  const g = ESTADO.grupos[grupoSel];
  let l = [...(g.permissoes?.[m] || [])];
  const tinha = l.includes(a);
  if (tinha) l = a === 'ver' ? [] : l.filter(x => x !== a);
  else { l.push(a); if (a !== 'ver' && !l.includes('ver')) l.push('ver'); }
  await DB.gravar(`${CAMINHOS.grupos}/${grupoSel}/permissoes/${m}`, l.length ? l : null);
  registrar('grupos', `Permissão ${m}.${a} ${tinha ? 'removida de' : 'dada a'} ${g.nome}`);
}

async function definirGrupoPadrao(id) {
  if (!ESTADO.grupos[id]) return;
  if (ESTADO.grupos[id].padrao) return toast('Para trocar o padrão, ligue a opção em outro grupo', 'aviso');
  const upd = {};
  Object.keys(ESTADO.grupos).forEach(k => { upd[`${k}/padrao`] = k === id; });
  await DB.mesclar(CAMINHOS.grupos, upd);
  toast(`${ESTADO.grupos[id].nome} é o grupo padrão para novos usuários`);
}

// ── Gaveta de grupo ───────────────────────────────────────────
let _gEd = null;
function abrirGrupo(id) {
  const g = id ? ESTADO.grupos[id] : null;
  _gEd = { id: id || null, icone: g?.icone || 'fa-users', cor: g?.cor || '#00a8cc' };
  abrirGaveta({
    sobre: id ? 'Editar grupo' : 'Novo grupo', titulo: g ? g.nome : 'Cadastrar grupo',
    corpo: `<div class="form-col">
      ${campo('g-nome', 'Nome', g?.nome || '', { tipo: 'text', ph: 'Ex.: Atendimento' })}
      ${campo('g-desc', 'Descrição', g?.descricao || '', { tipo: 'text', ph: 'O que este grupo faz' })}
      <div class="field"><label>Cor</label><div class="swatches">${PALETA.map(c => `<button type="button" class="sw ${_gEd.cor === c ? 'on' : ''}" style="--c:${c}" onclick="_gEd.cor='${c}';this.parentNode.querySelectorAll('.sw').forEach(x=>x.classList.toggle('on',x===this));document.querySelectorAll('#g-icones .ig').forEach(x=>x.style.setProperty('--c','${c}'))"></button>`).join('')}</div></div>
      <div class="field"><label>Ícone</label><div class="icon-grid pequeno" id="g-icones">${ICONES_GRUPO.map(ic => `<button type="button" class="ig ${_gEd.icone === ic ? 'on' : ''}" style="--c:${_gEd.cor}" onclick="_gEd.icone='${ic}';this.parentNode.querySelectorAll('.ig').forEach(x=>x.classList.toggle('on',x===this))"><i class="fa-solid ${ic}"></i></button>`).join('')}</div></div>
      ${id ? '' : '<div class="alert x"><i class="fa-solid fa-circle-info"></i><div>O grupo nasce só com acesso de consulta. Ajuste as permissões na matriz depois de salvar.</div></div>'}
    </div>`,
    rodape: `<button class="btn" onclick="fecharGaveta()">Cancelar</button><button class="btn pri" onclick="gravarGrupo()"><i class="fa-solid fa-floppy-disk"></i>Salvar</button>`
  });
}

async function gravarGrupo() {
  const nome = valorCampo('g-nome').trim();
  if (!nome) return toast('Informe o nome do grupo', 'erro');
  if (lista(ESTADO.grupos).some(g => normalizar(g.nome) === normalizar(nome) && g.id !== _gEd.id)) return toast('Já existe um grupo com esse nome', 'erro');
  const dados = { nome, descricao: valorCampo('g-desc').trim(), icone: _gEd.icone, cor: _gEd.cor };
  if (_gEd.id) await DB.mesclar(`${CAMINHOS.grupos}/${_gEd.id}`, dados);
  else {
    const id = DB.novaChave(CAMINHOS.grupos);
    await DB.gravar(`${CAMINHOS.grupos}/${id}`, { ...dados, permissoes: { exames: ['ver'] } });
    grupoSel = id;
  }
  registrar('grupos', `Grupo ${nome} ${_gEd.id ? 'alterado' : 'criado'}`);
  fecharGaveta();
  toast(`Grupo ${nome} salvo`);
}

async function excluirGrupo(id) {
  const g = ESTADO.grupos[id], n = lista(ESTADO.usuarios).filter(u => u.grupoId === id).length;
  if (n) return toast(`${g.nome} tem ${n} usuário(s): mova-os antes de excluir`, 'aviso');
  if (g.padrao) return toast('Defina outro grupo como padrão antes de excluir este', 'aviso');
  const ok = await confirmar({ titulo: `Excluir o grupo ${g.nome}?`, botao: 'Excluir', perigo: true });
  if (!ok) return;
  await DB.remover(`${CAMINHOS.grupos}/${id}`);
  registrar('grupos', `Grupo ${g.nome} excluído`);
  grupoSel = null;
  toast('Grupo excluído');
}
