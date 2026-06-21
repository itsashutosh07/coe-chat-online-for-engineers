const roomSelect = document.getElementById('room');
const joinForm = document.getElementById('join-form');
const joinError = document.getElementById('join-error');

const socket = io();

function formatRoomLabel(name, count) {
  if (count > 0) return `${name} (${count} online)`;
  return name;
}

function updateRoomOptions(rooms) {
  const countMap = {};
  rooms.forEach(({ room, count }) => {
    countMap[room] = count;
  });

  Array.from(roomSelect.options).forEach((option) => {
    const roomKey = option.dataset.room || option.value;
    if (!roomKey || roomKey === 'default' || option.disabled) return;
    const count = countMap[roomKey] || 0;
    option.textContent = formatRoomLabel(roomKey, count);
  });
}

socket.on('connect', () => {
  socket.emit('getRooms');
});

socket.on('roomDirectory', (rooms) => {
  updateRoomOptions(rooms);
});

roomSelect.addEventListener('change', (e) => {
  if (e.target.value === 'default') {
    const value = window.prompt('Enter room name');
    if (!value || !value.trim()) {
      e.target.selectedIndex = 0;
      return;
    }
    const trimmed = value.trim().slice(0, 50);
    const existing = Array.from(roomSelect.options).find((o) => o.value === trimmed);
    if (existing) {
      roomSelect.value = trimmed;
      return;
    }
    const option = document.createElement('option');
    option.value = trimmed;
    option.dataset.room = trimmed;
    option.textContent = trimmed;
    roomSelect.insertBefore(option, roomSelect.lastElementChild);
    roomSelect.value = trimmed;
  }
});

joinForm.addEventListener('submit', (e) => {
  const username = document.getElementById('username').value.trim();
  const room = roomSelect.value;

  if (!username || !room || room === 'default') {
    e.preventDefault();
    joinError.textContent = 'Please enter a username and select a room.';
    joinError.classList.remove('hidden');
    return;
  }

  joinError.classList.add('hidden');
  socket.disconnect();
});
