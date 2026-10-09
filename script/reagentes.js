// ═══════════════════════════════════════════════════════════════
// reagentes.js — Reagentes e insumos (Custos → Reagentes)
// custo por teste = preço do kit ÷ (testes × (1 − perdas) − controles)
// ═══════════════════════════════════════════════════════════════

let buscaReag = '';

const examesDoReagente = id => lista(ESTADO.exames).filter(e => e.reagenteId === id);

function htmlReagentes() {
  return `<div class="card">
    <div class="toolbar">
      <div class="search"><i class="fa-solid fa-magnifying-glass"></i><input id="q-reag" value="${esc(buscaReag)}" placeholder="Buscar reagente ou fornecedor…" oninput="buscaReag=this.value;desenharReagentes()"></div>
      <span class="formula"><i class="fa-solid fa-calculator"></i>custo/teste = preço do kit ÷ (testes × (1 − perdas) − controles)</span>
    </div>
    <div class="tbl-wrap"><table><thead><tr><th>Reagente / insumo</th><th class="num">Preço kit</th><th class="num">Testes</th><th class="num">Perdas</th><th class="num">Controles</th><th class="num">Custo/teste</th><th class="num">Exames</th><th>Atualizado</th></tr></thead>
      <tbody id="reag-body"></tbody></table></div></div>`;
}

function desenharReagentes() {
  const el = document.getElementById('reag-body');
  if (!el) return;
  const rs = lista(ESTADO.reagentes, porNome).filter(r => contem(r.nome + ' ' + (r.fornecedor || ''), buscaReag));
  el.innerHTML = rs.map(r => `<tr class="row" onclick="abrirReagente('${r.id}')">
      <td><div class="ucell"><span class="po-ic" style="--c:var(--cyan)"><i class="fa-solid fa-vials"></i></span><div>${esc(r.nome)}<div class="s">${esc(r.fornecedor || '—')}</div></div></div></td>
      <td class="num">${fmt(r.precoKit)}</td><td class="num">${num(r.testesPorKit, 0)}</td><td class="num">${num(r.perdas || 0)}%</td><td class="num">${num(r.controles || 0, 0)}</td>
      <td class="num" style="font-weight:600">${fmt(custoPorTeste(r))}</td><td class="num">${examesDoReagente(r.id).length}</td>
      <td class="muted" style="font-size:12px">${dataHora(r.atualizadoEm)}</td></tr>`).join('')
    || `<tr><td colspan="8">${vazio('fa-vials', Object.keys(ESTADO.reagentes).length ? 'Nenhum reagente encontrado' : '<b>Nenhum reagente cadastrado</b><br>Cadastre e depois vincule aos exames pela ficha do exame (Custo do teste → Reagente).')}</td></tr>`;
}

let _rEd = null;
function abrirReagente(id) {
  const r = id ? ESTADO.reagentes[id] : null, editar = pode('custos', id ? 'editar' : 'criar');
  _rEd = { id: id || null };
  abrirGaveta({
    sobre: id ? 'Reagente' : 'Novo reagente', titulo: r ? r.nome : 'Cadastrar reagente',
    meta: r ? `<span class="tag"><i class="fa-solid fa-link"></i>${examesDoReagente(id).length} exame(s)</span><span class="tag"><i class="fa-solid fa-clock"></i>${dataHora(r.atualizadoEm)}</span>` : '',
    corpo: `<div class="form-col">
      <div class="fgrid sem-pad">
        ${campo('rg-nome', 'Nome', r?.nome || '', { tipo: 'text', ph: 'Ex.: ImmunoCAP Specific IgE', desab: !editar })}
        ${campo('rg-forn', 'Fornecedor', r?.fornecedor || '', { tipo: 'text', ph: 'Ex.: Thermo Fisher', desab: !editar })}
      </div>
      <div class="fgrid sem-pad">
        ${campo('rg-kit', 'Preço do kit', r?.precoKit ?? '', { pre: 'R$', passo: '0.01', aoMudar: 'previaReagente()', desab: !editar })}
        ${campo('rg-testes', 'Testes por kit', r?.testesPorKit ?? '', { suf: 'testes', passo: '1', aoMudar: 'previaReagente()', desab: !editar })}
        ${campo('rg-perdas', 'Perdas e repetições', r?.perdas ?? 0, { suf: '%', passo: '0.1', dica: 'calibração, repetição, vencimento', aoMudar: 'previaReagente()', desab: !editar })}
        ${campo('rg-ctrl', 'Controles por kit', r?.controles ?? 0, { suf: 'testes', passo: '1', dica: 'testes gastos em controle', aoMudar: 'previaReagente()', desab: !editar })}
      </div>
      <div class="sec-t"><i class="fa-solid fa-calculator"></i>Resultado</div><div id="rg-prev"></div>
      ${id ? '<div class="sec-t"><i class="fa-solid fa-flask-vial"></i>Impacto nos exames vinculados</div><div id="rg-ex"></div>' : ''}
    </div>`,
    rodape: `${id && pode('custos', 'excluir') ? `<button class="btn perigo-txt" style="margin-right:auto" onclick="excluirReagente()"><i class="fa-solid fa-trash"></i>Excluir</button>` : ''}
      <button class="btn" onclick="fecharGaveta()">${editar ? 'Cancelar' : 'Fechar'}</button>
      ${editar ? `<button class="btn pri" onclick="gravarReagente()"><i class="fa-solid fa-floppy-disk"></i>Salvar e recalcular</button>` : ''}`
  });
  previaReagente();
}

