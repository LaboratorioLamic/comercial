// ═══════════════════════════════════════════════════════════════
// apoio.js — Laboratórios de apoio: importação da tabela de preços
// (modelos Hermes Pardini 4114 e Alvaro 2656), vínculo de mnemônicos e vigência
// ═══════════════════════════════════════════════════════════════
//
// Pardini 4114 = preços NEGOCIADOS. Colunas usadas:
//   A Material (desempate) · B Mnemônico · C Descrição (conferência)
//   F Início Vigência · G Preço Exame(R$)
// Vínculo automático só quando mnemônico E descrição batem.

// Modelo de importação: definido no cadastro do setor (Configurações → Setores)
const modeloDoApoio = s => s?.categoria === 'apoio' && MODELOS_APOIO[s.modeloImportacao] ? s.modeloImportacao : null;
const chaveItemApoio = (codigo, material) => chaveExame(`${codigo}|${material || ''}`);

// ── Similaridade de descrições ────────────────────────────────
const _STOP = new Set(['DE', 'DA', 'DO', 'DAS', 'DOS', 'E', 'PARA', 'POR', 'COM', 'EM', 'A', 'O', 'ANTI', 'ANTICORPOS', 'S', 'U', 'NO', 'NA']);
const textoComparar = s => normalizar(s).toUpperCase().replace(/[^A-Z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
const tokens = s => new Set(s.split(' ').filter(t => t && !_STOP.has(t)));
function dice(a, b) {
  if (a === b) return 1;
  if (a.length < 2 || b.length < 2) return 0;
  const m = new Map();
  for (let i = 0; i < a.length - 1; i++) { const g = a.slice(i, i + 2); m.set(g, (m.get(g) || 0) + 1); }
  let inter = 0;
  for (let i = 0; i < b.length - 1; i++) { const g = b.slice(i, i + 2), n = m.get(g); if (n) { inter++; m.set(g, n - 1); } }
  return 2 * inter / (a.length + b.length - 2);
}
function similaridade(a, b) {
  a = textoComparar(a); b = textoComparar(b);
  const ta = tokens(a), tb = tokens(b);
  const uni = new Set([...ta, ...tb]).size, inter = [...ta].filter(t => tb.has(t)).length;
  return Math.max(dice(a, b), dice([...ta].sort().join(' '), [...tb].sort().join(' ')), uni ? inter / uni : 0);
}

// ── Leitura do arquivo ────────────────────────────────────────
let _xlsxPromessa = null;
function carregarXLSX() {
  if (window.XLSX) return Promise.resolve();
  return _xlsxPromessa ??= new Promise((ok, erro) => {
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
    s.onload = ok; s.onerror = () => erro(new Error('Não foi possível carregar o leitor de Excel (sem internet?).'));
    document.head.appendChild(s);
  });
}

async function linhasDoArquivo(arquivo) {
  if (/\.csv$/i.test(arquivo.name)) return lerCSV(await arquivo.text());
  await carregarXLSX();
  const wb = XLSX.read(await arquivo.arrayBuffer(), { type: 'array' });
  return XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: true, defval: '' });
}

function dataPlanilha(v) {
  if (typeof v === 'number' && window.XLSX) { const d = XLSX.SSF.parse_date_code(v); return d ? `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}` : ''; }
  return dataISO(v);
}

// Tabela Pardini → { chave: { codigo, material, descricao, preco, vigencia } }
function analisarTabelaPardini(linhas) {
  const iCab = linhas.slice(0, 15).findIndex(l => l.some(c => normalizar(c) === 'mnemonico'));
  if (iCab < 0) throw new Error('Cabeçalho não encontrado: o arquivo precisa ter a coluna "Mnemônico" (modelo Pardini 4114).');
  const cab = linhas[iCab].map(normalizar);
  const col = (re, padrao) => { const i = cab.findIndex(c => re.test(c)); return i >= 0 ? i : padrao; };
  const C = { mat: col(/^material/, 0), mn: col(/^mnemonico/, 1), desc: col(/^descricao/, 2), vig: col(/vigencia/, 5), preco: col(/^preco/, 6) };
  const itens = {}, avisos = [];
  linhas.slice(iCab + 1).forEach(l => {
    const codigo = String(l[C.mn] ?? '').trim();
    if (!codigo) return;
    const preco = typeof l[C.preco] === 'number' ? l[C.preco] : numeroBR(l[C.preco]);
    if (preco == null) { avisos.push(`${codigo}: sem preço`); return; }
    const material = String(l[C.mat] ?? '').trim();
    itens[chaveItemApoio(codigo, material)] = { codigo, material, descricao: String(l[C.desc] ?? '').trim(), preco: Math.round(preco * 100) / 100, vigencia: dataPlanilha(l[C.vig]) };
  });
  if (!Object.keys(itens).length) throw new Error('Nenhum exame com preço encontrado no arquivo.');
  return { itens, avisos };
}

