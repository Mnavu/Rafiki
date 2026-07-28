# Beadwork Academy

The first of the Nanu "skill apps" — a standalone app that trains one craft skill (beadwork) to independence through a structured, multi-year curriculum. Built for the same neurodiverse learner population as Nanu, but scoped narrowly: no timetables, no fees, no messaging threads — just learn → practice → show your work → get reviewed → earn a reward, on repeat.

It's a separate codebase from the rest of this repo (own database, own auth, own deploy) that consumes two shared packages so a second skill app won't start from scratch:
- [`../../packages/skillapp-core-backend`](../../packages/skillapp-core-backend) — reusable Django apps (curriculum, practice, submissions, rewards, notifications, media pipeline).
- [`../../packages/skillapp-core-ui`](../../packages/skillapp-core-ui) — reusable Expo/RN components, theme (including a real high-contrast palette swap), accessibility context, and voice utilities.

## Current scope (MVP)

Year 1, first three modules, matching the curriculum's own natural progression:
1. **Tool Orientation** — get familiar with needle, thread/wire, beads, board, and clasp before touching a real project.
2. **Colors & Color Theory** — the color wheel and which combinations work well together.
3. **Starting a Piece & the Mat Project** — the fundamental starting technique, then repeated practice until a first mat is finished, submitted, and reviewed.

Bags, baskets, and Year 2 content (`beadwork_year2.py`) are not yet authored — see [Not done yet](#not-done-yet) below.

## Roles

Two roles only: **learner** and **mentor** (parent/guardian/instructor). A `MentorLearnerLink` connects them; a mentor can view a linked learner's progress and review/approve their milestone submissions.

## Local development

### Backend
```bash
cd skill-apps
pip install -e packages/skillapp-core-backend[voice]
cd apps/beadwork-academy/backend
pip install -r requirements.txt   # Django, DRF, Pillow, etc.

set DJANGO_DEBUG=1                # Windows; use `export` on macOS/Linux
python manage.py migrate
python manage.py seed_curriculum      # loads the Year 1 modules/lessons/steps/milestone
python manage.py seed_badges          # loads the badge catalog
python manage.py seed_demo_accounts   # creates learner1 / mentor1, linked together
python manage.py runserver 127.0.0.1:8010
```
- Admin: `http://127.0.0.1:8010/admin/`
- Demo learner: `learner1` / `Learner@2025`
- Demo mentor: `mentor1` / `Mentor@2025`

All settings fail closed rather than open: `DJANGO_DEBUG` defaults to `False`, and both `DJANGO_SECRET_KEY` and `DJANGO_ALLOWED_HOSTS` must be set explicitly once `DJANGO_DEBUG` is off.

### Frontend
```bash
cd skill-apps
npm install                        # installs the whole workspace, including @skillapp-core/ui
cd apps/beadwork-academy/app
cp .env.example .env               # set EXPO_PUBLIC_API_URL to your backend's LAN address
npx expo start --clear
```
The app resolves `@skillapp-core/ui` directly from `../../../packages/skillapp-core-ui/src` via an npm workspace + a monorepo-aware `metro.config.js` — no separate build step for that package.

### Verifying the full loop
With the backend running, `python manage.py seed_curriculum`/`seed_badges`/`seed_demo_accounts` applied, log in as `learner1` in the app, complete every checklist step across the three modules, submit the mat milestone with a photo, then log in as `mentor1` to approve it with a star award and badge code (`FIRST_MAT`). The learner's progress screen should then show the new badge and star total.

## Not done yet
- Real hosted photo/video assets — the seed curriculum currently points at placeholder `media.beadworkacademy.example` URLs.
- `beadwork_year2.py` (bags, baskets, and further projects) and the rest of the 2-year curriculum.
- Visual/device testing — the app type-checks and bundles cleanly via Metro, but hasn't been exercised on a simulator or physical device in this environment.
- EAS build configuration for a distributable app.
