#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const ROLE_ORDER = ['lecturer', 'student', 'guardian', 'records', 'hod'];

const CHECKLISTS = {
  lecturer: [
    {
      id: 'LECT-01',
      title: 'Lecturer class dashboard loads assigned classes',
      steps: [
        'Log in as lecturer.',
        'Open "My Classes".',
        'Confirm classes list and pending counters render.',
      ],
      expected:
        'Assigned units are listed with pending issue/mark/message counts and no crash occurs.',
    },
    {
      id: 'LECT-02',
      title: 'Class detail shows students, guardians, and assessment summary',
      steps: [
        'Open one class from "My Classes".',
        'Review "Students and Guardians" cards.',
        'Review "Assessment performance tracker" cards.',
      ],
      expected:
        'Student names, guardian labels, and assessment statuses are visible for the selected class.',
    },
    {
      id: 'LECT-03',
      title: 'Schedule class call and open embedded room',
      steps: [
        'In class detail, fill class-call title/start/end fields.',
        'Tap "Schedule call and notify class".',
        'Tap "Join latest room in-app".',
      ],
      expected:
        'Call is created, shown in list, and opens in embedded video room with valid meeting URL.',
    },
    {
      id: 'LECT-04',
      title: 'Publish weekly plan with strict 2 assignments + 1 CAT',
      steps: [
        'Open "Weekly planner" from class detail.',
        'Fill all three planner items (2 assignment, 1 cat).',
        'Tap "Publish week plan".',
      ],
      expected:
        'Planner publishes successfully and appears in planner history for selected week.',
    },
    {
      id: 'LECT-05',
      title: 'Planner guardrail rejects invalid assessment mix',
      steps: [
        'In weekly planner, change items so they are not 2 assignments + 1 cat.',
        'Tap "Publish week plan".',
      ],
      expected:
        'Server returns guardrail validation error and invalid plan is not published.',
    },
    {
      id: 'LECT-06',
      title: 'Upload attendance sheet',
      steps: [
        'In weekly planner, enter attendance rows using "student_user_id,present,notes" format.',
        'Tap "Upload attendance".',
      ],
      expected:
        'Upload succeeds and sheet appears under attendance history with uploaded timestamp.',
    },
    {
      id: 'LECT-07',
      title: 'Messaging (text + voice) with thread history',
      steps: [
        'Open "Message center".',
        'Open a thread and send text message.',
        'Record and send a voice note, then play it back.',
      ],
      expected:
        'Both text and voice messages appear in thread history and voice playback works.',
    },
  ],
  student: [
    {
      id: 'STUD-01',
      title: 'Student workspace loads profile, assignments, timetable, and finance',
      steps: [
        'Log in as student.',
        'Open student home screen.',
      ],
      expected:
        'Overview, assignments, timetable, and finance/rewards sections render without network errors.',
    },
    {
      id: 'STUD-02',
      title: 'Student message center thread history',
      steps: [
        'Open "Message center".',
        'Open an existing thread.',
        'Send text message and verify it appears in history.',
      ],
      expected:
        'Thread title/participants are correctly labeled and message history updates immediately.',
    },
    {
      id: 'STUD-03',
      title: 'Open peer directory and create private 1:1 student chat',
      steps: [
        'From student home, open "Private classmate chats".',
        'Select a peer from the directory.',
        'Open resulting thread and send a message.',
      ],
      expected:
        'A private peer thread opens for shared-class peer and new message is delivered in the thread.',
    },
    {
      id: 'STUD-04',
      title: 'Peer eligibility protection',
      steps: [
        'Attempt to create a peer thread with a student who does not share approved units (if available).',
      ],
      expected:
        'System blocks creation and shows eligibility validation message.',
    },
  ],
  guardian: [
    {
      id: 'GUAR-01',
      title: 'Guardian workspace and child visibility',
      steps: [
        'Log in as guardian.',
        'Open guardian home.',
      ],
      expected:
        'Linked student data, recent activity, and communication summary load for guardian account.',
    },
    {
      id: 'GUAR-02',
      title: 'Guardian messaging threads and history',
      steps: [
        'Open guardian message center.',
        'Open thread with lecturer.',
        'Send text and play voice note if present.',
      ],
      expected:
        'Thread list and detailed history are visible with guardian-friendly participant labels.',
    },
    {
      id: 'GUAR-03',
      title: 'Missing guardian link warning behavior',
      steps: [
        'Use guardian account without student link (or temporarily remove link).',
        'Open message center.',
      ],
      expected:
        'UI shows warning prompting records/admin to create guardian-student link.',
    },
  ],
  records: [
    {
      id: 'RECO-01',
      title: 'Records control center access',
      steps: [
        'Log in as records user.',
        'Open "Control center" from dashboard.',
      ],
      expected: 'Records control center loads with department scope cards and no permission error.',
    },
    {
      id: 'RECO-02',
      title: 'Assign HOD to department',
      steps: [
        'Select target department in control center.',
        'Choose HOD candidate and assign.',
      ],
      expected: 'Department leadership updates and assigned HOD is reflected in structure section.',
    },
    {
      id: 'RECO-03',
      title: 'Assign and remove lecturers in department',
      steps: [
        'Assign one lecturer from pool.',
        'Remove one currently assigned lecturer.',
      ],
      expected:
        'Department lecturer list updates after each action and success feedback is shown.',
    },
    {
      id: 'RECO-04',
      title: 'Assign lecturer to course offering',
      steps: [
        'In "Course offering lecturer assignment", set lecturer user ID for an offering.',
        'Tap "Assign/update lecturer".',
      ],
      expected:
        'Offering shows updated lecturer mapping and replacement behavior applies for same unit/year/trimester.',
    },
    {
      id: 'RECO-05',
      title: 'Clear lecturer from offering',
      steps: [
        'Use the same offering card.',
        'Tap "Clear lecturer".',
      ],
      expected: 'Lecturer assignment for selected offering is removed and matrix refresh reflects removal.',
    },
  ],
  hod: [
    {
      id: 'HOD-01',
      title: 'HOD control center access',
      steps: [
        'Log in as HOD.',
        'Open "Control center" from dashboard.',
      ],
      expected: 'Control center opens with HOD role context and department-scoped data.',
    },
    {
      id: 'HOD-02',
      title: 'Department course matrix visibility',
      steps: [
        'Set academic year and trimester filters.',
        'Reload matrix.',
      ],
      expected:
        'Years/offering matrix includes courses, student grouping, and lecturer assignment for HOD scope.',
    },
    {
      id: 'HOD-03',
      title: 'HOD lecturer assignment workflow',
      steps: [
        'Assign or clear lecturer on one offering within HOD department.',
      ],
      expected: 'Action succeeds for own department and data updates after refresh.',
    },
    {
      id: 'HOD-04',
      title: 'HOD cross-department protection',
      steps: [
        'Attempt to modify another department (if account has visibility to multiple departments).',
      ],
      expected: 'System denies unauthorized cross-department management actions.',
    },
  ],
};

