// ═══════════════════════════════════════════════════════════════
// auth.js — Login, cadastro, sessão e permissões — COMERCIAL LAMIC
// Modelo do Manutenção LAMIC (usuários e grupos no Realtime Database).
// A segurança definitiva (Firebase Auth + Security Rules) fica para a
// fase final do projeto.
// ═══════════════════════════════════════════════════════════════

const SESSAO_KEY = 'prec-sessao-v1';
let sessao = null;          // { usuarioId, em }

// ── SHA-256 (JS puro: funciona também fora de HTTPS) ──────────
const _K256 = [
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
];
function sha256(texto) {
  const bytes = new TextEncoder().encode(texto), l = bytes.length;
  const blocos = (l + 9 + 63) >> 6, w = new Uint32Array(blocos * 16);
  for (let i = 0; i < l; i++) w[i >> 2] |= bytes[i] << (24 - (i % 4) * 8);
  w[l >> 2] |= 0x80 << (24 - (l % 4) * 8);
  w[blocos * 16 - 1] = (l * 8) >>> 0;
  w[blocos * 16 - 2] = Math.floor(l * 8 / 0x100000000);
  const H = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
  const W = new Uint32Array(64);
  const rotr = (x, n) => (x >>> n) | (x << (32 - n));
  for (let b = 0; b < blocos; b++) {
    for (let t = 0; t < 16; t++) W[t] = w[b * 16 + t];
    for (let t = 16; t < 64; t++) {
      const s0 = rotr(W[t - 15], 7) ^ rotr(W[t - 15], 18) ^ (W[t - 15] >>> 3);
      const s1 = rotr(W[t - 2], 17) ^ rotr(W[t - 2], 19) ^ (W[t - 2] >>> 10);
      W[t] = (W[t - 16] + s0 + W[t - 7] + s1) >>> 0;
    }
    let [a, bb, c, d, e, f, g, h] = H;
    for (let t = 0; t < 64; t++) {
      const t1 = (h + (rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)) + ((e & f) ^ (~e & g)) + _K256[t] + W[t]) >>> 0;
      const t2 = ((rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)) + ((a & bb) ^ (a & c) ^ (bb & c))) >>> 0;
      h = g; g = f; f = e; e = (d + t1) >>> 0; d = c; c = bb; bb = a; a = (t1 + t2) >>> 0;
    }
    [a, bb, c, d, e, f, g, h].forEach((v, i) => { H[i] = (H[i] + v) >>> 0; });
  }
  return H.map(x => x.toString(16).padStart(8, '0')).join('');
}

const novoSal = () => [...crypto.getRandomValues(new Uint8Array(16))].map(b => b.toString(16).padStart(2, '0')).join('');
const hashSenha = (senha, sal) => sha256(sal + ':' + senha);

// ── Consultas ─────────────────────────────────────────────────
const usuarioAtual = () => sessao ? { id: sessao.usuarioId, ...ESTADO.usuarios[sessao.usuarioId] } : null;
const temAdmin = () => Object.values(ESTADO.usuarios).some(u => u.admin);
const grupoPadrao = () => lista(ESTADO.grupos).find(g => g.padrao) || lista(ESTADO.grupos).find(g => !g.travado);
const acharUsuario = login => lista(ESTADO.usuarios).find(u => u.usuario === String(login).trim().toLowerCase());

// Permissão: admin e grupo travado podem tudo
function pode(modulo, acao = 'ver') {
  const u = usuarioAtual();
  if (!u) return false;
  if (u.admin) return true;
  const g = ESTADO.grupos[u.grupoId];
  if (!g) return false;
  if (g.travado) return true;
  return (g.permissoes?.[modulo] || []).includes(acao);
}

// ── Sessão ────────────────────────────────────────────────────
function salvarSessao(id) {
  sessao = { usuarioId: id, em: Date.now() };
  try { localStorage.setItem(SESSAO_KEY, JSON.stringify(sessao)); } catch (e) {}
}
function restaurarSessao() {
  try {
    const s = JSON.parse(localStorage.getItem(SESSAO_KEY) || 'null');
    const u = s && ESTADO.usuarios[s.usuarioId];
    if (u && u.ativo !== false) { sessao = s; return true; }
  } catch (e) {}
  return false;
}
function encerrarSessao() {
  sessao = null;
  try { localStorage.removeItem(SESSAO_KEY); } catch (e) {}
}

