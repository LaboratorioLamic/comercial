// ═══════════════════════════════════════════════════════════════
// propostas.js — Envio do rascunho como proposta, aprovação,
// rejeição e publicação dos preços — COMERCIAL LAMIC
// ═══════════════════════════════════════════════════════════════
//
// propostas/{id}: alvo, alvoNome, itens {chave: {mn, de, para}}, n,
//   justificativa, autor, autorId, em, status (pendente|aprovada|rejeitada|cancelada),
//   decisao {por, porId, em, motivo}
// Ausência de "de" = exame não estava na tabela; ausência de "para" = sai da tabela.

const ST_PROPOSTA = {
  pendente:  { nome: 'Pendente',  icone: 'fa-hourglass-half', cls: 'warn' },
  aprovada:  { nome: 'Aprovada',  icone: 'fa-circle-check',   cls: 'ok' },
  rejeitada: { nome: 'Rejeitada', icone: 'fa-circle-xmark',   cls: 'bad' },
  cancelada: { nome: 'Cancelada', icone: 'fa-ban',            cls: 'off' }
};
let propFiltro = 'pendente';

const alvoInfo = alvo => {
  const cx = ctxAlvo(alvo);
  return cx ? { nome: cx.nome, icone: cx.icone, cor: cx.cor } : { nome: '(removida)', icone: 'fa-table-list', cor: 'var(--gray)' };
};
const fmtOuFora = (v, lab) => v != null ? fmt(v) : `<span class="muted">${lab ? 'sem valor' : 'fora'}</span>`;

// ── Envio ─────────────────────────────────────────────────────
async function abrirEnvioProposta() {
  const cx = ctxAtual();
  await gravarRasc(cx.alvo);
  const r = rasc(cx.alvo), s = resumoRasc(cx), aprova = pode('tabelas', 'aprovar');
  const itens = Object.entries(r).filter(([k]) => ESTADO.exames[k]).map(([k, v]) => {
    const e = ESTADO.exames[k], o = cx.salvo(k), c = v != null ? calcular(e, v, cx.tab) : null;
    return { k, e, o, v, c };
  }).sort((a, b) => a.e.mn.localeCompare(b.e.mn));
  abrirGaveta({
    sobre: 'Enviar proposta', titulo: cx.nome,
    meta: `<span class="tag"><i class="fa-solid fa-pen"></i>${s.n} alteração(ões)</span>${s.ab ? `<span class="tag" style="color:var(--red)"><i class="fa-solid fa-circle-xmark"></i>${s.ab} abaixo do ${cx.pisoNome}</span>` : ''}`,
    corpo: `
      ${s.k ? `<div class="alert x"><i class="fa-solid fa-chart-line"></i><div>Margem média dos exames alterados: <b>${pct(s.m0 / s.k)}</b> → <b>${pct(s.m1 / s.k)}</b></div></div>` : ''}
      ${s.ab ? `<div class="alert r"><i class="fa-solid fa-circle-xmark"></i><div>${s.ab} preço(s) ficam abaixo do ${cx.pisoNome} de ${pct(cx.piso, 0)}.</div></div>` : ''}
      <div class="sec-t"><i class="fa-solid fa-list"></i>Alterações</div>
      <div class="tbl-wrap card-in"><table><thead><tr><th>MN</th><th class="num">Atual</th><th class="num">Proposto</th><th class="num">Margem</th></tr></thead>
        <tbody>${itens.map(x => `<tr><td class="mn" title="${esc(x.e.descricao)}">${esc(x.e.mn)}</td><td class="num">${fmtOuFora(x.o, cx.lab)}</td>
          <td class="num"><b>${fmtOuFora(x.v, cx.lab)}</b></td><td class="num" style="color:${x.c?.status === 'r' ? 'var(--red)' : 'inherit'}">${x.c?.margem != null ? pct(x.c.margem) : '—'}</td></tr>`).join('')}</tbody></table></div>
      <div class="just"><label for="pp-just">Justificativa <span class="muted">(opcional)</span></label>
        <textarea id="pp-just" placeholder="Motivo do reajuste, negociação, concorrência…"></textarea></div>
      ${aprova ? '' : '<div class="hint" style="margin-top:8px"><i class="fa-solid fa-circle-info"></i> Os preços passam a valer quando alguém com permissão de aprovação aprovar a proposta.</div>'}`,
    rodape: `<button class="btn" style="margin-right:auto" onclick="fecharGaveta()">Voltar</button>
      <button class="btn ${aprova ? '' : 'pri'}" onclick="enviarProposta(false)"><i class="fa-solid fa-paper-plane"></i>Enviar para aprovação</button>
      ${aprova ? `<button class="btn pri" onclick="enviarProposta(true)"><i class="fa-solid fa-stamp"></i>Aprovar e publicar</button>` : ''}`
  });
}

