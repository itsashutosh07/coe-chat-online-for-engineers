const chatForm = document.getElementById('chat-form');
const chatMessages = document.querySelector('.chat-messages');
const roomName = document.getElementById('room-name');
const userList = document.getElementById('users');
const connectionBanner = document.getElementById('connection-banner');
const typingIndicator = document.getElementById('typing-indicator');
const scrollBottomBtn = document.getElementById('scroll-bottom');
const unreadBadge = document.getElementById('unread-badge');
const msgInput = document.getElementById('msg');
const leaveRoomLink = document.getElementById('leave-room');
const sidebarToggle = document.getElementById('sidebar-toggle');
const sidebarClose = document.getElementById('sidebar-close');
const chatSidebar = document.getElementById('chat-sidebar');
const muteToggle = document.getElementById('mute-toggle');

const { username, room } = Qs.parse(location.search, { ignoreQueryPrefix: true });

if (!username || !room) {
  window.location.href = 'index.html';
}

const BOT_NAME = 'C.O.E. Bot';
const MAX_MESSAGE_LENGTH = 500;

let soundEnabled = localStorage.getItem('chatSound') !== 'false';
let isNearBottom = true;
let unreadCount = 0;
let typingTimeout = null;
let isTyping = false;
let typingUsers = new Set();
let typingClearTimers = new Map();
let joined = false;

const socket = io({ reconnection: true, reconnectionAttempts: Infinity });

const audio = new Audio('audio.mp3');

function playNotification() {
  if (!soundEnabled) return;
  audio.currentTime = 0;
  audio.play().catch(() => {});
}

function setConnectionBanner(text, type) {
  connectionBanner.textContent = text;
  connectionBanner.className = `connection-banner connection-banner--${type}`;
  connectionBanner.classList.remove('hidden');
}

function hideConnectionBanner(delay = 2500) {
  if (delay === 0) {
    connectionBanner.classList.add('hidden');
    return;
  }
  setTimeout(() => connectionBanner.classList.add('hidden'), delay);
}

function updateMuteIcon() {
  muteToggle.innerHTML = soundEnabled
    ? '<i class="fas fa-volume-up"></i>'
    : '<i class="fas fa-volume-mute"></i>';
}

muteToggle.addEventListener('click', () => {
  soundEnabled = !soundEnabled;
  localStorage.setItem('chatSound', String(soundEnabled));
  updateMuteIcon();
});
updateMuteIcon();

socket.on('connect', () => {
  if (joined) {
    setConnectionBanner('Back online', 'success');
    hideConnectionBanner();
    socket.emit('joinRoom', { username, room });
  } else {
    socket.emit('joinRoom', { username, room });
  }
});

socket.on('disconnect', () => {
  setConnectionBanner('Connection lost. Reconnecting…', 'error');
});

socket.on('connect_error', () => {
  setConnectionBanner('Cannot reach server. Retrying…', 'error');
});

socket.on('joinError', ({ message }) => {
  alert(message);
  window.location.href = 'index.html';
});

socket.on('messageHistory', ({ messages, hasMore }) => {
  chatMessages.innerHTML = '';
  if (hasMore) {
    appendHistorySeparator();
  }
  messages.forEach((message) => outputMessage(message, { skipSound: true, skipScrollTrack: true }));
  scrollToBottom(false);
});

socket.on('roomUsers', ({ room: r, users }) => {
  outputRoomName(r);
  outputUsers(users);
});

socket.on('message', (message) => {
  outputMessage(message);
  handleScrollOnNewMessage();
});

socket.on('typing', ({ username: typingUser }) => {
  if (typingUser === username) return;
  typingUsers.add(typingUser);
  scheduleTypingClear(typingUser);
  renderTypingIndicator();
});

socket.on('stopTyping', ({ username: typingUser }) => {
  typingUsers.delete(typingUser);
  clearTypingTimer(typingUser);
  renderTypingIndicator();
});

function scheduleTypingClear(typingUser) {
  clearTypingTimer(typingUser);
  typingClearTimers.set(
    typingUser,
    setTimeout(() => {
      typingUsers.delete(typingUser);
      renderTypingIndicator();
    }, 3000)
  );
}

function clearTypingTimer(typingUser) {
  if (typingClearTimers.has(typingUser)) {
    clearTimeout(typingClearTimers.get(typingUser));
    typingClearTimers.delete(typingUser);
  }
}

function renderTypingIndicator() {
  if (typingUsers.size === 0) {
    typingIndicator.classList.add('hidden');
    typingIndicator.textContent = '';
    return;
  }
  const names = Array.from(typingUsers);
  let text = '';
  if (names.length === 1) text = `${names[0]} is typing…`;
  else if (names.length === 2) text = `${names[0]} and ${names[1]} are typing…`;
  else text = 'Several people are typing…';
  typingIndicator.textContent = text;
  typingIndicator.classList.remove('hidden');
}

function appendHistorySeparator() {
  const sep = document.createElement('div');
  sep.className = 'history-separator';
  sep.textContent = '— Earlier messages —';
  chatMessages.appendChild(sep);
}

