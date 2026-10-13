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

// ── Quadro da proposta (envio e avaliação) ────────────────────
// Linha: valor de antes, valor proposto e o cálculo dele no perfil da tabela.
// Desconto só onde há referência (tabelas: Particular; laboratórios/conveniados: tabela base).
// Valor da Particular em proposta pendente (a mais recente que inclui o exame): { id, para } | null
function partPendente(k) {
  let r = null;
  Object.entries(ESTADO.propostas || {}).forEach(([id, p]) => {
    const it = p.status === 'pendente' && p.alvo === 'particular' ? p.itens?.[k] : null;
    if (it && it.para != null && (!r || (p.em || 0) > r.em)) r = { id, para: it.para, em: p.em || 0 };
  });
  return r;
}

// Onde a referência é a Particular, o desconto já considera o valor dela que aguarda aprovação (pend)
function linhaProposta(cx, k, de, para) {
  const e = ESTADO.exames[k], c = cx && e && para != null ? calcular(e, para, cx.tab) : null;
  const c0 = cx && e && de != null ? calcular(e, de, cx.tab) : null;
  const refPub = cx && !cx.base ? cx.ref?.valor(k) ?? null : null;
  const pend = cx && (cx.tabela || (cx.conv && !cx.tab)) ? partPendente(k) : null, ref = pend ? pend.para : refPub;
  const desc = ref && para != null && !precoSimbolico(ref) && !precoSimbolico(para) ? 1 - para / ref : null;
  return { k, e, mn: e?.mn, de, para, c, c0, ref, refPub, pend, desc, descRef: cx?.tabela ? c?.descRef ?? null : null, descMax: cx?.tabela ? c?.descMax ?? null : null };
}

const ppVar = x => {
  const d = x.de != null && x.para != null && x.de > 0 ? x.para / x.de - 1 : null;
  return d ? `<small class="${d > 0 ? 'delta-dn' : 'delta-up'}">${d > 0 ? '+' : ''}${pct(d)}</small>` : '';
};
const ppDesc = x => x.desc == null ? '<span class="muted">—</span>'
  : `<b class="${acimaDescMax(x.desc, x.descMax) || x.desc < -0.0005 ? 'r' : x.descRef != null && x.desc > x.descRef + 0.0005 ? 'a' : ''}"${acimaDescMax(x.desc, x.descMax) ? ` title="Acima do desconto máximo (${pct(x.descMax, 0)})"` : ''}>${pct(x.desc)}</b>${x.descRef != null ? `<small>ref. ${pct(x.descRef, 0)}</small>` : ''}${x.pend ? `<small style="color:var(--amber)" title="Particular com proposta pendente: desconto sobre ${fmt(x.pend.para)} (publicado hoje: ${x.refPub != null ? fmt(x.refPub) : '—'})"><i class="fa-solid fa-hourglass-half"></i> Part. ${fmt(x.pend.para)}</small>` : ''}`;
const ppMrg = x => {
  if (x.c?.semCusto && pode('exames', 'editar')) return `<button type="button" class="gx-sc" title="Exame sem custo: clique para informar" onclick="ppCusto(this)"><i class="fa-solid fa-plus"></i>custo</button>`;
  if (x.c?.margem == null) return `<span class="muted">${x.c?.semCusto ? 'sem custo' : '—'}</span>`;
  const mref = x.c.margemSug ?? x.c.alvo;
  return `<b class="${x.c.status === 'r' ? 'r' : 'g'}">${pct(x.c.margem)}</b><small>lucro ${fmt(x.c.lucro)}</small>${mref != null ? `<small>ref. ${pct(mref, 0)}</small>` : ''}`;
};

// "Sem custo": abre a ficha do exame na aba de custos; ao fechá-la, a proposta volta como estava
// (justificativa, observação e valores revisados).
let _ppVolta = null;
function ppCusto(btn) {
  const k = btn.closest('tr').dataset.k, envio = !!document.getElementById('pp-just');
  const volta = { envio, id: _propId, txt: valorCampo(envio ? 'pp-just' : 'pp-motivo'), rev: { ..._propRev } };
  abrirFicha(k, 'custos');
  _ppVolta = volta;
}
const _ppFecharGaveta = fecharGaveta;
fecharGaveta = function () {
  const v = _ppVolta;
  _ppVolta = null;
  _ppFecharGaveta();
  if (!v) return;
  // espera o custo gravado chegar ao estado antes de recalcular
  setTimeout(async () => {
    if (v.envio) await abrirEnvioProposta(); else abrirProposta(v.id);
    const campo = document.getElementById(v.envio ? 'pp-just' : 'pp-motivo');
    if (campo) campo.value = v.txt;
    Object.entries(v.rev).forEach(([k, val]) => {
      const inp = [...document.querySelectorAll('#g-corpo .pp-tab tr')].find(tr => tr.dataset.k === k)?.querySelector('input');
      if (inp) { inp.value = val != null ? val.toFixed(2) : ''; revisarItem(inp); }
    });
  }, 400);
};

