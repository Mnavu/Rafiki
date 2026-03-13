# EduAssist V2 App Map (Phase 2)

## Entry Points
- App root: `frontend-v2/App.tsx`
- Navigation: `frontend-v2/src/navigation/AppNavigator.tsx`

## Auth Flows
- Role selection: `frontend-v2/src/screens/auth/RoleSelectionScreen.tsx`
- Login: `frontend-v2/src/screens/auth/LoginScreen.tsx`

## Role Workspaces
- Student workspace (live API): `frontend-v2/src/screens/student/StudentHomeScreen.tsx`
- Student help chatbot (persistent support entry): `frontend-v2/src/screens/student/StudentChatbotScreen.tsx`
- Parent workspace (live API): `frontend-v2/src/screens/parent/ParentHomeScreen.tsx`
- Role hub for lecturer / hod / finance / records / admin / superadmin / librarian: `frontend-v2/src/screens/dashboard/RoleDashboardScreen.tsx`
- Module detail screen for all role features: `frontend-v2/src/screens/feature/RoleFeatureScreen.tsx`
- Message channel list and history tracking: `frontend-v2/src/screens/messages/MessageThreadListScreen.tsx`
- Thread detail with text + voice notes: `frontend-v2/src/screens/messages/MessageThreadDetailScreen.tsx`
- Student peer directory for private 1:1 chat: `frontend-v2/src/screens/messages/StudentPeerDirectoryScreen.tsx`
- Lecturer class list with pending priorities: `frontend-v2/src/screens/lecturer/LecturerClassesScreen.tsx`
- Lecturer class detail (students, guardians, performance, call scheduler): `frontend-v2/src/screens/lecturer/LecturerClassDetailScreen.tsx`
- Lecturer weekly planner and attendance upload: `frontend-v2/src/screens/lecturer/LecturerPlannerScreen.tsx`
- Embedded class call room: `frontend-v2/src/screens/lecturer/VideoRoomScreen.tsx`
- Records and HOD control center: `frontend-v2/src/screens/records/RecordsControlCenterScreen.tsx`

## Role Content Catalog
- Role-to-feature definitions: `frontend-v2/src/data/featureCatalog.ts`
- Shared feature scope and checklist content: `frontend-v2/src/data/featureGuides.ts`

## Shared Components
- Tiles: `frontend-v2/src/components/DashboardTile.tsx`
- Header: `frontend-v2/src/components/GreetingHeader.tsx`
- Role badge: `frontend-v2/src/components/RoleBadge.tsx`
- Primary action button: `frontend-v2/src/components/VoiceButton.tsx`

## State and Services
- Auth state: `frontend-v2/src/context/AuthContext.tsx`
- API client and typed endpoints (phase 2 role modules): `frontend-v2/src/services/api.ts`

## Theme
- Tokens: `frontend-v2/src/theme/*`

## UAT
- Role checklists: `frontend-v2/docs/UAT_ROLE_CHECKLISTS.md`
- Interactive runner: `frontend-v2/scripts/uat/role-uat.cjs`
