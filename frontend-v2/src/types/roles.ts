export type Role =
  | 'student'
  | 'parent'
  | 'lecturer'
  | 'hod'
  | 'finance'
  | 'records'
  | 'admin'
  | 'superadmin'
  | 'librarian';

export const roleLabels: Record<Role, string> = {
  student: 'Student',
  parent: 'Parent / Guardian',
  lecturer: 'Lecturer',
  hod: 'Head of Department',
  finance: 'Finance',
  records: 'Records',
  admin: 'Admin',
  superadmin: 'Super Admin',
  librarian: 'Librarian',
};
