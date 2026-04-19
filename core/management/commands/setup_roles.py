"""
Idempotent bootstrap for role groups.

Run on every deploy:
    python manage.py setup_roles

Creates the User + Admin groups if they don't exist, and optionally promotes
a named user to Admin:
    python manage.py setup_roles --admin demo
"""

from django.contrib.auth.models import Group, User
from django.core.management.base import BaseCommand

from core.permissions import ADMIN_GROUP, USER_GROUP


class Command(BaseCommand):
    help = "Create default role groups and optionally promote a user to Admin."

    def add_arguments(self, parser):
        parser.add_argument(
            "--admin",
            type=str,
            default=None,
            help="Username to add to the Admin group (creates if missing).",
        )

    def handle(self, *args, **options):
        for name in (USER_GROUP, ADMIN_GROUP):
            _, created = Group.objects.get_or_create(name=name)
            verb = "Created" if created else "Exists"
            self.stdout.write(f"  [{verb}] group: {name}")

        admin_username = options.get("admin")
        if admin_username:
            try:
                user = User.objects.get(username=admin_username)
            except User.DoesNotExist:
                self.stderr.write(
                    self.style.ERROR(f"User '{admin_username}' not found — skipping admin promotion.")
                )
                return
            admin_group = Group.objects.get(name=ADMIN_GROUP)
            user.groups.add(admin_group)
            self.stdout.write(self.style.SUCCESS(f"  [Promoted] {admin_username} → Admin"))
