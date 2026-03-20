from django.test import SimpleTestCase

from users.display import resolve_user_display_name
from users.models import User


class DisplayNameResolutionTests(SimpleTestCase):
    def test_placeholder_demo_name_uses_real_names_when_available(self):
        user = User(
            username="steven",
            display_name="Demo Student DTM Year 1 #1",
            first_name="Steven",
            last_name="Ogaro",
        )

        self.assertEqual(resolve_user_display_name(user), "Steven Ogaro")

    def test_placeholder_demo_name_uses_real_username_when_names_are_blank(self):
        user = User(
            username="Salma",
            display_name="Demo Student TTM101 Year 1 #1",
            first_name="",
            last_name="",
        )

        self.assertEqual(resolve_user_display_name(user), "Salma")
