# COMERCIAL LAMIC — Plano do sistema

Versão 1.0 · 09/10/2026 · Prévia navegável: `previa-precificacao.html`

## 1. Objetivo

Ambiente comercial para precificar os exames do LAMIC, substituindo a planilha
"LAMIC - Comercial - Preços" (aba PARTICULAR e tabelas derivadas). O sistema calcula
o custo real de cada exame, mostra a margem, sugere preços, permite a edição manual
das tabelas de preço e troca arquivos com o sistema do laboratório e com o apoio
Hermes Pardini.

## 2. Tecnologia

| Item | Decisão |
|---|---|
| Front-end | HTML, CSS e JavaScript puros (mesmo padrão do Manutenção LAMIC) |
| Banco | Firebase Realtime Database (projeto próprio) |
| Hospedagem | GitHub Pages |
| Login e grupos | Modelo do `key.js` do Manutenção, base de usuários **separada** |
| Segurança | Mantida como no Manutenção durante o desenvolvimento; Firebase Auth + Security Rules na fase final |
| Ícones | Font Awesome 6.5.2 (`fa-solid`) |
| Fontes | DM Sans (texto) e DM Mono (valores e mnemônicos) |

Organização prevista dos arquivos: `index.html`, `style.css`, `bd.js` (Firebase),
`key.js` (login/grupos), `calc.js` (regras de cálculo), `popover.js`, e um arquivo por
módulo (`exames.js`, `custos.js`, `tabelas.js`, `importar.js`, `simulador.js`,
`pendencias.js`, `config.js`).

## 3. Identidade visual

- Mesma identidade do Manutenção LAMIC: menu lateral azul-noite `#0e1628`, destaque
  ciano `#00a8cc`, fundo `#f4f7f6`, cards brancos, raio 8–12 px, modo noturno.
- Status: vermelho `#e63946` (abaixo do mínimo), âmbar `#e8913a` (abaixo do alvo),
  verde `#2a9d8f` (saudável), cinza `#94a3b8` (sem custo).
- Listas suspensas substituídas por **popovers**: rótulo + valor, busca, grupos, ícone
  colorido, contagem, teclado (↑ ↓ Enter Esc), abre para cima quando falta espaço e vira
  painel inferior (bottom sheet) no celular.
- Detalhes abrem em **gaveta lateral**; confirmações em **toast**.
- Layout responsivo (menu recolhe no celular).

## 4. Módulos

### 4.1 Login
Tela igual à do Manutenção (usuário, senha, criar conta). Primeiro acesso cria o admin.

### 4.2 Início — painel completo ✔
Oito indicadores clicáveis (margem média, abaixo do mínimo, sem custo, divergência com o
Unilab em todas as tabelas, propostas pendentes, quebra de hierarquia, abaixo do alvo, a
auditar); barra de situação dos exames; margem por setor (linhas de mínimo e alvo);
pendências por categoria; resumo de cada tabela de preço (exames, margem média, abaixo do
piso, diferentes do Unilab, propostas) e as últimas alterações do sistema (`historico/`).

### 4.3 Exames
- Tabela com busca, filtros (setor, origem) e filtros rápidos por status.
- Ícones na linha: 🔍 a auditar, 🤝 apoio negociado, divergência com o sistema.
- Ficha do exame (gaveta) em sub-abas:
  - **Valores** (primeira): sugerido, praticado, composição do preço, preço em cada
    tabela (editável: alterar, incluir ou retirar), aviso de quebra da hierarquia,
    propostas pendentes do exame e justificativa. Alterar preço troca o rodapé para
    "Enviar p/ aprovação" ou "Aprovar e publicar": uma proposta por tabela alterada.
  - **Custos**: custo do teste (manual, reagente, tabela do apoio), cascata com
    projeção na maquininha, custos adicionais e etapas do atendimento.
  - **Controles**: negociado, a auditar, fora do sistema.
  - **Instruções** e **Histórico**.

