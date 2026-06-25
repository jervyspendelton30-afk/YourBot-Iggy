/**
 * app.js – Main application controller; wires together UI, API, and Chat modules
 * Component 1: Web-Based Chat Interface (Front-End)
 */

const ChatApp = (() => {

  let sessionId = Utils.generateSessionId();
  let isLoading = false;
  let messageHistory = [];

  const input     = () => document.getElementById('user-input');
  const sendBtn   = () => document.getElementById('send-btn');
  const charCount = () => document.getElementById('char-count');
  const status    = () => document.getElementById('bot-status');

  // ── Init ──────────────────────────────────────────────────────
  function init() {
    Chat.renderWelcome();
    Chat.renderSessionHistory();
    _bindEvents();
    _checkBackendHealth();
  }

  function _bindEvents() {
    const inp = input();

    inp.addEventListener('input', () => {
      Utils.autoResize(inp);
      charCount().textContent = `${inp.value.length}/500`;
    });

    inp.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    });

    document.querySelectorAll('.topic-item').forEach(item => {
      item.addEventListener('click', () => {
        inp.value = item.dataset.query;
        Utils.autoResize(inp);
        sendMessage();
      });
    });
  }

  async function _checkBackendHealth() {
    const online = await API.healthCheck();
    const el = status();
    if (!online) {
      el.innerHTML = `<span class="status-dot" style="background:#e74c3c"></span> Offline`;
      Utils.showToast('⚠️ Cannot connect to server. Responses may be limited.');
    }
  }

  // ── Send message ──────────────────────────────────────────────
  async function sendMessage() {
    const text = input().value.trim();
    if (!text || isLoading) return;

    input().value = '';
    Utils.autoResize(input());
    charCount().textContent = '0/500';

    document.getElementById('suggestions-bar').style.display = 'none';

    Chat.appendUserMessage(text);

    messageHistory.push({ role: 'user', content: text, time: Date.now() });
    Chat.updateCurrentSession(sessionId, messageHistory);

    isLoading = true;
    sendBtn().disabled = true;
    Chat.showTyping();

    try {
      const data = await API.sendMessage(text, sessionId);
      Chat.hideTyping();
      Chat.appendBotMessage(data.reply, data.intent);

      messageHistory.push({ role: 'bot', content: data.reply, intent: data.intent, time: Date.now() });
      Chat.updateCurrentSession(sessionId, messageHistory);

    } catch (err) {
      Chat.hideTyping();
      Chat.appendBotMessage(
        '⚠️ Sorry, I couldn\'t reach the server right now. Please try again in a moment.',
        null,
        true
      );
      console.error('[ChatApp] API error:', err.message);
    }

    isLoading = false;
    sendBtn().disabled = false;
    input().focus();
  }

  /** Called by suggestion chips */
  function sendSuggestion(btn) {
    input().value = btn.textContent;
    sendMessage();
  }

  /** Load a past session into the chat area */
  function loadSession(sid) {
    const sessions = Utils.loadLocal('icct_sessions') || [];
    const session = sessions.find(s => s.id === sid);
    if (!session) return;

    if (messageHistory.length > 0) {
      Chat.updateCurrentSession(sessionId, messageHistory);
    }

    sessionId = session.id;
    messageHistory = session.history || [];

    const area = document.getElementById('messages-area');
    area.innerHTML = '';
    messageHistory.forEach(m => {
      if (m.role === 'user') Chat.appendUserMessage(m.content);
      else Chat.appendBotMessage(m.content, m.intent);
    });

    Chat.renderSessionHistory(sid);
    input().focus();
  }

  /** Start a brand new chat */
  function clearChat() {
    if (messageHistory.length > 0) {
      Chat.updateCurrentSession(sessionId, messageHistory);
    }

    sessionId = Utils.generateSessionId();
    messageHistory = [];

    Chat.renderWelcome();
    Chat.renderSessionHistory();
    document.getElementById('suggestions-bar').style.display = 'flex';
    input().focus();
    Utils.showToast('New chat started.');
  }

  /** Export chat as a plain-text file */
  function exportChat() {
    if (!messageHistory.length) { Utils.showToast('No messages to export.'); return; }
    const lines = messageHistory.map(m => {
      const time = new Date(m.time).toLocaleString('en-PH');
      const role = m.role === 'user' ? 'You' : 'ICCT Bot';
      return `[${time}] ${role}:\n${m.content}\n`;
    });
    const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `ICCT_Chat_${new Date().toISOString().slice(0,10)}.txt`;
    a.click();
    Utils.showToast('Chat exported!');
  }

  /** Toggle profile dropdown */
  function toggleProfile() {
    const dropdown = document.getElementById('profile-dropdown');
    if (dropdown) {
      dropdown.style.display = dropdown.style.display === 'block' ? 'none' : 'block';
    }
  }

  /** Logout — clear all stored user data */
  function logout() {
    localStorage.removeItem('icct_token');
    localStorage.removeItem('icct_first_name');
    localStorage.removeItem('icct_last_name');
    localStorage.removeItem('icct_email');
    localStorage.removeItem('icct_guest');
    window.location.href = 'login.html';
  }

  // Auto-init when DOM is ready
  document.addEventListener('DOMContentLoaded', init);

  // ── Public API ────────────────────────────────────────────────
  return { sendMessage, sendSuggestion, clearChat, exportChat, loadSession, toggleProfile, logout };

})();
