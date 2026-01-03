const state = {
  userId: null,
  activeCourse: null,
  progress: null,
  completions: [],
  view: 'loading', // loading | user | courseSelect | moduleList | module | journal
  moduleIndex: 0,
  pageIndex: 0
};

function $(id) {
  return document.getElementById(id);
}

function setStatus(text) {
  const el = $('statusText');
  if (el) el.textContent = text;
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

async function api(path, options) {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...options
  });
  if (!res.ok) {
    let msg = `${res.status} ${res.statusText}`;
    try {
      const j = await res.json();
      if (j && j.error) msg = j.error;
    } catch {
      // ignore
    }
    throw new Error(msg);
  }
  return await res.json();
}

function render(html) {
  $('root').innerHTML = html;
}

function getCompletionKey(moduleIndex, pageIndex) {
  return `${moduleIndex}-${pageIndex}`;
}

function buildCompletedSet(completions) {
  const s = new Set();
  for (const c of completions) {
    s.add(getCompletionKey(c.module_index, c.page_index));
  }
  return s;
}

async function loadInitial() {
  setStatus('Loading…');
  const savedUser = localStorage.getItem('plc_userId');
  if (savedUser) state.userId = Number(savedUser);

  $('btnSwitchUser').addEventListener('click', () => {
    localStorage.removeItem('plc_userId');
    state.userId = null;
    state.activeCourse = null;
    state.progress = null;
    state.completions = [];
    state.view = 'user';
    paint();
  });

  $('btnJournal').addEventListener('click', async () => {
    if (!state.userId) return;
    state.view = 'journal';
    paint();
    try {
      const entries = await api(`/api/users/${state.userId}/journal`);
      paintJournal(entries);
    } catch (e) {
      setStatus(`Error: ${e.message}`);
      paint();
    }
  });

  // Ensure server is reachable
  try {
    await api('/api/health');
  } catch (e) {
    render(`
      <div class="card">
        <div class="title">Backend not running</div>
        <div class="divider"></div>
        <div class="muted">Start the server, then refresh.</div>
        <div class="divider"></div>
        <pre class="page">${escapeHtml(String(e.message))}</pre>
      </div>
    `);
    setStatus('Backend not reachable');
    return;
  }

  if (!state.userId) {
    state.view = 'user';
    paint();
    return;
  }

  await loadUserContext();
}

async function loadUserContext() {
  setStatus('Loading user…');
  try {
    state.activeCourse = await api(`/api/users/${state.userId}/active-course`);
  } catch {
    state.activeCourse = null;
  }

  if (!state.activeCourse) {
    state.view = 'courseSelect';
    paint();
    setStatus('Select a course');
    return;
  }

  await loadCourseContext();
}

async function loadCourseContext() {
  setStatus('Loading course…');
  const courseId = state.activeCourse.id;
  state.progress = await api(`/api/users/${state.userId}/courses/${courseId}/progress`);
  state.completions = await api(`/api/users/${state.userId}/courses/${courseId}/completions`);
  state.view = 'moduleList';
  paint();
  setStatus('Ready');
}

function paint() {
  if (state.view === 'user') return paintUserSelector();
  if (state.view === 'courseSelect') return paintCourseSelect();
  if (state.view === 'moduleList') return paintModuleList();
  if (state.view === 'module') return paintModuleView();
  if (state.view === 'journal') return paintJournalLoading();
  render(`<div class="card"><div class="loading">Loading…</div></div>`);
}

