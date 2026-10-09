// ═══════════════════════════════════════════════════════════════
// usuarios.js — Usuários e perfil — COMERCIAL LAMIC
// ═══════════════════════════════════════════════════════════════

let buscaUsuario = '';

const tagGrupo = id => {
  const g = ESTADO.grupos[id];
  return g ? `<span class="tag"><i class="fa-solid ${g.icone}" style="color:${g.cor}"></i>${esc(g.nome)}</span>` : '<span class="tag muted">sem grupo</span>';
};
const resumoSetores = u => u.setores === 'todos' || !Array.isArray(u.setores) || !u.setores.length ? 'Todos os setores'
  : u.setores.map(id => ESTADO.setores[id]?.nome).filter(Boolean).join(', ');

function renderUsuarios() {
  const p = painelConfig(), editar = pode('usuarios', 'editar');
  p.innerHTML = `<div class="card">
    <div class="toolbar">
      <div class="search"><i class="fa-solid fa-magnifying-glass"></i><input id="q-user" value="${esc(buscaUsuario)}" placeholder="Buscar nome ou usuário…" oninput="buscaUsuario=this.value;desenharTabelaUsuarios()"></div>
      <div id="pop-ugrupo"></div>
      <div class="toggle-row"><i class="fa-solid fa-door-open"></i>Cadastro aberto ${chave(ESTADO.permitirCadastro, 'alternarCadastro()', !editar)}</div>
      ${pode('usuarios', 'criar') ? `<button class="btn pri" onclick="abrirUsuario()"><i class="fa-solid fa-user-plus"></i>Novo usuário</button>` : ''}
    </div>
    <div class="tbl-wrap"><table><thead><tr><th>Usuário</th><th>Cargo</th><th>Grupo</th><th>Setores</th><th>Status</th><th>Último acesso</th><th></th></tr></thead><tbody id="users-body"></tbody></table></div>
    <div class="foot"><span id="users-count"></span><span></span></div></div>`;
  criarPop('pop-ugrupo', {
    rotulo: 'Grupo', titulo: 'Filtrar por grupo', icone: 'fa-user-shield', limpavel: true,
    opcoes: () => [{ valor: '', rotulo: 'Todos os grupos', icone: 'fa-layer-group', qtd: Object.keys(ESTADO.usuarios).length },
      ...lista(ESTADO.grupos, porNome).map(g => ({ valor: g.id, rotulo: g.nome, icone: g.icone, cor: g.cor, desc: g.descricao, qtd: lista(ESTADO.usuarios).filter(u => u.grupoId === g.id).length }))],
    aoMudar: desenharTabelaUsuarios
  });
  desenharTabelaUsuarios();
}

function desenharTabelaUsuarios() {
  const g = valorPop('pop-ugrupo'), eu = sessao?.usuarioId;
  const us = lista(ESTADO.usuarios, porNome).filter(u => (!g || u.grupoId === g) && contem(u.nome + ' ' + u.usuario, buscaUsuario));
  document.getElementById('users-body').innerHTML = us.map(u => `
    <tr class="row" onclick="abrirUsuario('${u.id}')">
      <td><div class="ucell"><div class="avatar" style="background:${corAvatar(u.id)}">${esc(iniciais(u.nome))}</div><div>${esc(u.nome)} ${u.id === eu ? '<span class="badge-s base">você</span>' : ''}${u.admin ? ' <span class="badge-s warn"><i class="fa-solid fa-crown"></i>admin</span>' : ''}<div class="s">@${esc(u.usuario)}</div></div></div></td>
      <td>${esc(u.cargo || '—')}</td><td>${tagGrupo(u.grupoId)}</td>
      <td class="desc" style="font-size:12.5px;color:var(--text-secondary)">${esc(resumoSetores(u))}</td>
      <td>${u.ativo !== false ? '<span class="badge-s ok"><i class="fa-solid fa-circle" style="font-size:6px"></i>Ativo</span>' : '<span class="badge-s off"><i class="fa-solid fa-circle" style="font-size:6px"></i>Inativo</span>'}</td>
      <td class="muted" style="font-size:12px">${dataHora(u.ultimoAcesso)}</td>
      <td><i class="fa-solid fa-chevron-right muted"></i></td></tr>`).join('') || `<tr><td colspan="7">${vazio('fa-users', 'Nenhum usuário encontrado')}</td></tr>`;
  document.getElementById('users-count').textContent = `${us.length} de ${Object.keys(ESTADO.usuarios).length} usuários`;
}

