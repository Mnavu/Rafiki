from rest_framework import serializers

from .models import FeeStructure, Payment, FinanceThreshold, FinanceStatus


class FeeStructureSerializer(serializers.ModelSerializer):
    class Meta:
        model = FeeStructure
        fields = "__all__"


class PaymentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Payment
        fields = "__all__"


class PaymentCreateSerializer(serializers.ModelSerializer):
    student = serializers.PrimaryKeyRelatedField(read_only=True)

    class Meta:
        model = Payment
        fields = ["student", "academic_year", "trimester", "amount", "method", "ref"]




class FinanceThresholdSerializer(serializers.ModelSerializer):
    class Meta:
        model = FinanceThreshold
        fields = "__all__"


class FinanceStatusSerializer(serializers.ModelSerializer):
    class Meta:
        model = FinanceStatus
        fields = "__all__"