// ═══════════════════════════════════════════════════════════════
// calc.js — Regras de cálculo de custo, margem e preço
// ═══════════════════════════════════════════════════════════════
//
// custoTotal = custoTeste + custos fixos aplicáveis + custos adicionais
// lucro      = preço − custoTotal − imposto        (imposto = preço × %)
// margem     = lucro ÷ preço
// sugerido   = ⌈ custoTotal ÷ (1 − imposto − margemAlvo) ⌉
// mínimo     = ⌈ custoTotal ÷ (1 − imposto − margemMínima) ⌉
// maquininha = projeção: lucro − preço × taxa (não entra no custo)

// Chave segura para o Realtime Database (mnemônicos podem ter "/" ou ".")
const chaveExame = mn => String(mn).trim().replace(/[.#$\[\]\/%]/g, c => '%' + c.charCodeAt(0).toString(16).toUpperCase());

const STATUS = {
  r: { nome: 'Abaixo do mínimo', icone: 'fa-circle-xmark',       cor: 'var(--red)' },
  a: { nome: 'Abaixo do alvo',   icone: 'fa-circle-exclamation', cor: 'var(--amber)' },
  g: { nome: 'Saudável',         icone: 'fa-circle-check',       cor: 'var(--green)' },
  x: { nome: 'Sem custo',        icone: 'fa-circle-question',    cor: 'var(--gray)' },
  p: { nome: 'Sem preço',        icone: 'fa-circle-minus',       cor: 'var(--gray)' }
};
const tagSt = (cls, icone, nome) => `<span class="st ${cls}" title="${nome}"><i class="fa-solid ${icone}"></i><span class="st-t">${nome}</span></span>`;
const tagStatus = s => tagSt(s, STATUS[s].icone, STATUS[s].nome);

// Preço abaixo de R$ 1,00 é simbólico (reanálise, cortesia…): fica fora das simulações
// e dos cálculos de variação e desconto médio
const PRECO_MIN_VARIACAO = 1;
const precoSimbolico = p => p != null && p < PRECO_MIN_VARIACAO;

// Etapas: ajuste do exame > padrão do setor > passa por todas
function etapasExame(e) {
  const s = ESTADO.setores[e.setorId];
  return {
    coleta:  e.etapas?.coleta  ?? s?.etapas?.coleta  ?? true,
    triagem: e.etapas?.triagem ?? s?.etapas?.triagem ?? true
  };
}

// perfil (opcional, da tabela de preço): { idCustoFixo: false (não cobra) | valor próprio }
function fixosExame(e, perfil = null) {
  const et = etapasExame(e), n = Math.max(1, parametro('examesPorAtendimento'));
  return lista(ESTADO.custosFixos, (a, b) => (a.ordem ?? 99) - (b.ordem ?? 99))
    .map(f => {
      const p = perfil?.[f.id], valor = typeof p === 'number' ? p : f.valor;
      return { ...f, valor, foraPerfil: p === false, aplica: p !== false && (!f.etapa || et[f.etapa] !== false), v: f.cobranca === 'rateado' ? valor / n : valor };
    });
}

// ── Custo do teste ────────────────────────────────────────────
// Prioridade: vínculo com tabela do apoio > reagente > valor manual
const hojeISO = () => new Date().toISOString().slice(0, 10);
// "24/09/2026" ou "2026-09-24" → "2026-09-24"
const dataISO = s => { s = String(s || '').trim(); const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/); return m ? `${m[3]}-${m[2]}-${m[1]}` : s.slice(0, 10); };
const dataBR = iso => iso && /^\d{4}-\d{2}-\d{2}/.test(iso) ? iso.slice(8, 10) + '/' + iso.slice(5, 7) + '/' + iso.slice(0, 4) : (iso || '—');

// Preço vigente de um item da tabela do apoio (vigência futura → vale o anterior)
function precoApoio(apoioId, chave) {
  const p = ESTADO.apoios?.[apoioId]?.precos?.[chave];
  if (!p) return null;
  if (p.vigencia && p.vigencia > hojeISO() && p.anterior) return { ...p, valor: p.anterior.preco, vigencia: p.anterior.vigencia, agendado: { preco: p.preco, vigencia: p.vigencia } };
  return { ...p, valor: p.preco };
}

const custoPorTeste = r => {
  const uteis = (r.testesPorKit || 0) * (1 - (r.perdas || 0) / 100) - (r.controles || 0);
  return uteis > 0 ? r.precoKit / uteis : null;
};

function custoTesteExame(e) {
  if (e.vinculoApoio) {
    const p = precoApoio(e.vinculoApoio.apoioId, e.vinculoApoio.chave);
    if (p) return { valor: p.valor, origem: 'apoio', ref: p };
  }
  if (e.reagenteId && ESTADO.reagentes[e.reagenteId]) {
    const r = ESTADO.reagentes[e.reagenteId], v = custoPorTeste(r);
    if (v != null) return { valor: v * (e.qtdReagente || 1), origem: 'reagente', ref: r };
  }
  return e.custoTeste != null ? { valor: e.custoTeste, origem: e.custoOrigem || 'manual' } : null;
}
// Pardini: negociado = vinculado à tabela 4114; demais apoios: marcação manual
const negociadoExame = e => e.vinculoApoio ? true : !!e.negociado;

const extrasExame = e => (Array.isArray(e.extras) ? e.extras : Object.values(e.extras || {})).filter(x => x && x.valor > 0);
const alvoExame = e => ESTADO.setores[e.setorId]?.margemAlvo ?? parametro('margemAlvo');

// ── Regras por faixa de custo total ───────────────────────────
// Piso de margem, desconto de referência e sugestão de margem são um valor único ou progressivos:
//   faixas/{campo} = [{ ate: 100, v: .20 }, { ate: 500, v: .15 }, { v: .10 }]
// (a primeira começa em 0; a última, sem "ate", vale para todo custo acima do limite anterior).
// tab = tabela de preço; sem tabela vale a configuração própria da Particular (config/particular).
const PADRAO_REGRA = { piso: () => parametro('margemMinima'), descontoRef: () => 0, margemSugerida: () => null };
const faixasDe = (o, campo) => { const f = o?.faixas?.[campo]; return f ? Object.values(f).filter(Boolean) : []; };
function regraTab(tab, campo, custo = null) {
  const o = tab || ESTADO.particular || {}, padrao = o[campo] ?? PADRAO_REGRA[campo]();
  const fx = faixasDe(o, campo);
  if (!fx.length || custo == null) return padrao;
  return (fx.find(f => f.ate == null || custo <= f.ate) || fx[fx.length - 1]).v ?? padrao;
}
// "20%" ou, com faixas, "10% a 20% progressivo"
function textoRegra(tab, campo, casas = 0) {
  const fx = faixasDe(tab || ESTADO.particular, campo).map(f => f.v).filter(v => v != null), v = regraTab(tab, campo);
  if (fx.length > 1) { const a = Math.min(...fx), b = Math.max(...fx); return a === b ? pct(a, casas) : `${pct(a, casas)} a ${pct(b, casas)} progressivo`; }
  return v != null ? pct(v, casas) : '—';
}
// Margem alvo da Particular: setor com alvo próprio > configuração da Particular > parâmetro geral
const textoAlvoParticular = () => regraTab(null, 'margemSugerida') != null ? textoRegra(null, 'margemSugerida', 1) : pct(parametro('margemAlvo'));

// tab (opcional): tabela de preço → usa o perfil de custo e as regras de margem dela
function calcular(e, preco = e.precoPraticado, tab = null) {
  const fx = fixosExame(e, tab?.perfil), extras = extrasExame(e);
  const fixo = fx.filter(f => f.aplica).reduce((s, f) => s + f.v, 0);
  const somaExtras = extras.reduce((s, x) => s + x.valor, 0);
  const imp = parametro('imposto'), ct = custoTesteExame(e), custo = ct ? ct.valor + fixo + somaExtras : null;
  const min = regraTab(tab, 'piso', custo);
  const alvo = tab ? alvoExame(e) : ESTADO.setores[e.setorId]?.margemAlvo ?? regraTab(null, 'margemSugerida', custo) ?? parametro('margemAlvo');
  // min, descRef e margemSug: regras da tabela já resolvidas para a faixa de custo deste exame
  const r = { fx, extras, fixo, somaExtras, alvo, min, descRef: regraTab(tab, 'descontoRef', custo), margemSug: regraTab(tab, 'margemSugerida', custo),
    preco: preco || null, teste: ct, semCusto: !ct };
  if (r.semCusto) { r.status = 'x'; return r; }
  r.custo = custo;
  r.sugerido = 1 - imp - alvo > 0 ? Math.ceil(r.custo / (1 - imp - alvo)) : null;
  r.minimo = 1 - imp - min > 0 ? Math.ceil(r.custo / (1 - imp - min)) : null;
  if (!preco) { r.status = 'p'; return r; }
  r.imposto = preco * imp;
  r.lucro = preco - r.custo - r.imposto;
  r.margem = r.lucro / preco;
  r.taxaCartao = preco * parametro('taxaMaquininha');
  r.lucroCartao = r.lucro - r.taxaCartao;
  r.margemCartao = r.lucroCartao / preco;
  // Tabelas de preço só têm piso: abaixo dele ou OK
  r.status = r.margem < min ? 'r' : tab || r.margem >= alvo ? 'g' : 'a';
  return r;
}

// Composição do custo total (dica ao passar o mouse e célula das listas)
function composicaoCusto(c) {
  if (c.semCusto) return '';
  const partes = [`Teste ${fmt(c.teste.valor)}`, ...c.fx.filter(f => f.aplica).map(f => `${f.nome} ${fmt(f.v)}`), ...c.extras.map(x => `${x.nome} ${fmt(x.valor)}`)];
  return `${partes.join(' + ')} = ${fmt(c.custo)}`;
}
const celulaCusto = c => c.semCusto ? '—'
  : `<span title="${esc(composicaoCusto(c))}">${fmt(c.custo)}</span><div class="sub-num">teste ${fmt(c.teste.valor)}</div>`;

// Pendências de um exame (usadas na tela Pendências e nos ícones da lista)
const PENDENCIAS = {
  custo:  { nome: 'Sem custo',           icone: 'fa-circle-question',          desc: 'Sem custo do teste: margem desconhecida.' },
  setor:  { nome: 'Sem setor',           icone: 'fa-tags',                     desc: 'Exame sem setor definido.' },
  preco:  { nome: 'Sem preço',           icone: 'fa-circle-minus',             desc: 'Exame sem preço praticado.' },
  sist:   { nome: 'Fora do sistema',     icone: 'fa-plug-circle-xmark',        desc: 'Mnemônico não encontrado no sistema do laboratório, ou não efetuado pela tabela Particular (efetua = N no Unilab).' },
  div:    { nome: 'Divergência de preço', icone: 'fa-code-compare',            desc: 'Preço praticado diferente do cadastrado no sistema do laboratório.' },
  hier:   { nome: 'Quebra hierarquia',   icone: 'fa-stairs',                   desc: 'Preço de uma tabela acima de outra que deveria ser maior (Particular ≥ Cartões ≥ … ; tabelas fora da hierarquia ≤ Particular). Ajuste em Tabelas de preço → Hierarquia.' },
  aud:    { nome: 'A auditar',           icone: 'fa-magnifying-glass-dollar',  desc: 'Valores marcados para auditoria interna.' },
  min:    { nome: 'Abaixo do mínimo',    icone: 'fa-circle-xmark',             desc: 'Margem abaixo da mínima: revise preço ou custo.' }
};
function pendenciasExame(e, c = calcular(e)) {
  const p = [];
  if (e.ativo === false) return p;
  if (c.semCusto) p.push('custo');
  if (!e.setorId || !ESTADO.setores[e.setorId]) p.push('setor');
  if (!e.precoPraticado) p.push('preco');
  if (e.foraDoSistema || e.inativoNoSistema) p.push('sist');
  if (e.precoSistema != null && e.precoPraticado && Math.abs(e.precoSistema - e.precoPraticado) > 0.004) p.push('div');
  if (e.id && quebrasHierarquia(e.id).length) p.push('hier');
  if (e.auditar) p.push('aud');
  if (c.status === 'r') p.push('min');
  return p;
}

// Setores que o usuário atual pode ver ('todos' ou lista de ids)
function exameVisivel(e) {
  const u = usuarioAtual();
  if (!u || u.admin || u.setores === 'todos' || !Array.isArray(u.setores)) return true;
  return u.setores.includes(e.setorId);
}
const examesVisiveis = () => lista(ESTADO.exames).filter(exameVisivel);