async function alternarCadastro() {
  await DB.gravar(CAMINHOS.permitirCadastro, !ESTADO.permitirCadastro);
  toast(ESTADO.permitirCadastro ? 'Cadastro aberto: novos usuários podem criar conta' : 'Cadastro fechado: só administradores criam usuários');
}

// ── Gaveta de usuário ─────────────────────────────────────────
let _uEd = null;
function abrirUsuario(id) {
  const u = id ? ESTADO.usuarios[id] : null, novo = !u;
  const editar = novo ? pode('usuarios', 'criar') : pode('usuarios', 'editar');
  const souAdmin = usuarioAtual()?.admin, eu = id === sessao?.usuarioId;
  _uEd = { id, grupoId: u?.grupoId || grupoPadrao()?.id || null, setores: Array.isArray(u?.setores) ? [...u.setores] : 'todos', ativo: u ? u.ativo !== false : true, admin: !!u?.admin };
  const ro = editar ? '' : 'disabled';
  abrirGaveta({
    sobre: novo ? 'Novo usuário' : '@' + u.usuario,
    titulo: novo ? 'Cadastrar usuário' : u.nome,
    meta: novo ? '' : `${tagGrupo(u.grupoId)}<span class="tag"><i class="fa-solid fa-clock"></i>${dataHora(u.ultimoAcesso)}</span>`,
    corpo: `<div class="form-col">
      ${campo('u-nome', 'Nome completo', u?.nome || '', { tipo: 'text', desab: !editar })}
      <div class="fgrid sem-pad">
        ${campo('u-usuario', 'Usuário', u?.usuario || '', { tipo: 'text', desab: !novo, dica: novo ? 'letras, números, ponto ou hífen' : 'não pode ser alterado' })}
        ${campo('u-cargo', 'Cargo', u?.cargo || '', { tipo: 'text', desab: !editar, ph: 'Ex.: Analista de custos' })}
      </div>
      ${novo ? `<div class="fgrid sem-pad">${campo('u-senha', 'Senha', '', { tipo: 'password' })}${campo('u-senha2', 'Confirmar senha', '', { tipo: 'password' })}</div>` : ''}
      <div class="sec-t"><i class="fa-solid fa-user-shield"></i>Grupo</div>
      <div class="opt-cards" id="u-grupo">${lista(ESTADO.grupos, porNome).map(g => `
        <button type="button" class="oc ${_uEd.grupoId === g.id ? 'on' : ''}" ${ro} onclick="_uEd.grupoId='${g.id}';marcarOc('u-grupo', this)"><span class="po-ic" style="--c:${g.cor}"><i class="fa-solid ${g.icone}"></i></span><span><b>${esc(g.nome)}</b><small>${esc(g.descricao || '')}</small></span><i class="fa-solid fa-circle-check ck"></i></button>`).join('')}</div>
      <div class="sec-t"><i class="fa-solid fa-sitemap"></i>Setores visíveis</div>
      <div id="u-setores"></div>
      <div class="sec-t"><i class="fa-solid fa-toggle-on"></i>Situação</div>
      <div class="casc">
        <div class="casc-r"><div class="lft"><i class="fa-solid fa-user-check"></i><div>Usuário ativo<div class="s">inativo não consegue entrar</div></div></div>${chave(_uEd.ativo, '_uEd.ativo=!_uEd.ativo;this.classList.toggle(\'on\')', !editar || eu)}</div>
        ${souAdmin ? `<div class="casc-r"><div class="lft"><i class="fa-solid fa-crown"></i><div>Administrador<div class="s">acesso total, independente do grupo</div></div></div>${chave(_uEd.admin, '_uEd.admin=!_uEd.admin;this.classList.toggle(\'on\')', eu)}</div>` : ''}
      </div>
      ${!novo && editar && !eu ? `<div class="sec-t"><i class="fa-solid fa-key"></i>Redefinir senha</div>
        <div class="fgrid sem-pad">${campo('u-nsenha', 'Nova senha', '', { tipo: 'password', ph: 'deixe vazio para manter' })}${campo('u-nsenha2', 'Confirmar', '', { tipo: 'password' })}</div>` : ''}
    </div>`,
    rodape: `${!novo && pode('usuarios', 'excluir') && !eu ? `<button class="btn perigo-txt" style="margin-right:auto" onclick="excluirUsuario('${id}')"><i class="fa-solid fa-trash"></i>Excluir</button>` : ''}
      <button class="btn" onclick="fecharGaveta()">${editar ? 'Cancelar' : 'Fechar'}</button>
      ${editar ? `<button class="btn pri" onclick="gravarUsuario()"><i class="fa-solid fa-floppy-disk"></i>Salvar</button>` : ''}`
  });
  desenharSetoresUsuario(editar);
}

