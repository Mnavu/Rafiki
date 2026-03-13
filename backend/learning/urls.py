from django.urls import path, include
from rest_framework.routers import DefaultRouter
# TODO: Refactor all the views in core_views.py and uncomment the lines below
# from .core_views import (
#     CourseViewSet,
#     UnitViewSet,
#     EnrollmentViewSet,
#     ProgressSummaryView,
#     QuickEnrollmentView,
#     CourseRosterView,
#     AttendanceCheckInView,
#     ExamRegistrationView,
# )
from .views import (
    ProgrammeViewSet,
    CurriculumUnitViewSet,
    TermOfferingViewSet,
    LecturerAssignmentViewSet,
    TimetableViewSet,
    StudentUnitSelectionViewSet,
    StudentLecturersView,
    HodUnitApprovalViewSet,
    LecturerGradingViewSet,
    AchievementCategoryViewSet,
    AchievementViewSet,
    StudentAchievementViewSet,
    RewardClaimViewSet,
    TermProgressViewSet,
    AssignmentViewSet,
    RegistrationViewSet,
    SubmissionViewSet,
    ProgressSummaryView,
    QuizViewSet,
    LecturerClassesDashboardView,
    LecturerClassDetailView,
    LecturerWeeklyPlannerView,
    LecturerAttendanceSheetView,
    StudentPeersView,
)

router = DefaultRouter()
router.register(r"programmes", ProgrammeViewSet, basename="programme")
router.register(r"curriculum-units", CurriculumUnitViewSet, basename="curriculum-unit")
router.register(r"term-offerings", TermOfferingViewSet, basename="term-offering")
router.register(r"lecturer-assignments", LecturerAssignmentViewSet, basename="lecturer-assignment")
router.register(r"timetables", TimetableViewSet, basename="timetable")
router.register(r"submissions", SubmissionViewSet, basename="submission")
# router.register(r"courses", CourseViewSet, basename="course")
# router.register(r"units", UnitViewSet, basename="unit")
# router.register(r"enrollments", EnrollmentViewSet, basename="enrollment")
router.register(r"achievement-categories", AchievementCategoryViewSet, basename="achievement-category")
router.register(r"achievements", AchievementViewSet, basename="achievement")
router.register(r"student-achievements", StudentAchievementViewSet, basename="student-achievement")
router.register(r"reward-claims", RewardClaimViewSet, basename="reward-claim")
router.register(r"term-progress", TermProgressViewSet, basename="term-progress")
router.register(r"assignments", AssignmentViewSet, basename="assignment")
router.register(r"registrations", RegistrationViewSet, basename="registration")
router.register(r"student-unit-selection", StudentUnitSelectionViewSet, basename="student-unit-selection")
router.register(r"hod-unit-approval", HodUnitApprovalViewSet, basename="hod-unit-approval")
router.register(r"lecturer-grading", LecturerGradingViewSet, basename="lecturer-grading")
router.register(r"quizzes", QuizViewSet, basename="quiz")


custom_patterns = [
    path("students/<int:student_id>/progress/", ProgressSummaryView.as_view(), name="progress-summary"),
    path("my-lecturers/", StudentLecturersView.as_view(), name="my-lecturers"),
    path("students/me/peers/", StudentPeersView.as_view(), name="student-peers"),
    path("lecturer/classes/", LecturerClassesDashboardView.as_view(), name="lecturer-classes"),
    path("lecturer/classes/<int:unit_id>/", LecturerClassDetailView.as_view(), name="lecturer-class-detail"),
    path("lecturer/weekly-planner/", LecturerWeeklyPlannerView.as_view(), name="lecturer-weekly-planner"),
    path("lecturer/attendance-sheet/", LecturerAttendanceSheetView.as_view(), name="lecturer-attendance-sheet"),
    # path("enrollments/quick/", QuickEnrollmentView.as_view(), name="quick-enrollment"),
    # path("courses/<int:course_id>/roster/", CourseRosterView.as_view(), name="course-roster"),
    # path("attendance/check-in/", AttendanceCheckInView.as_view(), name="attendance-check-in"),
    # path("exams/register/", ExamRegistrationView.as_view(), name="exam-register"),
]

urlpatterns = router.urls + custom_patterns
