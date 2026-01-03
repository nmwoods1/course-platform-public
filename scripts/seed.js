const fs = require('fs');
const path = require('path');
const { openDb, migrate } = require('../src/db');

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function main() {
  const db = openDb();
  migrate(db);

  const sampleCoursePath = path.join(process.cwd(), 'seed', 'sample-course.json');
  const course = readJson(sampleCoursePath);

  // Seed users (if none exist)
  const userCount = db.prepare('SELECT COUNT(*) AS n FROM users').get().n;
  if (userCount === 0) {
    const insertUser = db.prepare('INSERT INTO users (name) VALUES (?)');
    insertUser.run('Nick');
    insertUser.run('Alex');
    insertUser.run('Sam');
    console.log('Seeded users: Nick, Alex, Sam');
  } else {
    console.log('Users already exist; skipping user seed');
  }

  // Seed course (idempotent)
  const existingCourse = db.prepare('SELECT 1 FROM courses WHERE id = ?').get(course.id);
  if (!existingCourse) {
    db.prepare('INSERT INTO courses (id, title, description, data) VALUES (?, ?, ?, ?)').run(
      course.id,
      course.title,
      course.description || '',
      JSON.stringify(course)
    );
    console.log(`Seeded course: ${course.id}`);
  } else {
    console.log(`Course ${course.id} already exists; skipping course seed`);
  }

  // Ensure each user has an active course set
  const users = db.prepare('SELECT id FROM users').all();
  const upsert = db.prepare(`
    INSERT INTO user_settings (user_id, active_course_id)
    VALUES (?, ?)
    ON CONFLICT(user_id) DO UPDATE SET active_course_id = excluded.active_course_id
  `);
  for (const u of users) upsert.run(u.id, course.id);
  console.log('Set active course for all users');
}

main();

