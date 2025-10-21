// Este script deve ser importado no layout principal para registrar o Service Worker.

export function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js') // Assumindo que o sw.js será gerado na raiz
        .then(registration => {
          console.log('Service Worker registrado com sucesso:', registration.scope);
          // Lógica para Web Push Subscription (se necessário)
          // subscribeUserToPush(registration);
        })
        .catch(error => {
          console.error('Falha no registro do Service Worker:', error);
        });
    });
  }
}

// Função de exemplo para lidar com a instalação
let deferredPrompt: any;

export function setupPWAInstallPrompt() {
  window.addEventListener('beforeinstallprompt', (e) => {
    // Previne que o mini-infobar apareça automaticamente
    e.preventDefault();
    // Armazena o evento para que possa ser acionado mais tarde
    deferredPrompt = e;
    console.log('Evento beforeinstallprompt capturado.');
    // Você pode mostrar um botão de instalação customizado aqui
  });
}

export function promptPWAInstall() {
  if (deferredPrompt) {
    deferredPrompt.prompt();
    deferredPrompt.userChoice.then((choiceResult: any) => {
      if (choiceResult.outcome === 'accepted') {
        console.log('Usuário aceitou a instalação do PWA');
      } else {
        console.log('Usuário recusou a instalação do PWA');
      }
      deferredPrompt = null;
    });
  } else {
    console.log('O prompt de instalação não está disponível ou já foi acionado.');
  }
}