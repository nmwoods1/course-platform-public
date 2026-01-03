const express = require('express');
const path = require('path');
const { openDb, migrate } = require('./db');

const app = express();
app.disable('x-powered-by');

app.use(express.json({ limit: '50mb' }));

const publicDir = path.join(process.cwd(), 'public');
app.use(express.static(publicDir));

const db = openDb();
migrate(db);

function badRequest(res, message) {
  return res.status(400).json({ error: message });
}

function parseMaybeJson(value) {
  if (value == null) return null;
  if (typeof value === 'object') return value;
  if (typeof value !== 'string') return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

// === USERS ===
app.get('/api/users', (_req, res) => {
  const users = db.prepare('SELECT id, name FROM users ORDER BY name').all();
  res.json(users);
});

app.post('/api/users', (req, res) => {
  const name = String(req.body?.name || '').trim();
  if (!name) return badRequest(res, 'Missing name');

  try {
    const result = db.prepare('INSERT INTO users (name) VALUES (?)').run(name);
    res.json({ id: result.lastInsertRowid, name });
  } catch (e) {
    if (String(e && e.message).includes('UNIQUE')) {
      return res.status(409).json({ error: 'User already exists' });
    }
    throw e;
  }
});

// === COURSES ===
app.get('/api/courses', (_req, res) => {
  const courses = db
    .prepare('SELECT id, title, description, created_at FROM courses ORDER BY created_at DESC')
    .all();
  res.json(courses);
});

app.post('/api/courses', (req, res) => {
  const body = req.body || {};
  const course = body.courseJson ? body.courseJson : body;
  const parsed = parseMaybeJson(course);
  const c = parsed || course;

  if (!c || typeof c !== 'object') return badRequest(res, 'Missing course JSON');
  if (!c.id || !c.title || !Array.isArray(c.modules)) return badRequest(res, 'Invalid course structure');

  const id = String(c.id).trim();
  const title = String(c.title).trim();
  const description = c.description ? String(c.description) : '';

  try {
    db.prepare('INSERT INTO courses (id, title, description, data) VALUES (?, ?, ?, ?)').run(
      id,
      title,
      description,
      JSON.stringify(c)
    );
    res.json({ success: true, courseId: id });
  } catch (e) {
    if (String(e && e.message).includes('UNIQUE') || String(e && e.message).includes('PRIMARY')) {
      return res.status(409).json({ error: 'Course already exists' });
    }
    throw e;
  }
});

app.get('/api/courses/:courseId', (req, res) => {
  const course = db.prepare('SELECT data FROM courses WHERE id = ?').get(req.params.courseId);
  if (!course) return res.status(404).json({ error: 'Course not found' });
  res.json(JSON.parse(course.data));
});

// === ACTIVE COURSE ===
app.get('/api/users/:userId/active-course', (req, res) => {
  const setting = db
    .prepare('SELECT active_course_id FROM user_settings WHERE user_id = ?')
    .get(req.params.userId);

  if (!setting || !setting.active_course_id) return res.json(null);

  const course = db.prepare('SELECT data FROM courses WHERE id = ?').get(setting.active_course_id);
  if (!course) return res.json(null);
  res.json(JSON.parse(course.data));
});

app.put('/api/users/:userId/active-course', (req, res) => {
  const courseId = String(req.body?.courseId || '').trim();
  if (!courseId) return badRequest(res, 'Missing courseId');

  const exists = db.prepare('SELECT 1 FROM courses WHERE id = ?').get(courseId);
  if (!exists) return res.status(404).json({ error: 'Course not found' });

  db.prepare(
    `
    INSERT INTO user_settings (user_id, active_course_id)
    VALUES (?, ?)
    ON CONFLICT(user_id) DO UPDATE SET active_course_id = excluded.active_course_id
  `
  ).run(req.params.userId, courseId);

  res.json({ success: true });
});

// === PAGE COMPLETIONS (unified) ===
app.post('/api/page-completion', (req, res) => {
  const { userId, courseId, moduleIndex, pageIndex, pageType, data } = req.body || {};

  if (!userId || !courseId) return badRequest(res, 'Missing userId or courseId');
  if (moduleIndex == null || pageIndex == null) return badRequest(res, 'Missing moduleIndex or pageIndex');
  if (!pageType) return badRequest(res, 'Missing pageType');

  const allowedTypes = new Set(['info', 'video', 'quiz', 'journal', 'checkbox']);
  if (!allowedTypes.has(pageType)) return badRequest(res, `Invalid pageType: ${pageType}`);

  const result = db
    .prepare(
      `
      INSERT INTO page_completions
      (user_id, course_id, module_index, page_index, page_type, data)
      VALUES (?, ?, ?, ?, ?, ?)
    `
    )
    .run(
      Number(userId),
      String(courseId),
      Number(moduleIndex),
      Number(pageIndex),
      String(pageType),
      data == null ? null : JSON.stringify(data)
    );

  res.json({ id: result.lastInsertRowid });
});

app.get('/api/users/:userId/courses/:courseId/completions', (req, res) => {
  const rows = db
    .prepare(
      `
      SELECT id, user_id, course_id, module_index, page_index, page_type, data, completed_at
      FROM page_completions
      WHERE user_id = ? AND course_id = ?
      ORDER BY completed_at DESC, id DESC
    `
    )
    .all(Number(req.params.userId), String(req.params.courseId));

  const parsed = rows.map((r) => ({ ...r, data: r.data ? JSON.parse(r.data) : null }));
  res.json(parsed);
});

app.get('/api/users/:userId/journal', (req, res) => {
  const rows = db
    .prepare(
      `
      SELECT
        pc.id,
        pc.course_id,
        co.title AS course_title,
        pc.module_index,
        pc.page_index,
        pc.data,
        pc.completed_at
      FROM page_completions pc
      JOIN courses co ON pc.course_id = co.id
      WHERE pc.user_id = ? AND pc.page_type = 'journal'
      ORDER BY pc.completed_at DESC, pc.id DESC
    `
    )
    .all(Number(req.params.userId));

  const parsed = rows.map((r) => {
    const d = r.data ? JSON.parse(r.data) : null;
    return {
      id: r.id,
      courseId: r.course_id,
      courseTitle: r.course_title,
      moduleIndex: r.module_index,
      pageIndex: r.page_index,
      content: d && typeof d.content === 'string' ? d.content : '',
      completedAt: r.completed_at
    };
  });

  res.json(parsed);
});

app.get('/api/users/:userId/quiz-history', (req, res) => {
  const rows = db
    .prepare(
      `
      SELECT
        pc.id,
        pc.course_id,
        co.title AS course_title,
        pc.module_index,
        pc.page_index,
        pc.data,
        pc.completed_at
      FROM page_completions pc
      JOIN courses co ON pc.course_id = co.id
      WHERE pc.user_id = ? AND pc.page_type = 'quiz'
      ORDER BY pc.completed_at DESC, pc.id DESC
    `
    )
    .all(Number(req.params.userId));

  const parsed = rows.map((r) => {
    const d = r.data ? JSON.parse(r.data) : null;
    return {
      id: r.id,
      courseId: r.course_id,
      courseTitle: r.course_title,
      moduleIndex: r.module_index,
      pageIndex: r.page_index,
      selectedIndex: d ? d.selectedIndex : null,
      isCorrect: d ? d.isCorrect : null,
      completedAt: r.completed_at
    };
  });

  res.json(parsed);
});

// === Optional: derived progress summary (helps the frontend) ===
app.get('/api/users/:userId/courses/:courseId/progress', (req, res) => {
  const courseRow = db.prepare('SELECT data FROM courses WHERE id = ?').get(req.params.courseId);
  if (!courseRow) return res.status(404).json({ error: 'Course not found' });
  const course = JSON.parse(courseRow.data);

  const completions = db
    .prepare(
      `
      SELECT module_index, page_index, page_type, data, completed_at, id
      FROM page_completions
      WHERE user_id = ? AND course_id = ?
      ORDER BY completed_at DESC, id DESC
    `
    )
    .all(Number(req.params.userId), String(req.params.courseId));

  const seen = new Set();
  const completedPages = new Set();

  for (const c of completions) {
    const key = `${c.module_index}-${c.page_index}`;
    if (seen.has(key)) continue;
    seen.add(key);

    // For MVP: any record counts as completed.
    completedPages.add(key);
  }

  const modules = (course.modules || []).map((m, moduleIndex) => {
    const totalPages = Array.isArray(m.pages) ? m.pages.length : 0;
    let completedCount = 0;
    for (let pageIndex = 0; pageIndex < totalPages; pageIndex++) {
      if (completedPages.has(`${moduleIndex}-${pageIndex}`)) completedCount++;
    }
    return {
      moduleIndex,
      title: m.title || `Module ${moduleIndex + 1}`,
      totalPages,
      completedPages: completedCount,
      isComplete: totalPages > 0 && completedCount === totalPages
    };
  });

  const nextIncomplete = modules.find((m) => !m.isComplete);
  res.json({
    courseId: course.id,
    modules,
    nextModuleIndex: nextIncomplete ? nextIncomplete.moduleIndex : Math.max(0, modules.length - 1),
    completedPages: completedPages.size
  });
});

// Basic error handler (keeps JSON responses consistent)
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || '0.0.0.0';
app.listen(PORT, HOST, () => {
  console.log(`Personal Learning Companion running on http://${HOST}:${PORT}`);
});