function parseArgs(argv) {
  const parsed = {
    role: 'all',
    template: false,
    outDir: path.join('docs', 'uat-reports'),
  };

  for (let index = 2; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--template') {
      parsed.template = true;
      continue;
    }
    if (token === '--role' && argv[index + 1]) {
      parsed.role = argv[index + 1].toLowerCase();
      index += 1;
      continue;
    }
    if (token === '--out-dir' && argv[index + 1]) {
      parsed.outDir = argv[index + 1];
      index += 1;
    }
  }

  return parsed;
}

function resolveRoles(roleArg) {
  if (roleArg === 'all') {
    return ROLE_ORDER;
  }
  if (!CHECKLISTS[roleArg]) {
    throw new Error(
      `Invalid role "${roleArg}". Use one of: ${ROLE_ORDER.join(', ')}, all.`,
    );
  }
  return [roleArg];
}

function nowStamp() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

function buildChecklistTemplateMarkdown(report) {
  const lines = [];
  lines.push(`# UAT Template - ${report.stamp}`);
  lines.push('');
  lines.push(`Roles: ${report.roles.join(', ')}`);
  lines.push('');
  lines.push('## Environment');
  lines.push('- App URL / Expo host:');
  lines.push('- API base URL:');
  lines.push('- Build/branch:');
  lines.push('- Tester:');
  lines.push('');
  report.roles.forEach((role) => {
    lines.push(`## ${role.toUpperCase()}`);
    lines.push('');
    CHECKLISTS[role].forEach((testCase) => {
      lines.push(`### ${testCase.id} - ${testCase.title}`);
      lines.push(`Expected: ${testCase.expected}`);
      lines.push('');
      lines.push('Result: [ ] PASS [ ] FAIL [ ] SKIP');
      lines.push('Notes:');
      lines.push('');
      lines.push('Steps:');
      testCase.steps.forEach((step) => {
        lines.push(`- [ ] ${step}`);
      });
      lines.push('');
    });
  });
  return `${lines.join('\n')}\n`;
}

