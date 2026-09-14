/* =============================================
   TaskForge — Daily Task Management App
   ============================================= */

// ===== Configuration =====
const DAILY_HABITS = [
  { text: 'Commit to GitHub repo', category: 'dev', priority: 'high', isHabit: true },
  { text: 'Open & review AWS Cloud console', category: 'cloud', priority: 'high', isHabit: true },
  { text: 'Solve a DSA problem', category: 'learning', priority: 'high', isHabit: true },
  { text: 'Complete editing work', category: 'editing', priority: 'medium', isHabit: true },
];

const CATEGORIES = {
  all: { label: 'All', icon: '📋' },
  dev: { label: 'Dev Work', icon: '🔧' },
  cloud: { label: 'Cloud', icon: '☁️' },
  learning: { label: 'Learning', icon: '📚' },
  editing: { label: 'Editing', icon: '✏️' },
  general: { label: 'General', icon: '📌' },
};

const PRIORITY_LABELS = {
  high: '● High',
  medium: '● Medium',
  low: '● Low',
};

// ===== State =====
let state = {
  currentDate: getTodayString(),
  activeFilter: 'all',
  activeHistoryFilter: 'all',
  tasks: {},       // keyed by date string -> array of tasks
  streakData: {},  // keyed by date string -> boolean (all completed?)
};

// ===== Utilities =====
function getTodayString() {
  return formatDateString(new Date());
}