// Alvaro 2656 = "Preços Negociados". Cabeçalho do cadastro do cliente nas primeiras linhas;
// depois A Cod. Exame · B Nome Exame · F Preços Especiais R$ ("R$ 1.843,15").
// Sem material e sem vigência: vale a partir da data da importação.
function analisarTabelaAlvaro(linhas) {
  const iCab = linhas.slice(0, 40).findIndex(l => l.some(c => /^cod\.? ?exame/.test(normalizar(c))));
  if (iCab < 0) throw new Error('Cabeçalho não encontrado: o arquivo precisa ter a coluna "Cod. Exame" (modelo Alvaro, preços negociados).');
  const cab = linhas[iCab].map(normalizar);
  const col = (re, padrao) => { const i = cab.findIndex(c => re.test(c)); return i >= 0 ? i : padrao; };
  const C = { cod: col(/^cod\.? ?exame/, 0), desc: col(/^nome/, 1), preco: col(/^preco/, 5) };
  const itens = {}, avisos = [], hoje = hojeISO();
  linhas.slice(iCab + 1).forEach(l => {
    const codigo = String(l[C.cod] ?? '').trim();
    if (!codigo) return;
    const preco = typeof l[C.preco] === 'number' ? l[C.preco] : numeroBR(l[C.preco]);
    if (preco == null) { avisos.push(`${codigo}: sem preço`); return; }
    itens[chaveItemApoio(codigo, '')] = { codigo, material: '', descricao: String(l[C.desc] ?? '').trim(), preco: Math.round(preco * 100) / 100, vigencia: hoje };
  });
  if (!Object.keys(itens).length) throw new Error('Nenhum exame com preço encontrado no arquivo.');
  return { itens, avisos };
}

// Leitor de cada modelo (linhas do arquivo → { itens, avisos })
const LEITORES_APOIO = { pardini4114: analisarTabelaPardini, alvaro2656: analisarTabelaAlvaro };

// ── Classificação dos vínculos ────────────────────────────────
// Para cada exame do setor do apoio: vinculado | auto | conf | forte | fraca | sem
function classificarVinculos(apoioId, itens) {
  const porCodigo = {};
  Object.entries(itens).forEach(([k, it]) => { (porCodigo[it.codigo.toUpperCase()] ??= []).push({ k, ...it }); });
  const todos = Object.entries(itens).map(([k, it]) => ({ k, ...it }));
  return lista(ESTADO.exames).filter(e => e.setorId === apoioId).map(e => {
    if (e.vinculoApoio?.apoioId === apoioId) {
      return { e, st: itens[e.vinculoApoio.chave] ? 'vinculado' : 'saiu', k: e.vinculoApoio.chave, it: itens[e.vinculoApoio.chave] };
    }
    const mesmos = porCodigo[e.mn.toUpperCase()];
    if (mesmos) {
      const melhor = mesmos.map(it => ({ it, s: similaridade(e.descricao, it.descricao) })).sort((a, b) => b.s - a.s)[0];
      return { e, st: melhor.s >= 0.75 ? 'auto' : 'conf', k: melhor.it.k, it: melhor.it, sc: melhor.s, multi: mesmos.length > 1 };
    }
    let melhor = null;
    for (const it of todos) { const s = similaridade(e.descricao, it.descricao); if (!melhor || s > melhor.s) melhor = { it, s }; }
    const st = melhor && melhor.s >= 0.9 ? 'forte' : melhor && melhor.s >= 0.6 ? 'fraca' : 'sem';
    return { e, st, k: st !== 'sem' ? melhor.it.k : null, it: st !== 'sem' ? melhor.it : null, sc: melhor?.s };
  });
}

