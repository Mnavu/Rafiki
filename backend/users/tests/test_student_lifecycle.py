from django.test import TestCase
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient
from decimal import Decimal

from users.models import User, Student, HOD
from core.models import Department
from learning.models import Programme, CurriculumUnit, Registration
from finance.models import FinanceStatus

class StudentLifecycleTest(TestCase):
    def setUp(self):
        self.client = APIClient()

        # Create users
        self.admin_user = User.objects.create_user("admin", "admin@test.com", "password", role=User.Roles.ADMIN, is_staff=True)
        self.hod_user = User.objects.create_user("hod", "hod@test.com", "password", role=User.Roles.HOD)
        self.student_user = User.objects.create_user("student", "student@test.com", "password", role=User.Roles.STUDENT)

        # Create department and programme
        self.department = Department.objects.create(name="Computer Science", code="CS")
        self.programme = Programme.objects.create(name="BSc. Computer Science", code="CS", department=self.department, duration_years=4, trimesters_per_year=3)
        
        # Create HOD profile
        self.hod_profile = HOD.objects.create(user=self.hod_user, department=self.department)
        
        # Create student profile
        self.student_profile = Student.objects.create(
            user=self.student_user, 
            programme=self.programme, 
            year=1, 
            trimester=1,
            trimester_label="T1",
            current_status=Student.Status.ADMITTED
        )

        # Create Finance Status
        self.finance_status = FinanceStatus.objects.create(
            student=self.student_profile,
            academic_year=2024,
            trimester=1,
            total_due=Decimal("1000.00"),
            total_paid=Decimal("0.00")
        )

        # Create units
        self.unit1 = CurriculumUnit.objects.create(programme=self.programme, code="CS101", title="Intro to CS", credit_hours=3)
        self.unit2 = CurriculumUnit.objects.create(programme=self.programme, code="CS102", title="Data Structures", credit_hours=3)

    def test_student_payment_updates_finance_status(self):
        self.client.force_authenticate(user=self.student_user)
        
        # Make a payment that is more than 60%
        payment_data = {
            "academic_year": 2024,
            "trimester": 1,
            "amount": "700.00",
            "method": "Test Payment"
        }
        
        url = reverse("payment-list")
        response = self.client.post(url, payment_data)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        # Payment updates finance totals, but finance clearance is opened separately.
        self.student_profile.refresh_from_db()
        self.assertEqual(self.student_profile.current_status, Student.Status.ADMITTED)

        # Check finance status
        self.finance_status.refresh_from_db()
        self.assertEqual(self.finance_status.clearance_status, FinanceStatus.Clearance.BLOCKED)
        self.assertEqual(self.finance_status.status, FinanceStatus.Status.PARTIAL)
        self.assertEqual(self.finance_status.total_paid, Decimal("700.00"))

    def test_student_can_select_units_after_fee_clearance(self):
        # First, clear the student financially
        self.student_profile.current_status = Student.Status.FINANCE_OK
        self.student_profile.save()

        self.client.force_authenticate(user=self.student_user)

        unit_selection_data = {
            "unit_ids": [self.unit1.id, self.unit2.id]
        }
        
        url = reverse("student-unit-selection-list")
        response = self.client.post(url, unit_selection_data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        # Check student status
        self.student_profile.refresh_from_db()
        self.assertEqual(self.student_profile.current_status, Student.Status.PENDING_HOD)

        # Check that registrations were created
        registrations = Registration.objects.filter(student=self.student_profile)
        self.assertEqual(registrations.count(), 2)
        for reg in registrations:
            self.assertEqual(reg.status, Registration.Status.PENDING_HOD)

    def test_student_can_adjust_units_while_pending_hod(self):
        self.student_profile.current_status = Student.Status.FINANCE_OK
        self.student_profile.save()

        self.client.force_authenticate(user=self.student_user)

        first_response = self.client.post(
            reverse("student-unit-selection-list"),
            {"unit_ids": [self.unit1.id, self.unit2.id]},
            format="json",
        )
        self.assertEqual(first_response.status_code, status.HTTP_201_CREATED)

        self.student_profile.refresh_from_db()
        self.assertEqual(self.student_profile.current_status, Student.Status.PENDING_HOD)

        second_response = self.client.post(
            reverse("student-unit-selection-list"),
            {"unit_ids": [self.unit1.id]},
            format="json",
        )
        self.assertEqual(second_response.status_code, status.HTTP_201_CREATED)

        registrations = Registration.objects.filter(student=self.student_profile).order_by("unit__code")
        self.assertEqual(registrations.count(), 1)
        self.assertEqual(registrations.first().unit_id, self.unit1.id)
        self.assertEqual(registrations.first().status, Registration.Status.PENDING_HOD)

    def test_student_cannot_select_more_than_four_units(self):
        self.student_profile.current_status = Student.Status.FINANCE_OK
        self.student_profile.save()

        extra_units = [
            CurriculumUnit.objects.create(
                programme=self.programme,
                code=f"CS10{index}",
                title=f"Extra Unit {index}",
                credit_hours=3,
            )
            for index in range(3, 6)
        ]

        self.client.force_authenticate(user=self.student_user)

        response = self.client.post(
            reverse("student-unit-selection-list"),
            {
                "unit_ids": [
                    self.unit1.id,
                    self.unit2.id,
                    extra_units[0].id,
                    extra_units[1].id,
                    extra_units[2].id,
                ]
            },
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("maximum of 4 units", str(response.data))
        self.assertFalse(Registration.objects.filter(student=self.student_profile).exists())
    
    def test_hod_can_approve_units(self):
        # Create pending registrations
        Registration.objects.create(student=self.student_profile, unit=self.unit1, academic_year=2024, trimester=1, status=Registration.Status.PENDING_HOD)
        Registration.objects.create(student=self.student_profile, unit=self.unit2, academic_year=2024, trimester=1, status=Registration.Status.PENDING_HOD)
        self.student_profile.current_status = Student.Status.PENDING_HOD
        self.student_profile.save()

        self.client.force_authenticate(user=self.hod_user)
        
        registrations_to_approve = Registration.objects.filter(student=self.student_profile)
        registration_ids = [reg.id for reg in registrations_to_approve]

        approval_data = {
            "registration_ids": registration_ids
        }

        url = reverse("hod-unit-approval-approve-registrations")
        response = self.client.post(url, approval_data, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        # Check student status
        self.student_profile.refresh_from_db()
        self.assertEqual(self.student_profile.current_status, Student.Status.ACTIVE)

        # Check registration status
        for reg in registrations_to_approve:
            reg.refresh_from_db()
            self.assertEqual(reg.status, Registration.Status.APPROVED)