function formatDateString(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function parseDate(str) {
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function formatDisplayDate(dateStr) {
  const date = parseDate(dateStr);
  const today = new Date();
  const todayStr = getTodayString();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = formatDateString(yesterday);

  if (dateStr === todayStr) return 'Today';
  if (dateStr === yesterdayStr) return 'Yesterday';

  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 7);
}

function getTimeString() {
  return new Date().toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

// ===== Storage =====
function saveState() {
  localStorage.setItem('taskforge_data', JSON.stringify({
    tasks: state.tasks,
    streakData: state.streakData,
  }));
}

function loadState() {
  try {
    const raw = localStorage.getItem('taskforge_data');
    if (raw) {
      const data = JSON.parse(raw);
      state.tasks = data.tasks || {};
      state.streakData = data.streakData || {};
    }
  } catch (e) {
    console.warn('Failed to load state:', e);
  }
}

// ===== Task Operations =====
function getTasksForDate(dateStr) {
  return state.tasks[dateStr] || [];
}

function ensureDailyHabits(dateStr) {
  if (!state.tasks[dateStr]) {
    state.tasks[dateStr] = [];
  }

  const tasks = state.tasks[dateStr];
  const existingHabits = tasks.filter(t => t.isHabit).map(t => t.text);

  DAILY_HABITS.forEach(habit => {
    if (!existingHabits.includes(habit.text)) {
      tasks.unshift({
        id: generateId(),
        text: habit.text,
        category: habit.category,
        priority: habit.priority,
        isHabit: true,
        completed: false,
        createdAt: getTimeString(),
      });
    }
  });

  saveState();
}

function addTask(text, category, priority) {
  if (!text.trim()) return;

  if (!state.tasks[state.currentDate]) {
    state.tasks[state.currentDate] = [];
  }

  const task = {
    id: generateId(),
    text: text.trim(),
    category,
    priority,
    isHabit: false,
    completed: false,
    createdAt: getTimeString(),
  };

  state.tasks[state.currentDate].push(task);
  saveState();
  renderTasks();
  updateStats();
  showToast('✅', `Task added`);
}

function toggleTask(taskId) {
  const tasks = getTasksForDate(state.currentDate);
  const task = tasks.find(t => t.id === taskId);
  if (!task) return;

  task.completed = !task.completed;
  saveState();

  // Check if all tasks completed
  const allDone = tasks.length > 0 && tasks.every(t => t.completed);
  state.streakData[state.currentDate] = allDone;
  saveState();

  renderTasks();
  updateStats();

  if (allDone) {
    showConfetti();
    showToast('🎉', 'All tasks completed! Amazing!');
  }
}

function deleteTask(taskId) {
  const tasks = getTasksForDate(state.currentDate);
  const idx = tasks.findIndex(t => t.id === taskId);
  if (idx === -1) return;

  // Animate out
  const el = document.querySelector(`[data-task-id="${taskId}"]`);
  if (el) {
    el.classList.add('removing');
    setTimeout(() => {
      tasks.splice(idx, 1);
      saveState();
      renderTasks();
      updateStats();
    }, 300);
  } else {
    tasks.splice(idx, 1);
    saveState();
    renderTasks();
    updateStats();
  }

  showToast('🗑️', 'Task removed');
}

function clearCompleted() {
  const tasks = getTasksForDate(state.currentDate);
  state.tasks[state.currentDate] = tasks.filter(t => !t.completed);
  saveState();
  renderTasks();
  updateStats();
  showToast('🧹', 'Completed tasks cleared');
}

// ===== Date Navigation =====
function navigateDate(offset) {
  const current = parseDate(state.currentDate);
  current.setDate(current.getDate() + offset);
  state.currentDate = formatDateString(current);
  ensureDailyHabits(state.currentDate);
  renderDateNav();
  renderTasks();
  updateStats();
}

function goToToday() {
  state.currentDate = getTodayString();
  ensureDailyHabits(state.currentDate);
  renderDateNav();
  renderTasks();
  updateStats();
}

// ===== Streak Calculation =====
function calculateStreak() {
  let streak = 0;
  const today = new Date();
  const date = new Date(today);

  // If today is complete, include today
  if (state.streakData[formatDateString(date)]) {
    streak = 1;
    date.setDate(date.getDate() - 1);
  } else {
    // Start from yesterday
    date.setDate(date.getDate() - 1);
  }

  while (true) {
    const dateStr = formatDateString(date);
    if (state.streakData[dateStr]) {
      streak++;
      date.setDate(date.getDate() - 1);
    } else {
      break;
    }
  }

  return streak;
}

// ===== Rendering =====
function renderDateNav() {
  const dateDisplay = document.getElementById('currentDate');
  const displayText = formatDisplayDate(state.currentDate);
  dateDisplay.textContent = displayText;
  dateDisplay.classList.toggle('is-today', state.currentDate === getTodayString());
}

function renderTasks() {
  const container = document.getElementById('taskList');
  const tasks = getTasksForDate(state.currentDate);
  const filter = state.activeFilter;

  const filtered = filter === 'all' ? tasks : tasks.filter(t => t.category === filter);

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">📝</div>
        <h3>${tasks.length === 0 ? 'No tasks yet' : 'No tasks in this category'}</h3>
        <p>${tasks.length === 0 ? 'Add your first task or wait for daily habits to populate!' : 'Try selecting a different filter above.'}</p>
      </div>
    `;
    return;
  }

  // Sort: incomplete first, then habits first, then by priority
  const priorityOrder = { high: 0, medium: 1, low: 2 };
  const sorted = [...filtered].sort((a, b) => {
    if (a.completed !== b.completed) return a.completed ? 1 : -1;
    if (a.isHabit !== b.isHabit) return a.isHabit ? -1 : 1;
    return (priorityOrder[a.priority] || 1) - (priorityOrder[b.priority] || 1);
  });

  container.innerHTML = sorted.map(task => `
    <div class="task-item ${task.completed ? 'completed' : ''}" data-category="${task.category}" data-task-id="${task.id}">
      <label class="task-checkbox">
        <input type="checkbox" ${task.completed ? 'checked' : ''} onchange="toggleTask('${task.id}')">
        <span class="checkmark">✓</span>
      </label>
      <div class="task-content">
        <div class="task-text">${escapeHtml(task.text)}</div>
        <div class="task-meta">
          <span class="task-category-badge cat-${task.category}">${CATEGORIES[task.category]?.icon || '📌'} ${CATEGORIES[task.category]?.label || 'General'}</span>
          <span class="task-priority ${task.priority}">${PRIORITY_LABELS[task.priority] || ''}</span>
          ${task.isHabit ? '<span class="habit-badge">DAILY</span>' : ''}
          <span class="task-time">${task.createdAt}</span>
        </div>
      </div>
      <div class="task-actions">
        <button class="task-action-btn" onclick="deleteTask('${task.id}')" title="Delete task">🗑️</button>
      </div>
    </div>
  `).join('');

  // Update filter counts
  renderFilterCounts();
}

function renderFilterCounts() {
  const tasks = getTasksForDate(state.currentDate);
  document.querySelectorAll('.filter-btn').forEach(btn => {
    const cat = btn.dataset.category;
    const count = cat === 'all' ? tasks.length : tasks.filter(t => t.category === cat).length;
    const countEl = btn.querySelector('.filter-count');
    if (countEl) countEl.textContent = count;
  });
}

function updateStats() {
  const tasks = getTasksForDate(state.currentDate);
  const completed = tasks.filter(t => t.completed).length;
  const total = tasks.length;
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;

  // Progress
  document.getElementById('progressPct').textContent = `${pct}%`;
  document.getElementById('progressText').textContent = `${completed}/${total} done`;

  // Progress ring
  const ring = document.getElementById('progressRingFill');
  const circumference = 188.5; // 2 * π * 30
  const offset = circumference - (pct / 100) * circumference;
  ring.style.strokeDashoffset = offset;

  // Streak
  const streak = calculateStreak();
  document.getElementById('streakValue').textContent = streak;
  document.getElementById('streakSub').textContent = streak > 0
    ? `${streak} day${streak > 1 ? 's' : ''} in a row!`
    : 'Complete all tasks to start';

  // Total
  document.getElementById('totalValue').textContent = total;
  document.getElementById('totalSub').textContent = `${completed} completed, ${total - completed} remaining`;

  // Update streak data
  const allDone = total > 0 && tasks.every(t => t.completed);
  state.streakData[state.currentDate] = allDone;
  saveState();

  // Update history modal if open
  const histOverlay = document.getElementById('historyModalOverlay');
  if (histOverlay && histOverlay.classList.contains('active')) {
    updateHistoryModalContent();
  }
}

function setActiveFilter(category) {
  state.activeFilter = category;
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.category === category);
  });
  renderTasks();
}

// ===== History & Progress Overview =====
function getAllRecordedDates() {
  const dates = new Set(Object.keys(state.tasks).filter(d => (state.tasks[d] || []).length > 0));
  if (state.currentDate) dates.add(state.currentDate);
  return Array.from(dates).sort((a, b) => b.localeCompare(a));
}

function computeHistoryStats() {
  const dates = getAllRecordedDates();
  let totalTasks = 0;
  let completedTasks = 0;

  dates.forEach(dateStr => {
    const list = state.tasks[dateStr] || [];
    totalTasks += list.length;
    completedTasks += list.filter(t => t.completed).length;
  });

  const avgRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
  const streak = calculateStreak();

  return {
    daysTracked: dates.length,
    avgRate,
    completedTasks,
    streak,
  };
}

function computeWeeklyActivity() {
  const activity = [];
  const today = new Date();

  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dateStr = formatDateString(d);
    const tasks = state.tasks[dateStr] || [];
    const completed = tasks.filter(t => t.completed).length;
    const total = tasks.length;
    const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
    const dayLabel = d.toLocaleDateString('en-US', { weekday: 'short' });
    const isToday = (dateStr === getTodayString());

    activity.push({
      dateStr,
      dayLabel,
      pct,
      completed,
      total,
      isToday,
      hasData: total > 0,
    });
  }

  return activity;
}

function renderWeeklyChart() {
  const container = document.getElementById('weeklyChart');
  if (!container) return;

  const weekData = computeWeeklyActivity();
  container.innerHTML = weekData.map(d => {
    const isComplete = d.hasData && d.pct === 100;
    const isZero = d.pct === 0;
    const height = d.hasData ? Math.max(d.pct, 8) : 4;
    return `
      <div class="weekly-col ${d.isToday ? 'is-today' : ''}" data-jump-date="${d.dateStr}" title="${d.dateStr}: ${d.completed}/${d.total} done (${d.pct}%) — Click to jump">
        <span class="weekly-day-pct">${d.hasData ? `${d.pct}%` : '—'}</span>
        <div class="weekly-bar-track">
          <div class="weekly-bar-fill ${isComplete ? 'complete' : ''} ${isZero ? 'zero' : ''}" style="height: ${height}%;"></div>
        </div>
        <span class="weekly-day-label">${d.dayLabel}</span>
      </div>
    `;
  }).join('');
}

function renderHistoryList(filter = 'all') {
  const container = document.getElementById('historyList');
  if (!container) return;

  const dates = getAllRecordedDates();
  let filtered = dates;

  if (filter === 'completed') {
    filtered = dates.filter(d => {
      const list = state.tasks[d] || [];
      return list.length > 0 && list.every(t => t.completed);
    });
  } else if (filter === 'pending') {
    filtered = dates.filter(d => {
      const list = state.tasks[d] || [];
      return list.length === 0 || list.some(t => !t.completed);
    });
  }

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="history-empty">
        <div class="history-empty-icon">📂</div>
        <p><strong>No history records found</strong></p>
        <p style="font-size: 0.8rem; margin-top: 4px;">
          ${dates.length === 0 ? 'Start crushing tasks daily, or click "Load Demo History" below to preview!' : 'No days match the selected filter.'}
        </p>
      </div>
    `;
    return;
  }

  container.innerHTML = filtered.map(dateStr => {
    const tasks = state.tasks[dateStr] || [];
    const completed = tasks.filter(t => t.completed).length;
    const total = tasks.length;
    const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
    const isCurrent = (dateStr === state.currentDate);

    let badgeClass = 'none';
    let badgeText = '0% done';
    if (total > 0 && completed === total) {
      badgeClass = 'complete';
      badgeText = '✓ 100% Done';
    } else if (completed > 0) {
      badgeClass = 'partial';
      badgeText = `${pct}% done`;
    }

    const displayTitle = formatDisplayDate(dateStr);
    const parsed = parseDate(dateStr);
    const fullDate = parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

    return `
      <div class="history-day-card" data-date="${dateStr}">
        <div class="history-card-header">
          <div class="history-date-info">
            <span class="history-date-name ${isCurrent ? 'is-active-day' : ''}">
              ${displayTitle} <span style="font-weight: 400; font-size: 0.78rem; color: var(--text-muted);">(${fullDate})</span>
              ${isCurrent ? '<span style="font-size: 0.72rem; color: var(--accent-primary); font-weight: 700; margin-left: 4px;">● Active</span>' : ''}
            </span>
            <span class="history-status-badge ${badgeClass}">${badgeText}</span>
          </div>
          <div class="history-card-actions">
            <button class="history-details-toggle" data-toggle-date="${dateStr}" aria-label="Toggle task details for ${dateStr}">
              Details ▾
            </button>
            <button class="history-jump-btn" data-jump-date="${dateStr}" aria-label="Jump to ${dateStr}">
              <span>View Day</span> →
            </button>
          </div>
        </div>

        <div class="history-progress-row">
          <div class="history-progress-track">
            <div class="history-progress-fill" style="width: ${pct}%;"></div>
          </div>
          <span class="history-progress-text">${completed}/${total} completed</span>
        </div>

        <div class="history-tasks-breakdown" id="breakdown-${dateStr}" style="display: none;">
          ${tasks.length === 0 ? '<div style="font-size: 0.78rem; color: var(--text-muted);">No tasks recorded for this day.</div>' : tasks.map(t => `
            <div class="history-task-item ${t.completed ? 'is-done' : ''}">
              <span style="display: flex; align-items: center;">
                <span class="hist-check">${t.completed ? '✓' : '○'}</span>
                <span style="${t.completed ? 'text-decoration: line-through; opacity: 0.75;' : ''}">${escapeHtml(t.text)}</span>
              </span>
              <span class="task-category-badge cat-${t.category}" style="font-size: 0.68rem; padding: 2px 7px;">
                ${CATEGORIES[t.category]?.icon || '📌'} ${CATEGORIES[t.category]?.label || 'General'}
              </span>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }).join('');
}

function updateHistoryModalContent() {
  const stats = computeHistoryStats();
  const daysEl = document.getElementById('historyDaysTracked');
  const avgEl = document.getElementById('historyAvgRate');
  const finishedEl = document.getElementById('historyTasksFinished');
  const streakEl = document.getElementById('historyBestStreak');

  if (daysEl) daysEl.textContent = stats.daysTracked;
  if (avgEl) avgEl.textContent = `${stats.avgRate}%`;
  if (finishedEl) finishedEl.textContent = stats.completedTasks;
  if (streakEl) streakEl.textContent = `${stats.streak} 🔥`;

  renderWeeklyChart();
  renderHistoryList(state.activeHistoryFilter);
}

function openHistoryModal() {
  const overlay = document.getElementById('historyModalOverlay');
  if (!overlay) return;

  updateHistoryModalContent();
  overlay.classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closeHistoryModal() {
  const overlay = document.getElementById('historyModalOverlay');
  if (overlay) {
    overlay.classList.remove('active');
    document.body.style.overflow = '';
  }
}

function jumpToDate(dateStr) {
  state.currentDate = dateStr;
  ensureDailyHabits(state.currentDate);
  renderDateNav();
  renderTasks();
  updateStats();
  closeHistoryModal();
  showToast('📅', `Switched to ${formatDisplayDate(dateStr)}`);
}

function toggleHistoryDetails(dateStr) {
  const breakdown = document.getElementById(`breakdown-${dateStr}`);
  const btn = document.querySelector(`[data-toggle-date="${dateStr}"]`);
  if (!breakdown) return;

  const isHidden = (breakdown.style.display === 'none' || !breakdown.style.display);
  breakdown.style.display = isHidden ? 'flex' : 'none';
  if (btn) {
    btn.textContent = isHidden ? 'Details ▴' : 'Details ▾';
  }
}

function loadDemoHistory() {
  const today = new Date();

  // Populate previous 5 days with realistic activity
  const demoData = [
    { offset: 1, habitDone: [true, true, true, true], extra: [{ text: 'Review PR #42 on GitHub', category: 'dev', priority: 'high', completed: true }] },
    { offset: 2, habitDone: [true, true, true, false], extra: [{ text: 'Setup S3 bucket lifecycle policy', category: 'cloud', priority: 'medium', completed: true }] },
    { offset: 3, habitDone: [true, true, true, true], extra: [{ text: 'Practice Dynamic Programming patterns', category: 'learning', priority: 'high', completed: true }] },
    { offset: 4, habitDone: [true, false, true, false], extra: [{ text: 'Draft sprint notes & documentation', category: 'general', priority: 'low', completed: true }] },
    { offset: 5, habitDone: [true, true, true, true], extra: [] },
  ];

  demoData.forEach(({ offset, habitDone, extra }) => {
    const d = new Date(today);
    d.setDate(d.getDate() - offset);
    const dateStr = formatDateString(d);

    if (!state.tasks[dateStr] || state.tasks[dateStr].length === 0) {
      state.tasks[dateStr] = DAILY_HABITS.map((h, idx) => ({
        id: generateId(),
        text: h.text,
        category: h.category,
        priority: h.priority,
        isHabit: true,
        completed: habitDone[idx] ?? true,
        createdAt: '09:00 AM',
      }));

      extra.forEach(ex => {
        state.tasks[dateStr].push({
          id: generateId(),
          text: ex.text,
          category: ex.category,
          priority: ex.priority,
          isHabit: false,
          completed: ex.completed,
          createdAt: '02:30 PM',
        });
      });
    }

    const allDone = state.tasks[dateStr].length > 0 && state.tasks[dateStr].every(t => t.completed);
    state.streakData[dateStr] = allDone;
  });

  saveState();
  updateHistoryModalContent();
  updateStats();
  showToast('✨', 'Demo history loaded successfully!');
}

// ===== UI Helpers =====
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function showToast(icon, message) {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.innerHTML = `<span class="toast-icon">${icon}</span>${message}`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('toast-out');
    setTimeout(() => toast.remove(), 300);
  }, 2500);
}

