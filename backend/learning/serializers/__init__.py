from .achievements import (
    AchievementCategorySerializer,
    AchievementSerializer,
    StudentAchievementSerializer,
    RewardClaimSerializer,
    TermProgressSerializer,
)
from .assignments import AssignmentSerializer, RegistrationSerializer, SubmissionSerializer
from .catalogue import ProgrammeSerializer, CurriculumUnitSerializer, TermOfferingSerializer, LecturerAssignmentSerializer, TimetableSerializer# TODO: Refactor core serializers and uncomment
# from .core import (
#     CourseSerializer,
#     UnitSerializer,
#     EnrollmentSerializer,
#     AttendanceEventSerializer,
# )
from .sessions import (
    CourseScheduleSerializer,
    CourseSessionSerializer,
    VoiceAttendanceSerializer,
    SessionReminderSerializer,
)
from .progress import (
    StudentProgressSerializer,
    ActivityLogSerializer,
    CompletionRecordSerializer,
    CompletionRecordListSerializer,
)
from .goals import (
    LearningGoalSerializer,
    LearningGoalListSerializer,
    LearningMilestoneSerializer,
    LearningSupportSerializer,
    GoalReflectionSerializer,
)
from .quiz import QuizSerializer, QuestionSerializer, ChoiceSerializer, StudentAnswerSerializer

__all__ = [
    "AchievementCategorySerializer",
    "AchievementSerializer",
    "StudentAchievementSerializer",
    "RewardClaimSerializer",
    "TermProgressSerializer",
    "AssignmentSerializer",
    "RegistrationSerializer",
    "ProgrammeSerializer",
    "CurriculumUnitSerializer",
    "TermOfferingSerializer",
    "LecturerAssignmentSerializer",
    "TimetableSerializer",
    # "CourseSerializer",
    # "UnitSerializer",
    # "EnrollmentSerializer",
    # "AttendanceEventSerializer",
    "CourseScheduleSerializer",
    "CourseSessionSerializer",
    "VoiceAttendanceSerializer",
    "SessionReminderSerializer",
    "StudentProgressSerializer",
    "ActivityLogSerializer",
    "CompletionRecordSerializer",
    "CompletionRecordListSerializer",
    "LearningGoalSerializer",
    "LearningGoalListSerializer",
    "LearningMilestoneSerializer",
    "LearningSupportSerializer",
    "GoalReflectionSerializer",
    "QuizSerializer", 
    "QuestionSerializer", 
    "ChoiceSerializer", 
    "StudentAnswerSerializer",
]