// ── Tela de acesso ────────────────────────────────────────────
function mostrarAuth(modo, erro = '') {
  const el = document.getElementById('auth');
  el.classList.remove('hide');
  const marca = `<div class="brand"><div class="brand-ico"><i class="fa-solid fa-hand-holding-dollar"></i></div>
    <div><div class="brand-name">COMERCIAL LAMIC</div><div class="brand-sub">Precificação &amp; Comercial</div></div></div>`;
  const msg = erro ? `<div class="auth-erro"><i class="fa-solid fa-circle-exclamation"></i>${esc(erro)}</div>` : '';
  const ent = (id, rotulo, icone, tipo = 'text', ph = '') =>
    `<label for="${id}">${rotulo}</label><div class="inp-auth"><i class="fa-solid ${icone}"></i><input id="${id}" type="${tipo}" placeholder="${ph}" autocomplete="${tipo === 'password' ? 'current-password' : 'username'}"></div>`;
  let corpo = '';
  if (modo === 'carregando') {
    corpo = `<div class="auth-load"><i class="fa-solid fa-circle-notch fa-spin"></i>Conectando ao banco de dados…</div>`;
  } else if (modo === 'erro-conexao') {
    corpo = `<h1>Sem conexão</h1><p>Não foi possível acessar o banco de dados. Verifique a internet e as regras do Realtime Database.</p>
      <button class="btn-primary" onclick="location.reload()"><i class="fa-solid fa-rotate"></i>Tentar novamente</button>`;
  } else if (modo === 'primeiro-admin') {
    corpo = `<h1>Primeiro acesso</h1><p>Crie o usuário administrador do sistema.</p>${msg}
      <form onsubmit="event.preventDefault();criarPrimeiroAdmin()">
      ${ent('a-nome', 'Nome completo', 'fa-id-card', 'text', 'Seu nome')}
      ${ent('a-usuario', 'Usuário', 'fa-user', 'text', 'Nome de usuário')}
      ${ent('a-senha', 'Senha', 'fa-lock', 'password', 'Mínimo 6 caracteres')}
      ${ent('a-senha2', 'Confirmar senha', 'fa-lock', 'password', 'Repita a senha')}
      <button class="btn-primary" type="submit"><i class="fa-solid fa-crown"></i>Criar administrador</button></form>`;
  } else if (modo === 'cadastro') {
    corpo = `<h1>Criar conta</h1><p>Sua conta entra no grupo padrão. O administrador pode alterar depois.</p>${msg}
      <form onsubmit="event.preventDefault();cadastrar()">
      ${ent('c-nome', 'Nome completo', 'fa-id-card', 'text', 'Seu nome')}
      ${ent('c-usuario', 'Usuário', 'fa-user', 'text', 'Nome de usuário')}
      ${ent('c-senha', 'Senha', 'fa-lock', 'password', 'Mínimo 6 caracteres')}
      ${ent('c-senha2', 'Confirmar senha', 'fa-lock', 'password', 'Repita a senha')}
      <button class="btn-primary" type="submit"><i class="fa-solid fa-user-plus"></i>Criar conta</button></form>
      <button class="btn-ghost-dark" onclick="mostrarAuth('login')"><i class="fa-solid fa-arrow-left"></i>Voltar ao login</button>`;
  } else {
    corpo = `<h1>Bem-vindo</h1><p>Faça login para acessar o sistema</p>${msg}
      <form onsubmit="event.preventDefault();entrar()">
      ${ent('l-usuario', 'Usuário', 'fa-user', 'text', 'Nome de usuário')}
      ${ent('l-senha', 'Senha', 'fa-lock', 'password', '••••••••')}
      <button class="btn-primary" type="submit"><i class="fa-solid fa-right-to-bracket"></i>Entrar</button></form>
      ${ESTADO.permitirCadastro ? `<button class="btn-ghost-dark" onclick="mostrarAuth('cadastro')"><i class="fa-solid fa-user-plus"></i>Criar Conta</button>` : ''}`;
  }
  el.innerHTML = `<div class="auth-card">${marca}${corpo}${window.DB_TESTE ? '<div class="auth-teste"><i class="fa-solid fa-flask"></i>Ambiente de teste (emulador)</div>' : ''}</div>`;
  el.querySelector('input')?.focus();
}
const esconderAuth = () => document.getElementById('auth').classList.add('hide');

