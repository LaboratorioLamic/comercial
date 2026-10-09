// ═══════════════════════════════════════════════════════════════
// inicio.js — Tela inicial — COMERCIAL LAMIC
// ═══════════════════════════════════════════════════════════════

function renderInicio() {
  const u = usuarioAtual();
  const exames = examesVisiveis().filter(e => e.ativo !== false).map(e => ({ e, c: calcular(e) }));
  const comMargem = exames.filter(x => x.c.margem != null);
  const media = comMargem.length ? comMargem.reduce((s, x) => s + x.c.margem, 0) / comMargem.length : null;
  const cont = s => exames.filter(x => x.c.status === s).length;
  const div = exames.filter(x => pendenciasExame(x.e, x.c).includes('div')).length;
  const kpi = (icone, cor, fundo, rotulo, valor, sub, acao) => `
    <div class="card kpi ${acao ? 'clicavel' : ''}" ${acao ? `onclick="${acao}"` : ''}>
      <div class="kpi-l"><span class="ic" style="background:${fundo};color:${cor}"><i class="fa-solid ${icone}"></i></span>${rotulo}</div>
      <div class="kpi-v" style="${cor === 'var(--red)' && valor ? 'color:var(--red)' : ''}">${valor}</div><div class="kpi-s">${sub}</div></div>`;
  const irPend = k => pode('pendencias') ? `pendAba='${k}';pendPag=1;irPara('pendencias')` : '';

  // Margem média por setor (só setores com exames com margem)
  const porSetor = {};
  comMargem.forEach(x => { const s = ESTADO.setores[x.e.setorId]; if (!s) return; (porSetor[x.e.setorId] ??= []).push(x.c.margem); });
  const barras = Object.entries(porSetor).map(([id, ms]) => ({ s: ESTADO.setores[id], m: ms.reduce((a, b) => a + b, 0) / ms.length, n: ms.length }))
    .sort((a, b) => b.n - a.n).slice(0, 14).sort((a, b) => b.m - a.m);
  const escala = Math.max(0.8, ...barras.map(b => b.m));
  const pos = v => Math.max(0, Math.min(100, v / escala * 100));
  const mMin = parametro('margemMinima'), mAlvo = parametro('margemAlvo');

  const fases = [
    [1, 'Base', 'Layout, login e grupos, setores, parâmetros e custos fixos', true],
    [2, 'Exames', 'Cadastro, cálculo, ficha do exame, pendências e migração da planilha', true],
    [3, 'Custos e catálogo', 'Reagentes, Pardini 4114 com vínculos e vigência, catálogo e instruções', true],
    [4, 'Comercial', 'Tabelas de preço com perfil de custo, Lamic-to-Lab, laboratórios apoiados, propostas e aprovação', true],
    [5, 'Integração', 'Simulador pronto · falta CSV do sistema e painel completo'],
    [6, 'Finalização', 'Firebase Auth, regras de segurança, PDF e novos apoios']
  ];

  document.getElementById('s-inicio').innerHTML = `
    <div class="h-row"><div><h2>Olá, ${esc((u?.nome || '').split(' ')[0])}</h2><p>Imposto ${pct(parametro('imposto'))} · margem mínima ${pct(mMin)} · alvo ${pct(mAlvo)}</p></div>
      ${!exames.length && pode('importar', 'importar') ? `<button class="btn pri" onclick="irPara('importar')"><i class="fa-solid fa-file-import"></i>Migrar planilha</button>` : ''}</div>
    <div class="kpis">
      ${kpi('fa-percent', 'var(--cyan)', 'var(--cyan-light)', 'Margem média', media != null ? pct(media) : '—', `${num(comMargem.length, 0)} de ${num(exames.length, 0)} exames com custo e preço`, pode('exames') ? "irPara('exames')" : '')}
      ${kpi('fa-circle-xmark', 'var(--red)', 'var(--red-bg)', 'Abaixo do mínimo', cont('r'), `margem menor que ${pct(mMin)}`, irPend('min'))}
      ${kpi('fa-circle-question', 'var(--gray)', 'var(--gray-bg)', 'Sem custo', cont('x'), 'margem desconhecida', irPend('custo'))}
      ${kpi('fa-code-compare', 'var(--amber)', 'var(--amber-bg)', 'Divergência c/ sistema', div, 'praticado ≠ sistema', irPend('div'))}
    </div>
    <div class="grid2">
      <div class="card">
        <div class="card-h"><h3><i class="fa-solid fa-chart-simple"></i>Margem média por setor</h3><span>maiores setores</span></div>
        ${barras.length ? `<div class="bars">${barras.map(b => `
          <div class="bar-row" title="${esc(b.s.nome)} · ${b.n} exames"><span class="nm"><i class="fa-solid ${b.s.icone}" style="color:${b.s.cor}"></i> ${esc(b.s.nome)}</span>
            <div class="bar-track"><div class="bar-fill" style="width:${pos(b.m)}%;background:${b.m < mMin ? 'var(--red)' : b.m < (b.s.margemAlvo ?? mAlvo) ? 'var(--amber)' : 'var(--green)'}"></div>
              <div class="bar-min" style="left:${pos(mMin)}%"></div><div class="bar-alvo" style="left:${pos(mAlvo)}%"></div></div>
            <span class="bar-v">${pct(b.m)}</span></div>`).join('')}</div>
          <div class="legend"><span><b style="background:var(--red)"></b>Mínimo ${pct(mMin)}</span><span><b style="background:var(--green)"></b>Alvo ${pct(mAlvo)}</span></div>`
        : vazio('fa-chart-simple', 'Sem exames com custo e preço ainda')}
      </div>
      <div class="card">
        <div class="card-h"><h3><i class="fa-solid fa-road"></i>Andamento do projeto</h3><span>6 fases</span></div>
        <div class="fases">${fases.map(([n, t, d, ok]) => `
          <div class="fase ${ok ? 'ok' : ''}"><span class="fase-n">${ok ? '<i class="fa-solid fa-check"></i>' : n}</span>
            <div><b>Fase ${n} · ${t}</b><div class="s">${d}</div></div>${ok ? '<span class="badge-s ok">em uso</span>' : ''}</div>`).join('')}</div>
      </div>
    </div>`;
}
