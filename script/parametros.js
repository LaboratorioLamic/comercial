// ═══════════════════════════════════════════════════════════════
// parametros.js — Parâmetros de cálculo — COMERCIAL LAMIC
// ═══════════════════════════════════════════════════════════════

const CAMPOS_PARAM = [
  { id: 'imposto',              rotulo: 'Imposto sobre faturamento', icone: 'fa-landmark',     suf: '%', dica: '% do preço (Simples/ISS)' },
  { id: 'taxaMaquininha',       rotulo: 'Taxa da maquininha',        icone: 'fa-credit-card',  suf: '%', dica: 'só projeção: não entra no custo' },
  { id: 'margemMinima',         rotulo: 'Margem mínima',             icone: 'fa-shield-halved', suf: '%', dica: 'abaixo disso o exame fica vermelho' },
  { id: 'margemAlvo',           rotulo: 'Margem alvo',               icone: 'fa-bullseye',     suf: '%', dica: 'base do preço sugerido (setor pode ter a sua)' },
  { id: 'examesPorAtendimento', rotulo: 'Exames por atendimento',    icone: 'fa-divide',       suf: 'exames', dica: 'média; divide os custos fixos rateados' }
];
const ehPct = id => id !== 'examesPorAtendimento';

function renderParametros() {
  const editar = pode('params', 'editar');
  painelConfig().innerHTML = `<div class="card">
    <div class="sec-card-h"><span class="tc-ic" style="--c:var(--cyan)"><i class="fa-solid fa-sliders"></i></span><div><h3>Parâmetros de cálculo</h3><div class="sub">Valem para todos os exames. Setores podem ter margem alvo própria.</div></div></div>
    <div class="fgrid">${CAMPOS_PARAM.map(c => campo('pf-' + c.id, c.rotulo, ehPct(c.id) ? +(parametro(c.id) * 100).toFixed(2) : parametro(c.id),
      { suf: c.suf, icone: c.icone, dica: c.dica, aoMudar: 'previaParametros()', desab: !editar, passo: ehPct(c.id) ? '0.01' : '0.1' })).join('')}</div>
    <div style="padding:0 18px 18px"><div class="alert x" id="params-previa" style="margin:0"></div></div>
    ${editar ? `<div class="wz-f"><span class="muted" style="font-size:12px"><i class="fa-solid fa-clock-rotate-left"></i> Toda alteração fica registrada no histórico</span>
      <div style="display:flex;gap:8px"><button class="btn" onclick="renderParametros()">Descartar</button><button class="btn pri" onclick="salvarParametros()"><i class="fa-solid fa-floppy-disk"></i>Salvar parâmetros</button></div></div>` : ''}
  </div>`;
  previaParametros();
}

function lerParametros() {
  const p = {};
  for (const c of CAMPOS_PARAM) {
    const v = numCampo('pf-' + c.id);
    if (isNaN(v) || v < 0) return null;
    p[c.id] = ehPct(c.id) ? Math.round(v * 100) / 10000 : v;
  }
  return p;
}

// Exemplo do efeito dos parâmetros em um exame de custo conhecido
function previaParametros() {
  const p = lerParametros(), el = document.getElementById('params-previa');
  if (!p) { el.innerHTML = '<i class="fa-solid fa-circle-exclamation"></i><div>Valores inválidos.</div>'; return; }
  const soma = lista(ESTADO.custosFixos).reduce((s, f) => s + (f.cobranca === 'rateado' ? f.valor / Math.max(1, p.examesPorAtendimento) : f.valor), 0);
  const custoTeste = 8.51, custo = custoTeste + soma;              // ex.: E1 (ImmunoCAP)
  const div = 1 - p.imposto - p.margemAlvo, divMin = 1 - p.imposto - p.margemMinima;
  const sug = div > 0 ? Math.ceil(custo / div) : null, min = divMin > 0 ? Math.ceil(custo / divMin) : null;
  el.innerHTML = `<i class="fa-solid fa-calculator"></i><div><b>Exemplo:</b> exame com custo do teste ${fmt(custoTeste)} + custos fixos ${fmt(soma)} = ${fmt(custo)} →
    preço sugerido <b>${sug ? fmt(sug) : 'impossível (imposto + alvo ≥ 100%)'}</b> · mínimo viável <b>${min ? fmt(min) : '—'}</b>
    · na maquininha o lucro cai ${pct(p.taxaMaquininha, 2)} do preço.</div>`;
}

async function salvarParametros() {
  const p = lerParametros();
  if (!p) return toast('Corrija os valores inválidos', 'erro');
  if (p.imposto + p.margemAlvo >= 1) return toast('Imposto + margem alvo precisa ser menor que 100%', 'erro');
  if (p.margemMinima > p.margemAlvo) return toast('A margem mínima não pode ser maior que a alvo', 'erro');
  if (p.examesPorAtendimento < 1) return toast('Exames por atendimento precisa ser ao menos 1', 'erro');
  const antes = { ...ESTADO.parametros };
  const mudou = CAMPOS_PARAM.filter(c => antes[c.id] !== p[c.id]);
  if (!mudou.length) return toast('Nenhuma alteração', 'aviso');
  const ok = await confirmar({ titulo: 'Salvar parâmetros?', texto: `Alterações: ${mudou.map(c => c.rotulo.toLowerCase()).join(', ')}. O cálculo de todos os exames muda.`, botao: 'Salvar' });
  if (!ok) return;
  await DB.gravar(CAMINHOS.parametros, p);
  registrar('parametros', 'Parâmetros de cálculo alterados', { antes, depois: p });
  toast('Parâmetros salvos');
}