function lerReagente() {
  return { nome: valorCampo('rg-nome').trim(), fornecedor: valorCampo('rg-forn').trim(), precoKit: numCampo('rg-kit'),
    testesPorKit: numCampo('rg-testes'), perdas: numCampo('rg-perdas') || 0, controles: numCampo('rg-ctrl') || 0 };
}

function previaReagente() {
  const n = lerReagente(), antes = _rEd.id ? ESTADO.reagentes[_rEd.id] : null;
  const uteis = (n.testesPorKit || 0) * (1 - n.perdas / 100) - n.controles;
  const novo = n.precoKit > 0 && uteis > 0 ? n.precoKit / uteis : null, atual = antes ? custoPorTeste(antes) : null;
  const d = novo != null && atual ? novo / atual - 1 : 0;
  document.getElementById('rg-prev').innerHTML = `<div class="casc">
    <div class="casc-r"><div class="lft"><i class="fa-solid fa-vial"></i><div>Testes úteis<div class="s">${num(n.testesPorKit || 0, 0)} × (1 − ${num(n.perdas)}%) − ${num(n.controles, 0)}</div></div></div><span class="v">${num(Math.max(0, uteis), 1)}</span></div>
    <div class="casc-r tot"><div class="lft"><i class="fa-solid fa-equals"></i><div>Custo por teste${atual ? `<div class="s">atual ${fmt(atual)}</div>` : ''}</div></div>
      <span class="v">${novo == null ? '<span style="color:var(--red)">informe preço e testes</span>' : fmt(novo)}${Math.abs(d) > 0.0005 ? ` <span class="${d > 0 ? 'delta-up' : 'delta-dn'}" style="font-size:11px">${d > 0 ? '+' : ''}${pct(d)}</span>` : ''}</span></div></div>`;
  const el = document.getElementById('rg-ex');
  if (!el) return;
  const exs = examesDoReagente(_rEd.id);
  el.innerHTML = !exs.length ? '<div class="muted" style="font-size:12.5px">Nenhum exame vinculado. Vincule pela ficha do exame (Custo do teste → Reagente).</div>'
    : `<div class="casc">${exs.slice(0, 40).map(e => {
        const c0 = calcular(e), fake = { ...ESTADO.reagentes, [_rEd.id]: { ...ESTADO.reagentes[_rEd.id], ...n } };
        const salvo = ESTADO.reagentes; ESTADO.reagentes = fake; const c1 = calcular(e); ESTADO.reagentes = salvo;
        return `<div class="casc-r"><div class="lft"><span class="mn">${esc(e.mn)}</span><div class="s">${c0.margem != null ? pct(c0.margem) : '—'} → <b style="color:${STATUS[c1.status].cor}">${c1.margem != null ? pct(c1.margem) : '—'}</b></div></div>${tagStatus(c1.status)}</div>`;
      }).join('')}${exs.length > 40 ? `<div class="casc-r muted">+ ${exs.length - 40} exames</div>` : ''}</div>`;
}

async function gravarReagente() {
  const n = lerReagente();
  if (!n.nome) return toast('Informe o nome', 'erro');
  if (!(n.precoKit > 0) || !(n.testesPorKit > 0)) return toast('Informe preço do kit e testes por kit', 'erro');
  if (custoPorTeste(n) == null) return toast('Perdas e controles consomem todos os testes do kit', 'erro');
  const dados = { ...n, atualizadoEm: DB.agora(), atualizadoPor: usuarioAtual().nome };
  const id = _rEd.id || DB.novaChave(CAMINHOS.reagentes), antes = ESTADO.reagentes[id] || null;
  await DB.gravar(`${CAMINHOS.reagentes}/${id}`, dados);
  registrar('reagentes', `Reagente ${n.nome} ${_rEd.id ? 'alterado' : 'cadastrado'}`, { antes, depois: n });
  fecharGaveta();
  toast(`${n.nome} salvo${_rEd.id ? ` · ${examesDoReagente(id).length} exame(s) recalculados` : ''}`);
}

async function excluirReagente() {
  const r = ESTADO.reagentes[_rEd.id], exs = examesDoReagente(_rEd.id);
  if (exs.length) return toast(`${r.nome} está vinculado a ${exs.length} exame(s): desvincule antes`, 'aviso');
  const ok = await confirmar({ titulo: `Excluir ${r.nome}?`, botao: 'Excluir', perigo: true });
  if (!ok) return;
  await DB.remover(`${CAMINHOS.reagentes}/${_rEd.id}`);
  registrar('reagentes', `Reagente ${r.nome} excluído`, { antes: r });
  fecharGaveta();
  toast('Reagente excluído');
}
