from decimal import Decimal

from django.test import TestCase
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from core.models import Department
from finance.models import FinanceStatus, Payment
from learning.models import Programme
from users.models import Student, User


class FinanceWorkflowApiTests(TestCase):
    def setUp(self):
        self.client = APIClient()

        self.finance_user = User.objects.create_user(
            username="finance_api",
            email="finance@example.com",
            password="password",
            role=User.Roles.FINANCE,
        )
        self.student_user = User.objects.create_user(
            username="student_api",
            email="student@example.com",
            password="password",
            role=User.Roles.STUDENT,
        )

        department = Department.objects.create(name="Business", code="BUS")
        programme = Programme.objects.create(
            department=department,
            name="Diploma in Business",
            code="DBUS",
            award_level="Diploma",
            duration_years=2,
            trimesters_per_year=3,
        )
        self.student = Student.objects.create(
            user=self.student_user,
            programme=programme,
            year=1,
            trimester=1,
            trimester_label="Year 1 Trimester 1",
            current_status=Student.Status.ADMITTED,
        )
        self.finance_status = FinanceStatus.objects.create(
            student=self.student,
            academic_year=2026,
            trimester=1,
            total_due=Decimal("1000.00"),
            total_paid=Decimal("0.00"),
            status=FinanceStatus.Status.PENDING,
            clearance_status=FinanceStatus.Clearance.BLOCKED,
        )

    def test_finance_can_record_payment_for_student(self):
        self.client.force_authenticate(user=self.finance_user)

        response = self.client.post(
            reverse("finance-status-record-payment", args=[self.finance_status.id]),
            {"amount": "400.00", "method": "Cash", "ref": "RCPT-001"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.finance_status.refresh_from_db()
        self.assertEqual(self.finance_status.total_paid, Decimal("400.00"))
        self.assertEqual(self.finance_status.status, FinanceStatus.Status.PARTIAL)
        self.assertEqual(Payment.objects.filter(student=self.student).count(), 1)

    def test_finance_can_clear_student_after_threshold(self):
        self.finance_status.total_paid = Decimal("700.00")
        self.finance_status.status = FinanceStatus.Status.PARTIAL
        self.finance_status.save(update_fields=["total_paid", "status"])

        self.client.force_authenticate(user=self.finance_user)

        response = self.client.post(
            reverse("finance-status-open-registration", args=[self.finance_status.id]),
            {},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.finance_status.refresh_from_db()
        self.student.refresh_from_db()
        self.assertEqual(
            self.finance_status.clearance_status,
            FinanceStatus.Clearance.CLEARED_FOR_REGISTRATION,
        )
        self.assertEqual(self.student.current_status, Student.Status.FINANCE_OK)
