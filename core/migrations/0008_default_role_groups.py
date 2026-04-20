"""
Data migration: create the User + Admin role groups.

Idempotent — safe to run multiple times. Also backfills the User group on
every existing non-superuser account so the role system is consistent from
day one of the rollout.
"""

from django.db import migrations


USER_GROUP = "User"
ADMIN_GROUP = "Admin"


def create_default_groups(apps, schema_editor):
    Group = apps.get_model("auth", "Group")
    User = apps.get_model("auth", "User")

    user_group, _ = Group.objects.get_or_create(name=USER_GROUP)
    Group.objects.get_or_create(name=ADMIN_GROUP)

    # Backfill — assign every non-superuser to the User group so the role
    # field is never blank in the UI.
    for user in User.objects.filter(is_superuser=False):
        user.groups.add(user_group)


def remove_default_groups(apps, schema_editor):
    Group = apps.get_model("auth", "Group")
    Group.objects.filter(name__in=[USER_GROUP, ADMIN_GROUP]).delete()


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0007_rename_core_crypto_user_sy_idx_core_crypto_user_id_2bf443_idx"),
        ("auth", "0012_alter_user_first_name_max_length"),
    ]

    operations = [
        migrations.RunPython(create_default_groups, remove_default_groups),
    ]