async function enviarProposta(publicar) {
  const cx = ctxAtual(), r = rasc(cx.alvo), u = usuarioAtual();
  const just = valorCampo('pp-just').trim();
  const itens = {};
  Object.entries(r).forEach(([k, v]) => {
    const e = ESTADO.exames[k];
    if (e) itens[k] = { mn: e.mn, de: cx.salvo(k) ?? null, para: v ?? null };
  });
  const n = Object.keys(itens).length;
  if (!n) return toast('Nada para enviar', 'erro');
  const id = DB.novaChave('propostas');
  const p = { alvo: cx.alvo, alvoNome: cx.nome, itens, n, justificativa: just || null, autor: u.nome, autorId: u.id, em: Date.now(), status: 'pendente' };
  await DB.gravar(`propostas/${id}`, { ...p, em: DB.agora() });
  await limparRasc(cx.alvo);
  if (publicar) await aplicarProposta(id, p);
  else registrar('tabelas', `${cx.nome}: proposta com ${n} preço(s) enviada`, { proposta: id });
  fecharGaveta();
  toast(publicar ? `${n} preço(s) publicados em ${cx.nome}` : `Proposta enviada: ${n} preço(s) aguardando aprovação`);
  renderTabelas();
}

// Grava os preços da proposta e marca como aprovada
async function aplicarProposta(id, p) {
  const cx = ctxAlvo(p.alvo);
  if (!cx) throw new Error('Tabela da proposta não existe mais');
  const u = usuarioAtual(), agora = DB.agora(), upd = {};
  let n = 0;
  Object.entries(p.itens || {}).forEach(([k, it]) => {
    if (!ESTADO.exames[k]) return;
    const para = it.para ?? null;
    if (cx.base) {
      if (para == null) return;
      upd[`${CAMINHOS.exames}/${k}/precoPraticado`] = para;
      upd[`${CAMINHOS.exames}/${k}/atualizadoEm`] = agora;
      upd[`${CAMINHOS.exames}/${k}/atualizadoPor`] = u.nome;
    } else if (cx.lab) upd[`${cx.caminho}/${cx.id}/precos/${k}`] = para;
    else upd[`${CAMINHOS.tabelas}/${cx.id}/precos/${k}`] = para;
    upd[`historicoExames/${k}/${DB.novaChave('historicoExames')}`] = {
      descricao: `${cx.nome}: ${it.de != null ? fmt(it.de) : cx.lab ? 'sem valor' : 'fora da tabela'} → ${para != null ? fmt(para) : cx.lab ? 'valor removido' : 'retirado da tabela'}${it.revisado ? ` (revisado na aprovação; proposto ${it.proposto != null ? fmt(it.proposto) : 'retirar'})` : ''}`,
      justificativa: p.justificativa || null, proposta: id, usuario: u.nome, usuarioId: u.id, em: agora
    };
    n++;
  });
  upd[`propostas/${id}/status`] = 'aprovada';
  upd[`propostas/${id}/decisao`] = { por: u.nome, porId: u.id, em: agora };
  await DB.mesclar('/', upd);
  registrar('tabelas', `${cx.nome}: ${n} preço(s) publicados (proposta de ${p.autor})`, { proposta: id });
  return n;
}

