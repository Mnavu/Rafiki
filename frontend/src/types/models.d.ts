import { Role } from './roles';

export interface Programme {
    id: number;
    department: number;
    name: string;
    code: string;
    award_level: string;
    duration_years: number;
    trimesters_per_year: number;
}

export interface CurriculumUnit {
    id: number;
    programme: number;
    code: string;
    title: string;
    credit_hours: number;
    trimester_hint: number | null;
    has_prereq: boolean;
    prereq_unit: number | null;
}

export interface Registration {
    id: number;
    student: number;
    unit: CurriculumUnit; // Nested CurriculumUnit
    academic_year: number;
    trimester: number;
    status: 'draft' | 'submitted' | 'pending_hod' | 'approved' | 'rejected';
}

export interface UserProfile {
  id: number;
  user: number;
}

export interface StudentProfile extends UserProfile {
  programme: number;
  year: number;
  trimester: number;
  trimester_label: string;
  cohort_year: number;
  current_status: 'new'|'admitted'|'finance_ok'|'pending_hod'|'active'|'blocked';
}

export interface HodProfile extends UserProfile {
  department: number;
}

export interface Department {
    id: number;
    name: string;
    code: string;
    head_of_department: number | null;
}

export interface LecturerProfile extends UserProfile {
  department: number;
  assigned_load: number;
}

export interface LecturerAssignment {
    id: number;
    lecturer: number;
    unit: CurriculumUnit; // Nested CurriculumUnit
    academic_year: number;
    trimester: number;
}

export interface User {
    id: number;
    username: string;
    email: string;
    first_name: string;
    last_name: string;
    display_name: string;
    role: Role;
    must_change_password: boolean;
    student_profile?: StudentProfile; // Optional student profile
    lecturer_profile?: LecturerProfile; // Optional lecturer profile
    hod_profile?: HodProfile; // Optional HOD profile
    // Add other role profiles as needed
}

// Extend other types as needed