function showConfetti() {
  const container = document.getElementById('confettiContainer');
  const colors = ['#7c5cfc', '#38bdf8', '#34d399', '#f59e0b', '#ec4899', '#f87171'];

  for (let i = 0; i < 50; i++) {
    const confetti = document.createElement('div');
    confetti.className = 'confetti';
    confetti.style.left = Math.random() * 100 + '%';
    confetti.style.top = '-10px';
    confetti.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
    confetti.style.animationDelay = Math.random() * 0.5 + 's';
    confetti.style.animationDuration = (1 + Math.random()) + 's';
    confetti.style.width = (5 + Math.random() * 8) + 'px';
    confetti.style.height = (5 + Math.random() * 8) + 'px';
    container.appendChild(confetti);

    setTimeout(() => confetti.remove(), 2500);
  }
}

// ===== Event Handlers =====
function handleAddTask(e) {
  e.preventDefault();
  const input = document.getElementById('taskInput');
  const category = document.getElementById('categorySelect').value;
  const priority = document.getElementById('prioritySelect').value;

  if (!input.value.trim()) {
    input.focus();
    return;
  }

  addTask(input.value, category, priority);
  input.value = '';
  input.focus();
}

function handleKeyPress(e) {
  if (e.key === 'Enter') {
    handleAddTask(e);
  }
}