const VST = {
  vinculado: { t: 'Vinculado',        c: 'ok',   ic: 'fa-link',                h: 'vínculo já confirmado' },
  auto:      { t: 'Automático',       c: 'ok',   ic: 'fa-link',                h: 'mnemônico e descrição iguais' },
  forte:     { t: 'Sugestão forte',   c: 'base', ic: 'fa-wand-magic-sparkles', h: 'mnemônico diferente, descrição igual' },
  fraca:     { t: 'Sugestão fraca',   c: 'base', ic: 'fa-wand-magic-sparkles', h: 'descrição parecida: confira' },
  conf:      { t: 'Conferir',         c: 'bad',  ic: 'fa-triangle-exclamation', h: 'mesmo mnemônico, exame diferente: não vincula sozinho' },
  sem:       { t: 'Sem vínculo',      c: 'off',  ic: 'fa-link-slash',          h: 'não encontrado na tabela' },
  saiu:      { t: 'Saiu da tabela',   c: 'warn', ic: 'fa-circle-exclamation',  h: 'item vinculado não está mais na tabela' },
  manual:    { t: 'Escolhido',        c: 'base', ic: 'fa-hand-pointer',        h: 'item trocado manualmente: confirme para vincular' }
};

// ── Tela (Custos → Laboratórios de apoio) ─────────────────────
const apo = { sel: null, passo: 0, arquivo: null, analise: null, erro: '', comFortes: false, filtro: '', pag: 1, cache: null, troca: {}, trocaEx: {} };
aoAtualizar(ch => { if (ch === 'exames' || ch === 'apoios' || ch === 'setores') apo.cache = null; });

function htmlApoios() {
  const apoios = lista(ESTADO.setores, porNome).filter(s => s.categoria === 'apoio');
  if (!apoios.length) return `<div class="card">${vazio('fa-truck-medical', 'Nenhum setor da categoria "Laboratório de apoio" cadastrado.')}</div>`;
  if (!apoios.find(a => a.id === apo.sel)) apo.sel = (apoios.find(a => modeloDoApoio(a)) || apoios[0]).id;
  return `<div class="cards">${apoios.map(a => {
      const t = ESTADO.apoios[a.id] || {}, nItens = Object.keys(t.precos || {}).length;
      const exs = lista(ESTADO.exames).filter(e => e.setorId === a.id), vinc = exs.filter(e => e.vinculoApoio?.apoioId === a.id).length;
      const modelo = modeloDoApoio(a);
      return `<button class="card tcard ${a.id === apo.sel ? 'on' : ''}" onclick="apo.sel='${a.id}';apo.passo=0;apo.cache=null;apo.pag=1;apo.troca={};apo.trocaEx={};renderCustos()">
        <div class="tc-h"><span class="tc-ic" style="--c:${a.cor}"><i class="fa-solid ${a.icone}"></i></span><div><div class="tc-n">${esc(a.nome)}</div>
          <div class="tc-s">${nItens ? `tabela de ${dataBR(t.vigencia)} · ${num(nItens, 0)} itens` : modelo ? 'tabela ainda não importada' : 'modelo de importação pendente'}</div></div></div>
        <div class="tc-stats"><div><b>${exs.length}</b><span>exames LAMIC</span></div><div><b>${vinc}</b><span>vinculados</span></div><div><b>${exs.filter(e => !custoTesteExame(e)).length}</b><span>sem custo</span></div></div></button>`;
    }).join('')}</div>
    <div class="card" style="margin-top:14px" id="apoio-det">${htmlApoioDetalhe()}</div>`;
}

function htmlApoioDetalhe() {
  const a = ESTADO.setores[apo.sel], modelo = modeloDoApoio(a), t = ESTADO.apoios[apo.sel] || {};
  const podeImp = pode('custos', 'importar');
  const cab = `<div class="sec-card-h"><span class="tc-ic" style="--c:${a.cor}"><i class="fa-solid ${a.icone}"></i></span>
    <div><h3>${esc(a.nome)}</h3><div class="sub">${modelo ? MODELOS_APOIO[modelo].nome + (MODELOS_APOIO[modelo].negociada ? ' · preços negociados' : '') : 'Sem modelo de importação: custos informados manualmente na ficha de cada exame'}</div></div>
    <div class="rt">${t.importadoEm ? `<span class="muted" style="font-size:12px">importada em ${dataHora(t.importadoEm)} por ${esc(t.importadoPor || '—')}</span>` : ''}
      ${modelo && podeImp && apo.passo === 0 ? `<button class="btn pri" onclick="apo.passo=1;apo.erro='';desenharApoioDet()"><i class="fa-solid fa-file-import"></i>${t.precos ? 'Importar nova tabela' : 'Importar tabela'}</button>` : ''}</div></div>`;
  if (apo.passo >= 1) return cab + htmlImportacaoApoio();
  if (!modelo) return cab + vazio('fa-file-excel', `<b>Nenhum modelo de importação escolhido</b><br>Escolha o modelo no cadastro do setor. Se o apoio ainda não tem modelo, envie um arquivo de exemplo da tabela para criarmos.${pode('params', 'editar') ? `<br><button class="btn sm" style="margin-top:10px" onclick="abrirSetor('${apo.sel}')"><i class="fa-solid fa-pen"></i>Editar setor</button>` : ''}`);
  if (!t.precos) return cab + vazio('fa-file-import', `Importe a tabela (${esc(MODELOS_APOIO[modelo].exemplo)}) para vincular os exames e atualizar os custos.`);
  return cab + htmlVinculos();
}
const desenharApoioDet = () => { const el = document.getElementById('apoio-det'); if (el) { el.innerHTML = htmlApoioDetalhe(); popsVinculos(); } };