### 4.4 Custos
- **Reagentes e insumos**: preço do kit, testes por kit, perdas %, controles; custo por
  teste calculado; impacto da alteração nos exames vinculados.
- **Custos fixos**: Atendimento (J), Sistemas (K), Coleta (L), Triagem (M), Analista (O).
  Cada um pode ser **linear** (valor cheio em cada exame, padrão) ou **rateado** por
  atendimento. Coleta e Triagem só entram se o exame passa pela etapa.
- **Laboratórios de apoio**: card por laboratório, tabela de vínculos de mnemônicos e
  prévia da importação.

### 4.5 Tabelas de preço (ambiente comercial) — fase 4 ✔
- Particular (base, = preço praticado do exame), Cartões de Desconto, Funerária Vida,
  AFAGU, LAMIC VIVA+, Particular 02 e Lamic-to-Lab. SOLUMEDI removida. Novas tabelas
  podem ser criadas (vazia, Particular com desconto ou cópia de outra).
- As abas da planilha mostraram que **não há regra fixa**: cada tabela tem um **preço
  próprio por exame** (580 a 801 exames) e o desconto varia exame a exame. O "desconto de
  referência" (célula A2 da aba) vira só atalho de edição.
- Cada tabela tem **piso de margem** (W3 da aba: 20/20/18/18/16%; L2L 15%) e **perfil de
  custo** (por custo fixo: padrão, não cobra ou valor próprio).
- **Edição manual em cada linha** com custo do perfil, margem e situação ao vivo; ações
  por linha (sugerido, Particular − desconto, levar ao piso, desfazer, retirar da tabela);
  ações em lote (reajuste %, desconto %, piso, arredondar, retirar, desfazer); filtros
  (na tabela, fora, abaixo do piso, sem custo, diverge do Unilab, no rascunho); teclado.
- Edições ficam no **rascunho do usuário** (gravado no banco) e são enviadas como
  **proposta** com justificativa opcional. Quem
  tem "Aprovar" pode publicar direto. Aprovar grava os preços e o histórico de cada exame;
  rejeitar exige motivo; o autor pode cancelar ou "editar de novo".
- Importação por tabela: aba da planilha (.csv, coluna 💲 FINAL + bloco do Unilab ao lado)
  ou CSV do Unilab (preço publicado). Exportação no formato do Unilab.

### 4.5.1 Hierarquia de valor entre tabelas
Ordem configurável (Tabelas de preço → Hierarquia): Particular ≥ Cartões de Desconto ≥
Funerária Vida ≥ AFAGU ≥ LAMIC VIVA+ (padrão). Cada tabela da hierarquia não pode passar
do menor preço das que estão acima dela (exame sem preço numa tabela é pulado; igual é
permitido). Tabelas ativas fora da hierarquia (Particular 02, Lamic-to-Lab…) só precisam
ficar ≤ Particular. Laboratórios apoiados não entram. A aba lista os exames que quebram a
regra (preço em vermelho, exportação CSV, atalho para corrigir na grade); a grade tem o
filtro "Quebra hierarquia" e um aviso na linha que considera o rascunho; Pendências ganha
a categoria "Quebra hierarquia" (preços salvos).

### 4.6 Simulador — fase 5 ✔
- **Reajuste de tabela**: qualquer tabela (Particular, tabelas de preço, laboratórios
  apoiados), escopo por setor, aplicar em todos ou só abaixo do piso. Tipos: percentual
  (−20% a +50%), levar ao piso/mínimo, margem desejada, sugerido (só Particular) e desconto
  sobre a referência (tabelas e laboratórios). Arredondamento (centavos, R$ 1, 5, 10, para
  cima) e "não reduzir preços". Mostra exames alterados, variação média, margem média
  antes/depois, abaixo do piso antes/depois e quantos saem do vermelho. O resultado vai ao
  rascunho do usuário (somado ao que já existe, com confirmação) ou direto para o envio da
  proposta; segue o fluxo normal de aprovação.