// ── Lista ─────────────────────────────────────────────────────
function desenharPropostas() {
  const el = document.getElementById('tabelas-propostas');
  const todas = lista(ESTADO.propostas, (a, b) => (b.em || 0) - (a.em || 0));
  const cont = { '': todas.length };
  todas.forEach(p => { cont[p.status] = (cont[p.status] || 0) + 1; });
  const ls = todas.filter(p => !propFiltro || p.status === propFiltro);
  el.innerHTML = `<div class="card">
    <div class="chips" style="padding-bottom:12px">${['pendente', 'aprovada', 'rejeitada', 'cancelada', ''].map(s => `<button class="chip ${propFiltro === s ? 'on' : ''}" onclick="propFiltro='${s}';desenharPropostas()">
      <i class="fa-solid ${s ? ST_PROPOSTA[s].icone : 'fa-list'}"></i>${s ? ST_PROPOSTA[s].nome + 's' : 'Todas'} <b>${cont[s] || 0}</b></button>`).join('')}</div>
    <div class="tbl-wrap"><table><thead><tr><th>Enviada em</th><th>Tabela</th><th>Autor</th><th class="num">Preços</th><th>Justificativa</th><th>Situação</th><th></th></tr></thead>
      <tbody>${ls.map(p => { const a = alvoInfo(p.alvo), st = ST_PROPOSTA[p.status] || ST_PROPOSTA.pendente; return `<tr class="row" onclick="abrirProposta('${p.id}')">
        <td>${dataHora(p.em)}</td><td><span class="tag"><i class="fa-solid ${a.icone}" style="color:${a.cor}"></i>${esc(a.nome)}</span></td>
        <td>${esc(p.autor)}</td><td class="num">${num(p.n || Object.keys(p.itens || {}).length, 0)}</td>
        <td class="desc" title="${esc(p.justificativa || '')}">${esc(p.justificativa || '—')}</td>
        <td><span class="badge-s ${st.cls}"><i class="fa-solid ${st.icone}"></i>${st.nome}</span></td>
        <td class="acts"><button title="Abrir"><i class="fa-solid fa-chevron-right"></i></button></td></tr>`; }).join('')
        || `<tr><td colspan="7">${vazio('fa-stamp', propFiltro === 'pendente' ? 'Nenhuma proposta aguardando aprovação' : 'Nenhuma proposta')}</td></tr>`}</tbody></table></div></div>`;
}

// ── Detalhe ───────────────────────────────────────────────────
// Quem aprova pode revisar o valor proposto antes de publicar (_propRev: chave → valor)
let _propRev = {}, _propId = null;