function desenharSetoresUsuario(editar = true) {
  const todos = _uEd.setores === 'todos';
  const setores = lista(ESTADO.setores, porNome);
  document.getElementById('u-setores').innerHTML = `
    <div class="chips sem-pad"><button type="button" class="chip ${todos ? 'on' : ''}" ${editar ? '' : 'disabled'} onclick="_uEd.setores=_uEd.setores==='todos'?[]:'todos';desenharSetoresUsuario()"><i class="fa-solid fa-layer-group"></i>Todos os setores</button></div>
    ${todos ? '' : `<div class="chips sem-pad" style="margin-top:8px">${setores.map(s => `<button type="button" class="chip ${_uEd.setores.includes(s.id) ? 'on' : ''}" ${editar ? '' : 'disabled'} onclick="alternarSetorUsuario('${s.id}')"><i class="fa-solid ${s.icone}" style="color:${s.cor}"></i>${esc(s.nome)}</button>`).join('')}</div>
      <div class="hint" style="margin-top:6px">${_uEd.setores.length} setor(es) selecionado(s)</div>`}`;
}
function alternarSetorUsuario(id) {
  const i = _uEd.setores.indexOf(id);
  i >= 0 ? _uEd.setores.splice(i, 1) : _uEd.setores.push(id);
  desenharSetoresUsuario();
}

async function gravarUsuario() {
  const nome = valorCampo('u-nome').trim(), cargo = valorCampo('u-cargo').trim();
  if (!nome) return toast('Informe o nome', 'erro');
  if (Array.isArray(_uEd.setores) && !_uEd.setores.length) return toast('Escolha ao menos um setor ou "Todos"', 'erro');
  const dados = { nome, cargo, grupoId: _uEd.grupoId, setores: _uEd.setores, ativo: _uEd.ativo };
  if (usuarioAtual()?.admin) dados.admin = _uEd.admin;
  if (!_uEd.id) {
    const erro = validarNovo(nome, valorCampo('u-usuario'), valorCampo('u-senha'), valorCampo('u-senha2'));
    if (erro) return toast(erro, 'erro');
    const id = DB.novaChave(CAMINHOS.usuarios);
    await DB.gravar(`${CAMINHOS.usuarios}/${id}`, { ...montarUsuario(nome, valorCampo('u-usuario'), valorCampo('u-senha')), ...dados });
    registrar('usuarios', `Usuário ${valorCampo('u-usuario').trim().toLowerCase()} criado`);
  } else {
    const ns = valorCampo('u-nsenha');
    if (ns) {
      if (ns.length < 6) return toast('A nova senha precisa ter ao menos 6 caracteres', 'erro');
      if (ns !== valorCampo('u-nsenha2')) return toast('As senhas não conferem', 'erro');
      dados.sal = novoSal(); dados.hash = hashSenha(ns, dados.sal);
    }
    await DB.mesclar(`${CAMINHOS.usuarios}/${_uEd.id}`, dados);
    registrar('usuarios', `Usuário ${ESTADO.usuarios[_uEd.id]?.usuario} alterado${ns ? ' (senha redefinida)' : ''}`);
  }
  fecharGaveta();
  toast(`Usuário ${nome} salvo`);
}