// ── Assistente de importação ──────────────────────────────────
function htmlImportacaoApoio() {
  const passos = ['Arquivo', 'Conferir', 'Concluído'];
  const barra = `<div class="steps">${passos.map((s, i) => `<div class="step ${i + 1 < apo.passo ? 'done' : i + 1 === apo.passo ? 'cur' : ''}"><span class="c">${i + 1 < apo.passo ? '<i class="fa-solid fa-check"></i>' : i + 1}</span>${s}</div>`).join('')}</div>`;
  let corpo = '', rodape = '';
  if (apo.passo === 1) {
    corpo = `<label class="drop ${apo.arquivo ? 'ok' : ''}" for="apo-arq"><input type="file" id="apo-arq" accept="${MODELOS_APOIO[modeloDoApoio(ESTADO.setores[apo.sel])]?.aceita || '.xlsx,.xls,.csv'}" onchange="lerArquivoApoio(this)">
        <i class="fa-solid ${apo.arquivo ? 'fa-circle-check' : 'fa-cloud-arrow-up'}"></i><b>${esc(MODELOS_APOIO[modeloDoApoio(ESTADO.setores[apo.sel])]?.arquivo || 'Tabela de preços do apoio')}</b>
        <div class="drop-s">${apo.arquivo ? esc(apo.arquivo.name) : `Arquivo baixado do portal (ex.: ${esc(MODELOS_APOIO[modeloDoApoio(ESTADO.setores[apo.sel])]?.exemplo || '')})`}</div></label>
      ${apo.erro ? `<div class="alert r" style="margin-top:12px"><i class="fa-solid fa-circle-xmark"></i><div>${esc(apo.erro)}</div></div>` : ''}`;
    rodape = `<button class="btn" onclick="apo.passo=0;apo.arquivo=null;desenharApoioDet()">Cancelar</button><button class="btn pri" ${apo.arquivo && !apo.analisando ? '' : 'disabled'} onclick="analisarApoio()"><i class="fa-solid ${apo.analisando ? 'fa-circle-notch fa-spin' : 'fa-magnifying-glass-chart'}"></i>${apo.analisando ? 'Analisando vínculos…' : 'Analisar'}</button>`;
  }
  if (apo.passo === 2) {
    const an = apo.analise, cont = {};
    an.vinc.forEach(v => { cont[v.st] = (cont[v.st] || 0) + 1; });
    const vig = {}; Object.values(an.itens).forEach(it => { vig[it.vigencia] = (vig[it.vigencia] || 0) + 1; });
    const vigMaior = Object.entries(vig).sort((a, b) => b[1] - a[1])[0]?.[0], futuras = Object.values(an.itens).filter(it => it.vigencia > hojeISO()).length;
    const imp = an.impacto;
    const kp = (ic, cor, rot, v, s = '') => `<div class="imp"><div class="l"><i class="fa-solid ${ic}" style="color:${cor}"></i>${rot}</div><div class="v">${num(v, 0)}</div>${s ? `<div class="d muted">${s}</div>` : ''}</div>`;
    corpo = `<div class="sumgrid">
        ${kp('fa-list', 'var(--text-muted)', 'Itens na tabela', Object.keys(an.itens).length, `vigência ${dataBR(vigMaior)}${futuras ? ` · ${futuras} futura(s)` : ''}`)}
        ${kp('fa-link', 'var(--green)', 'Automáticos', (cont.auto || 0) + (cont.vinculado || 0), `${cont.vinculado || 0} já vinculados`)}
        ${kp('fa-wand-magic-sparkles', 'var(--cyan)', 'Sugestões', (cont.forte || 0) + (cont.fraca || 0), `${cont.forte || 0} fortes · ${cont.fraca || 0} fracas`)}
        ${kp('fa-triangle-exclamation', 'var(--red)', 'Conferir', cont.conf || 0, 'mesmo MN, exame diferente')}
        ${kp('fa-link-slash', 'var(--gray)', 'Sem vínculo', (cont.sem || 0) + (cont.saiu || 0), cont.saiu ? `${cont.saiu} saíram da tabela` : 'custo manual')}
        ${kp('fa-arrow-trend-up', 'var(--red)', 'Custos sobem', imp.sobem, imp.mediana != null ? `mediana ${imp.mediana > 0 ? '+' : ''}${pct(imp.mediana)}` : '')}
        ${kp('fa-arrow-trend-down', 'var(--green)', 'Custos descem', imp.descem)}
        ${kp('fa-circle-xmark', 'var(--red)', 'Caem abaixo do mínimo', imp.caem.length)}
      </div>
      ${an.avisos.length ? `<div class="alert a"><i class="fa-solid fa-triangle-exclamation"></i><div>${an.avisos.length} linha(s) ignoradas: ${esc(an.avisos.slice(0, 5).join(' · '))}${an.avisos.length > 5 ? '…' : ''}</div></div>` : ''}
      ${imp.caem.length ? `<div class="sec-t"><i class="fa-solid fa-circle-xmark"></i>Exames que caem abaixo do mínimo</div>
        <div class="tbl-wrap card-in"><table><thead><tr><th>MN</th><th>Exame</th><th class="num">Custo atual → novo</th><th class="num">Margem</th></tr></thead><tbody>
        ${imp.caem.slice(0, 15).map(x => `<tr><td class="mn">${esc(x.e.mn)}</td><td class="desc">${esc(x.e.descricao)}</td><td class="num">${fmt(x.c0)} → <b>${fmt(x.c1)}</b></td><td class="num">${pct(x.m0)} → <span style="color:var(--red)">${pct(x.m1)}</span></td></tr>`).join('')}
        </tbody></table></div>${imp.caem.length > 15 ? `<div class="hint" style="margin-top:6px">+ ${imp.caem.length - 15} exames</div>` : ''}` : ''}
      <div class="sec-t" style="margin-top:16px"><i class="fa-solid fa-sliders"></i>Ao aplicar</div>
      <div class="casc">
        <div class="casc-r"><div class="lft"><i class="fa-solid fa-link" style="color:var(--green)"></i><div>Gravar a tabela e vincular os automáticos<div class="s">custos passam a vir da tabela e os exames ficam marcados como negociados</div></div></div><span class="badge-s ok">sempre</span></div>
        <div class="casc-r"><div class="lft"><i class="fa-solid fa-wand-magic-sparkles" style="color:var(--cyan)"></i><div>Vincular também as ${cont.forte || 0} sugestões fortes<div class="s">descrição igual, mnemônico diferente (ex.: 17PG → 17-PG)</div></div></div>${chave(apo.comFortes, 'apo.comFortes=!apo.comFortes;this.classList.toggle(\'on\')')}</div>
        <div class="casc-r"><div class="lft"><i class="fa-solid fa-hand-pointer"></i><div>Sugestões fracas e "conferir"<div class="s">ficam para confirmação manual na lista de vínculos</div></div></div><span class="badge-s off">manual</span></div>
      </div>`;
    rodape = `<button class="btn" onclick="apo.passo=1;desenharApoioDet()"><i class="fa-solid fa-arrow-left"></i>Voltar</button><button class="btn pri" onclick="aplicarTabelaApoio()"><i class="fa-solid fa-check"></i>Aplicar tabela</button>`;
  }
  if (apo.passo === 3) {
    corpo = `<div class="done-box"><i class="fa-solid fa-circle-check"></i><h3>Tabela aplicada</h3><p>${apo.resultado}</p></div>`;
    rodape = `<span></span><button class="btn pri" onclick="apo.passo=0;apo.arquivo=null;apo.cache=null;desenharApoioDet()"><i class="fa-solid fa-link"></i>Ver vínculos</button>`;
  }
  return barra + `<div class="wz-body">${corpo}</div><div class="wz-f">${rodape}</div>`;
}