function renderMessageText(textEl, text) {
  textEl.textContent = '';

  const codeBlockRegex = /```([\s\S]*?)```/g;
  let lastIndex = 0;
  let match;
  let hasCodeBlock = false;

  while ((match = codeBlockRegex.exec(text)) !== null) {
    hasCodeBlock = true;
    if (match.index > lastIndex) {
      appendTextWithMentions(textEl, text.slice(lastIndex, match.index));
    }
    const pre = document.createElement('pre');
    const code = document.createElement('code');
    code.textContent = match[1].trim();
    pre.appendChild(code);
    textEl.appendChild(pre);
    lastIndex = match.index + match[0].length;
  }

  if (hasCodeBlock) {
    if (lastIndex < text.length) {
      appendTextWithMentions(textEl, text.slice(lastIndex));
    }
    return;
  }

  appendTextWithMentions(textEl, text);
}

function appendTextWithMentions(container, text) {
  const mentionRegex = /@([a-zA-Z0-9_\-\s.]+)/g;
  let lastIndex = 0;
  let match;

  while ((match = mentionRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      container.appendChild(document.createTextNode(text.slice(lastIndex, match.index)));
    }
    const span = document.createElement('span');
    span.className = 'mention';
    span.textContent = match[0];
    container.appendChild(span);
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    container.appendChild(document.createTextNode(text.slice(lastIndex)));
  }
}

function outputMessage(message, options = {}) {
  const { skipSound = false, skipScrollTrack = false } = options;

  const isBot = message.type === 'bot' || message.username === BOT_NAME;
  const isOwn =
    !isBot && message.username.trim().toLowerCase() === username.trim().toLowerCase();

  const div = document.createElement('div');
  div.classList.add('message');
  if (isBot) div.classList.add('message--bot');
  else if (isOwn) div.classList.add('message--own');
  else div.classList.add('message--other');

  const meta = document.createElement('p');
  meta.classList.add('meta');

  const nameSpan = document.createElement('span');
  nameSpan.className = 'meta-name';
  nameSpan.textContent = message.username;
  meta.appendChild(nameSpan);

  const timeSpan = document.createElement('span');
  timeSpan.className = 'meta-time';
  timeSpan.textContent = message.time || '';
  meta.appendChild(timeSpan);

  div.appendChild(meta);

  const textEl = document.createElement('p');
  textEl.classList.add('text');
  renderMessageText(textEl, message.text);
  div.appendChild(textEl);

  chatMessages.appendChild(div);

  if (!skipSound) {
    playNotification();
  }

  if (!skipScrollTrack && !isNearBottom) {
    unreadCount += 1;
    updateUnreadBadge();
  }
}

function outputRoomName(r) {
  roomName.textContent = r;
  joined = true;
}

function outputUsers(users) {
  userList.innerHTML = '';
  users.forEach((user) => {
    const li = document.createElement('li');
    if (user.username.trim() === username.trim()) {
      li.classList.add('curr-user');
    }
    li.textContent = user.username;
    userList.appendChild(li);
  });
  playNotification();
}

function scrollToBottom(smooth = true) {
  chatMessages.scrollTo({
    top: chatMessages.scrollHeight,
    behavior: smooth ? 'smooth' : 'auto',
  });
  isNearBottom = true;
  unreadCount = 0;
  updateUnreadBadge();
}

function updateUnreadBadge() {
  if (unreadCount > 0 && !isNearBottom) {
    unreadBadge.textContent = unreadCount > 99 ? '99+' : String(unreadCount);
    unreadBadge.classList.remove('hidden');
    scrollBottomBtn.classList.remove('hidden');
  } else {
    unreadBadge.classList.add('hidden');
    if (isNearBottom) scrollBottomBtn.classList.add('hidden');
  }
}

function handleScrollOnNewMessage() {
  if (isNearBottom) {
    scrollToBottom();
  } else {
    updateUnreadBadge();
  }
}

chatMessages.addEventListener('scroll', () => {
  const threshold = 80;
  isNearBottom =
    chatMessages.scrollHeight - chatMessages.scrollTop - chatMessages.clientHeight < threshold;
  if (isNearBottom) {
    unreadCount = 0;
    updateUnreadBadge();
  }
});

scrollBottomBtn.addEventListener('click', () => scrollToBottom());

chatForm.addEventListener('submit', (e) => {
  e.preventDefault();
  let msg = msgInput.value.trim();
  if (!msg || msg.length > MAX_MESSAGE_LENGTH) return;

  socket.emit('chatMessage', msg);
  socket.emit('stopTyping');
  isTyping = false;
  if (typingTimeout) clearTimeout(typingTimeout);

  msgInput.value = '';
  msgInput.focus();
});

msgInput.addEventListener('keydown', () => {
  if (!isTyping) {
    isTyping = true;
    socket.emit('typing');
  }
  if (typingTimeout) clearTimeout(typingTimeout);
  typingTimeout = setTimeout(() => {
    isTyping = false;
    socket.emit('stopTyping');
  }, 2000);
});

leaveRoomLink.addEventListener('click', (e) => {
  e.preventDefault();
  socket.emit('leaveRoom');
  window.location.href = 'index.html';
});

sidebarToggle.addEventListener('click', () => {
  chatSidebar.classList.add('open');
  document.body.classList.add('sidebar-open');
});

sidebarClose.addEventListener('click', () => {
  chatSidebar.classList.remove('open');
  document.body.classList.remove('sidebar-open');
});

document.body.addEventListener('click', (e) => {
  if (
    document.body.classList.contains('sidebar-open') &&
    !chatSidebar.contains(e.target) &&
    !sidebarToggle.contains(e.target)
  ) {
    chatSidebar.classList.remove('open');
    document.body.classList.remove('sidebar-open');
  }
});

setInterval(() => {
  if (socket.connected) socket.emit('heartbeat');
}, 25000);

window.addEventListener('beforeunload', () => {
  socket.emit('leaveRoom');
});