async function paintUserSelector() {
  setStatus('Choose a user');
  const users = await api('/api/users');

  render(`
    <div class="card stack">
      <div>
        <div class="title">Who’s learning?</div>
        <div class="muted">Multiple people can use the same device. Your selection is stored locally.</div>
      </div>

      <div class="grid2">
        <div class="stack">
          <label class="muted">Select existing user</label>
          <select id="userSelect" class="select">
            <option value="">Select…</option>
            ${users.map((u) => `<option value="${u.id}">${escapeHtml(u.name)}</option>`).join('')}
          </select>
          <button id="btnUseUser" class="btn btn--primary" type="button">Continue</button>
        </div>

        <div class="stack">
          <label class="muted">Create a new user</label>
          <input id="newUserName" class="input" placeholder="Name (e.g. Nick)" />
          <button id="btnCreateUser" class="btn btn--success" type="button">Create user</button>
        </div>
      </div>
    </div>
  `);

  $('btnUseUser').addEventListener('click', async () => {
    const v = $('userSelect').value;
    if (!v) return;
    state.userId = Number(v);
    localStorage.setItem('plc_userId', String(state.userId));
    await loadUserContext();
  });

  $('btnCreateUser').addEventListener('click', async () => {
    const name = $('newUserName').value.trim();
    if (!name) return;
    try {
      const created = await api('/api/users', { method: 'POST', body: JSON.stringify({ name }) });
      state.userId = Number(created.id);
      localStorage.setItem('plc_userId', String(state.userId));
      await loadUserContext();
    } catch (e) {
      setStatus(`Error: ${e.message}`);
    }
  });
}

async function paintCourseSelect() {
  setStatus('Choose an active course');
  const courses = await api('/api/courses');

  render(`
    <div class="card stack">
      <div>
        <div class="title">Pick a course</div>
        <div class="muted">You can switch anytime—no penalties for skipping days.</div>
      </div>

      <div class="list">
        ${courses
          .map(
            (c) => `
            <div class="item" data-course-id="${escapeHtml(c.id)}">
              <div class="item__top">
                <div class="spacer">
                  <div><strong>${escapeHtml(c.title)}</strong></div>
                  <div class="muted">${escapeHtml(c.description || '')}</div>
                </div>
                <span class="badge badge--warn">Select</span>
              </div>
            </div>
          `
          )
          .join('')}
      </div>

      <div class="divider"></div>

      <div class="stack">
        <div class="title">Add a course JSON</div>
        <div class="muted">Paste a full course JSON (matching your schema) and save it locally.</div>
        <textarea id="courseJson" class="textarea" placeholder='{"id":"guitar-fundamentals","title":"...","modules":[...]}'></textarea>
        <div class="row">
          <button id="btnAddCourse" class="btn btn--success" type="button">Save course</button>
          <button id="btnSeedHint" class="btn btn--ghost" type="button">Need a sample?</button>
        </div>
        <div id="seedHint" class="muted" style="display:none">
          Run <code>npm run seed</code> once to load a sample course + users, then refresh.
        </div>
      </div>
    </div>
  `);

  document.querySelectorAll('[data-course-id]').forEach((el) => {
    el.addEventListener('click', async () => {
      const courseId = el.getAttribute('data-course-id');
      try {
        await api(`/api/users/${state.userId}/active-course`, {
          method: 'PUT',
          body: JSON.stringify({ courseId })
        });
        state.activeCourse = await api(`/api/courses/${courseId}`);
        await loadCourseContext();
      } catch (e) {
        setStatus(`Error: ${e.message}`);
      }
    });
  });

  $('btnAddCourse').addEventListener('click', async () => {
    const text = $('courseJson').value.trim();
    if (!text) return;
    let course;
    try {
      course = JSON.parse(text);
    } catch (e) {
      setStatus(`Invalid JSON: ${e.message}`);
      return;
    }

    try {
      const out = await api('/api/courses', { method: 'POST', body: JSON.stringify(course) });
      await api(`/api/users/${state.userId}/active-course`, {
        method: 'PUT',
        body: JSON.stringify({ courseId: out.courseId })
      });
      state.activeCourse = await api(`/api/courses/${out.courseId}`);
      await loadCourseContext();
    } catch (e) {
      setStatus(`Error: ${e.message}`);
    }
  });

  $('btnSeedHint').addEventListener('click', () => {
    $('seedHint').style.display = 'block';
  });
}

