// ═══════════════════════════════════════════════════════════════
// firebase.js — Firebase Realtime Database — COMERCIAL LAMIC
// Usa Firebase Compat (script clássico, sem ES modules)
// ═══════════════════════════════════════════════════════════════

const firebaseConfig = {
  apiKey: 'AIzaSyBD7XDmLJoc-_0Kb_53emSK7AHRl9W3C_s',
  authDomain: 'precificacao-73fc3.firebaseapp.com',
  databaseURL: 'https://precificacao-73fc3-default-rtdb.firebaseio.com',
  projectId: 'precificacao-73fc3',
  storageBucket: 'precificacao-73fc3.firebasestorage.app',
  messagingSenderId: '432300497351',
  appId: '1:432300497351:web:4d23dac46edd141724e1e2'
};

firebase.initializeApp(firebaseConfig);
const _db = firebase.database();

// ── Ambiente de teste (Firebase Emulator) ─────────────────────
// http://localhost:PORTA/index.html?emu=1 conecta ao emulador local
// (firebase emulators:start --only database). Ignorado fora de localhost.
window.DB_TESTE = false;
(function () {
  const host = location.hostname;
  const local = host === 'localhost' || host === '127.0.0.1';
  if (local && new URLSearchParams(location.search).get('emu') === '1') {
    _db.useEmulator(host, 9000);
    window.DB_TESTE = true;
  }
})();

const DB = {
  ref:    caminho => _db.ref(caminho),
  ler:    async caminho => (await _db.ref(caminho).get()).val(),
  gravar: (caminho, valor) => _db.ref(caminho).set(valor),
  mesclar:(caminho, valor) => _db.ref(caminho).update(valor),
  remover: caminho => _db.ref(caminho).remove(),
  novaChave: caminho => _db.ref(caminho).push().key,
  // Escuta contínua; devolve função para cancelar
  ouvir(caminho, cb) {
    const r = _db.ref(caminho);
    const fn = s => cb(s.val());
    // sem permissão de leitura: segue com vazio em vez de travar a carga
    r.on('value', fn, err => { console.warn(`Sem acesso a ${caminho}:`, err?.message); cb(null); });
    return () => r.off('value', fn);
  },
  // Estado da conexão com o servidor
  conexao(cb) {
    _db.ref('.info/connected').on('value', s => cb(!!s.val()));
  },
  agora: () => firebase.database.ServerValue.TIMESTAMP
};
