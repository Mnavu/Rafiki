# Nanu Platform

Nanu is the voice-first OS powering inclusive education. Built for high-needs students like those with Down syndrome, our platform uses AI to create a scalable, adaptive learning environment for the entire neurodiverse community.

---

## Personas & Primary Journeys

| Persona | Primary goals | In-app coverage |
|---------|---------------|-----------------|
| Students | Follow schedules, submit work, ask for help, earn rewards. | Large touchscreen tiles, voice buttons, library of pictorial resources, voice-enabled messaging, Rewards Hub, notification bell. |
| Parents & Guardians | Track attendance, fees, and lecturer updates without jargon. | Parent dashboard, linked student overview, finance summary feed, communication threads, reward visibility. |
| Lecturers | Manage classes, plan lessons, grade work, keep families synced. | Lecturer class list, class detail (roster + guardians + performance), weekly planner, attendance upload, grading queue, class calls, voice threads. |
| Heads of Department | Approve unit registrations and monitor academic health. | HOD unit-approval queue, department dashboards, progress summaries per student. |
| Finance & Records teams | Maintain fee structures, payments, registrations, compliance logs. | Finance app (fee structures, payments, clearance status), records/HOD control center, provisioning approvals, audit logging for sensitive actions. |
| Admins & Super Admins | Govern roles, enforce MFA, seed demo data, monitor usage. | Role assignment endpoint, TOTP lifecycle, governance dashboards (audit logs, risk flags, approvals, alert policies), demo/UAT seeding. |
| Everyone | Get instant, judgment-free help. | A rule-based support chatbot reachable from every screen, with voice input/output throughout. |