- **Proposta para laboratório** (antiga aba 01.LAB): tabela de referência (perfil de custo
  e piso), laboratório cadastrado ou prospecção, preço inicial (valor da tabela, desconto %
  ou sugestão de margem), preço editável e volume mensal por exame, filtro por prazo de
  liberação (24h, 48h, 96h, 5 e 30 dias, pelo catálogo) e setor. Mostra exames, volume,
  receita, lucro e margem ponderada por volume, viabilidade pelo piso. Salva em
  `simulacoes/`, exporta CSV e, com laboratório cadastrado, leva os preços ao rascunho dele.
- **PDF da proposta** (jsPDF + autoTable, carregados sob demanda; logo em `img/logo-lamic.png`):
  cabeçalho com logo, nº da proposta e emissão; cartão do destinatário (razão social, CNPJ,
  A/C) com nº, emissão e validade; texto de apresentação; resumo (exames, volume mensal,
  investimento mensal); relação de exames agrupada por setor (todos os setores de apoio
  saem num grupo só, "Diversos", sem o nome do parceiro); sem volume (0) o PDF vira um
  relatório só de valores brutos, sem receita nem dados mensais (exames com preço
  digitado ou, sem nenhum, a lista filtrada na tela); encerramento, local/data e assinatura;
  rodapé com contato, validade e paginação. Custo, margem e lucro nunca saem no PDF.
- **Texto padrão** em `config/modeloProposta` (vale para todos; botão "Texto padrão" no
  simulador). Cada proposta pode personalizar os textos; a simulação guarda só o que difere
  do padrão, então o resto acompanha mudanças futuras do padrão.

### 4.7 Pendências
Sem custo · Sem setor · Fora do sistema · Divergência de preço · A auditar ·
Sem vínculo no apoio · Abaixo do mínimo.

### 4.8 Importar / Exportar
Nada é gravado antes da conferência.
- **Migração da planilha** (aba PARTICULAR).
- **Sincronizar com o Unilab** ✔: vários CSVs de uma vez (Particular e demais tabelas). Cada
  arquivo é ligado à tabela pelo nome (`PARTICULAR.csv`, `CARTOES_DE_DESCONTO.csv`…), com
  ajuste manual. Mostra por arquivo: linhas, preços conferidos, diferentes, só no Unilab e
  fora do arquivo. Grava o preço no Unilab de cada tabela; na Particular também efetua S/N,
  exames novos e fora do sistema. Preço diferente: manter o do LAMIC (fica como divergência)
  ou levar o do Unilab ao rascunho de cada tabela. Opção de incluir nas tabelas os exames
  que só têm preço no Unilab. Relatório de divergências (CSV) de todas as tabelas.
- **PDF da tabela** ✔ (botão PDF em cada tabela e laboratório): preços publicados, agrupado
  por setor (apoio = "Diversos"), material e prazo opcionais, título e observação, só os
  exames filtrados na tela se desejado. Mesmo visual do PDF da proposta; sem custo nem margem.
- Exportação no formato do Unilab por tabela.

### 4.9 Configurações
- **Usuários**: busca, filtro por grupo, cadastro aberto liga/desliga, ativo/inativo,
  setores visíveis, redefinir senha.
- **Grupos e permissões**: matriz módulo × ver/criar/editar/excluir/aprovar/importar/
  exportar; Admin travado; grupo padrão para novos usuários.
- **Apoiados (L2L)**: login e senha dos laboratórios apoiados no site L2L (4.12). Lista os
  mesmos laboratórios de Tabelas de Preço → Laboratórios apoiados, mais o acesso interno
  (Laboratório LAMIC). Senha cifrada (sal + SHA-256), gerar senha, ativar/bloquear, remover,
  último acesso. Importação dos logins do L2L antigo (`info.json`).
- **Parâmetros**: imposto, taxa da maquininha (só projeção), margem mínima, margem alvo,
  exames por atendimento; mostra impacto antes de salvar; alteração passa por aprovação.
- **Setores**: cadastro e edição com nome, categoria (interno / serviço / apoio), cor
  (paleta de 12 + personalizada), ícone (paleta de 52 com busca), etapas padrão e
  margem alvo própria. Exclusão só sem exames vinculados.