function lerArquivoApoio(input) {
  apo.arquivo = input.files[0] || null; apo.erro = '';
  desenharApoioDet();
}

async function analisarApoio() {
  apo.analisando = true; desenharApoioDet();
  await new Promise(r => setTimeout(r, 30));          // deixa a tela mostrar o "analisando"
  try {
    const leitor = LEITORES_APOIO[modeloDoApoio(ESTADO.setores[apo.sel])];
    if (!leitor) throw new Error('Este setor não tem modelo de importação.');
    const { itens, avisos } = leitor(await linhasDoArquivo(apo.arquivo));
    const vinc = classificarVinculos(apo.sel, itens);
    // impacto: exames que ficarão vinculados (já vinculados + automáticos)
    const imp = { sobem: 0, descem: 0, caem: [], var: [] }, min = parametro('margemMinima');
    vinc.filter(v => v.st === 'vinculado' || v.st === 'auto').forEach(v => {
      const c0 = calcular(v.e), e1 = { ...v.e, vinculoApoio: null, reagenteId: null, custoTeste: v.it.preco }, c1 = calcular(e1);
      if (c0.semCusto) return;
      const d = c1.teste.valor - c0.teste.valor;
      if (d > 0.004) imp.sobem++; else if (d < -0.004) imp.descem++;
      if (c0.teste.valor > 0) imp.var.push(c1.teste.valor / c0.teste.valor - 1);
      if (c0.margem != null && c0.margem >= min && c1.margem < min) imp.caem.push({ e: v.e, c0: c0.teste.valor, c1: c1.teste.valor, m0: c0.margem, m1: c1.margem });
    });
    imp.var.sort((a, b) => a - b);
    imp.mediana = imp.var.length ? imp.var[Math.floor(imp.var.length / 2)] : null;
    apo.analise = { itens, avisos, vinc, impacto: imp, arquivo: apo.arquivo.name };
    apo.passo = 2; apo.comFortes = false;
  } catch (e) { console.error(e); apo.erro = e.message; }
  apo.analisando = false;
  desenharApoioDet();
}

