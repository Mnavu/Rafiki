# EduAssist App Map

This document maps features and user roles to their primary frontend code locations.

## Entry Points And Navigation

- App entry: `frontend/App.tsx`
- Navigation stack: `frontend/src/navigation/AppNavigator.tsx`
- Screen exports: `frontend/src/screens/index.ts`

## Roles And Dashboards

- Student
  - Dashboard: `frontend/src/screens/dashboard/StudentDashboardScreen.tsx`
  - Timetable: `frontend/src/screens/student/StudentTimetableScreen.tsx`
  - Assignments: `frontend/src/screens/student/StudentAssignmentsScreen.tsx`
  - Communication: `frontend/src/screens/student/StudentCommunicateScreen.tsx`
  - Help: `frontend/src/screens/student/StudentHelpScreen.tsx`
  - Library: `frontend/src/screens/student/StudentLibraryScreen.tsx`
- Parent or Guardian
  - Dashboard: `frontend/src/screens/dashboard/GuardianDashboardScreen.tsx`
  - Progress: `frontend/src/screens/guardian/GuardianProgressScreen.tsx`
  - Fees: `frontend/src/screens/guardian/GuardianFeesScreen.tsx`
  - Messages: `frontend/src/screens/guardian/GuardianMessagesScreen.tsx`
  - Timetable: `frontend/src/screens/guardian/GuardianTimetableScreen.tsx`
  - Announcements: `frontend/src/screens/guardian/GuardianAnnouncementsScreen.tsx`
- Lecturer
  - Dashboard: `frontend/src/screens/dashboard/LecturerDashboardScreen.tsx`
  - Classes: `frontend/src/screens/lecturer/LecturerClassesScreen.tsx`
  - Assignments: `frontend/src/screens/lecturer/LecturerAssignmentsUpload.tsx`
  - Messages: `frontend/src/screens/lecturer/LecturerMessagesScreen.tsx`
  - Records: `frontend/src/screens/lecturer/LecturerRecordsScreen.tsx`
  - Timetable: `frontend/src/screens/lecturer/LecturerTimetableScreen.tsx`
- Head of Department
  - Dashboard: `frontend/src/screens/dashboard/HodDashboardScreen.tsx`
  - Assignments: `frontend/src/screens/hod/HodAssignmentsScreen.tsx`
  - Timetable: `frontend/src/screens/hod/HodTimetableScreen.tsx`
  - Performance: `frontend/src/screens/hod/HodPerformanceScreen.tsx`
  - Communications: `frontend/src/screens/hod/HodCommunicationsScreen.tsx`
  - Reports: `frontend/src/screens/hod/HodReportsScreen.tsx`
  - Lecturer management: `frontend/src/screens/hod/LecturerManagementScreen.tsx`
- Finance
  - Dashboard: `frontend/src/screens/dashboard/FinanceDashboardScreen.tsx`
  - Overview: `frontend/src/screens/finance/FinanceOverviewScreen.tsx`
  - Students: `frontend/src/screens/finance/FinanceStudentsScreen.tsx`
  - Invoices: `frontend/src/screens/finance/FinanceInvoicesScreen.tsx`
  - Alerts: `frontend/src/screens/finance/FinanceAlertsScreen.tsx`
  - Settings: `frontend/src/screens/finance/FinanceSettingsScreen.tsx`
- Records
  - Dashboard: `frontend/src/screens/dashboard/RecordsDashboardScreen.tsx`
  - Exams: `frontend/src/screens/records/RecordsExamsScreen.tsx`
  - Transcripts: `frontend/src/screens/records/RecordsTranscriptsScreen.tsx`
  - Progress: `frontend/src/screens/records/RecordsProgressScreen.tsx`
  - Verifications: `frontend/src/screens/records/RecordsVerificationsScreen.tsx`
  - Reports: `frontend/src/screens/records/RecordsReportsScreen.tsx`
  - Enrollment: `frontend/src/screens/records/RecordsEnrollmentScreen.tsx`
- Admin
  - Dashboard: `frontend/src/screens/dashboard/AdminDashboardScreen.tsx`
  - Users: `frontend/src/screens/admin/AdminUsersScreen.tsx`
  - Systems: `frontend/src/screens/admin/AdminSystemsScreen.tsx`
  - Analytics: `frontend/src/screens/admin/AdminAnalyticsScreen.tsx`
  - Theme: `frontend/src/screens/admin/AdminThemeScreen.tsx`
  - Audit: `frontend/src/screens/admin/AdminAuditScreen.tsx`

## Cross Role Features

- Authentication and MFA
  - Context and state: `frontend/src/context/AuthContext.tsx`
  - Screens: `frontend/src/screens/auth/*`
  - API helpers: `frontend/src/services/api.ts`
- Notifications
  - Context and bell: `frontend/src/context/NotificationContext.tsx`, `frontend/src/components/NotificationBell.tsx`
  - Screen: `frontend/src/screens/NotificationsScreen.tsx`
- Voice and Accessibility
  - Voice hooks: `frontend/src/hooks/useVoice.ts`, `frontend/src/hooks/useVoiceRecorder.ts`, `frontend/src/hooks/useAudioPlayer.ts`
  - Voice UI: `frontend/src/components/VoiceButton.tsx`, `frontend/src/components/VoiceSearchBar.tsx`, `frontend/src/components/SpeakerButton.tsx`
- Library and Learning
  - Library screen: `frontend/src/screens/LibraryScreen.tsx`
  - Video player: `frontend/src/screens/learning/VideoPlayerScreen.tsx`
  - Quiz flow: `frontend/src/screens/learning/QuizScreen.tsx`, `frontend/src/screens/learning/QuizResultScreen.tsx`
- Rewards
  - Screen: `frontend/src/screens/rewards/RewardsScreen.tsx`
- Chat and Messaging
  - Chatroom: `frontend/src/screens/ChatroomScreen.tsx`
  - Thread UI: `frontend/src/screens/communications/VoiceThreadScreen.tsx`
  - Support widget: `frontend/src/components/ChatWidget.tsx`

## Shared UI Components

- Tiles and layout: `frontend/src/components/DashboardTile.tsx`, `frontend/src/components/BottomUtilityBar.tsx`
- Alerts and assistant: `frontend/src/components/AlertBanner.tsx`, `frontend/src/components/FloatingAssistantButton.tsx`
- Headers and badges: `frontend/src/components/GreetingHeader.tsx`, `frontend/src/components/RoleBadge.tsx`

## Data, Services, And Localization

- API client: `frontend/src/services/api.ts`
- Voice service: `frontend/src/services/VoiceService.ts`
- Localization: `frontend/src/i18n.ts`, `frontend/src/locales/en.json`, `frontend/src/locales/es.json`
*** End Patch"}}
