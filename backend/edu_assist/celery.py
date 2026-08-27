import os
from celery import Celery

# Set the default Django settings module for the 'celery' program.
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'edu_assist.settings')

app = Celery('edu_assist')

# Load configuration from Django settings, using a 'CELERY_' prefix.
app.config_from_object('django.conf:settings', namespace='CELERY')

# Automatically discover tasks in all of your installed apps.
app.autodiscover_tasks()