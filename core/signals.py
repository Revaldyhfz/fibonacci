"""
Signal handlers for the core app.

On user creation, auto-assign the default `User` group so every account has a
concrete role. The Admin group is elevated manually via the management command
or Django admin — never auto-assigned.
"""

from django.contrib.auth.models import Group, User
from django.db.models.signals import post_save
from django.dispatch import receiver

from .permissions import USER_GROUP


@receiver(post_save, sender=User)
def assign_default_group(sender, instance, created, **kwargs):
    if not created:
        return
    # Skip superusers — they bypass permission checks anyway, and signal
    # ordering with fixtures/migrations can be fragile.
    if instance.is_superuser:
        return
    group, _ = Group.objects.get_or_create(name=USER_GROUP)
    instance.groups.add(group)