function abrirProposta(id) {
  const p = ESTADO.propostas[id];
  if (!p) return;
  const cx = ctxAlvo(p.alvo), st = ST_PROPOSTA[p.status] || ST_PROPOSTA.pendente, u = usuarioAtual();
  const pendente = p.status === 'pendente', aprova = pode('tabelas', 'aprovar'), autor = p.autorId === u.id;
  const revisa = pendente && aprova && !!cx;
  _propRev = {}; _propId = id;
  const nRev = Object.values(p.itens || {}).filter(it => it.revisado).length;
  let conflitos = 0, abaixo = 0;
  const itens = Object.entries(p.itens || {}).map(([k, it]) => {
    const e = ESTADO.exames[k], atual = cx && e ? cx.salvo(k) : null;
    const mudou = pendente && cx && e && (atual ?? null) !== (it.de ?? null);
    if (mudou) conflitos++;
    const c = cx && e && it.para != null ? calcular(e, it.para, cx.tab) : null;
    if (c?.status === 'r') abaixo++;
    return { k, it, e, atual, mudou, c };
  }).sort((a, b) => String(a.it.mn).localeCompare(String(b.it.mn)));
  abrirGaveta({
    sobre: `Proposta · ${dataHora(p.em)}`, titulo: p.alvoNome || cx?.nome || 'Proposta',
    meta: `<span class="badge-s ${st.cls}"><i class="fa-solid ${st.icone}"></i>${st.nome}</span><span class="tag"><i class="fa-solid fa-user"></i>${esc(p.autor)}</span><span class="tag"><i class="fa-solid fa-tag"></i>${itens.length} preço(s)</span>`,
    corpo: `
      ${!cx ? '<div class="alert r"><i class="fa-solid fa-circle-xmark"></i><div>A tabela desta proposta foi excluída.</div></div>' : ''}
      ${p.decisao ? `<div class="alert ${p.status === 'aprovada' ? 'x' : 'a'}"><i class="fa-solid ${st.icone}"></i><div><b>${st.nome}</b> por ${esc(p.decisao.por)} em ${dataHora(p.decisao.em)}${p.decisao.motivo ? `<br>${esc(p.decisao.motivo)}` : ''}</div></div>` : ''}
      ${conflitos ? `<div class="alert a"><i class="fa-solid fa-triangle-exclamation"></i><div>${conflitos} preço(s) mudaram desde o envio (coluna "Hoje"). Ao aprovar, vale o valor proposto.</div></div>` : ''}
      <div id="pp-abaixo">${abaixo ? `<div class="alert r"><i class="fa-solid fa-circle-xmark"></i><div>${abaixo} preço(s) abaixo do ${cx?.pisoNome || 'piso'}.</div></div>` : ''}</div>
      ${nRev ? `<div class="alert x"><i class="fa-solid fa-pen"></i><div>${nRev} valor(es) revisado(s) na aprovação (riscado = valor proposto).</div></div>` : ''}
      ${p.justificativa ? `<div class="sec-t"><i class="fa-solid fa-quote-left"></i>Justificativa</div><div class="ins-prev">${esc(p.justificativa)}</div>` : ''}
      <div class="sec-t"><i class="fa-solid fa-list"></i>Preços</div>
      ${revisa ? '<div class="hint" style="margin:-4px 0 8px"><i class="fa-solid fa-pen"></i> Ajuste o valor proposto, se precisar: ao aprovar, vale o valor revisado.</div>' : ''}
      <div class="tbl-wrap card-in"><table><thead><tr><th>MN</th><th class="num">${pendente ? 'Hoje' : 'Antes'}</th><th class="num">${p.status === 'aprovada' ? 'Publicado' : 'Proposto'}</th><th class="num">Var.</th><th class="num">Margem</th></tr></thead>
        <tbody id="pp-itens">${itens.map(x => { const de = pendente ? x.atual : x.it.de, d = de != null && x.it.para != null ? x.it.para / de - 1 : null; return `<tr data-k="${esc(x.k)}">
          <td class="mn" title="${esc(x.e?.descricao || 'exame excluído')}">${esc(x.it.mn)}${x.mudou ? ' <i class="fa-solid fa-triangle-exclamation" style="color:var(--amber)" title="Mudou desde o envio: era ' + (x.it.de != null ? fmt(x.it.de) : 'fora') + '"></i>' : ''}</td>
          <td class="num">${fmtOuFora(de, cx?.lab)}</td>
          <td class="num">${revisa && x.e ? `<div class="price-in"><span>R$</span><input type="number" step="0.01" min="0" value="${x.it.para != null ? x.it.para.toFixed(2) : ''}" placeholder="${cx.base ? '' : cx.lab ? 'sem valor' : 'fora'}" oninput="revisarItem(this)" onfocus="this.select()"></div><div class="delta"></div>`
            : `${x.it.revisado ? `<s class="muted">${fmtOuFora(x.it.proposto, cx?.lab)}</s> ` : ''}<b>${fmtOuFora(x.it.para, cx?.lab)}</b>`}</td>
          <td class="num ${d > 0 ? 'delta-dn' : d < 0 ? 'delta-up' : ''}">${d != null ? (d > 0 ? '+' : '') + pct(d) : '—'}</td>
          <td class="num" style="color:${x.c?.status === 'r' ? 'var(--red)' : 'inherit'}">${x.c?.margem != null ? pct(x.c.margem) : '—'}</td></tr>`; }).join('')}</tbody></table></div>
      ${pendente && aprova ? `<div class="just"><label for="pp-motivo">Observação da decisão <span class="muted">(obrigatória para rejeitar)</span></label><textarea id="pp-motivo"></textarea></div>` : ''}`,
    rodape: `${!pendente && autor && cx ? `<button class="btn" style="margin-right:auto" onclick="reabrirProposta('${id}')" title="Carrega os preços no seu rascunho"><i class="fa-solid fa-pen"></i>Editar de novo</button>` : '<span style="margin-right:auto"></span>'}
      ${pendente && autor ? `<button class="btn perigo-txt" onclick="decidirProposta('${id}','cancelada')"><i class="fa-solid fa-ban"></i>Cancelar</button>` : ''}
      ${pendente && aprova ? `<button class="btn perigo-txt" onclick="decidirProposta('${id}','rejeitada')"><i class="fa-solid fa-circle-xmark"></i>Rejeitar</button>
        <button class="btn pri" id="pp-aprovar" ${cx ? '' : 'disabled'} onclick="decidirProposta('${id}','aprovada')"><i class="fa-solid fa-stamp"></i>Aprovar e publicar</button>` : `<button class="btn" onclick="fecharGaveta()">Fechar</button>`}`
  });
}