// Indicadores do quadro: médias dos valores propostos, com as referências da tabela
function htmlKpisProposta(cx, ls) {
  let sm = 0, km = 0, s0 = 0, k0 = 0, sd = 0, kd = 0, lu = 0, ab = 0;
  ls.forEach(x => {
    if (x.c?.margem != null) { sm += x.c.margem; km++; lu += x.c.lucro; if (x.c.status === 'r') ab++; }
    if (x.c0?.margem != null) { s0 += x.c0.margem; k0++; }
    if (x.desc != null) { sd += x.desc; kd++; }
  });
  const dm = ls.filter(x => acimaDescMax(x.desc, x.descMax)).length;
  const kp = (rot, v, cls, sub) => `<div><span>${rot}</span><b class="${cls}">${v}</b><small>${sub}</small></div>`;
  return kp('Margem média', km ? pct(sm / km) : '—', ab ? 'r' : km ? 'g' : '',
      [`${cx.pisoNome} ${cx.pisoTxt}`, cx.margemSug != null ? `ref. ${cx.msugTxt}` : '', k0 ? `antes ${pct(s0 / k0)}` : ''].filter(Boolean).join(' · '))
    + (cx.base || !cx.ref ? '' : kp('Desconto médio', kd ? pct(sd / kd) : '—', dm ? 'r' : '',
      cx.tabela ? `ref. ${cx.descTxt}${cx.dmaxTxt ? ` · máx. ${cx.dmaxTxt}` : ''}` : `sobre ${esc(cx.ref.nome)}`))
    + kp('Lucro médio', km ? fmt(lu / km) : '—', km && lu < 0 ? 'r' : '', km ? `por exame · ${km} com custo` : 'sem custo informado');
}

// Quadro da tabela: cabeçalho, indicadores e itens. o: { nome, colDe, colPara, celPara(x), marca(x) }
function htmlQuadroProposta(cx, ls, o) {
  const lab = cx?.lab, comDesc = cx && !cx.base && !!cx.ref;
  const n = { e: 0, s: 0, up: 0, dn: 0 };
  ls.forEach(x => { if (x.de == null) n.e++; else if (x.para == null) n.s++; else if (x.para > x.de) n.up++; else if (x.para < x.de) n.dn++; });
  const pend = ls.filter(x => x.pend), idPend = pend[0]?.pend.id;
  const partes = [n.e && `${n.e} ${lab ? 'novos' : 'entram'}`, n.up && `${n.up} sobem`, n.dn && `${n.dn} descem`, n.s && `${n.s} ${lab ? 'removidos' : 'saem'}`].filter(Boolean).join(' · ');
  return `<div class="pp-q">
    <div class="pp-qh"><span class="tc-ic" style="--c:${cx?.cor || 'var(--gray)'}"><i class="fa-solid ${cx?.icone || 'fa-table-list'}"></i></span>
      <div><b>${esc(o.nome || cx?.nome || '(removida)')}</b><small>${ls.length} preço(s)${partes ? ' · ' + partes : ''}</small></div></div>
    ${cx ? `<div class="pp-kpis" id="pp-kpis">${htmlKpisProposta(cx, ls)}</div>` : ''}
    ${pend.length ? `<div class="alert a" style="margin:10px 12px"><i class="fa-solid fa-hourglass-half"></i><div><b>${pend.length} exame(s) com valor da Particular aguardando aprovação.</b> O desconto deles já considera o valor proposto da Particular; se ela for rejeitada, volta a valer o publicado. <a href="#" onclick="abrirProposta('${idPend}');return false">Abrir a proposta da Particular</a></div></div>` : ''}
    <div class="tbl-wrap"><table class="pp-tab"><thead><tr><th>Exame</th><th class="num">${o.colDe}</th><th class="num">${o.colPara}</th>${comDesc ? '<th class="num">Desconto</th>' : ''}<th class="num">Margem</th></tr></thead>
      <tbody>${ls.map(x => `<tr data-k="${esc(x.k)}">
        <td class="pp-ex"><span class="mn">${esc(x.mn ?? '—')}</span>${o.marca?.(x) || ''}<small title="${esc(x.e?.descricao || '')}">${esc(x.e?.descricao || 'exame excluído')}</small></td>
        <td class="num">${fmtOuFora(x.de, lab)}</td>
        <td class="num pp-para">${o.celPara(x)}</td>
        ${comDesc ? `<td class="num pp-v pp-desc">${ppDesc(x)}</td>` : ''}
        <td class="num pp-v pp-mrg">${ppMrg(x)}</td></tr>`).join('')}</tbody></table></div></div>`;
}

