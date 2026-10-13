// ═══════════════════════════════════════════════════════════════
// app.js — Inicialização — COMERCIAL LAMIC
// ═══════════════════════════════════════════════════════════════

let _appIniciado = false, _renderAdiado = false;
const campoEmEdicao = () => !!document.activeElement?.matches?.('.page input:not([type=file]), .page textarea');

async function iniciar() {
  temaInicial();
  mostrarAuth('carregando');

  // Sem resposta do banco em 12 s → tela de erro
  const limite = setTimeout(() => mostrarAuth('erro-conexao'), 12000);
  try {
    await sincronizarEstado();
    clearTimeout(limite);
    await semearDados();
  } catch (e) {
    clearTimeout(limite);
    console.error(e);
    return mostrarAuth('erro-conexao');
  }

  // Reage a alterações feitas por outros usuários
  aoAtualizar(chave => {
    if (!sessao) {
      // banco esvaziado ou cadastro alterado enquanto a tela de acesso está aberta
      if (chave === 'usuarios' && !temAdmin()) mostrarAuth('primeiro-admin');
      return;
    }
    const u = ESTADO.usuarios[sessao.usuarioId];
    // Só a lista de usuários decide se a sessão continua válida
    if (chave === 'usuarios' && (!u || u.ativo === false)) { encerrarSessao(); fecharGaveta(); return mostrarAuth('login', 'Sua sessão foi encerrada pelo administrador.'); }
    if (!u) return;
    // último acesso gravado pelo L2L: só interessa à aba de acessos
    if (chave === 'acessosL2L' && telaAtual !== 'config') return;
    aplicarPermissoes();
    if (!podeVerTela(telaAtual)) return irPara('inicio');
    // Gaveta aberta: redesenha quando ela fechar
    if (document.getElementById('gaveta').classList.contains('open')) { _renderAdiado = true; atualizarPropostaAberta(); return; }
    // Digitando em um campo da tela: redesenha só quando sair dele
    if (campoEmEdicao()) { _renderAdiado = true; return; }
    renderTela();
  });
  document.addEventListener('focusout', () => setTimeout(() => {
    if (_renderAdiado && !campoEmEdicao() && !document.getElementById('gaveta').classList.contains('open')) { _renderAdiado = false; renderTela(); }
  }, 400));

  if (!temAdmin()) return mostrarAuth('primeiro-admin');
  if (restaurarSessao()) return entrarApp();
  mostrarAuth('login');
}

function entrarApp() {
  esconderAuth();
  aplicarPermissoes();
  if (!_appIniciado) {
    _appIniciado = true;
    document.querySelectorAll('#nav a').forEach(a => a.onclick = () => irPara(a.dataset.s));
  }
  let t = 'inicio';
  try { t = sessionStorage.getItem('prec-tela') || 'inicio'; } catch (e) {}
  irPara(t);
}

document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && !popAberto && document.getElementById('gaveta').classList.contains('open') && !document.getElementById('modal').classList.contains('open')) clicarForaGaveta();
});

document.addEventListener('DOMContentLoaded', iniciar);
