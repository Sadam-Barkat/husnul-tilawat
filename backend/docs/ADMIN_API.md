# Admin API (`/api/admin`)

All routes require:

- Header: `Authorization: Bearer <JWT>`
- User `role` must be `"admin"` (set in MongoDB on the user document, or via first admin seed).

---

## Dashboard

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/admin/stats` | Counts: users, admins, lessons, feedback, phrases, quiz questions, recitations, quiz attempts |

---

## Feedback (reviews)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/admin/feedback?page=1&limit=20` | Paginated list (newest first) |
| DELETE | `/api/admin/feedback/:id` | Delete one review (**no update endpoint**) |

---

## Users (no create)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/admin/users?page=1&limit=20&search=` | Paginated learners only (`{ items, total, page, limit }`; admins excluded) |
| GET | `/api/admin/users/:id` | Single user |
| PATCH | `/api/admin/users/:id` | Body: `{ name?, email?, role?: 'user'|'admin', newPassword? }` |
| DELETE | `/api/admin/users/:id` | Deletes user + their feedback, recitations, quiz results. Cannot delete self or last admin. |

---

## Lessons

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/admin/lessons?page=1&limit=20` | Active lessons only; response `{ items, total, page, limit }` |
| GET | `/api/admin/lessons?all=1&page=1&limit=20` | Include inactive; same shape |
| GET | `/api/admin/lessons/:id` | One lesson |
| POST | `/api/admin/lessons` | Create (same body as `Lesson` model) |
| PUT | `/api/admin/lessons/:id` | Update |
| DELETE | `/api/admin/lessons/:id` | Delete lesson + its quiz questions + quiz results; removes lesson from users’ `practicePassedLessonIds` |

---

## Pronunciation (practice phrases)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/admin/practice-phrases?page=1&limit=20` | Paginated `{ items, total, page, limit }` |
| POST | `/api/admin/practice-phrases` | Create; if `textForComparison` omitted, derived from `text` |
| PUT | `/api/admin/practice-phrases/:id` | Update |
| DELETE | `/api/admin/practice-phrases/:id` | Delete |

---

## Quiz questions

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/admin/quiz/questions?page=1&limit=20` | Paginated (optionally `lessonId`) → `{ items, total, page, limit }` |
| POST | `/api/admin/quiz/questions` | Create |
| PUT | `/api/admin/quiz/questions/:id` | Update |
| DELETE | `/api/admin/quiz/questions/:id` | Delete |

---

## Recitations (read-only)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/admin/recitations?page=1&limit=20&userId=` | Paginated; optional filter by user |

---

## Making a user admin (MongoDB)

```js
db.users.updateOne(
  { email: "you@example.com" },
  { $set: { role: "admin" } }
);
```