// ── Envio ─────────────────────────────────────────────────────
async function abrirEnvioProposta() {
  const cx = ctxAtual();
  await gravarRasc(cx.alvo);
  const r = rasc(cx.alvo), s = resumoRasc(cx), aprova = pode('tabelas', 'aprovar');
  const itens = Object.entries(r).filter(([k]) => ESTADO.exames[k]).map(([k, v]) => linhaProposta(cx, k, cx.salvo(k) ?? null, v ?? null))
    .sort((a, b) => a.mn.localeCompare(b.mn));
  abrirGaveta({
    larga: true, sobre: 'Enviar proposta', titulo: cx.nome,
    meta: `<span class="tag"><i class="fa-solid fa-pen"></i>${s.n} alteração(ões)</span>${s.ab ? `<span class="tag" style="color:var(--red)"><i class="fa-solid fa-circle-xmark"></i>${s.ab} abaixo do ${cx.pisoNome}</span>` : ''}${s.dm ? `<span class="tag" style="color:var(--red)"><i class="fa-solid fa-ban"></i>${s.dm} acima do desc. máximo</span>` : ''}`,
    corpo: `
      ${s.ab ? `<div class="alert r"><i class="fa-solid fa-circle-xmark"></i><div>${s.ab} preço(s) ficam abaixo do ${cx.pisoNome} de ${cx.pisoTxt}.</div></div>` : ''}
      ${s.dm ? `<div class="alert r"><i class="fa-solid fa-ban"></i><div>${s.dm} preço(s) passam do desconto máximo de ${cx.dmaxTxt}.</div></div>` : ''}
      ${htmlQuadroProposta(cx, itens, { colDe: 'Atual', colPara: 'Proposto', celPara: x => `<b>${fmtOuFora(x.para, cx.lab)}</b>${ppVar(x)}` })}
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
    const x = Object.assign(linhaProposta(cx, k, (pendente ? atual : it.de) ?? null, it.para ?? null), { it, mudou, mn: it.mn });
    if (x.c?.status === 'r') abaixo++;
    return x;
  }).sort((a, b) => String(a.mn).localeCompare(String(b.mn)));
  abrirGaveta({
    larga: true, sobre: `Proposta · ${dataHora(p.em)}`, titulo: p.alvoNome || cx?.nome || 'Proposta',
    meta: `<span class="badge-s ${st.cls}"><i class="fa-solid ${st.icone}"></i>${st.nome}</span><span class="tag"><i class="fa-solid fa-user"></i>${esc(p.autor)}</span><span class="tag"><i class="fa-solid fa-tag"></i>${itens.length} preço(s)</span>`,
    corpo: `
      ${!cx ? '<div class="alert r"><i class="fa-solid fa-circle-xmark"></i><div>A tabela desta proposta foi excluída.</div></div>' : ''}
      ${p.decisao ? `<div class="alert ${p.status === 'aprovada' ? 'x' : 'a'}"><i class="fa-solid ${st.icone}"></i><div><b>${st.nome}</b> por ${esc(p.decisao.por)} em ${dataHora(p.decisao.em)}${p.decisao.motivo ? `<br>${esc(p.decisao.motivo)}` : ''}</div></div>` : ''}
      ${conflitos ? `<div class="alert a"><i class="fa-solid fa-triangle-exclamation"></i><div>${conflitos} preço(s) mudaram desde o envio (coluna "Hoje"). Ao aprovar, vale o valor proposto.</div></div>` : ''}
      <div id="pp-abaixo">${abaixo ? `<div class="alert r"><i class="fa-solid fa-circle-xmark"></i><div>${abaixo} preço(s) abaixo do ${cx?.pisoNome || 'piso'}.</div></div>` : ''}</div>
      ${nRev ? `<div class="alert x"><i class="fa-solid fa-pen"></i><div>${nRev} valor(es) revisado(s) na aprovação (riscado = valor proposto).</div></div>` : ''}
      ${p.justificativa ? `<div class="sec-t"><i class="fa-solid fa-quote-left"></i>Justificativa</div><div class="ins-prev">${esc(p.justificativa)}</div>` : ''}
      ${revisa ? '<div class="hint" style="margin:14px 0 0"><i class="fa-solid fa-pen"></i> Ajuste o valor proposto, se precisar: ao aprovar, vale o valor revisado.</div>' : ''}
      ${htmlQuadroProposta(cx, itens, {
        nome: p.alvoNome, colDe: pendente ? 'Hoje' : 'Antes', colPara: p.status === 'aprovada' ? 'Publicado' : 'Proposto',
        marca: x => x.mudou ? ` <i class="fa-solid fa-triangle-exclamation" style="color:var(--amber)" title="Mudou desde o envio: era ${x.it.de != null ? fmt(x.it.de) : 'fora'}"></i>` : '',
        celPara: x => revisa && x.e ? `<div class="price-in"><span>R$</span><input type="number" step="0.01" min="0" value="${x.para != null ? x.para.toFixed(2) : ''}" placeholder="${cx.base ? '' : cx.lab ? 'sem valor' : 'fora'}" oninput="revisarItem(this)" onfocus="this.select()"></div><div class="pp-var">${ppVar(x)}</div><div class="delta"></div>`
          : `${x.it.revisado ? `<s class="muted">${fmtOuFora(x.it.proposto, cx?.lab)}</s> ` : ''}<b>${fmtOuFora(x.para, cx?.lab)}</b>${ppVar(x)}`
      })}
      ${pendente && aprova ? `<div class="just"><label for="pp-motivo">Observação da decisão <span class="muted">(obrigatória para rejeitar)</span></label><textarea id="pp-motivo"></textarea></div>` : ''}`,
    rodape: `${!pendente && autor && cx ? `<button class="btn" style="margin-right:auto" onclick="reabrirProposta('${id}')" title="Carrega os preços no seu rascunho"><i class="fa-solid fa-pen"></i>Editar de novo</button>` : '<span style="margin-right:auto"></span>'}
      ${pendente && autor ? `<button class="btn perigo-txt" onclick="decidirProposta('${id}','cancelada')"><i class="fa-solid fa-ban"></i>Cancelar</button>` : ''}
      ${pendente && aprova ? `<button class="btn perigo-txt" onclick="decidirProposta('${id}','rejeitada')"><i class="fa-solid fa-circle-xmark"></i>Rejeitar</button>
        <button class="btn pri" id="pp-aprovar" ${cx ? '' : 'disabled'} onclick="decidirProposta('${id}','aprovada')"><i class="fa-solid fa-stamp"></i>Aprovar e publicar</button>` : `<button class="btn" onclick="fecharGaveta()">Fechar</button>`}`
  });
}

// Dados mudaram com a proposta aberta (Particular, custos, outra proposta…): recalcula sem perder
// os valores revisados nem a observação. Com um campo em edição, só os números das linhas.
function atualizarPropostaAberta() {
  const corpo = document.getElementById('g-corpo');
  if (!_propId || !document.getElementById('pp-abaixo') || !ESTADO.propostas[_propId]) return;
  const foco = document.activeElement;
  if (foco && corpo?.contains(foco) && /INPUT|TEXTAREA/.test(foco.tagName)) {
    document.querySelectorAll('#g-corpo .pp-tab tr input').forEach(revisarItem);
    return;
  }
  const rev = { ..._propRev }, txt = valorCampo('pp-motivo'), topo = corpo?.scrollTop || 0;
  abrirProposta(_propId);
  const campo = document.getElementById('pp-motivo');
  if (campo) campo.value = txt;
  Object.entries(rev).forEach(([k, val]) => {
    const inp = [...document.querySelectorAll('#g-corpo .pp-tab tr')].find(tr => tr.dataset.k === k)?.querySelector('input');
    if (inp) { inp.value = val != null ? val.toFixed(2) : ''; revisarItem(inp); }
  });
  const novo = document.getElementById('g-corpo');
  if (novo) novo.scrollTop = topo;
}

function revisarItem(inp) {
  const p = ESTADO.propostas[_propId], cx = p && ctxAlvo(p.alvo), tr = inp.closest('tr'), k = tr.dataset.k, it = p?.itens?.[k];
  if (!it || !cx) return;
  const txt = inp.value.trim(), v = txt === '' ? null : Math.round(parseFloat(txt) * 100) / 100, orig = it.para ?? null;
  if ((v != null && (isNaN(v) || v < 0)) || (v == null && cx.base) || v === orig) delete _propRev[k];
  else _propRev[k] = v;
  const rev = k in _propRev, x = linhaProposta(cx, k, cx.salvo(k) ?? null, rev ? _propRev[k] : orig);
  tr.querySelector('.price-in').classList.toggle('on', rev);
  tr.querySelector('.pp-var').innerHTML = ppVar(x);
  tr.querySelector('.delta').innerHTML = rev ? `<span class="muted">proposto ${fmtOuFora(orig, cx.lab)}</span>` : '';
  const tdDesc = tr.querySelector('.pp-desc');
  if (tdDesc) tdDesc.innerHTML = ppDesc(x);
  tr.querySelector('.pp-mrg').innerHTML = ppMrg(x);
  // indicadores, alerta e botão refletem os valores revisados
  const ls = Object.entries(p.itens).map(([kk, i2]) => linhaProposta(cx, kk, cx.salvo(kk) ?? null, kk in _propRev ? _propRev[kk] : i2.para ?? null));
  document.getElementById('pp-kpis').innerHTML = htmlKpisProposta(cx, ls);
  const abaixo = ls.filter(l => l.c?.status === 'r').length;
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