// ── Ações ─────────────────────────────────────────────────────
function validarNovo(nome, usuario, senha, senha2) {
  if (!nome.trim() || !usuario.trim()) return 'Preencha nome e usuário.';
  if (!/^[a-z0-9._-]{3,}$/i.test(usuario.trim())) return 'Usuário: mínimo 3 caracteres (letras, números, ponto, hífen).';
  if (acharUsuario(usuario)) return 'Este usuário já existe.';
  if (senha.length < 6) return 'A senha precisa ter ao menos 6 caracteres.';
  if (senha !== senha2) return 'As senhas não conferem.';
  return '';
}
function montarUsuario(nome, usuario, senha, extra = {}) {
  const sal = novoSal();
  return { nome: nome.trim(), usuario: usuario.trim().toLowerCase(), cargo: '', setores: 'todos', ativo: true, admin: false,
    sal, hash: hashSenha(senha, sal), criadoEm: Date.now(), ultimoAcesso: null, ...extra };
}

async function criarPrimeiroAdmin() {
  const [n, u, s, s2] = ['a-nome', 'a-usuario', 'a-senha', 'a-senha2'].map(valorCampo);
  const erro = validarNovo(n, u, s, s2);
  if (erro) return mostrarAuth('primeiro-admin', erro);
  if (temAdmin()) return mostrarAuth('login');
  const grupos = {};
  PADRAO_GRUPOS.forEach(({ chave, ...g }) => { grupos[chave] = g; });
  await DB.gravar(CAMINHOS.grupos, grupos);
  const id = DB.novaChave(CAMINHOS.usuarios);
  const novo = montarUsuario(n, u, s, { admin: true, grupoId: 'admin', cargo: 'Administrador', ultimoAcesso: Date.now() });
  await DB.gravar(`${CAMINHOS.usuarios}/${id}`, novo);
  // já reflete no estado local, sem esperar o retorno do listener
  ESTADO.grupos = { ...ESTADO.grupos, ...grupos };
  ESTADO.usuarios = { ...ESTADO.usuarios, [id]: novo };
  salvarSessao(id);
  registrar('usuarios', `Administrador ${n.trim()} criado`);
  entrarApp();
}

async function cadastrar() {
  const [n, u, s, s2] = ['c-nome', 'c-usuario', 'c-senha', 'c-senha2'].map(valorCampo);
  if (!ESTADO.permitirCadastro) return mostrarAuth('login', 'Cadastro fechado. Fale com o administrador.');
  const erro = validarNovo(n, u, s, s2);
  if (erro) return mostrarAuth('cadastro', erro);
  const id = DB.novaChave(CAMINHOS.usuarios);
  const novo = montarUsuario(n, u, s, { grupoId: grupoPadrao()?.id || null, ultimoAcesso: Date.now() });
  await DB.gravar(`${CAMINHOS.usuarios}/${id}`, novo);
  ESTADO.usuarios = { ...ESTADO.usuarios, [id]: novo };
  salvarSessao(id);
  registrar('usuarios', `Conta ${u.trim().toLowerCase()} criada pelo cadastro aberto`);
  entrarApp();
}

function entrar() {
  const login = valorCampo('l-usuario'), senha = valorCampo('l-senha');
  const u = acharUsuario(login);
  if (!u || hashSenha(senha, u.sal) !== u.hash) return mostrarAuth('login', 'Usuário ou senha incorretos.');
  if (u.ativo === false) return mostrarAuth('login', 'Usuário inativo. Fale com o administrador.');
  salvarSessao(u.id);
  DB.mesclar(`${CAMINHOS.usuarios}/${u.id}`, { ultimoAcesso: Date.now() });
  entrarApp();
}

async function sair() {
  const ok = await confirmar({ titulo: 'Sair do sistema?', texto: 'Você precisará fazer login novamente.', botao: 'Sair' });
  if (!ok) return;
  encerrarSessao();
  fecharGaveta();
  mostrarAuth('login');
}

function verificarSenhaAtual(senha) {
  const u = usuarioAtual();
  return !!u && hashSenha(senha, u.sal) === u.hash;
}
