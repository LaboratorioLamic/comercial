// ═══════════════════════════════════════════════════════════════
// estado.js — Estado em memória sincronizado com o Firebase
// ═══════════════════════════════════════════════════════════════
//
// Caminhos no banco:
//   config/parametros          parâmetros de cálculo
//   config/custosFixos/{id}    custos fixos (Atendimento, Sistemas…)
//   setores/{id}               setores com categoria, ícone, cor, etapas
//   exames/{chave}             exames (chave = mnemônico com / . # $ [ ] codificados)
//   historicoExames/{chave}/{id} alterações de cada exame
//   reagentes/{id}             reagentes e insumos (custo por teste)
//   apoios/{setorId}/precos/{código|material}  tabela importada do apoio (preço + vigência)
//   catalogo/{chave}           nome, material, prazo e instrução do exame (+ checklist de publicação)
//   tabelas/{id}               tabelas de preço (exceto Particular): nome, tipo, piso, perfil de custo,
//                              precos/{chave} preço do exame na tabela · sistema/{chave} preço no Unilab
//   laboratorios/{id}          laboratórios apoiados: dados + precos/{chave} valores diferenciados
//   propostas/{id}             alterações de preço enviadas para aprovação
//   config/hierarquia          hierarquia de valor: { definida, ordem: [idTabela…] } (Particular no topo)
//   config/modeloProposta      textos padrão do PDF da proposta para laboratório
//   simulacoes/{id}            propostas para laboratório salvas no simulador (preço × volume)
//   rascunhos/{alvo}/{usuario}/{chave}  edições ainda não enviadas (-1 = retirar da tabela)
//   auth/usuarios/{id}         usuários
//   auth/grupos/{id}           grupos e permissões
//   auth/cargos/{id}           cargos
//   auth/permitirCadastro      cadastro aberto (bool)
//   historico/{id}             registro de alterações

const ESTADO = {
  parametros: null,
  custosFixos: {},
  setores: {},
  exames: {},
  reagentes: {},
  apoios: {},
  tabelas: {},
  laboratorios: {},
  propostas: {},
  simulacoes: {},
  hierarquia: null,
  modeloProposta: null,
  catalogo: null,        // carregado sob demanda (textos de instrução são grandes)
  usuarios: {},
  grupos: {},
  cargos: {},
  permitirCadastro: true
};

const CAMINHOS = {
  parametros: 'config/parametros',
  custosFixos: 'config/custosFixos',
  setores: 'setores',
  exames: 'exames',
  reagentes: 'reagentes',
  apoios: 'apoios',
  tabelas: 'tabelas',
  laboratorios: 'laboratorios',
  propostas: 'propostas',
  simulacoes: 'simulacoes',
  hierarquia: 'config/hierarquia',
  modeloProposta: 'config/modeloProposta',
  usuarios: 'auth/usuarios',
  grupos: 'auth/grupos',
  cargos: 'auth/cargos',
  permitirCadastro: 'auth/permitirCadastro'
};

const _ouvintes = [];
const aoAtualizar = fn => _ouvintes.push(fn);

// Escuta todos os caminhos; resolve quando cada um respondeu ao menos uma vez
function sincronizarEstado() {
  return new Promise(resolve => {
    const faltam = new Set(Object.keys(CAMINHOS));
    Object.entries(CAMINHOS).forEach(([chave, caminho]) => {
      DB.ouvir(caminho, valor => {
        if (chave === 'permitirCadastro') ESTADO[chave] = valor !== false;
        else if (chave === 'parametros') ESTADO[chave] = valor;
        else ESTADO[chave] = valor || {};
        if (faltam.has(chave)) { faltam.delete(chave); if (!faltam.size) resolve(); }
        else _ouvintes.forEach(fn => fn(chave));
      });
    });
  });
}

// Catálogo/instruções: só é baixado quando alguma tela precisa
let _catalogoPromessa = null;
function garantirCatalogo() {
  if (_catalogoPromessa) return _catalogoPromessa;
  _catalogoPromessa = new Promise(resolve => {
    let primeiro = true;
    DB.ouvir('catalogo', v => {
      ESTADO.catalogo = v || {};
      if (primeiro) { primeiro = false; resolve(); }
      else _ouvintes.forEach(fn => fn('catalogo'));
    });
  });
  return _catalogoPromessa;
}

// Grava dados iniciais na primeira execução (banco vazio)
async function semearDados() {
  const tarefas = [];
  if (!ESTADO.parametros) tarefas.push(DB.gravar(CAMINHOS.parametros, PADRAO_PARAMETROS));
  if (!Object.keys(ESTADO.custosFixos).length) {
    const obj = {};
    PADRAO_CUSTOS_FIXOS.forEach(c => { obj[DB.novaChave(CAMINHOS.custosFixos)] = c; });
    tarefas.push(DB.gravar(CAMINHOS.custosFixos, obj));
  }
  if (!Object.keys(ESTADO.setores).length) {
    const obj = {};
    PADRAO_SETORES.forEach(s => {
      obj[DB.novaChave(CAMINHOS.setores)] = { etapas: { coleta: true, triagem: true }, ...s, margemAlvo: s.margemAlvo ?? null };
    });
    tarefas.push(DB.gravar(CAMINHOS.setores, obj));
  }
  await Promise.all(tarefas);
  // Setores de apoio anteriores ao campo modeloImportacao: Pardini recebe o modelo 4114
  const semModelo = lista(ESTADO.setores).filter(s => s.categoria === 'apoio' && s.modeloImportacao === undefined);
  if (semModelo.length) await DB.mesclar(CAMINHOS.setores, Object.fromEntries(semModelo.map(s => [`${s.id}/modeloImportacao`, /PARDINI/i.test(s.nome) ? 'pardini4114' : ''])));
  // Tabelas de preço: o perfil de custo usa os ids dos custos fixos
  if (!Object.keys(ESTADO.tabelas).length) {
    const fixos = lista(await DB.ler(CAMINHOS.custosFixos)), obj = {};
    PADRAO_TABELAS.forEach(({ perfilPorNome, ...t }) => {
      const perfil = {};
      Object.entries(perfilPorNome || {}).forEach(([nome, v]) => { const f = fixos.find(x => x.nome === nome); if (f) perfil[f.id] = v; });
      obj[DB.novaChave(CAMINHOS.tabelas)] = { ...t, ativa: true, perfil: Object.keys(perfil).length ? perfil : null };
    });
    await DB.gravar(CAMINHOS.tabelas, obj);
  }
}

// Registro de alterações
function registrar(entidade, descricao, detalhes = {}) {
  const u = usuarioAtual();
  return DB.gravar(`historico/${DB.novaChave('historico')}`, {
    entidade, descricao, detalhes,
    usuario: u ? u.nome : '—', usuarioId: u ? u.id : null,
    em: DB.agora()
  });
}

const parametro = chave => (ESTADO.parametros || PADRAO_PARAMETROS)[chave];