async function aplicarTabelaApoio() {
  const an = apo.analise, id = apo.sel, antes = ESTADO.apoios[id]?.precos || {}, u = usuarioAtual();
  const ok = await confirmar({ titulo: 'Aplicar a nova tabela?', texto: 'Os custos dos exames vinculados passam a usar os preços desta tabela, respeitando a vigência.', botao: 'Aplicar' });
  if (!ok) return;
  // preços: guarda o preço anterior quando muda (vigência futura continua usando o anterior)
  const precos = {}, semVig = MODELOS_APOIO[modeloDoApoio(ESTADO.setores[id])]?.semVigencia;
  Object.entries(an.itens).forEach(([k, it]) => {
    const old = antes[k];
    // modelo sem vigência no arquivo: preço igual mantém a data em que passou a valer
    if (semVig && old && old.preco === it.preco && old.vigencia) it = { ...it, vigencia: old.vigencia };
    precos[k] = { ...it };
    if (old && (old.preco !== it.preco || old.vigencia !== it.vigencia)) precos[k].anterior = { preco: old.preco, vigencia: old.vigencia || null };
    else if (old?.anterior && it.vigencia > hojeISO()) precos[k].anterior = old.anterior;
  });
  const vigs = Object.values(an.itens).map(i => i.vigencia).filter(Boolean).sort();
  const upd = {
    [`${CAMINHOS.apoios}/${id}/precos`]: precos,
    [`${CAMINHOS.apoios}/${id}/vigencia`]: vigs[Math.floor(vigs.length / 2)] || null,
    [`${CAMINHOS.apoios}/${id}/importadoEm`]: DB.agora(),
    [`${CAMINHOS.apoios}/${id}/importadoPor`]: u.nome,
    [`${CAMINHOS.apoios}/${id}/arquivo`]: an.arquivo,
    [`${CAMINHOS.apoios}/${id}/modelo`]: modeloDoApoio(ESTADO.setores[id])
  };
  let nv = 0;
  an.vinc.forEach(v => {
    if (v.st === 'auto' || (apo.comFortes && v.st === 'forte')) {
      upd[`${CAMINHOS.exames}/${v.e.id}/vinculoApoio`] = { apoioId: id, chave: v.k };
      upd[`${CAMINHOS.exames}/${v.e.id}/negociado`] = true;
      nv++;
    }
  });
  await DB.mesclar('/', upd);
  registrar('apoios', `Tabela ${ESTADO.setores[id].nome} importada: ${Object.keys(precos).length} itens, ${nv} novos vínculos`, { arquivo: an.arquivo });
  apo.resultado = `${num(Object.keys(precos).length, 0)} itens gravados · ${nv} novos vínculos · ${an.vinc.filter(v => v.st === 'vinculado').length} vínculos existentes atualizados`;
  apo.passo = 3; apo.cache = null;
  desenharApoioDet();
}