function revisarItem(inp) {
  const p = ESTADO.propostas[_propId], cx = p && ctxAlvo(p.alvo), tr = inp.closest('tr'), k = tr.dataset.k, it = p?.itens?.[k];
  if (!it || !cx) return;
  const txt = inp.value.trim(), v = txt === '' ? null : Math.round(parseFloat(txt) * 100) / 100, orig = it.para ?? null;
  if ((v != null && (isNaN(v) || v < 0)) || (v == null && cx.base) || v === orig) delete _propRev[k];
  else _propRev[k] = v;
  const rev = k in _propRev, para = rev ? _propRev[k] : orig, e = ESTADO.exames[k], de = cx.salvo(k);
  const c = e && para != null ? calcular(e, para, cx.tab) : null, d = de != null && para != null ? para / de - 1 : null;
  const td = tr.children;
  td[2].querySelector('.price-in').classList.toggle('on', rev);
  td[2].querySelector('.delta').innerHTML = rev ? `<span class="muted">proposto ${fmtOuFora(orig, cx.lab)}</span>` : '';
  td[3].className = `num ${d > 0 ? 'delta-dn' : d < 0 ? 'delta-up' : ''}`;
  td[3].textContent = d != null ? (d > 0 ? '+' : '') + pct(d) : '—';
  td[4].style.color = c?.status === 'r' ? 'var(--red)' : 'inherit';
  td[4].textContent = c?.margem != null ? pct(c.margem) : '—';
  // alerta e botão refletem os valores revisados
  const abaixo = Object.entries(p.itens).filter(([kk, x]) => {
    const v2 = kk in _propRev ? _propRev[kk] : x.para;
    return ESTADO.exames[kk] && v2 != null && calcular(ESTADO.exames[kk], v2, cx.tab).status === 'r';
  }).length;
  document.getElementById('pp-abaixo').innerHTML = abaixo ? `<div class="alert r"><i class="fa-solid fa-circle-xmark"></i><div>${abaixo} preço(s) abaixo do ${cx.pisoNome}.</div></div>` : '';
  const n = Object.keys(_propRev).length;
  document.getElementById('pp-aprovar').innerHTML = `<i class="fa-solid fa-stamp"></i>${n ? `Publicar com ${n} revisão(ões)` : 'Aprovar e publicar'}`;
}

async function decidirProposta(id, status) {
  const p = ESTADO.propostas[id], u = usuarioAtual(), motivo = valorCampo('pp-motivo').trim();
  if (!p || p.status !== 'pendente') return toast('Proposta já decidida', 'erro');
  if (status === 'rejeitada' && !motivo) { document.getElementById('pp-motivo')?.focus(); return toast('Informe o motivo da rejeição', 'erro'); }
  if (status === 'aprovada') {
    // valores revisados por quem aprova: guarda o proposto original para auditoria
    const rev = _propId === id ? { ..._propRev } : {}, nRev = Object.keys(rev).length, itens = { ...p.itens };
    Object.entries(rev).forEach(([k, v]) => { itens[k] = { ...itens[k], para: v, proposto: itens[k].para ?? null, revisado: true }; });
    if (nRev) await DB.mesclar(`propostas/${id}/itens`, Object.fromEntries(Object.keys(rev).map(k => [k, itens[k]])));
    const n = await aplicarProposta(id, { ...p, itens });
    if (motivo || nRev) await DB.mesclar(`propostas/${id}/decisao`, { motivo: motivo || null, revisados: nRev || null });
    toast(`${n} preço(s) publicados em ${p.alvoNome}${nRev ? ` · ${nRev} revisado(s)` : ''}`);
  } else {
    const ok = await confirmar({ titulo: status === 'cancelada' ? 'Cancelar proposta?' : 'Rejeitar proposta?', texto: 'Os preços atuais não mudam.', botao: status === 'cancelada' ? 'Cancelar proposta' : 'Rejeitar', perigo: true });
    if (!ok) return;
    await DB.mesclar(`propostas/${id}`, { status, decisao: { por: u.nome, porId: u.id, em: DB.agora(), motivo: motivo || null } });
    registrar('tabelas', `${p.alvoNome}: proposta ${status} (${p.n} preço(s))`, { proposta: id, motivo: motivo || null });
    toast(status === 'cancelada' ? 'Proposta cancelada' : 'Proposta rejeitada');
  }
  fecharGaveta();
  renderTela();
}

// Proposta rejeitada/cancelada → volta para o rascunho do autor
async function reabrirProposta(id) {
  const p = ESTADO.propostas[id];
  await carregarRascunho(p.alvo);
  const atual = { ...rasc(p.alvo) };
  Object.entries(p.itens || {}).forEach(([k, it]) => { atual[k] = it.para ?? null; });
  const n = await substituirRasc(p.alvo, atual);
  fecharGaveta();
  focarAlvo(p.alvo);
  grade.alvo = null;
  renderTabelas();
  toast(`${n} preço(s) no seu rascunho`);
}

// Contador no menu: propostas aguardando aprovação (só para quem aprova)
function atualizarBadgePropostas() {
  const a = document.querySelector('#nav a[data-s="tabelas"]');
  if (!a) return;
  a.querySelector('.badge')?.remove();
  const n = pode('tabelas', 'aprovar') ? lista(ESTADO.propostas).filter(p => p.status === 'pendente').length : 0;
  if (n) a.insertAdjacentHTML('beforeend', `<span class="badge aviso" title="Propostas aguardando aprovação">${n}</span>`);
}
