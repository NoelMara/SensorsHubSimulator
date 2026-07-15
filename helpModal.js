(function() {
  function mountHelpModal() {
    var root = document.getElementById('help-root');
    if (!root) return;
    if (document.getElementById('help-overlay')) return;
    if (typeof window.HELP_MODAL_HTML !== 'string') return;
    root.innerHTML = window.HELP_MODAL_HTML;
  }

  function openHelp() {
    var overlay = document.getElementById('help-overlay');
    if (!overlay) return;
    overlay.classList.remove('help-hidden');
    overlay.classList.add('help-visible');
    document.body.style.overflow = 'hidden';
  }

  function closeHelp() {
    var overlay = document.getElementById('help-overlay');
    if (!overlay) return;
    overlay.classList.remove('help-visible');
    overlay.classList.add('help-hiding');
    setTimeout(function() {
      overlay.classList.add('help-hidden');
      overlay.classList.remove('help-hiding');
      document.body.style.overflow = '';
    }, 280);
  }

  function closeHelpOutside(e) {
    if (e.target && e.target.id === 'help-overlay') {
      closeHelp();
    }
  }

  function switchHelpTab(tabId, btnEl) {
    document.querySelectorAll('.help-pane').forEach(function(p) {
      p.classList.remove('active');
    });
    document.querySelectorAll('.help-tab').forEach(function(b) {
      b.classList.remove('active');
    });
    var pane = document.getElementById('help-pane-' + tabId);
    if (pane) pane.classList.add('active');
    if (btnEl) btnEl.classList.add('active');
  }

  window.openHelp = openHelp;
  window.closeHelp = closeHelp;
  window.closeHelpOutside = closeHelpOutside;
  window.switchHelpTab = switchHelpTab;
  window.mountHelpModal = mountHelpModal;

  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
      var overlay = document.getElementById('help-overlay');
      if (overlay && !overlay.classList.contains('help-hidden')) {
        closeHelp();
      }
    }
  });

  document.addEventListener('DOMContentLoaded', function() {
    mountHelpModal();
    try {
      if (!localStorage.getItem('sh_help_seen')) {
        setTimeout(openHelp, 900);
        localStorage.setItem('sh_help_seen', '1');
      }
    } catch (e) {}
  });
})();