### 4.10 Instruções (catálogo do exame)
Prazo de liberação: cadastrado só em **dias** (`prazoDias`); 0 = "24 Horas", 1 = "1 dia",
n = "n dias". O texto livre foi removido dos formulários; o texto importado da planilha só
aparece enquanto o exame não tiver os dias preenchidos.

Fonte: planilha "BD - TABELAS CH PARTICULARES", aba Exames (CSV). Colunas A–E: mnemônico,
material biológico, nome, prazo em dias e prazo em texto. Colunas H–L (tabela separada,
ligada pelo mnemônico): checklist Site / Unilab / Revisado, espelho do mnemônico e a
instrução. Tela com progresso de publicação, filtros (sem instrução, não revisado, falta no
site, falta no Unilab, sem cadastro, sem nome), edição do texto e do checklist (quem marcou
e quando). Alterar o texto desmarca "Revisado". A ficha do exame mostra material, prazo,
resumo da instrução e o checklist.

**Anexos**: cada instrução tem uma lista de anexos (nome + link) editada na gaveta. É o
único lugar de onde o L2L tira os links clicáveis. Links escritos no texto no formato da
planilha (`<a href="…">nome</a>`, sob o título "🔗 Anexos") viram anexos: na importação da
planilha, pelo botão "Converter links do texto" do editor ou em lote pelo aviso da tela.

### 4.11 Lamic-to-Lab e laboratórios apoiados — fase 4 ✔
Tabela para laboratórios que o LAMIC atende (planilha "Tabela LAMIC-TO-LAB", aba L2L BASE):
- **Preço próprio por exame, sem regra** (coluna G "Cheia"). Coluna H = valor já publicado
  no Unilab (vira "preço no Unilab"). Coluna I "Proposta" entra no rascunho de quem importa.
- **Perfil de custo próprio**: sem Atendimento e sem Coleta (amostra chega coletada),
  Sistemas R$ 0,50, Triagem R$ 0,12, Analista R$ 0,52; piso 15%.
- **Laboratórios apoiados** (cadastro): nome, razão social, CNPJ, código do convênio,
  tabela de referência, ativo e observações. Cada laboratório tem **valores diferenciados**
  por exame (lançados manualmente no Unilab), editados na mesma grade, com margem pelo
  perfil da L2L, desconto sobre a L2L, rascunho e proposta. Migração da aba Negociados
  (272 valores, 7 laboratórios). Exportação da lista por laboratório (CSV).
- Simulador de proposta para laboratório (volume × preço, filtro por prazo) — aba 01.LAB:
  no Simulador (4.6).

## 5. Regras de cálculo

```
custoTeste   = reagente: precoKit ÷ (testesPorKit × (1 − perdas) − controles)
               apoio Pardini negociado: preço vigente da tabela 4114
               demais: custo manual
custoFixo    = Σ custos fixos aplicáveis ao exame
               (linear → valor; rateado → valor ÷ examesPorAtendimento)
               Coleta/Triagem só se o exame passa pela etapa
custoTotal   = custoTeste + custoFixo + Σ custos adicionais manuais (ex.: aplicação)
imposto      = preço × 8,1%
lucro        = preço − custoTotal − imposto
margem       = lucro ÷ preço
sugerido     = ⌈ custoTotal ÷ (1 − imposto − margemAlvo) ⌉
mínimo       = ⌈ custoTotal ÷ (1 − imposto − margemMínima) ⌉
maquininha   = projeção: lucro − preço × 2,29% (não entra no custo)
```

- Etapas do exame: ajuste do exame > padrão do setor > passa por todas.
- Margem alvo: do setor (ex.: Vacinas 30%) ou global (50%). Mínima: 24,5%.
- Status: ⚪ sem custo · 🔴 margem < mínimo · 🟡 margem < alvo · 🟢 margem ≥ alvo.
- Tabela derivada: preço = exceção ?? arredondar(Particular × (1 − desconto));
  sinaliza "abaixo do piso" quando margem < piso da tabela.
