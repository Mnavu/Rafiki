import type { Role } from '@app-types/roles';

export type FeatureKey =
  | 'timetable'
  | 'assignments'
  | 'communicate'
  | 'help'
  | 'library'
  | 'progress'
  | 'fees'
  | 'messages'
  | 'announcements'
  | 'classes'
  | 'records'
  | 'reports'
  | 'reports_generation'
  | 'reports_semester'
  | 'reports_transcripts'
  | 'reports_overview'
  | 'audit_policies'
  | 'alerts'
  | 'settings'
  | 'analytics'
  | 'users'
  | 'comms'
  | 'performance';

export type FeatureDescriptor = {
  key: FeatureKey;
  title: string;
  description: string;
  callToAction?: string;
  apiHint?: string;
};

export const featureCatalog: Record<Role, FeatureDescriptor[]> = {
  student: [
    {
      key: 'timetable',
      title: 'My Timetable',
      description: "See today's classes with reminders.",
      callToAction: 'View schedule',
    },
    {
      key: 'assignments',
      title: 'Assignments',
      description: 'Track upcoming work and submit easily.',
      callToAction: 'Review assignments',
    },
    {
      key: 'communicate',
      title: 'Communicate',
      description: 'Send quick messages, calls, or voice notes to lecturers.',
    },
    {
      key: 'help',
      title: 'Help',
      description: 'Voice-to-text FAQs and advisor support.',
    },
    {
      key: 'library',
      title: 'Library',
      description: 'Jump to course resources with read-aloud.',
    },
  ],
  parent: [
    {
      key: 'progress',
      title: 'Progress',
      description: 'Color-coded grades and attendance for your child.',
      apiHint: 'GET /api/learning/students/<id>/progress/',
    },
    {
      key: 'fees',
      title: 'Fees',
      description: 'View balance, pay, or request a plan.',
      apiHint: 'GET /api/finance/status/',
    },
    {
      key: 'messages',
      title: 'Messages',
      description: 'Threads with lecturers and admins, including voice notes.',
    },
    {
      key: 'timetable',
      title: 'Timetable',
      description: "Listen to today's classes and plan the week.",
    },
    {
      key: 'announcements',
      title: 'Announcements',
      description: 'School notices with automatic audio.',
    },
  ],
  lecturer: [
    {
      key: 'classes',
      title: 'My Classes',
      description: 'Start sessions and take attendance with tap-friendly roster.',
    },
    {
      key: 'assignments',
      title: 'Assignments',
      description: 'Create tasks quickly with speech-to-text and rubrics.',
    },
    {
      key: 'messages',
      title: 'Messages',
      description: 'Respond to Guardians and students with filters.',
    },
    {
      key: 'records',
      title: 'Records',
      description: 'Enter grades and attendance with numeric steppers.',
    },
    {
      key: 'timetable',
      title: 'Timetable',
      description: 'Week view with pre-class reminders you control.',
    },
  ],
  hod: [
    {
      key: 'users',
      title: 'Course Assignments',
      description: 'Assign lecturers to courses and spot conflicts fast.',
    },
    {
      key: 'timetable',
      title: 'Timetables',
      description: 'Approve weekly schedules with clash alerts.',
    },
    {
      key: 'performance',
      title: 'Performance',
      description: 'Heatmaps for pass rates and averages, export ready.',
    },
    {
      key: 'comms',
      title: 'Communications',
      description: 'Broadcast to lecturers, Guardians, or both.',
    },
    {
      key: 'reports_generation',
      title: 'Reports',
      description: 'Generate PDF/CSV summaries by cohort or semester.',
    },
  ],
  finance: [
    {
      key: 'fees',
      title: 'Fees Overview',
      description: 'KPIs for total due, collected, overdue with spoken summaries.',
    },
    {
      key: 'users',
      title: 'Students',
      description: 'Search ledgers, record payments, and highlight statuses.',
    },
    {
      key: 'messages',
      title: 'Invoices & Receipts',
      description: 'One-tap receipt generation and structured delivery.',
    },
    {
      key: 'alerts',
      title: 'Alerts',
      description: 'Schedule due reminders and bulk notifications.',
    },
    {
      key: 'settings',
      title: 'Settings',
      description: 'Manage fee items, waivers, and structured plans.',
    },
  ],
  records: [
    {
      key: 'records',
      title: 'Exams & Grades',
      description: 'Import, validate, and publish marks.',
    },
    {
      key: 'reports_transcripts',
      title: 'Transcripts',
      description: 'Generate watermarked transcripts for sharing.',
    },
    {
      key: 'progress',
      title: 'Programme Progress',
      description: 'Credits tracker with at-risk flags.',
    },
    {
      key: 'announcements',
      title: 'Verifications',
      description: 'Respond quickly to employer verification requests.',
    },
    {
      key: 'reports_semester',
      title: 'Reports',
      description: 'Semester summaries and dashboards.',
    },
  ],
  admin: [
    {
      key: 'users',
      title: 'Users & Roles',
      description: 'Create accounts, link Guardians, and manage credentials.',
    },
    {
      key: 'settings',
      title: 'Systems',
      description: 'Configure integrations, notifications, and schedulers.',
    },
    {
      key: 'analytics',
      title: 'Analytics',
      description: 'Track logins, chatbot usage, and alerts.',
    },
    {
      key: 'settings',
      title: 'Theme',
      description: 'Control branding, colors, and voice packs.',
    },
    {
      key: 'audit_policies',
      title: 'Audit & Policies',
      description: 'Review audit trails and retention rules.',
    },
  ],
  superadmin: [
    {
      key: 'users',
      title: 'Role Governance',
      description: 'Assign and revoke elevated roles across the platform.',
    },
    {
      key: 'analytics',
      title: 'Platform Health',
      description: 'Monitor adoption, login success, and security coverage.',
    },
    {
      key: 'settings',
      title: 'System Controls',
      description: 'Adjust global settings, integrations, and backups.',
    },
    {
      key: 'audit_policies',
      title: 'Audit Trails',
      description: 'Review sensitive activity and authenticator events.',
    },
    {
      key: 'reports',
      title: 'Executive Reports',
      description: 'Download compliance-ready quarterly exports.',
    },
  ],
  librarian: [
    {
      key: 'library',
      title: 'Digital Library',
      description: 'Manage accessible collections and featured lists.',
    },
    {
      key: 'analytics',
      title: 'Usage Insights',
      description: 'See most-read resources and engagement trends.',
    },
    {
      key: 'messages',
      title: 'Reader Outreach',
      description: 'Share new additions with classes and departments.',
    },
    {
      key: 'settings',
      title: 'Library Settings',
      description: 'Update policies and discovery controls.',
    },
    {
      key: 'reports',
      title: 'Inventory Reports',
      description: 'Export stock checks and reading trends.',
    },
  ],
  guest: [
    {
      key: 'help',
      title: 'Help Center',
      description: 'Get guided support for login, access, and account setup.',
    },
    {
      key: 'announcements',
      title: 'Announcements',
      description: 'View public school notices and onboarding updates.',
    },
    {
      key: 'messages',
      title: 'Contact Support',
      description: 'Reach support to request role assignment or account recovery.',
    },
  ],
};