Library curation is currently open to any authenticated user (there is no dedicated `librarian` role in the user model yet) — see [Known Gaps](#known-gaps-worth-knowing-before-you-build-on-this) below.

---

## Feature Breakdown

### Access, Security & Identity
- **Custom user model** stores nine roles (`student`, `parent`, `lecturer`, `hod`, `finance`, `records`, `admin`, `superadmin`, `guest`) plus accessibility hints (`prefers_simple_language`, `prefers_high_contrast`, `speech_rate`) that the mobile app uses to adapt copy and narration.
- **JWT auth with refresh + blacklist**, optional TOTP enforcement, and a `/api/users/me/` profile endpoint drive sign-in from Expo. Tokens persist in AsyncStorage via `AuthContext`.
- **Password lifecycle flows** provide reset token issuance, confirmation, and self-service password change; every action writes to `core.AuditLog` for traceability.
- **Role governance**: super administrators can harden accounts through `POST /api/users/assign-role/`, while `ParentStudentLink` keeps guardian access scoped to linked learners. `UserProvisionRequest` and family-enrollment flows let admins/records staff onboard new users with an approval step.

### Learning & Academic Support
- **Programme / CurriculumUnit / TermOffering / Registration** models capture curricula (this replaced the earlier Course/Unit/Enrollment shape). A student may register up to four units per term; HODs approve or reject registrations via a dedicated queue.
- **LecturerAssignment + Timetable** models tie lecturers to units and terms; **Assignment + Submission** (with optional audio + transcript) drive coursework, and a lightweight **Quiz** system auto-scores multiple-choice questions.
- **Progress summaries** (`GET /api/learning/students/<id>/progress/`) aggregate grades, completed units, and programme metadata for dashboards and guardians.
- **Lecturer tools**: a classes dashboard, per-class detail (roster, guardians, performance), a weekly planner, attendance-sheet upload, and a grading queue.
- **Student dashboards** surface timetable cards, assignment reminders, fee/finance status, class calls, and quick-access buttons to the library and Rewards Hub.

### Communication & Support Desk
- **Thread + Message** models tie a student, lecturer, and optional parent into a single conversation; role-based queryset filters prevent eavesdropping, and voice attachments are stored with automatic transcript capture (`POST /api/core/transcribe/`, pydub + SpeechRecognition).
- **Class chatrooms/communities** (`CourseChatroom` + `ChatMessage`) give each unit a group chat, and **class calls** let lecturers schedule and join video sessions from the app.
- **Support chatbot**: a rule/keyword-based assistant (not an LLM) answers navigation, login, and reset questions, redacts emails/long digit sequences from stored transcripts, and is reachable from a floating chat bubble on every screen.

### Finance & Records
- **FeeStructure + Payment + FinanceStatus** models track what's owed, what's paid, and a derived clearance status (cleared for registration / cleared for exams / blocked) per student per term.
- **Role-restricted CRUD**: finance staff record payments and fee structures; students/parents are read-only; HODs and records staff manage registrations and provisioning approvals through a dedicated records/HOD control center.

### Library & Inclusive Media
- **Repository resources** (`LibraryAsset` + `ResourceTag`) accept multiple media kinds (video, audio, PDF, doc, link), surfaced to students as a friendly, filterable library screen.

### Rewards & Motivation
- **Shipped, not mocked**: the `rewards` app (`Merit` ledger model) backs `POST /api/rewards/award/`, `GET /api/rewards/student/<id>/`, and `GET /api/rewards/leaderboard/`. Lecturers/staff award stars for achievements; students and linked guardians see the running total, history, and a semester leaderboard. The mobile Rewards Hub fetches this live.
- A second, independent points/achievement system also exists inside the `learning` app (`AchievementCategory`, `Achievement`, `RewardClaim`, `TermProgress`) — the two aren't currently reconciled into one model.

### Notifications & Guided Actions
- A **notification bell badge** shows an unread count (derived from `GET /api/notifications/` on screen focus, not a background poll) and routes users to the right screen.
- A floating **chat bubble** gives instant support-chatbot access from anywhere in the app.

### Accessibility by Design
- Voice buttons appear on every critical flow (login, timetable, library, messaging, rewards) to trigger speech or indicate microphone input, with a hand-built ASR mishear-correction pass and a text-to-speech fallback cascade (default voice → device language → best-available voice).
- The UI honors per-user `prefers_simple_language` (shortens lists) and `speech_rate` (controls narration speed), pulled from `/api/users/me/`. `prefers_high_contrast` is stored and toggleable in the UI, but the high-contrast visual theme itself isn't fully wired up yet — see [Known Gaps](#known-gaps-worth-knowing-before-you-build-on-this).

---

## System Architecture

### Backend (Django 5 + DRF)
- Apps: `core` (health/help/transcribe, HOD dashboards, governance/audit/risk endpoints), `users` (auth, MFA, provisioning, parent links, audit logs), `learning` (programmes, units, registrations, assignments, submissions, quizzes, achievements), `finance` (fee structures/payments/status), `communications` (threads, messages, class chatrooms, class calls, support chat), `repository` (library assets), `chatbot` (rule-based conversation engine), `rewards` (Merit ledger + leaderboard), and `notifications`.
- `drf-spectacular` exposes interactive docs at `http://127.0.0.1:8000/api/docs/`. `/api/core/health/` offers uptime probes.
- SQLite powers local development; PostgreSQL is supported via `DATABASE_URL` for deployed environments. `redis`, `celery`, and `channels` are listed as dependencies but are not currently wired into any settings or async task — background/notification work still runs synchronously in the request cycle.
- `seed_demo` provisions eight role-based demo accounts and starter curriculum fixtures so the mobile app has meaningful data immediately.

### Frontend (Expo SDK 54 + TypeScript)
- `src/context/AuthContext.tsx` centralizes login, JWT persistence in AsyncStorage, and per-role credential caching for quick demo sign-in. `useUnreadNotificationCount` hydrates the notification badge.
- Navigation is a single React Navigation stack that branches by role. Student and parent workspaces, plus lecturer, HOD, finance, records, and admin dashboards, all pull live API data.
- Voice interactions lean on `expo-av` (record/playback) and `expo-speech` (spoken prompts). Shared UI primitives (`VoiceButton`, `DashboardTile`, `AppMenu`, `RoleBadge`, `GreetingHeader`, `NotificationBellBadge`, `ChatbotBubble`) keep interactions consistent and accessible.
- A build-time flag (`EXPO_PUBLIC_WEB_PORTAL=admin`) turns the same codebase into an admin-only web build (deployed separately via Netlify), which now points admins toward Django's built-in `/admin/` as the primary control surface.

### API & Data Flow Highlights
- `POST /api/token/` (+ `totp_code`) — issue JWT access & refresh pairs.
- `GET /api/users/me/` — fetch profile, role, and accessibility preferences.
- `POST /api/users/totp/setup|activate|disable/` — MFA lifecycle.
- `GET|POST /api/learning/programmes|curriculum-units|term-offerings|registrations|assignments|submissions|quizzes/` + `GET /api/learning/students/<id>/progress/`.
- `GET|POST /api/finance/payments|status/`.
- `GET|POST /api/communications/threads|messages|chatrooms|class-calls|class-communities/` + `POST /api/communications/support/chat/`.
- `POST /api/core/transcribe/` — convert uploaded audio to text.
- `GET /api/repository/assets/` — drive the inclusive library screens.
- `POST /api/rewards/award/`, `GET /api/rewards/student/<id>/`, `GET /api/rewards/leaderboard/`.

---

## Local Development

### Requirements
- Python 3.11+, pip, and virtualenv/venv.
- Node.js 18+ with npm, plus the Expo CLI (`npx expo` works out of the box).
- Expo Go app (for device testing) or Android/iOS simulators.

### Backend setup
```bash
python -m venv .venv
# Windows
.venv\Scripts\activate
# macOS/Linux
source .venv/bin/activate

pip install -r backend/requirements.txt
python backend/manage.py migrate
python backend/manage.py seed_demo   # optional but recommended
python backend/manage.py runserver 0.0.0.0:8000
```
- Admin: `http://127.0.0.1:8000/admin`
- API docs (Swagger UI): `http://127.0.0.1:8000/api/docs/`
- Health: `http://127.0.0.1:8000/api/core/health/`

### Frontend setup
```bash
cd frontend-v2
npm install
# Create frontend-v2/.env and set:
# EXPO_PUBLIC_API_URL=http://<your-local-IP>:8000
npx expo start --clear
```
- Use LAN or tunnel mode in Expo so mobile devices can reach the backend.

### Demo data & sample accounts
Run `python backend/manage.py seed_demo` whenever you need fresh fixtures. Accounts created:

| Role | Username | Password |
|------|----------|----------|
| Student | `student1` | `Student@2025` |
| Parent | `parent1` | `Parent@2025` |
| Lecturer | `lecturer1` | `Lecturer@2025` |
| Head of Department | `hod1` | `HOD@2025` |
| Finance | `finance1` | `Finance@2025` |
| Records | `records1` | `Records@2025` |
| Admin | `admin1` | `Admin@2025` |
| Super Admin | `superadmin1` | `SuperAdmin@2025` |

Each account comes with sensible `is_staff` / `is_superuser` settings so you can test permissions as-is.

### Testing & quality checks
- Backend unit tests: `python backend/manage.py test` (a portion of the suite currently fails on a clean checkout due to stale fixtures and demo-seed collisions — see Known Gaps).
- Frontend linting: `cd frontend-v2 && npm run lint`
- For end-to-end manual testing, start the backend first, then Expo, log in with a demo user, and exercise dashboards, messaging, support chat, and rewards flows.

---

## Known Gaps Worth Knowing Before You Build on This
A full architecture review turned up a handful of things worth fixing before this handles real student data at scale: the password-reset endpoint currently returns its token directly in the API response instead of delivering it out-of-band; several Django settings (`DEBUG`, `SECRET_KEY`, `ALLOWED_HOSTS`) default to permissive values rather than failing closed; `prefers_high_contrast` is stored but not yet applied as an actual visual theme; and roughly a quarter of the backend test suite fails on a clean checkout due to stale fixtures and demo-account seeding colliding with test setup. None of these block local development, but they're the first things to address before a production rollout.

---

## Skill Apps (Version 3): Beadwork Academy
Alongside Nanu's broad school-management platform, we're building a family of focused, standalone **skill apps** — each one trains a single craft to independence through a structured, multi-year curriculum, rather than covering a whole school's operations. **Beadwork Academy** is the first.

Beadwork Academy lives in [`skill-apps/`](skill-apps/) as its own codebase (own auth, own database, own deploy) that reuses proven Nanu UX and backend patterns — not the literal code — via two shared packages so future skill apps don't start from scratch:

- **`skill-apps/packages/skillapp-core-backend`** — an installable Django package (`skillapp_core`) with reusable, skill-agnostic apps: `curriculum` (Module/Lesson/LessonStep/Milestone), `practice` (checklist completion + progress rollup), `submissions` (milestone submit/review workflow, mirroring Nanu's Submission pattern), `rewards` (a Badge/Award ledger mirroring Nanu's Merit pattern), `notifications`, and `media_pipeline` (an audio-transcription endpoint mirroring Nanu's `transcribe_audio`).
- **`skill-apps/packages/skillapp-core-ui`** — an npm workspace package with a real (not cosmetic) high-contrast theme swap, an `AccessibilityPrefsContext`, a text-to-speech fallback cascade, ASR mishear-correction, a metering-based auto-stop voice-recording hook, and shared accessible components (`BigActionButton`, `DashboardTile`, `StepCard`, `ChecklistRow`, `RecordButton`).
- **`skill-apps/apps/beadwork-academy`** — the first consumer app: a Django backend with two roles (learner, mentor) and an Expo/TypeScript frontend.

The current MVP curriculum covers stage one of a planned 2-year course: **tool & material orientation → color theory → starting technique → practice-to-perfection on a woven mat**, with bags, baskets, and further projects planned for later modules. The full learn → practice → submit → mentor-review → reward loop is built and verified end to end (login, walk all lessons, complete every checklist step, modules unlock in sequence, submit a milestone with a photo/video/voice note, a mentor reviews and awards a badge + points, the learner sees it on their progress screen).

See [`skill-apps/apps/beadwork-academy/README.md`](skill-apps/apps/beadwork-academy/README.md) for setup instructions, demo accounts, and current scope.

---

## Next Steps
- Close the password-reset and configuration gaps noted above before any production rollout.
- Apply the real high-contrast theme pattern proven in `skillapp-core-ui` back into Nanu's own frontend.
- Reconcile the two parallel rewards/points systems (`rewards` app vs. `learning.achievement_models`) into one.
- Author `beadwork_year2.py` (bags, baskets, and further projects) and replace placeholder media URLs with real hosted video/photo assets.
- Build production infrastructure (Postgres, Redis, a real Celery worker, HTTPS termination, monitoring) so background jobs and push notifications can be added safely across both Nanu and the skill apps.

Nanu is steadily evolving into a unified, voice-forward experience that rewards positive behavior, keeps families in the loop, and gives staff clear controls without compromising on clarity or accessibility — and the skill-apps line extends that same philosophy into focused, one-craft-at-a-time independence training.

---

# Hedera Certifications

## Team Members

- **Aaliyah**: [Hedera Certification][hederarita.pdf](https://github.com/user-attachments/files/23535738/hederarita.pdf)
- **Salma**: [Hedera Certification[hederasalma.pdf](https://github.com/user-attachments/files/23535740/hederasalma.pdf)
- **Rene**: [Hedera Certification](https://github.com/user-attachments/files/23535718/hederarene.pdf)
- **Aisha**: [Hedera Certification][hederaaisha.pdf](https://github.com/user-attachments/files/23535730/hederaaisha.pdf)
