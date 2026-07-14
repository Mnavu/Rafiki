from django.apps import AppConfig


class AccountsCoreConfig(AppConfig):
    """Holds only abstract base classes (AbstractSkillUser, AbstractMentorLearnerLink).

    Registered in INSTALLED_APPS purely so Django can resolve an app_label for the
    abstract models below; it contributes no concrete models and no migrations.
    """

    default_auto_field = "django.db.models.BigAutoField"
    name = "skillapp_core.accounts"
    label = "skillapp_core_accounts"
    verbose_name = "Skill App Core - Accounts"
