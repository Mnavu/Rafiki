import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent

SECRET_KEY = os.environ.get("DJANGO_SECRET_KEY", "dev-secret-key-change-me")
DEBUG = os.environ.get("DJANGO_DEBUG", "1") == "1"
ALLOWED_HOSTS = os.environ.get("DJANGO_ALLOWED_HOSTS", "*").split(",")

INSTALLED_APPS = [
    "jazzmin",
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    # Third-party
    "rest_framework",
    "corsheaders",
    "django_filters",
    "drf_spectacular",
    "rest_framework_simplejwt",
    "rest_framework_simplejwt.token_blacklist",
    "more_admin_filters",
    # Local apps
    "core",
    "users.apps.UsersConfig",
    "learning",
    "finance",
    "communications",
    "repository",
    "chatbot",
    "notifications",
    "rewards",
]

MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "core.middleware.RequestAuditMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "edu_assist.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [BASE_DIR / "templates"],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    }
]

WSGI_APPLICATION = "edu_assist.wsgi.application"
ASGI_APPLICATION = "edu_assist.asgi.application"

DATABASES = {
    "default": {
        "ENGINE": os.environ.get("DB_ENGINE", "django.db.backends.sqlite3"),
        "NAME": os.environ.get("DB_NAME", str(BASE_DIR / "db.sqlite3")),
        "USER": os.environ.get("DB_USER", ""),
        "PASSWORD": os.environ.get("DB_PASSWORD", ""),
        "HOST": os.environ.get("DB_HOST", ""),
        "PORT": os.environ.get("DB_PORT", ""),
    }
}

AUTH_USER_MODEL = "users.User"

LANGUAGE_CODE = "en-us"
TIME_ZONE = "UTC"
USE_I18N = True
USE_TZ = True

STATIC_URL = "/static/"
STATIC_ROOT = BASE_DIR / "staticfiles"

STATICFILES_DIRS = [
    BASE_DIR / "core/static",
]

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

RECORDS_PROVISION_PASSCODE = os.environ.get("RECORDS_PROVISION_PASSCODE", "Records@2025")

ADMIN_USERNAME = os.environ.get("DJANGO_ADMIN_USERNAME", "admin")
ADMIN_EMAIL = os.environ.get("DJANGO_ADMIN_EMAIL", "admin@example.com")
ADMIN_PASSWORD = os.environ.get("DJANGO_ADMIN_PASSWORD", "adminpass")

CORS_ALLOW_ALL_ORIGINS = True

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "rest_framework_simplejwt.authentication.JWTAuthentication",
        "rest_framework.authentication.SessionAuthentication",
        "rest_framework.authentication.BasicAuthentication",
    ],
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.IsAuthenticatedOrReadOnly",
    ],
    "DEFAULT_FILTER_BACKENDS": [
        "django_filters.rest_framework.DjangoFilterBackend",
        "rest_framework.filters.SearchFilter",
        "rest_framework.filters.OrderingFilter",
    ],
    "DEFAULT_SCHEMA_CLASS": "drf_spectacular.openapi.AutoSchema",
}

# Media files (for Resource.file) – dev-friendly defaults
MEDIA_URL = "/media/"
MEDIA_ROOT = BASE_DIR / "media"

# drf-spectacular minimal settings (can expand later)
SPECTACULAR_SETTINGS = {
    "TITLE": "EduAssist API",
    "DESCRIPTION": "Accessible Chatbot LMS Backend",
    "VERSION": "0.1.0",
}

from datetime import timedelta

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=60),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=7),
    "ROTATE_REFRESH_TOKENS": True,
    "BLACKLIST_AFTER_ROTATION": True,
    # Optionally update last_login on successful authentication
    "UPDATE_LAST_LOGIN": True,
    "AUTH_HEADER_TYPES": ("Bearer",),
}

JAZZMIN_SETTINGS = {
    # title of the window (Will default to current_admin_site.site_title if absent or None)
    "site_title": "Nanu Admin",

    # Title on the login screen (19 chars max) (defaults to current_admin_site.site_header if absent or None)
    "site_header": "Nanu",

    # Title on the brand (19 chars max) (defaults to current_admin_site.site_header if absent or None)
    "site_brand": "Nanu",

    # Logo to use for your site, must be present in static files, used for brand on top left
    # "site_logo": "books/img/logo.png",

    # Logo to use for your site, must be present in static files, used for login form logo (defaults to site_logo)
    # "login_logo": None,

    # Logo to use for login form in dark themes (defaults to login_logo)
    # "login_logo_dark": None,

    # CSS classes that are applied to the logo above
    "site_logo_classes": "img-circle",

    # Relative path to a favicon for your site, will default to site_logo if absent or None
    "site_icon": None,

    # Welcome text on the login screen
    "welcome_sign": "Welcome to the Nanu Admin",

    # Copyright on the footer
    "copyright": "Nanu Platform",

    # The model admin to search from the search bar, search bar omitted if excluded
    "search_model": "users.User",

    # List of apps (and models) to base side menu ordering off of (does not need to contain all apps)
    "order_with_respect_to": ["users", "learning", "finance", "communications", "repository", "rewards"],

    # Custom links to append to app groups, keyed on app name
    "custom_links": {
        "core": [{
            "name": "API Docs", "url": "/api/docs/", "icon": "fas fa-file-contract", "permissions": ["core.view_auditlog"]
        }]
    },

    # Icons for side menu apps/models available at https://fontawesome.com/
    # If you want to use a single icon for all models in an app, use the following format
    # "app_label": "icon_class_name",
    # Alternatively, you can specify icons on a model-by-model basis
    "icons": {
        "auth": "fas fa-users-cog",
        "users.user": "fas fa-user",
        "users.parentstudentlink": "fas fa-link",
        "core.auditlog": "fas fa-history",
        "learning": "fas fa-book-reader",
        "finance": "fas fa-file-invoice-dollar",
        "communications": "fas fa-comments",
        "repository": "fas fa-archive",
        "rewards": "fas fa-trophy",
        "notifications": "fas fa-bell",
        "chatbot": "fas fa-robot",
    },

    # Whether to show the UI customizer on the sidebar
    "show_ui_builder": True,
}

JAZZMIN_UI_TWEAKS = {
    "navbar_small_text": False,
    "footer_small_text": False,
    "body_small_text": True,
    "brand_small_text": False,
    "brand_colour": "navbar-dark",
    "accent": "accent-primary",
    "navbar": "navbar-dark",
    "no_navbar_border": False,
    "navbar_fixed": True,
    "layout_boxed": False,
    "footer_fixed": False,
    "sidebar_fixed": True,
    "sidebar": "sidebar-dark-primary",
    "sidebar_nav_small_text": False,
    "sidebar_disable_expand": False,
    "sidebar_nav_child_indent": False,
    "sidebar_nav_compact_style": False,
    "sidebar_nav_legacy_style": False,
    "sidebar_nav_flat_style": True,
    "theme": "darkly",
    "dark_mode_theme": "darkly",
    "button_classes": {
        "primary": "btn-primary",
        "secondary": "btn-secondary",
        "info": "btn-info",
        "warning": "btn-warning",
        "danger": "btn-danger",
        "success": "btn-success"
    },
    "related_modal_active": True,
}