// ===== Initialization =====
function init() {
  loadState();
  ensureDailyHabits(state.currentDate);

  // Render
  renderDateNav();
  renderTasks();
  updateStats();

  // Event listeners - Tasks & Navigation
  document.getElementById('addTaskBtn').addEventListener('click', handleAddTask);
  document.getElementById('taskInput').addEventListener('keypress', handleKeyPress);
  document.getElementById('prevDate').addEventListener('click', () => navigateDate(-1));
  document.getElementById('nextDate').addEventListener('click', () => navigateDate(1));
  document.getElementById('currentDate').addEventListener('click', goToToday);
  document.getElementById('clearCompleted').addEventListener('click', clearCompleted);

  // Category filter buttons
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => setActiveFilter(btn.dataset.category));
  });

  // History button & modal events
  const historyBtn = document.getElementById('historyBtn');
  if (historyBtn) {
    historyBtn.addEventListener('click', openHistoryModal);
  }

  const closeHistoryBtn = document.getElementById('closeHistoryBtn');
  if (closeHistoryBtn) {
    closeHistoryBtn.addEventListener('click', closeHistoryModal);
  }

  const closeHistoryFooterBtn = document.getElementById('closeHistoryFooterBtn');
  if (closeHistoryFooterBtn) {
    closeHistoryFooterBtn.addEventListener('click', closeHistoryModal);
  }

  const historyOverlay = document.getElementById('historyModalOverlay');
  if (historyOverlay) {
    historyOverlay.addEventListener('click', (e) => {
      if (e.target.id === 'historyModalOverlay') {
        closeHistoryModal();
      }
    });
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeHistoryModal();
    }
  });

  const loadDemoBtn = document.getElementById('loadDemoBtn');
  if (loadDemoBtn) {
    loadDemoBtn.addEventListener('click', loadDemoHistory);
  }

  // History filter tabs
  document.querySelectorAll('.history-filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.history-filter-btn').forEach(b => {
        b.classList.remove('active');
        b.setAttribute('aria-selected', 'false');
      });
      btn.classList.add('active');
      btn.setAttribute('aria-selected', 'true');
      state.activeHistoryFilter = btn.dataset.histFilter;
      renderHistoryList(state.activeHistoryFilter);
    });
  });

  // History list event delegation (Jump & Toggle details)
  const historyList = document.getElementById('historyList');
  if (historyList) {
    historyList.addEventListener('click', (e) => {
      const jumpBtn = e.target.closest('.history-jump-btn');
      if (jumpBtn) {
        const date = jumpBtn.dataset.jumpDate;
        if (date) jumpToDate(date);
        return;
      }

      const toggleBtn = e.target.closest('.history-details-toggle');
      if (toggleBtn) {
        const date = toggleBtn.dataset.toggleDate;
        if (date) toggleHistoryDetails(date);
        return;
      }
    });
  }

  // Weekly chart click delegation (Jump to clicked date)
  const weeklyChart = document.getElementById('weeklyChart');
  if (weeklyChart) {
    weeklyChart.addEventListener('click', (e) => {
      const col = e.target.closest('.weekly-col');
      if (col && col.dataset.jumpDate) {
        jumpToDate(col.dataset.jumpDate);
      }
    });
  }

  // Focus the input
  document.getElementById('taskInput').focus();
}

// Start the app
document.addEventListener('DOMContentLoaded', init);