- Médias são simples (sem volume; a aba 0Reajuste foi descartada).
- Preço abaixo de R$ 1,00 é simbólico: fica fora do reajuste simulado, não serve de
  referência na proposta para laboratório e não entra na variação nem no desconto médio.

### 4.12 Site L2L (LAMIC Apoiados) — repositório `L2L`
Página única (`index.html`, mesma identidade visual) onde o laboratório apoiado consulta a
própria tabela. Não usa mais a planilha: lê o banco do Comercial.
- **Login**: escolhe o laboratório e informa a senha (`l2l/acessos`); 5 erros → espera de
  10 s; sessão de 30 dias, derrubada se a senha for redefinida ou o acesso bloqueado.
- **Tabela**: exames da tabela de referência do laboratório + valores diferenciados (que
  substituem o valor da tabela). Mnemônico, nome, material, prazo e valor; busca sem
  acento/pontuação, filtros por material e prazo, negociados, com instrução, com anexos.
- **Detalhe do exame**: valor, instrução (texto puro) e anexos clicáveis.
- **Acesso interno** (Laboratório LAMIC): tabela escolhida em Configurações e proposta em PDF.
- Lê: `l2l/acessos`, `laboratorios/{id}`, `tabelas/{tabelaId}`, `exames` (ativo, nome),
  `catalogo` (nome, material, prazo, instrução, anexos). Grava só `ultimoAcesso`.

## 6. Estrutura de dados (Firebase)

```
config/parametros      imposto, taxaMaquininha, margemMinima, margemAlvo, examesPorAtendimento
config/custosFixos/{id} nome, colunaOrigem, valor, cobranca (linear|rateado), etapa (null|coleta|triagem)
setores/{id}            nome, categoria (interno|servico|apoio), icone, cor,
                        etapas {coleta, triagem}, margemAlvo?
reagentes/{id}          nome, fornecedor, precoKit, testesPorKit, perdas, controles (outros testes gastos), diasKit,
                        calId, calPontos, calDias, ctrlId, ctrlNiveis, ctrlCorridasDia, atualizadoEm
insumosCQ/{id}          tipo ('cal'|'ctrl'), nome, fornecedor, preco, niveis, rende (usos por embalagem), atualizadoEm
apoios/{id}             nome, modeloImportacao (pardini4114|null), ultimaVigencia
apoios/{id}/precos/{codigo|material}  descricao, material, preco, vigencia, historico[]
apoios/{id}/vinculos/{codigo|material} mnemonicosLamic[], status
exames/{mn}             descricao, setorId, ativo, material, prazo, origem (interno|apoio),
                        reagenteId?, apoioId?, codigoApoio?, negociado, custoManual?,
                        etapas?, custosExtras[{nome, valor}], auditar,
                        precoPraticado, precoSistema, justificativa
tabelas/{id}            nome, tipo (convenio|lab), icone, cor, ordem, ativa, descontoRef, piso,
                        perfil {idCustoFixo: false | valor}, precos {chave: preço},
                        sistema {chave: preço no Unilab}, importadoEm, arquivo
laboratorios/{id}       nome, razaoSocial, cnpj, codConvenio, tabelaId, ativo, obs,
                        precos {chave: valor diferenciado}
l2l/acessos/{id}        id = id do laboratório | 'lamic' (interno): nome, sal, hash, ativo,
                        interno, tabelaId (interno), atualizadoEm/Por, ultimoAcesso
catalogo/{chave}        mn, nome, material, prazoDias, instrucao, anexos [{nome, url}],
                        site, unilab, revisado (+ quem e quando)
rascunhos/{alvo}/{usuario}  {chave: preço | -1 (retirar)}   alvo = particular | idTabela | lab:id
propostas/{id}          alvo, alvoNome, itens {chave: {mn, de, para}}, n, justificativa,
                        autor, em, status (pendente|aprovada|rejeitada|cancelada),
                        decisao {por, em, motivo}
config/hierarquia       definida, ordem [idTabela…] (Particular implícita no topo)
config/modeloProposta   apresentacao, encerramento, assinatura, cargo, rodape, validade
simulacoes/{id}         tipo 'lab', nome, labId, tabelaId, base (tab|desc|msug), d,
                        itens {chave: {p: preço digitado, v: volume/mês}}, resumo, autor, em
historico/{id}          entidade, campo, antes, depois, usuario, data, origem (manual|importação)
auth/                   users, groups, cargos (modelo key.js)
```

