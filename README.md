## Personal Learning Companion (local-first MVP)

This is a **single-machine, local-first** learning companion:

- **Backend**: Node.js + Express
- **DB**: SQLite (`better-sqlite3`) stored on disk (no setup)
- **Frontend**: vanilla HTML/CSS/JS served from `public/`
- **Multi-user**: pick a user; selection persists in `localStorage`
- **Unified tracking**: all interactions stored in `page_completions`

### Run locally

```bash
npm install
npm run seed
npm start
```

Then open:

- `http://localhost:3000`

### Data location

By default the SQLite DB is created at `./data/app.db` (gitignored).

You can override:

```bash
DB_PATH=./data/app.db PORT=3000 HOST=0.0.0.0 npm start
```

### API (MVP)

- **Users**
  - `GET /api/users`
  - `POST /api/users` `{ "name": "Nick" }`
- **Courses**
  - `GET /api/courses`
  - `POST /api/courses` (body is either the full course JSON or `{ "courseJson": {...} }`)
  - `GET /api/courses/:courseId`
- **User settings**
  - `GET /api/users/:userId/active-course`
  - `PUT /api/users/:userId/active-course` `{ "courseId": "guitar-fundamentals" }`
- **Unified page completion tracking**
  - `POST /api/page-completion`
    - `{ userId, courseId, moduleIndex, pageIndex, pageType, data }`
  - `GET /api/users/:userId/courses/:courseId/completions`
  - `GET /api/users/:userId/journal`
  - `GET /api/users/:userId/quiz-history`
  - `GET /api/users/:userId/courses/:courseId/progress` (derived summary)

### Windows service (optional)

On Windows, you can install this as a background service:

```bash
npm run install-service
```

Uninstall:

```bash
npm run uninstall-service
```

### Course format

See `seed/sample-course.json` for an example matching the schema you described.

