/**
 * chat.js – Chat UI rendering and message management
 * Component 1: Web-Based Chat Interface (Front-End)
 */

const Chat = (() => {

  const messagesArea = () => document.getElementById('messages-area');

  /** Render the welcome card on first load */
  function renderWelcome() {
    const area = messagesArea();
    area.innerHTML = `
      <div class="welcome-card">
        <img src="Iggy.png" alt="Iggy" class="welcome-icon-img"/>
        <div class="welcome-title">Welcome to ICCT Bot!</div>
        <div class="welcome-sub">
          I can help you with enrollment, courses, schedules, tuition, scholarships, and school policies.
          <br/><br/>Select a topic on the left or type your question below.
        </div>
      </div>`;
  }

  /** Append a user message bubble */
  function appendUserMessage(text) {
    const area = messagesArea();
    const welcomeCard = area.querySelector('.welcome-card');
    if (welcomeCard) welcomeCard.remove();

    const row = document.createElement('div');
    row.className = 'msg-row user';
    row.innerHTML = `
      <div class="msg-avatar-sm" aria-hidden="true">
        <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
      </div>
      <div>
        <div class="msg-bubble">${Utils.escapeHTML(text)}</div>
        <div class="msg-meta">${Utils.formatTime()}</div>
      </div>`;
    area.appendChild(row);
    Utils.scrollToBottom(area);
    return row;
  }

  /** Show animated typing indicator */
  function showTyping() {
    const area = messagesArea();
    const row = document.createElement('div');
    row.className = 'typing-row';
    row.id = 'typing-indicator';
    row.innerHTML = `
      <div class="bot-avatar-bubble"><img src="Iggy.png" class="bot-msg-avatar"/></div>
      <div class="typing-bubble">
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
      </div>`;
    area.appendChild(row);
    Utils.scrollToBottom(area);
  }

  /** Remove typing indicator */
  function hideTyping() {
    document.getElementById('typing-indicator')?.remove();
  }

  /** Append a bot response bubble */
  function appendBotMessage(text, intent = null, isError = false) {
    const area = messagesArea();
    const row = document.createElement('div');
    row.className = 'msg-row bot';
    row.dataset.intent = intent || '';

    const bubbleClass = isError ? 'msg-bubble error-bubble' : 'msg-bubble';
    const formatted = Utils.escapeHTML(text)
      .replace(/\n/g, '<br>')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

    row.innerHTML = `
      <div class="bot-avatar-bubble"><img src="Iggy.png" class="bot-msg-avatar"/></div>
      <div>
        <div class="${bubbleClass}">${formatted}</div>
        <div class="msg-meta">
          ${Utils.formatTime()}
          ${intent ? `· <em>${intent.replace(/_/g, ' ')}</em>` : ''}
        </div>
      </div>`;
    area.appendChild(row);
    Utils.scrollToBottom(area);
    return row;
  }

  /** Save or update a session in localStorage */
  function updateCurrentSession(sessionId, messageHistory) {
    if (!messageHistory.length) return;
    const sessions = Utils.loadLocal('icct_sessions') || [];
    const firstUserMsg = messageHistory.find(m => m.role === 'user');
    const preview = firstUserMsg ? firstUserMsg.content.slice(0, 35) : 'Session';
    const date = new Date().toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });

    const existingIndex = sessions.findIndex(s => s.id === sessionId);
    const sessionData = { id: sessionId, date, preview, pinned: existingIndex >= 0 ? (sessions[existingIndex].pinned || false) : false, history: messageHistory };

    if (existingIndex >= 0) {
      sessions[existingIndex] = sessionData;
    } else {
      sessions.unshift(sessionData);
    }

    // Sort: pinned first, then rest
    sessions.sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0));
    Utils.saveLocal('icct_sessions', sessions.slice(0, 15));
  }

  /** Close any open dropdown menus */
  function closeAllDropdowns() {
    document.querySelectorAll('.history-dropdown').forEach(d => d.remove());
  }

  /** Render the session history list in the sidebar */
  function renderSessionHistory(activeSessionId = null) {
    const list = document.getElementById('history-list');
    const sessions = Utils.loadLocal('icct_sessions') || [];

    if (sessions.length === 0) {
      list.innerHTML = '<li class="history-empty">No previous sessions</li>';
      return;
    }

    list.innerHTML = '';
    sessions.forEach(session => {
      const item = document.createElement('li');
      item.className = 'history-item' + (session.id === activeSessionId ? ' active' : '') + (session.pinned ? ' pinned' : '');
      item.dataset.id = session.id;

      item.innerHTML = `
        <div class="history-item-content">
          ${session.pinned ? '<span class="pin-icon">📌</span>' : ''}
          <div class="history-item-text">
            <span class="history-date">${session.date}</span>
            <span class="history-preview">${Utils.escapeHTML(session.preview)}${session.preview.length >= 35 ? '…' : ''}</span>
          </div>
          <button class="history-menu-btn" title="Options">⋮</button>
        </div>
      `;

      // Click on item = load session
      item.addEventListener('click', (e) => {
        if (e.target.classList.contains('history-menu-btn')) return;
        closeAllDropdowns();
        ChatApp.loadSession(session.id);
      });

      // Click on ⋮ = show dropdown
      item.querySelector('.history-menu-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        closeAllDropdowns();

        const dropdown = document.createElement('div');
        dropdown.className = 'history-dropdown';
        dropdown.innerHTML = `
          <button class="dropdown-item" data-action="pin">${session.pinned ? '📌 Unpin' : '📌 Pin'}</button>
          <button class="dropdown-item" data-action="rename">✏️ Rename</button>
          <button class="dropdown-item danger" data-action="delete">🗑️ Delete</button>
        `;

        // Position dropdown near the button
        document.body.appendChild(dropdown);
        const rect = e.target.getBoundingClientRect();
        const ddHeight = dropdown.offsetHeight || 120;
        const spaceBelow = window.innerHeight - rect.bottom;
        if (spaceBelow < ddHeight) {
          dropdown.style.top = (rect.top + window.scrollY - ddHeight - 4) + 'px';
        } else {
          dropdown.style.top = (rect.bottom + window.scrollY + 4) + 'px';
        }
        dropdown.style.left = Math.max(4, rect.left + window.scrollX - 110) + 'px';

        dropdown.addEventListener('click', (ev) => {
          const action = ev.target.dataset.action;
          const sessions = Utils.loadLocal('icct_sessions') || [];
          const idx = sessions.findIndex(s => s.id === session.id);

          if (action === 'pin') {
            sessions[idx].pinned = !sessions[idx].pinned;
            sessions.sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0));
            Utils.saveLocal('icct_sessions', sessions);
            renderSessionHistory(activeSessionId);

          } else if (action === 'rename') {
            closeAllDropdowns();
            const newName = prompt('Enter a new name for this session:', session.preview);
            if (newName && newName.trim()) {
              sessions[idx].preview = newName.trim().slice(0, 35);
              Utils.saveLocal('icct_sessions', sessions);
              renderSessionHistory(activeSessionId);
            }

          } else if (action === 'delete') {
            closeAllDropdowns();
            if (confirm('Delete this session? This cannot be undone.')) {
              sessions.splice(idx, 1);
              Utils.saveLocal('icct_sessions', sessions);
              renderSessionHistory(activeSessionId);
              // If deleted session was active, show welcome
              if (session.id === activeSessionId) {
                ChatApp.clearChat();
              }
            }
          }
          closeAllDropdowns();
        });

        // Close dropdown when clicking outside
        setTimeout(() => {
          document.addEventListener('click', closeAllDropdowns, { once: true });
        }, 0);
      });

      list.appendChild(item);
    });
  }

  /** Clear all messages and re-render welcome */
  function clearMessages() {
    renderWelcome();
    document.getElementById('suggestions-bar').style.display = 'flex';
  }

  return {
    renderWelcome,
    appendUserMessage,
    showTyping,
    hideTyping,
    appendBotMessage,
    updateCurrentSession,
    renderSessionHistory,
    clearMessages
  };
})();