## 7. Importação e exportação

### 7.1 Formato do sistema do laboratório (todas as tabelas)
- Arquivo por tabela (ex.: `PARTICULAR.csv`), mesmo layout para todas.
- ISO-8859-1, separador `;`, CRLF em todas as linhas, sem BOM.
- Cabeçalho: `código;índice;porte;ch;filme;mnemonico;efetua;vlrporte`.
- Uma linha por mnemônico, ordem alfabética sem diferenciar maiúsculas.
- `ch` = preço, vírgula decimal, sem separador de milhar, sem zeros à direita
  (`71,69`, `128,4`, `201`).
- `efetua S` → `porte UNIL`, `vlrporte 1`; `efetua N` → porte vazio, `ch 0`, `vlrporte 0`.
- `código` vazio, `índice 0`, `filme 0`: constantes (só têm uso em planos de saúde).
- Exportação validada: linhas idênticas ao arquivo do sistema.
- Importação: mnemônico é a chave; divergências de preço são resolvidas exame a exame;
  exames novos entram como "sem custo". Arquivo atual: 3.366 linhas, 1.863 já na
  planilha, 966 novos com preço, 15 preços divergentes, 5 inconsistências.

### 7.2 Hermes Pardini — tabela 4114 (exclusivo Pardini)
- Excel, cabeçalho na linha 4. Colunas usadas: **B** mnemônico Pardini, **F** início da
  vigência, **G** preço. **A** (material) e **C** (descrição) só para desempate e
  conferência.
- A tabela 4114 contém os **preços negociados**: exames vinculados ficam marcados como
  negociados e o custo atualiza a cada importação. Exames Pardini fora dela têm custo
  manual.
- Vínculo mnemônico LAMIC ↔ código Pardini, salvo e reaproveitado; um código pode
  atender vários exames LAMIC.
- Regras: automático quando mnemônico **e** descrição batem (≥ 75%, comparação por
  palavras); código repetido por material → escolhe pela descrição; sugestão quando o
  mnemônico difere e a descrição bate (forte ≥ 90%, fraca 60–89%); **mesmo mnemônico
  com descrição diferente nunca vincula sozinho** (ex.: HOMO homocisteína × ácido
  homovanílico).
- Vigência futura fica agendada até a data.
- Resultado atual: 386 automáticos, 116 sugestões fortes, 104 fracas, 37 a conferir,
  32 sem vínculo (de 675). Custos sobem em 365 exames (mediana +7,0%); 41 caem abaixo
  da margem mínima.

### 7.3 Migração inicial (planilha)
Aba PARTICULAR exportada em CSV (Arquivo → Fazer download → .csv): mnemônico (C),
descrição (D), setor (B), preço praticado (G), custo do teste (N), Neg (A) → **Negociado
invertido** (só apoio), CB (H) → **A auditar**, X → fora do sistema, L em serviços (vacinas)
→ custo adicional **Aplicação**. Exames sem custo entram com status ⚪.

A coluna F (PART) está defasada em relação ao sistema e **não é usada**. O preço de
referência do sistema vem do `PARTICULAR.csv` do sistema, enviado junto na migração
(opcional): define o preço no sistema, os exames fora dele e os marcados com efetua = N.
Exames que existem só no sistema (1.503) entram na sincronização da fase 5.

## 8. Grupos (sugestão inicial)