function paintModuleList() {
  const course = state.activeCourse;
  const modules = state.progress?.modules || [];
  const totalPages = modules.reduce((sum, m) => sum + (m.totalPages || 0), 0);
  const completedPages = state.progress?.completedPages || 0;
  const pct = totalPages ? Math.round((completedPages / totalPages) * 100) : 0;

  render(`
    <div class="card stack">
      <div class="row">
        <div class="spacer">
          <div class="title">${escapeHtml(course.title)}</div>
          <div class="muted">${escapeHtml(course.description || '')}</div>
        </div>
        <button id="btnChangeCourse" class="btn btn--ghost" type="button">Change course</button>
      </div>

      <div class="stack">
        <div class="row">
          <div class="muted">Overall progress</div>
          <div class="spacer"></div>
          <div class="muted">${completedPages}/${totalPages} pages</div>
        </div>
        <div class="progressbar"><div class="progressbar__fill" style="width:${pct}%"></div></div>
      </div>

      <div class="divider"></div>

      <div class="list">
        ${modules
          .map((m) => {
            const badge = m.isComplete
              ? `<span class="badge badge--ok">Done</span>`
              : `<span class="badge badge--warn">${m.completedPages}/${m.totalPages}</span>`;
            return `
              <div class="item" data-module-index="${m.moduleIndex}">
                <div class="item__top">
                  <div class="spacer">
                    <div><strong>${escapeHtml(m.title)}</strong></div>
                    <div class="muted">${escapeHtml(m.totalPages ? `${m.totalPages} pages` : 'No pages')}</div>
                  </div>
                  ${badge}
                </div>
              </div>
            `;
          })
          .join('')}
      </div>

      <div class="row">
        <button id="btnResume" class="btn btn--primary" type="button">Resume</button>
      </div>
    </div>
  `);

  $('btnChangeCourse').addEventListener('click', async () => {
    state.activeCourse = null;
    state.progress = null;
    state.completions = [];
    state.view = 'courseSelect';
    paint();
  });

  document.querySelectorAll('[data-module-index]').forEach((el) => {
    el.addEventListener('click', () => {
      const mi = Number(el.getAttribute('data-module-index'));
      state.moduleIndex = mi;
      state.pageIndex = 0;
      state.view = 'module';
      paint();
    });
  });

  $('btnResume').addEventListener('click', () => {
    const next = state.progress?.nextModuleIndex ?? 0;
    state.moduleIndex = next;
    state.pageIndex = 0;
    state.view = 'module';
    paint();
  });
}

function currentPage() {
  const course = state.activeCourse;
  const module = course.modules?.[state.moduleIndex];
  const page = module?.pages?.[state.pageIndex];
  return { course, module, page };
}

function paintModuleView() {
  const { course, module, page } = currentPage();
  if (!module || !page) {
    state.view = 'moduleList';
    paint();
    return;
  }

  const completedSet = buildCompletedSet(state.completions);
  const key = getCompletionKey(state.moduleIndex, state.pageIndex);
  const isCompleted = completedSet.has(key);

  const pageHeader = `
    <div class="row">
      <button id="btnBackModules" class="btn btn--ghost" type="button">← Modules</button>
      <div class="spacer"></div>
      <span class="badge">${escapeHtml(`Page ${state.pageIndex + 1} of ${module.pages.length}`)}</span>
    </div>
    <div class="divider"></div>
    <div class="title">${escapeHtml(module.title || `Module ${state.moduleIndex + 1}`)}</div>
    <div class="muted">${escapeHtml(page.type)} ${isCompleted ? '• completed' : ''}</div>
  `;

  const pageBody = renderPage(page);

  render(`
    <div class="card stack">
      ${pageHeader}
      <div class="page">${pageBody}</div>
      <div class="row">
        <button id="btnPrev" class="btn" type="button">← Previous</button>
        <button id="btnNext" class="btn btn--primary" type="button">Next →</button>
        <div class="spacer"></div>
        <button id="btnMarkViewed" class="btn btn--success" type="button">Mark complete</button>
      </div>
    </div>
  `);

  $('btnBackModules').addEventListener('click', () => {
    state.view = 'moduleList';
    paint();
  });

  $('btnPrev').addEventListener('click', () => {
    if (state.pageIndex > 0) state.pageIndex--;
    else if (state.moduleIndex > 0) {
      state.moduleIndex--;
      state.pageIndex = Math.max(0, (course.modules[state.moduleIndex].pages || []).length - 1);
    }
    paint();
  });

  $('btnNext').addEventListener('click', () => {
    if (state.pageIndex < module.pages.length - 1) state.pageIndex++;
    else if (state.moduleIndex < course.modules.length - 1) {
      state.moduleIndex++;
      state.pageIndex = 0;
    } else {
      state.view = 'moduleList';
    }
    paint();
  });

  $('btnMarkViewed').addEventListener('click', async () => {
    try {
      await completePage(page, null);
      await refreshProgressAndCompletions();
      paint();
      setStatus('Saved');
    } catch (e) {
      setStatus(`Error: ${e.message}`);
    }
  });

  wirePageInteractions(page);
}

