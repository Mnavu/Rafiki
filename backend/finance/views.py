from decimal import Decimal
from django.shortcuts import get_object_or_404
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.exceptions import PermissionDenied, ValidationError

from .models import Payment, FinanceStatus
from .serializers import PaymentSerializer, FinanceStatusSerializer, PaymentCreateSerializer
from users.models import Student, ParentStudentLink

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
        elif user.role == 'parent':
            linked_student_ids = ParentStudentLink.objects.filter(
                parent__user=user,
            ).values_list('student_id', flat=True)
            return Payment.objects.filter(student_id__in=linked_student_ids)
        elif user.role in ['finance', 'admin', 'superadmin']:
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

        # Finance officer is responsible for opening registration after threshold checks.
        if fin_status.total_due > 0:
            percentage_paid = (fin_status.total_paid / fin_status.total_due) * 100
            if percentage_paid >= Decimal("100.0"):
                fin_status.status = FinanceStatus.Status.PAID
            elif percentage_paid >= Decimal("1.0"):
                fin_status.status = FinanceStatus.Status.PARTIAL
            else:
                fin_status.status = FinanceStatus.Status.PENDING
            fin_status.save(update_fields=["status", "updated_at"])


class FinanceStatusViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = FinanceStatus.objects.all()
    serializer_class = FinanceStatusSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if user.role == 'student':
            return FinanceStatus.objects.filter(student=user.student_profile)
        elif user.role == 'parent':
            linked_student_ids = ParentStudentLink.objects.filter(
                parent__user=user,
            ).values_list('student_id', flat=True)
            return FinanceStatus.objects.filter(student_id__in=linked_student_ids)
        elif user.role in ['finance', 'admin', 'superadmin', 'hod']:
            return FinanceStatus.objects.all()
        return FinanceStatus.objects.none()

    @action(detail=True, methods=['post'])
    def open_registration(self, request, pk=None):
        user = request.user
        if user.role not in ['finance', 'admin']:
            raise PermissionDenied("Only finance or admin can open registration.")

        fin_status = self.get_object()
        if fin_status.total_due <= 0:
            raise ValidationError("Total due must be greater than 0 to evaluate clearance.")
        percentage_paid = (fin_status.total_paid / fin_status.total_due) * 100
        if percentage_paid < Decimal("60.0"):
            raise ValidationError(
                f"Student has paid {percentage_paid:.2f}% and does not meet the 60% threshold."
            )

        fin_status.clearance_status = FinanceStatus.Clearance.CLEARED_FOR_REGISTRATION
        if percentage_paid >= Decimal("100.0"):
            fin_status.status = FinanceStatus.Status.PAID
        else:
            fin_status.status = FinanceStatus.Status.PARTIAL
        fin_status.save(update_fields=["clearance_status", "status", "updated_at"])

        student = fin_status.student
        student.current_status = Student.Status.FINANCE_OK
        student.save(update_fields=["current_status"])

        return Response(
            {
                "detail": "Registration portal is now open for this student.",
                "percentage_paid": float(percentage_paid),
                "student_id": student.user_id,
                "finance_status_id": fin_status.id,
            },
            status=status.HTTP_200_OK,
        )
