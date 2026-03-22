from io import StringIO

from django.core.management import call_command
from django.test import TestCase

from chatbot.models import CourseRevisionKnowledge
from learning.models import CurriculumUnit, Programme


class SeedRevisionKnowledgeBankCommandTests(TestCase):
    def setUp(self):
        self.programme = Programme.objects.create(
            code="CTT01",
            name="Certificate in Tourism and Travel",
            award_level="Certificate",
            duration_years=2,
            trimesters_per_year=3,
        )
        self.diploma_programme = Programme.objects.create(
            code="DTM",
            name="Diploma in Tourism Operations",
            award_level="Diploma",
            duration_years=2,
            trimesters_per_year=3,
        )
        CurriculumUnit.objects.create(
            programme=self.programme,
            code="TT-111",
            title="Introduction to the Global Travel & Tourism Industry",
            credit_hours=3,
            trimester_hint=1,
        )
        CurriculumUnit.objects.create(
            programme=self.programme,
            code="TT-212",
            title="Sustainable Tourism",
            credit_hours=3,
            trimester_hint=1,
        )
        CurriculumUnit.objects.create(
            programme=self.diploma_programme,
            code="DTM101",
            title="Introduction to Tourism",
            credit_hours=3,
            trimester_hint=1,
        )

    def test_seed_revision_knowledge_bank_creates_entries_for_available_units(self):
        output = StringIO()
        call_command("seed_revision_knowledge_bank", stdout=output)

        self.assertTrue(
            CourseRevisionKnowledge.objects.filter(
                unit__code="TT-111",
                topic_title="Tourism basics and the visitor journey",
            ).exists()
        )
        self.assertTrue(
            CourseRevisionKnowledge.objects.filter(
                unit__code="TT-212",
                topic_title="Sustainable and responsible tourism",
            ).exists()
        )
        self.assertTrue(
            CourseRevisionKnowledge.objects.filter(
                unit__code="DTM101",
                topic_title="Tourism basics and the visitor journey",
            ).exists()
        )
        self.assertIn("Revision bank seeding complete", output.getvalue())

    def test_dry_run_does_not_write_records(self):
        output = StringIO()
        call_command("seed_revision_knowledge_bank", "--dry-run", stdout=output)

        self.assertEqual(CourseRevisionKnowledge.objects.count(), 0)
        self.assertIn("[DRY RUN] CREATE", output.getvalue())

