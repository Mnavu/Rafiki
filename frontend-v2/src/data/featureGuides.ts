import type { FeatureKey } from '@data/featureCatalog';

export type FeatureGuide = {
  scope: string[];
  actions: string[];
};

export const featureGuides: Record<FeatureKey, FeatureGuide> = {
  timetable: {
    scope: [
      'Current timetable entries for your visible programmes or units.',
      'Upcoming sessions sorted by start time.',
      'Room and schedule visibility for quick planning.',
    ],
    actions: [
      'Review upcoming sessions.',
      'Flag schedule conflicts before execution.',
      'Coordinate reminders and follow-up communication.',
    ],
  },
  assignments: {
    scope: [
      'Assignment queue with due dates and unit metadata.',
      'Workload visibility for planning and follow-up.',
      'Submission readiness indicators.',
    ],
    actions: [
      'Prioritize due work by deadline.',
      'Track upcoming deliverables and overdue items.',
      'Use assignment insights for learner outreach.',
    ],
  },
  communicate: {
    scope: [
      'Direct communication channels between student-facing roles.',
      'Thread-level visibility with recency context.',
      'Message continuity for academic support.',
    ],
    actions: [
      'Open the latest active threads first.',
      'Capture unresolved issues and escalate fast.',
      'Coordinate with staff using shared thread history.',
    ],
  },
  help: {
    scope: [
      'Support entry points and triage status.',
      'Recent issues and common blockers.',
      'Follow-up guidance for unresolved requests.',
    ],
    actions: [
      'Prioritize blockers affecting access.',
      'Route complex requests to the right team.',
      'Monitor support workload trends.',
    ],
  },
  library: {
    scope: [
      'Accessible digital assets by programme or unit.',
      'Media mix visibility (PDF, video, audio, links).',
      'Quick discovery of recently added resources.',
    ],
    actions: [
      'Curate high-use assets.',
      'Keep outdated links out of learner workflows.',
      'Track library growth and usage readiness.',
    ],
  },
  progress: {
    scope: [
      'Programme completion summary and unit-level status.',
      'Completed versus total units for each learner.',
      'Average grade indicators where available.',
    ],
    actions: [
      'Identify at-risk learners early.',
      'Surface missing or incomplete unit outcomes.',
      'Coordinate intervention with lecturers and guardians.',
    ],
  },
  fees: {
    scope: [
      'Finance status records by academic year and trimester.',
      'Total due, paid, and clearance positioning.',
      'Payment trend visibility for follow-up.',
    ],
    actions: [
      'Track arrears and upcoming payment pressure.',
      'Prioritize students needing finance clearance support.',
      'Coordinate repayment communication quickly.',
    ],
  },
  messages: {
    scope: [
      'Conversation and receipt/invoice communication streams.',
      'Message volume and thread activity snapshots.',
      'Recent update timeline per thread.',
    ],
    actions: [
      'Focus on unread or high-priority threads.',
      'Keep payment and learner communication aligned.',
      'Document key outcomes from conversations.',
    ],
  },
  announcements: {
    scope: [
      'Notification feed and audience targeting context.',
      'Status visibility for queued and delivered notices.',
      'Recent announcement metadata for follow-up.',
    ],
    actions: [
      'Verify delivery status quickly.',
      'Follow up on critical announcements.',
      'Reduce duplicate or conflicting notices.',
    ],
  },
  classes: {
    scope: [
      'Class load and scheduling visibility for active units.',
      'Session context for lecturer coordination.',
      'Upcoming class priorities.',
    ],
    actions: [
      'Review classes needing immediate preparation.',
      'Check load balance and schedule feasibility.',
      'Coordinate attendance and teaching continuity.',
    ],
  },
  records: {
    scope: [
      'Registration and grading records in one operational view.',
      'Pending, approved, and rejected lifecycle status.',
      'Submission grading readiness where available.',
    ],
    actions: [
      'Resolve stuck records quickly.',
      'Prioritize pending approvals and grading queues.',
      'Keep audit-ready history accurate and current.',
    ],
  },
  reports: {
    scope: [
      'Operational report outputs and readiness indicators.',
      'Cross-module counts used for reporting.',
      'Executive and compliance summary support.',
    ],
    actions: [
      'Generate periodic operational snapshots.',
      'Track reporting completeness before export.',
      'Align report cadence across departments.',
    ],
  },
  reports_generation: {
    scope: [
      'Programme and cohort report generation pipeline.',
      'Data readiness signals for formal reports.',
      'Export support for management review.',
    ],
    actions: [
      'Confirm source data is complete.',
      'Generate departmental summaries.',
      'Escalate data quality gaps before publishing.',
    ],
  },
  reports_semester: {
    scope: [
      'Semester-level performance and registration summaries.',
      'Trend indicators by cohort and programme.',
      'Comparative snapshots across terms.',
    ],
    actions: [
      'Review key semester outcomes.',
      'Highlight progression and risk signals.',
      'Prepare summaries for stakeholder review.',
    ],
  },
  reports_transcripts: {
    scope: [
      'Transcript-related data readiness and validation context.',
      'Academic record consistency checks.',
      'Supporting metadata for formal issuance.',
    ],
    actions: [
      'Confirm grading completeness before generation.',
      'Prioritize transcript requests by urgency.',
      'Track issues requiring records intervention.',
    ],
  },
  reports_overview: {
    scope: [
      'High-level report rollup across modules.',
      'Coverage and completeness indicators.',
      'Leadership-ready summary framing.',
    ],
    actions: [
      'Use overview to prioritize deep-dive reports.',
      'Cross-check anomalies before publishing.',
      'Coordinate action owners from findings.',
    ],
  },
  audit_policies: {
    scope: [
      'Access governance and sensitive workflow checkpoints.',
      'Provisioning lifecycle visibility for compliance.',
      'Policy enforcement touchpoints.',
    ],
    actions: [
      'Review pending access actions.',
      'Ensure approval workflows follow policy.',
      'Flag exceptions for immediate review.',
    ],
  },
  alerts: {
    scope: [
      'Active notification queue with delivery status.',
      'Operational alert distribution context.',
      'Priority routing for urgent notices.',
    ],
    actions: [
      'Watch pending alerts and retry failures.',
      'Prioritize urgent audiences.',
      'Reduce stale unresolved alerts.',
    ],
  },
  settings: {
    scope: [
      'Configuration controls for module operations.',
      'Policy and workflow defaults in one place.',
      'System readiness indicators for changes.',
    ],
    actions: [
      'Validate prerequisites before changing settings.',
      'Document critical configuration updates.',
      'Coordinate rollout with affected teams.',
    ],
  },
  analytics: {
    scope: [
      'Operational KPIs (logins, support usage, alerts).',
      'Usage trends for planning and staffing.',
      'System health checkpoints for leadership.',
    ],
    actions: [
      'Review trend shifts weekly.',
      'Prioritize areas with rising support demand.',
      'Use KPI movement to guide next-phase improvements.',
    ],
  },
  users: {
    scope: [
      'User directory and role assignment visibility.',
      'Provisioning requests and approval workload.',
      'Access governance checkpoints.',
    ],
    actions: [
      'Clear pending provisioning queue quickly.',
      'Validate role assignments for least-privilege access.',
      'Track account readiness before onboarding.',
    ],
  },
  comms: {
    scope: [
      'Institution-wide communication readiness view.',
      'Audience routing and thread activity context.',
      'Operational continuity for announcements and follow-up.',
    ],
    actions: [
      'Prioritize unresolved communication threads.',
      'Coordinate announcements with role owners.',
      'Close loops on critical learner/staff communication.',
    ],
  },
  performance: {
    scope: [
      'Department and learner performance indicators.',
      'Approval bottlenecks and progression signals.',
      'Operational data for intervention planning.',
    ],
    actions: [
      'Identify delays in approvals or grading.',
      'Target support for low-progress cohorts.',
      'Monitor improvements after interventions.',
    ],
  },
};
