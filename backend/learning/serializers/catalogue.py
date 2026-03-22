from rest_framework import serializers

from ..models import Programme, CurriculumUnit, TermOffering, LecturerAssignment, Timetable


class ProgrammeSerializer(serializers.ModelSerializer):
    class Meta:
        model = Programme
        fields = "__all__"


class CurriculumUnitSerializer(serializers.ModelSerializer):
    class Meta:
        model = CurriculumUnit
        fields = "__all__"


class TermOfferingSerializer(serializers.ModelSerializer):
    class Meta:
        model = TermOffering
        fields = "__all__"


class LecturerAssignmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = LecturerAssignment
        fields = "__all__"


class TimetableSerializer(serializers.ModelSerializer):
    unit_title = serializers.CharField(source="unit.title", read_only=True)
    unit_code = serializers.CharField(source="unit.code", read_only=True)

    class Meta:
        model = Timetable
        fields = "__all__"
