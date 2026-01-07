from decimal import Decimal
from django.shortcuts import get_object_or_404
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.exceptions import PermissionDenied, ValidationError

from .models import Payment, FinanceStatus
from .serializers import PaymentSerializer, FinanceStatusSerializer, PaymentCreateSerializer
from users.models import Student

class PaymentViewSet(viewsets.ModelViewSet):
    queryset = Payment.objects.all()
    serializer_class = PaymentSerializer
    permission_classes = [IsAuthenticated]

    def get_serializer_class(self):
        if self.action == 'create':
            return PaymentCreateSerializer
        return PaymentSerializer

    def get_queryset(self):
        user = self.request.user
        if user.role == 'student':
            try:
                student_profile = user.student_profile
                return Payment.objects.filter(student=student_profile)
            except Student.DoesNotExist:
                return Payment.objects.none()
        elif user.role in ['finance', 'admin']:
            return Payment.objects.all()
        return Payment.objects.none()

    def perform_create(self, serializer):
        user = self.request.user
        if user.role != 'student':
            # Or allow finance/admin to create on behalf of a student
            raise PermissionDenied("Only students can make payments for themselves.")
        
        try:
            student_profile = user.student_profile
        except Student.DoesNotExist:
            raise ValidationError("A student profile is required to make a payment.")

        payment = serializer.save(student=student_profile)

        # Update finance status
        fin_status = get_object_or_404(
            FinanceStatus,
            student=student_profile,
            academic_year=payment.academic_year,
            trimester=payment.trimester
        )
        
        fin_status.total_paid += payment.amount
        fin_status.save()

        # Check for clearance
        if fin_status.total_due > 0:
            percentage_paid = (fin_status.total_paid / fin_status.total_due) * 100
            if percentage_paid >= Decimal("60.0"):
                fin_status.clearance_status = FinanceStatus.Clearance.CLEARED_FOR_REGISTRATION
                fin_status.save()

                student_profile.current_status = Student.Status.FINANCE_OK
                student_profile.save()


class FinanceStatusViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = FinanceStatus.objects.all()
    serializer_class = FinanceStatusSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if user.role == 'student':
            return FinanceStatus.objects.filter(student=user.student_profile)
        elif user.role in ['finance', 'admin', 'hod']:
            return FinanceStatus.objects.all()
        return FinanceStatus.objects.none()