// ── Lista de vínculos ─────────────────────────────────────────
const VINC_POR_PAG = 40;
function htmlVinculos() {
  const itens = Object.fromEntries(Object.entries(ESTADO.apoios[apo.sel]?.precos || {}).map(([k, v]) => [k, { k, ...v }]));
  if (!apo.cache) apo.cache = classificarVinculos(apo.sel, itens);
  const cont = {}; apo.cache.forEach(v => { cont[v.st] = (cont[v.st] || 0) + 1; });
  const ls = apo.cache.filter(v => !apo.filtro || v.st === apo.filtro || (apo.filtro === 'pend' && !['vinculado'].includes(v.st)));
  const ordem = ['saiu', 'conf', 'auto', 'forte', 'fraca', 'sem', 'vinculado'];
  ls.sort((a, b) => ordem.indexOf(a.st) - ordem.indexOf(b.st) || a.e.mn.localeCompare(b.e.mn));
  const n = Math.max(1, Math.ceil(ls.length / VINC_POR_PAG)); if (apo.pag > n) apo.pag = n;
  const editar = pode('exames', 'editar') || pode('custos', 'editar');
  return `<div class="chips" style="padding-bottom:12px">
      <button class="chip ${!apo.filtro ? 'on' : ''}" onclick="apo.filtro='';apo.pag=1;desenharApoioDet()"><i class="fa-solid fa-list"></i>Todos <b>${apo.cache.length}</b></button>
      ${ordem.filter(k => cont[k]).map(k => `<button class="chip ${apo.filtro === k ? 'on' : ''}" onclick="apo.filtro='${k}';apo.pag=1;desenharApoioDet()"><i class="fa-solid ${VST[k].ic}"></i>${VST[k].t} <b>${cont[k]}</b></button>`).join('')}
    </div>
    <div class="tbl-wrap"><table><thead><tr><th>MN LAMIC</th><th>Exame LAMIC</th><th></th><th>Item do apoio</th><th>Descrição no apoio</th><th class="num">Preço</th><th>Situação</th><th></th></tr></thead><tbody>
    ${ls.slice((apo.pag - 1) * VINC_POR_PAG, apo.pag * VINC_POR_PAG).map(v => {
      // item trocado à mão na linha: vale no lugar da sugestão até confirmar
      const lin = v.e.id, tr = v.st !== 'vinculado' && itens[apo.troca[lin]];
      if (tr) v = { ...v, k: tr.k, it: tr, sc: similaridade(v.e.descricao, tr.descricao), manual: true };
      // exame LAMIC trocado à mão: o item da linha passa a ser oferecido a outro exame do setor
      const ex = v.st !== 'vinculado' && v.it && ESTADO.exames[apo.trocaEx[lin]];
      if (ex) v = { ...v, e: { ...ex, id: apo.trocaEx[lin] }, sc: similaridade(ex.descricao, v.it.descricao), manual: true };
      const podeTrocar = editar && v.st !== 'vinculado';
      const s = v.manual ? VST.manual : VST[v.st], it = v.it, p = v.st === 'vinculado' ? precoApoio(apo.sel, v.k) : null;
      return `<tr><td><span class="mn" style="cursor:pointer" onclick="abrirFicha('${v.e.id}')">${esc(v.e.mn)}</span>${podeTrocar && it ? `<span class="pop-mini" id="pop-ve-${lin}" data-ex="${lin}" data-tipo="ex" title="Trocar o exame LAMIC"></span>` : ''}</td><td class="desc" title="${esc(v.e.descricao)}">${esc(v.e.descricao)}</td>
        <td class="muted"><i class="fa-solid fa-arrows-left-right"></i></td>
        <td>${it ? `<span class="mn">${esc(it.codigo)}</span> <span class="tag">${esc(it.material || '—')}</span>` : '—'}${podeTrocar ? `<span class="pop-mini" id="pop-vt-${lin}" data-ex="${lin}" title="Trocar o item do apoio"></span>` : ''}</td>
        <td class="desc" title="${esc(it?.descricao || '')}">${it ? (v.st === 'conf' && !v.manual ? `<span style="color:var(--red)">${esc(it.descricao)}</span>` : esc(it.descricao)) : '<span class="muted">não encontrado</span>'}</td>
        <td class="num">${p ? fmt(p.valor) + (p.agendado ? ` <i class="fa-solid fa-clock" style="color:var(--amber)" title="${fmt(p.agendado.preco)} a partir de ${dataBR(p.agendado.vigencia)}"></i>` : '') : it ? fmt(it.preco) : '—'}</td>
        <td><span class="badge-s ${s.c}" title="${s.h}"><i class="fa-solid ${s.ic}"></i>${s.t}${v.sc != null && (v.manual || (v.st !== 'vinculado' && v.st !== 'auto')) ? ` ${Math.round(v.sc * 100)}%` : ''}</span></td>
        <td class="acts">${editar ? (v.st === 'vinculado'
          ? `<button title="Remover vínculo" onclick="definirVinculo('${v.e.id}', null)"><i class="fa-solid fa-link-slash"></i></button>`
          : `${v.manual ? `<button title="Desfazer a troca" onclick="delete apo.troca['${lin}'];delete apo.trocaEx['${lin}'];desenharApoioDet()"><i class="fa-solid fa-rotate-left"></i></button>` : ''}${v.k && (v.manual || v.st !== 'saiu') ? `<button title="Confirmar vínculo" onclick="definirVinculo('${v.e.id}', '${v.k}')"><i class="fa-solid fa-check"></i></button>` : ''}<button title="Escolher na ficha do exame" onclick="abrirFicha('${v.e.id}');setTimeout(()=>trocarFonteCusto('apoio'),80)"><i class="fa-solid fa-magnifying-glass"></i></button>`) : ''}</td></tr>`;
    }).join('') || `<tr><td colspan="8">${vazio('fa-link', 'Nada nesta situação')}</td></tr>`}
    </tbody></table></div>
    <div class="foot">${paginacao(ls.length, apo.pag, VINC_POR_PAG, 'paginaVinculos')}</div>`;
}
function paginaVinculos(p) { apo.pag = p; desenharApoioDet(); }

