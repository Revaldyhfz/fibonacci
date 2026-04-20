"""
Custom DRF permission classes for role-based access control.

Roles are modeled with Django Groups:
- `User` — default group, assigned to every new user automatically
- `Admin` — elevated group, gets admin-only endpoints + user listing

The User.is_staff flag is reserved for Django admin-site access only.
Application-level admin is driven by group membership so it round-trips
through the API cleanly.
"""

from rest_framework import permissions


ADMIN_GROUP = "Admin"
USER_GROUP = "User"


def is_admin(user) -> bool:
    """True if the user belongs to the Admin group OR is a Django superuser."""
    if not user or not user.is_authenticated:
        return False
    if user.is_superuser:
        return True
    return user.groups.filter(name=ADMIN_GROUP).exists()


class IsOwner(permissions.BasePermission):
    """Object-level permission: only the owner of a record can access it.

    Defense-in-depth — the viewsets already scope `get_queryset()` by user, so
    cross-user access via ID guessing returns 404. This adds an explicit check
    so any future view that doesn't scope its queryset still stays safe.
    """

    def has_object_permission(self, request, view, obj):
        if not request.user or not request.user.is_authenticated:
            return False
        return getattr(obj, "user_id", None) == request.user.id


class IsOwnerOrAdmin(permissions.BasePermission):
    """Owner can access, Admin can access any. Useful for admin dashboards."""

    def has_object_permission(self, request, view, obj):
        if is_admin(request.user):
            return True
        return getattr(obj, "user_id", None) == request.user.id


class IsAdminRole(permissions.BasePermission):
    """View-level: only Admin-group members (or superusers) are allowed."""

    def has_permission(self, request, view):
        return is_admin(request.user)
