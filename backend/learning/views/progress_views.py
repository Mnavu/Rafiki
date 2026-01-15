from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import permissions, status
from django.shortcuts import get_object_or_404

from users.models import Student
from learning.models import Registration, Submission, CurriculumUnit

class ProgressSummaryView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, student_id):
        student = get_object_or_404(Student, pk=student_id)
        user = request.user

        # Permission check
        if user.role == 'student':
            if user.id != student.user_id:
                return Response({"error": "Forbidden"}, status=status.HTTP_403_FORBIDDEN)
        elif user.role == 'parent':
            if not hasattr(user, 'guardian_profile') or not user.guardian_profile.linked_students.filter(student=student).exists():
                return Response({"error": "Forbidden"}, status=status.HTTP_403_FORBIDDEN)
        elif user.role not in ['lecturer', 'hod', 'records', 'admin', 'superadmin']:
            return Response({"error": "Forbidden"}, status=status.HTTP_403_FORBIDDEN)

        registrations = Registration.objects.filter(student=student, status='approved').select_related('unit__programme')
        
        programmes_progress = {}
        completed_units = 0
        total_units = registrations.count()
        
        all_submissions = Submission.objects.filter(student=student).select_related('assignment__unit')
        
        # Group submissions by unit
        submissions_by_unit = {}
        for sub in all_submissions:
            if sub.assignment.unit.id not in submissions_by_unit:
                submissions_by_unit[sub.assignment.unit.id] = []
            submissions_by_unit[sub.assignment.unit.id].append(sub)

        for reg in registrations:
            unit = reg.unit
            programme = unit.programme
            
            if programme.id not in programmes_progress:
                programmes_progress[programme.id] = {
                    "programme_id": programme.id,
                    "programme_name": programme.name,
                    "programme_code": programme.code,
                    "unit_progress": [],
                    "programme_grades": [],
                }

            submissions_for_unit = submissions_by_unit.get(unit.id, [])
            
            grades = [float(s.grade) for s in submissions_for_unit if s.grade is not None]
            average_grade = sum(grades) / len(grades) if grades else None

            is_completed = average_grade is not None # Or some other logic

            if is_completed:
                completed_units += 1
                if average_grade is not None:
                    programmes_progress[programme.id]["programme_grades"].append(average_grade)

            programmes_progress[programme.id]['unit_progress'].append({
                'unit_id': unit.id,
                'unit_code': unit.code,
                'unit_title': unit.title,
                'average_grade': average_grade,
                'completed': is_completed,
            })

        for prog_id, prog_data in programmes_progress.items():
            prog_grades = prog_data["programme_grades"]
            prog_data["average_score"] = sum(prog_grades) / len(prog_grades) if prog_grades else None
            del prog_data["programme_grades"]


        response_data = {
            "student": {
                "id": student.pk,
                "username": student.user.username,
                "display_name": student.user.display_name,
            },
            "programmes": list(programmes_progress.values()),
            "completed_units": completed_units,
            "total_units": total_units,
        }
        
        return Response(response_data)