// Botão de troca em cada linha: popover com a tabela do apoio; a escolha fica na linha até confirmar
function popsVinculos() {
  document.querySelectorAll('#apoio-det .pop-mini').forEach(el => {
    delete POPS[el.id];
    const lin = el.dataset.ex, ex = el.dataset.tipo === 'ex', mapa = ex ? apo.trocaEx : apo.troca;
    criarPop(el.id, {
      rotulo: 'Trocar', titulo: ex ? 'Trocar o exame LAMIC' : 'Trocar o item do apoio', icone: 'fa-right-left', busca: ex ? 'Mnemônico ou nome…' : 'Código ou nome…', padrao: '',
      opcoes: () => [{ valor: '', rotulo: 'Escolha', icone: 'fa-right-left' }, ...(ex
        ? lista(ESTADO.exames, (a, b) => a.mn.localeCompare(b.mn)).filter(e => e.setorId === apo.sel && !e.vinculoApoio && e.id !== lin)
          .map(e => ({ valor: e.id, rotulo: `${e.mn} · ${e.descricao}`, icone: 'fa-vial' }))
        : lista(ESTADO.apoios[apo.sel]?.precos, (a, b) => String(a.codigo).localeCompare(b.codigo))
          .map(p => ({ valor: p.id, rotulo: `${p.codigo} · ${p.descricao}`, icone: 'fa-flask', desc: [p.material, fmt(p.preco)].filter(Boolean).join(' · ') })))].filter(o => o.valor || !popAberto),
      aoMudar: k => { if (k) mapa[lin] = k; else delete mapa[lin]; desenharApoioDet(); }
    });
  });
}

async function definirVinculo(exameId, chaveItem) {
  const e = ESTADO.exames[exameId], u = usuarioAtual();
  const upd = { vinculoApoio: chaveItem ? { apoioId: apo.sel, chave: chaveItem } : null, atualizadoEm: DB.agora(), atualizadoPor: u.nome };
  if (chaveItem) upd.negociado = true;
  await DB.mesclar(`${CAMINHOS.exames}/${exameId}`, upd);
  const it = chaveItem ? ESTADO.apoios[apo.sel]?.precos?.[chaveItem] : null;
  await DB.gravar(`historicoExames/${exameId}/${DB.novaChave('historicoExames')}`, {
    descricao: chaveItem ? `Vinculado ao item ${it?.codigo} (${it?.material || '—'}) do apoio` : 'Vínculo com o apoio removido', usuario: u.nome, usuarioId: u.id, em: DB.agora()
  });
  apo.cache = null;
  const lin = Object.keys(apo.trocaEx).find(k => apo.trocaEx[k] === exameId) || exameId;
  delete apo.troca[lin]; delete apo.trocaEx[lin];
  toast(chaveItem ? `${e.mn} vinculado` : `Vínculo de ${e.mn} removido`);
}
