# EduAssist Role-Based UAT Checklists

This runbook covers the live role flows implemented in `frontend-v2` for:
- Lecturer
- Student
- Guardian
- Records
- HOD

## Pre-UAT Setup
- Backend API is running and reachable from phone/emulator.
- `frontend-v2/.env` contains valid `EXPO_PUBLIC_API_URL`.
- At least one department, programme, unit, and term offering exist.
- Lecturer is assigned to at least one class.
- At least one guardian is linked to one student.
- At least two students share one approved unit (for peer chat tests).

## Fast Execution Commands
- Generate blank template:
  - `npm run uat:template`
- Run full interactive UAT:
  - `npm run uat:run`
- Run one role only:
  - `npm run uat:lecturer`
  - `npm run uat:student`
  - `npm run uat:guardian`
  - `npm run uat:records`
  - `npm run uat:hod`

Reports are written to:
- `frontend-v2/docs/uat-reports/uat-report-<timestamp>.json`
- `frontend-v2/docs/uat-reports/uat-report-<timestamp>.md`

## Lecturer Checklist
- Open class dashboard and verify class counters load.
- Open class detail and verify student + guardian labels.
- Schedule class call and verify it appears in scheduled calls.
- Join embedded video room from class detail.
- Publish valid weekly plan: exactly 2 assignments + 1 CAT.
- Verify invalid weekly mix is rejected by API guardrail.
- Upload attendance sheet and confirm history row appears.
- Send text and voice notes in messaging thread and play back voice.

## Student Checklist
- Open student workspace and verify overview/assignments/timetable/finance.
- Open message center and verify history loading.
- Open peer directory and create private 1:1 peer thread.
- Send message in peer thread and verify persistence.
- Verify non-shared-unit peer creation is blocked.

## Guardian Checklist
- Open guardian workspace and verify linked student data.
- Open message center and verify labeled lecturer conversation threads.
- Send text message and verify history update.
- Play voice note if available in thread history.
- Verify missing-link warning on unlinked guardian account.

## Records Checklist
- Open records control center from dashboard.
- Select department and reload course matrix by year/trimester.
- Assign HOD to selected department and verify structure refresh.
- Assign lecturer to department and verify lecturer appears in structure.
- Remove lecturer from department and verify removal.
- Assign lecturer to specific offering and verify offering mapping refresh.
- Clear lecturer from specific offering and verify mapping clears.

## HOD Checklist
- Open control center and verify scoped department access.
- Reload matrix with year/trimester filters and verify class/student/lecturer data.
- Assign or clear lecturer for offering in HOD department.
- Verify cross-department action attempts are denied.