async function excluirUsuario(id) {
  const u = ESTADO.usuarios[id];
  const ok = await confirmar({ titulo: `Excluir ${u.nome}?`, texto: 'O acesso é removido definitivamente. Para apenas bloquear, deixe o usuário inativo.', botao: 'Excluir', perigo: true });
  if (!ok) return;
  await DB.remover(`${CAMINHOS.usuarios}/${id}`);
  registrar('usuarios', `Usuário ${u.usuario} excluído`);
  fecharGaveta();
  toast(`${u.nome} excluído`);
}

// ── Meu perfil ────────────────────────────────────────────────
function abrirPerfil() {
  const u = usuarioAtual();
  if (!u) return;
  abrirGaveta({
    sobre: '@' + u.usuario, titulo: u.nome,
    meta: `${tagGrupo(u.grupoId)}${u.admin ? '<span class="tag" style="color:var(--amber)"><i class="fa-solid fa-crown"></i>Administrador</span>' : ''}`,
    corpo: `<div class="form-col">
      ${campo('p-nome', 'Nome completo', u.nome, { tipo: 'text' })}
      <div class="sec-t"><i class="fa-solid fa-key"></i>Alterar senha</div>
      ${campo('p-atual', 'Senha atual', '', { tipo: 'password' })}
      <div class="fgrid sem-pad">${campo('p-nova', 'Nova senha', '', { tipo: 'password' })}${campo('p-nova2', 'Confirmar', '', { tipo: 'password' })}</div>
      <div class="sec-t"><i class="fa-solid fa-circle-info"></i>Acesso</div>
      <div class="casc"><div class="casc-r"><div class="lft"><i class="fa-solid fa-sitemap"></i><div>Setores visíveis<div class="s">${esc(resumoSetores(u))}</div></div></div></div>
      <div class="casc-r"><div class="lft"><i class="fa-solid fa-clock"></i><div>Último acesso<div class="s">${dataHora(u.ultimoAcesso)}</div></div></div></div></div>
    </div>`,
    rodape: `<button class="btn perigo-txt" style="margin-right:auto" onclick="sair()"><i class="fa-solid fa-arrow-right-from-bracket"></i>Sair</button>
      <button class="btn" onclick="fecharGaveta()">Fechar</button><button class="btn pri" onclick="gravarPerfil()"><i class="fa-solid fa-floppy-disk"></i>Salvar</button>`
  });
}

async function gravarPerfil() {
  const nome = valorCampo('p-nome').trim(), atual = valorCampo('p-atual'), nova = valorCampo('p-nova');
  if (!nome) return toast('Informe o nome', 'erro');
  const dados = { nome };
  if (atual || nova) {
    if (!verificarSenhaAtual(atual)) return toast('Senha atual incorreta', 'erro');
    if (nova.length < 6) return toast('A nova senha precisa ter ao menos 6 caracteres', 'erro');
    if (nova !== valorCampo('p-nova2')) return toast('As senhas não conferem', 'erro');
    dados.sal = novoSal(); dados.hash = hashSenha(nova, dados.sal);
  }
  await DB.mesclar(`${CAMINHOS.usuarios}/${sessao.usuarioId}`, dados);
  fecharGaveta();
  toast(dados.hash ? 'Perfil e senha atualizados' : 'Perfil atualizado');
}
