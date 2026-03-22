from __future__ import annotations

from uuid import uuid4

from django.utils.deprecation import MiddlewareMixin

from . import state
from .audit import log_api_request


class RequestAuditMiddleware(MiddlewareMixin):
    def process_request(self, request):
        user = getattr(request, "user", None)
        if user and not getattr(user, "is_authenticated", False):
            user = None
        request_id = request.headers.get("X-Request-ID") or str(uuid4())
        request.audit_request_id = request_id
        state.set_user(user)
        state.set_request_info(
            {
                "request_id": request_id,
                "path": request.path,
                "method": request.method,
                "remote_addr": request.META.get("REMOTE_ADDR"),
                "user_agent": request.META.get("HTTP_USER_AGENT"),
            }
        )

    def process_response(self, request, response):
        try:
            if request.path.startswith("/api/") and not getattr(request, "_skip_api_audit", False):
                log_api_request(request, response)
            request_id = getattr(request, "audit_request_id", None)
            if request_id:
                response["X-Request-ID"] = request_id
        finally:
            state.clear()
        return response

    def process_exception(self, request, exception):
        state.clear()
        return None