| Grupo | Acesso |
|---|---|
| Admin | Tudo (travado) |
| Comercial | Exames, tabelas e simulador (criar/editar/exportar); demais ver |
| Custos / Financeiro | Custos, parâmetros, importações e **aprovação** |
| Técnico de setor | Ver exames; editar custos do próprio setor |
| Visualizador | Somente consulta (grupo padrão; se nenhum grupo estiver marcado, o sistema volta a marcá-lo ao abrir) |

## 9. Decisões registradas

| Tema | Decisão |
|---|---|
| Neg (coluna A) | Vira "Negociado" (marcado quando há negociação) |
| CB (coluna H) | Controle interno "valor a auditar" |
| J, K, L, M | Atendimento, Sistemas, Coleta, Triagem |
| Coleta/Triagem | Só entram se o exame passa pela etapa (padrão no setor, ajuste no exame) |
| Custos fixos | Lineares por padrão; rateio opcional por custo |
| Vacinas | L = custo de aplicação (custo adicional manual); M = maquininha |
| Maquininha | Fora do custo; só projeção |
| Volumes (0Reajuste) | Descartado |
| SOLUMEDI | Removida |
| Índice/filme | Constantes (só planos de saúde) |
| Tabelas do sistema | Todas no mesmo layout CSV |
| Pardini 4114 | Preços negociados; modelo exclusivo da Pardini |
| Alvaro 2656 | Preços negociados (código, nome, preço especial); sem material e sem vigência no arquivo: vale a partir da data da importação |
| Modelo de importação do apoio | Escolhido no cadastro do setor (categoria Laboratório de apoio); novos modelos entram na lista quando criados a partir de um arquivo de exemplo |
| Usuários | Base separada do Manutenção |
| Segurança | Adiada para a fase final |
| Tabelas derivadas | Preço próprio por exame (sem regra); desconto de referência só como atalho |
| L2L coluna H | Valor já publicado no Unilab |
| L2L preço | Definido exame a exame |
| Laboratórios apoiados | Nome, razão social, CNPJ, código do convênio |
| Fluxo de preço | Rascunho por usuário → proposta → aprovação (ou publicação direta por quem aprova) |
| Site L2L | Lê direto o banco do Comercial (sem planilha); login por laboratório apoiado, gerido em Configurações → Apoiados |
| Anexos da instrução | Campo próprio (nome + link); o L2L não procura links no texto |

## 10. Em aberto (não bloqueia o início)

- Modelos de importação de Diagnóstico Brasil e Yatros (até lá: custo manual).
- Mostrar na ficha de exames internos o custo de enviar ao apoio (comparação).
- L2L: o bloco do Unilab colado ao lado da aba L2L BASE bate com a coluna I (Proposta) em
  262 de 271 exames, não com G nem H. Confirmar qual valor está de fato no Unilab.
- Planilha de instruções: coluna F oculta (formato novo com emojis) — hoje ignorada.
- L2L na fase de segurança: hoje a página baixa `exames` e `catalogo` inteiros (inclui
  custos). Com as Security Rules, publicar um nó só com o que o apoiado pode ver.

## 11. Fases de desenvolvimento

1. **Base** ✔: estrutura de arquivos, layout, popover, Firebase, login e grupos, setores,
   parâmetros, custos fixos.
2. **Exames** ✔: cadastro, cálculo, ficha do exame, pendências, migração da planilha.
3. **Custos e catálogo** ✔: reagentes; importação Pardini 4114 com vínculos e vigência;
   catálogo e instruções com checklist de publicação.
4. **Comercial** ✔: tabelas de preço com edição manual, rascunho, propostas, aprovação e
   histórico; perfil de custo por tabela; Lamic-to-Lab e laboratórios apoiados;
   importação das abas e exportação no formato do Unilab por tabela.
5. **Integração** ✔: simulador (reajuste e proposta para laboratório), sincronização com o
   Unilab (vários arquivos) e painel inicial completo.
6. **Finalização**: PDF das tabelas ✔; faltam Firebase Auth + Security Rules (exige ativar
   o provedor no console do Firebase) e novos modelos de apoio (exigem arquivo de exemplo).