function renderPage(page) {
  if (page.type === 'info') {
    return `
      <div class="stack">
        ${page.title ? `<div class="title">${escapeHtml(page.title)}</div>` : ''}
        <div class="rich">${page.content || ''}</div>
      </div>
    `;
  }

  if (page.type === 'video') {
    return `
      <div class="stack">
        ${page.title ? `<div class="title">${escapeHtml(page.title)}</div>` : ''}
        <iframe src="${escapeHtml(page.url || '')}" allowfullscreen></iframe>
      </div>
    `;
  }

  if (page.type === 'quiz') {
    return `
      <div class="stack">
        <div class="title">${escapeHtml(page.question || 'Quiz')}</div>
        <div class="stack" id="quizOptions">
          ${(page.options || [])
            .map(
              (opt, i) => `
              <label class="item" style="cursor:pointer">
                <div class="item__top">
                  <input type="radio" name="quizAnswer" value="${i}" />
                  <div class="spacer">${escapeHtml(opt)}</div>
                </div>
              </label>
            `
            )
            .join('')}
        </div>
        <div class="row">
          <button id="btnSubmitQuiz" class="btn btn--primary" type="button">Submit answer</button>
          <span id="quizFeedback" class="muted"></span>
        </div>
      </div>
    `;
  }

  if (page.type === 'journal') {
    return `
      <div class="stack">
        <div class="title">${escapeHtml(page.prompt || 'Journal')}</div>
        <textarea id="journalText" class="textarea" placeholder="${escapeHtml(
          page.placeholder || 'Write your thoughts…'
        )}"></textarea>
        <div class="row">
          <button id="btnSaveJournal" class="btn btn--success" type="button">Save entry</button>
          <span id="journalFeedback" class="muted"></span>
        </div>
      </div>
    `;
  }

  if (page.type === 'checkbox') {
    return `
      <div class="stack">
        <label class="row item" style="cursor:pointer">
          <input id="habitCheck" type="checkbox" />
          <div class="spacer"><strong>${escapeHtml(page.prompt || 'Complete')}</strong></div>
          <span class="badge badge--warn">Habit</span>
        </label>
        <div class="muted">Toggling records a completion event (history is kept).</div>
      </div>
    `;
  }

  return `<div class="muted">Unknown page type: ${escapeHtml(page.type)}</div>`;
}

