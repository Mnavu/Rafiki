# EduAssist V2 (Managed Rebuild)

Phase 2 is now active:
- Core auth flows are in place (role selection + login).
- Student and Parent workspaces now pull live API data.
- Remaining roles still use placeholder dashboards.

## Setup
```bash
npm install
```

## Configure API
Create `.env` and set:
```
EXPO_PUBLIC_API_URL=http://<your-local-ip>:8000
```

## Run
```bash
npx expo start --clear
```

If port `8081` is busy, use:
```bash
npx expo start --clear --port 8090
```

## Phase Plan
1. Core flows (completed)
2. Student and Parent API workspaces (in progress)
3. Lecturer, HoD, Finance, Records modules
4. Notifications, voice, and chat enhancements

## UAT (Role-Based)
Manual checklists:
- `docs/UAT_ROLE_CHECKLISTS.md`

Interactive UAT runner:
```bash
npm run uat:run
```

Role-specific runs:
```bash
npm run uat:lecturer
npm run uat:student
npm run uat:guardian
npm run uat:records
npm run uat:hod
```

Generate blank UAT template:
```bash
npm run uat:template
```

Generated artifacts:
- `docs/uat-reports/uat-report-<timestamp>.json`
- `docs/uat-reports/uat-report-<timestamp>.md`