function buildReportMarkdown(report) {
  const lines = [];
  lines.push(`# UAT Report - ${report.stamp}`);
  lines.push('');
  lines.push(`Roles: ${report.roles.join(', ')}`);
  lines.push(`Started: ${report.startedAt}`);
  lines.push(`Finished: ${report.finishedAt}`);
  lines.push('');
  lines.push('## Summary');
  lines.push(`- Pass: ${report.summary.pass}`);
  lines.push(`- Fail: ${report.summary.fail}`);
  lines.push(`- Skip: ${report.summary.skip}`);
  lines.push(`- Total: ${report.summary.total}`);
  lines.push('');

  report.results.forEach((roleResult) => {
    lines.push(`## ${roleResult.role.toUpperCase()}`);
    lines.push('');
    roleResult.cases.forEach((item) => {
      lines.push(`### ${item.id} - ${item.title}`);
      lines.push(`- Result: ${item.result.toUpperCase()}`);
      lines.push(`- Expected: ${item.expected}`);
      if (item.notes) {
        lines.push(`- Notes: ${item.notes}`);
      }
      lines.push('- Steps executed:');
      item.steps.forEach((step) => {
        lines.push(`  - ${step}`);
      });
      lines.push('');
    });
  });
  return `${lines.join('\n')}\n`;
}

function summarize(results) {
  const summary = { pass: 0, fail: 0, skip: 0, total: 0 };
  results.forEach((roleResult) => {
    roleResult.cases.forEach((testCase) => {
      summary.total += 1;
      summary[testCase.result] += 1;
    });
  });
  return summary;
}

function createReadline() {
  return readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
}

function prompt(rl, message) {
  return new Promise((resolve) => {
    rl.question(message, (answer) => resolve(answer.trim()));
  });
}

async function runInteractive(roles) {
  const rl = createReadline();
  const results = [];
  console.log('\nEduAssist role-based UAT runner\n');
  console.log(`Roles selected: ${roles.join(', ')}\n`);
  try {
    for (const role of roles) {
      console.log(`\n=== ${role.toUpperCase()} ===\n`);
      const roleResult = { role, cases: [] };
      for (const testCase of CHECKLISTS[role]) {
        console.log(`${testCase.id} - ${testCase.title}`);
        console.log(`Expected: ${testCase.expected}`);
        testCase.steps.forEach((step, index) => {
          console.log(`  ${index + 1}. ${step}`);
        });

        let resultToken = '';
        while (!['p', 'f', 's'].includes(resultToken)) {
          resultToken = (
            await prompt(rl, 'Result [p=pass, f=fail, s=skip]: ')
          ).toLowerCase();
        }
        const notes = await prompt(rl, 'Notes (optional): ');
        const resultMap = { p: 'pass', f: 'fail', s: 'skip' };
        roleResult.cases.push({
          id: testCase.id,
          title: testCase.title,
          expected: testCase.expected,
          steps: testCase.steps,
          result: resultMap[resultToken],
          notes,
        });
        console.log('');
      }
      results.push(roleResult);
    }
  } finally {
    rl.close();
  }
  return results;
}

async function main() {
  const args = parseArgs(process.argv);
  const roles = resolveRoles(args.role);
  const stamp = nowStamp();
  const outDir = path.resolve(process.cwd(), args.outDir);
  fs.mkdirSync(outDir, { recursive: true });

  if (args.template) {
    const template = buildChecklistTemplateMarkdown({ roles, stamp });
    const templatePath = path.join(outDir, `uat-template-${stamp}.md`);
    fs.writeFileSync(templatePath, template, 'utf8');
    console.log(`Template created: ${templatePath}`);
    return;
  }

  const startedAt = new Date().toISOString();
  const results = await runInteractive(roles);
  const finishedAt = new Date().toISOString();
  const summary = summarize(results);
  const report = {
    stamp,
    roles,
    startedAt,
    finishedAt,
    summary,
    results,
  };

  const jsonPath = path.join(outDir, `uat-report-${stamp}.json`);
  const mdPath = path.join(outDir, `uat-report-${stamp}.md`);
  fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2), 'utf8');
  fs.writeFileSync(mdPath, buildReportMarkdown(report), 'utf8');

  console.log('\nUAT complete.');
  console.log(`JSON report: ${jsonPath}`);
  console.log(`Markdown report: ${mdPath}`);
  console.log(
    `Summary: pass=${summary.pass}, fail=${summary.fail}, skip=${summary.skip}, total=${summary.total}`,
  );
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