function wirePageInteractions(page) {
  if (page.type === 'quiz') {
    const btn = $('btnSubmitQuiz');
    if (!btn) return;
    btn.addEventListener('click', async () => {
      const selected = document.querySelector('input[name="quizAnswer"]:checked');
      if (!selected) return setStatus('Select an answer first');
      const selectedIndex = Number(selected.value);
      const isCorrect = selectedIndex === Number(page.correctIndex);
      try {
        await completePage(page, { selectedIndex, isCorrect });
        $('quizFeedback').textContent = isCorrect ? 'Correct' : 'Saved (incorrect)';
        await refreshProgressAndCompletions();
        setStatus('Saved');
      } catch (e) {
        setStatus(`Error: ${e.message}`);
      }
    });
  }

  if (page.type === 'journal') {
    const btn = $('btnSaveJournal');
    if (!btn) return;
    btn.addEventListener('click', async () => {
      const content = ($('journalText')?.value || '').trim();
      if (!content) return setStatus('Write something first');
      try {
        await completePage(page, { content });
        $('journalFeedback').textContent = 'Saved';
        await refreshProgressAndCompletions();
        setStatus('Saved');
      } catch (e) {
        setStatus(`Error: ${e.message}`);
      }
    });
  }

  if (page.type === 'checkbox') {
    const el = $('habitCheck');
    if (!el) return;
    el.addEventListener('change', async (e) => {
      try {
        await completePage(page, { checked: Boolean(e.target.checked) });
        await refreshProgressAndCompletions();
        setStatus('Saved');
      } catch (err) {
        setStatus(`Error: ${err.message}`);
      }
    });
  }
}

async function completePage(page, pageData) {
  const courseId = state.activeCourse.id;
  const pageType = page.type;

  let data = null;
  if (pageType === 'quiz') data = { selectedIndex: pageData.selectedIndex, isCorrect: pageData.isCorrect };
  if (pageType === 'journal') data = { content: pageData.content };
  if (pageType === 'checkbox') data = { checked: pageData.checked };

  await api('/api/page-completion', {
    method: 'POST',
    body: JSON.stringify({
      userId: state.userId,
      courseId,
      moduleIndex: state.moduleIndex,
      pageIndex: state.pageIndex,
      pageType,
      data
    })
  });
}

async function refreshProgressAndCompletions() {
  const courseId = state.activeCourse.id;
  state.progress = await api(`/api/users/${state.userId}/courses/${courseId}/progress`);
  state.completions = await api(`/api/users/${state.userId}/courses/${courseId}/completions`);
}

function paintJournalLoading() {
  render(`
    <div class="card stack">
      <div class="row">
        <button id="btnBackFromJournal" class="btn btn--ghost" type="button">← Back</button>
        <div class="spacer"></div>
        <span class="badge">Journal</span>
      </div>
      <div class="divider"></div>
      <div class="loading">Loading journal…</div>
    </div>
  `);

  $('btnBackFromJournal').addEventListener('click', () => {
    state.view = state.activeCourse ? 'moduleList' : 'courseSelect';
    paint();
  });
}

function paintJournal(entries) {
  render(`
    <div class="card stack">
      <div class="row">
        <button id="btnBackFromJournal" class="btn btn--ghost" type="button">← Back</button>
        <div class="spacer"></div>
        <span class="badge">Journal</span>
      </div>
      <div class="divider"></div>
      <div class="list">
        ${entries.length === 0 ? `<div class="muted">No journal entries yet.</div>` : ''}
        ${entries
          .map(
            (e) => `
            <div class="page">
              <div class="row">
                <strong>${escapeHtml(e.courseTitle)}</strong>
                <div class="spacer"></div>
                <span class="muted">${escapeHtml(new Date(e.completedAt).toLocaleString())}</span>
              </div>
              <div class="muted">Module ${e.moduleIndex + 1}, page ${e.pageIndex + 1}</div>
              <div class="divider"></div>
              <div class="rich"><p>${escapeHtml(e.content).replace(/\n/g, '<br/>')}</p></div>
            </div>
          `
          )
          .join('')}
      </div>
    </div>
  `);

  $('btnBackFromJournal').addEventListener('click', () => {
    state.view = state.activeCourse ? 'moduleList' : 'courseSelect';
    paint();
  });
}

loadInitial().catch((e) => {
  setStatus(`Error: ${e.message}`);
  render(`<div class="card"><pre class="page">${escapeHtml(String(e.stack || e.message))}</pre></div>`);
});

