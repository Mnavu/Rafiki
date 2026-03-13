import re
import difflib
from typing import Iterable

from django.utils import timezone
from rest_framework import permissions
from rest_framework.response import Response
from rest_framework.views import APIView

from core.models import CalendarEvent
from learning.models import Assignment, Registration, Timetable
from notifications.models import Notification
from .models import Conversation, Turn
from .knowledge import (
    ALLOWED_STUDENT_INTENTS,
    KEMU_TOURISM_KNOWLEDGE,
    RESTRICTED_PATTERNS,
)


INTENT_KEYWORDS = {
    "class_timing": (
        "time",
        "timetable",
        "time table",
        "schedule",
        "next class",
        "class time",
        "when is class",
        "when is my class",
        "lesson time",
    ),
    "scheduled_calls": (
        "call",
        "calls",
        "meeting",
        "meetings",
        "online class",
        "video class",
        "video call",
        "join link",
        "room link",
    ),
    "school_activities": (
        "activity",
        "activities",
        "event",
        "events",
        "notice",
        "notices",
        "announcement",
        "announcements",
        "school activity",
    ),
    "course_content": (
        "assignment",
        "assignments",
        "assigment",
        "cat",
        "cats",
        "grade",
        "grades",
        "exam",
        "exams",
        "unit",
        "course",
        "topic",
        "revise",
        "revision",
        "study",
        "learn",
        "notes",
    ),
}

QUERY_PHRASE_REPLACEMENTS = {
    "time table": "timetable",
    "table time": "timetable",
    "chat boat": "chatbot",
    "chat bot": "chatbot",
    "a sign ment": "assignment",
    "assigment": "assignment",
    "assainment": "assignment",
    "see a t": "cat",
    "cee a tee": "cat",
    "class group": "class community",
}

QUERY_VOCABULARY = {
    "timetable",
    "schedule",
    "class",
    "classes",
    "call",
    "calls",
    "meeting",
    "assignment",
    "assignments",
    "cat",
    "exam",
    "course",
    "unit",
    "topic",
    "revise",
    "revision",
    "study",
    "notes",
    "chatbot",
    "community",
    "group",
    "fees",
    "finance",
    "activity",
    "activities",
    "notice",
    "announcement",
    "lecturer",
    "student",
    "guardian",
}

QUERY_SKIP_FUZZY = {
    "the",
    "and",
    "for",
    "with",
    "from",
    "this",
    "that",
    "what",
    "when",
    "where",
    "who",
    "how",
    "why",
    "is",
    "are",
    "do",
    "does",
    "did",
    "i",
    "we",
    "my",
    "our",
}

FOLLOWUP_MARKERS = (
    "and ",
    "also ",
    "what about",
    "about that",
    "continue",
    "same",
    "then",
    "next",
)

MEMORY_TURNS_LIMIT = 40
MEMORY_CONTEXT_TURNS = 8


def _normalize_query(query: str) -> str:
    lowered = query.lower().strip()
    lowered = lowered.replace("what's", "what is").replace("how's", "how is")

    for source, target in QUERY_PHRASE_REPLACEMENTS.items():
        lowered = re.sub(rf"\b{re.escape(source)}\b", target, lowered)

    cleaned = re.sub(r"[^a-z0-9\s]", " ", lowered)
    normalized = re.sub(r"\s+", " ", cleaned).strip()
    if not normalized:
        return normalized

    corrected_tokens = []
    for token in normalized.split():
        if (
            len(token) < 4
            or token in QUERY_VOCABULARY
            or token in QUERY_SKIP_FUZZY
            or token.isdigit()
        ):
            corrected_tokens.append(token)
            continue
        best = difflib.get_close_matches(token, QUERY_VOCABULARY, n=1, cutoff=0.82)
        corrected_tokens.append(best[0] if best else token)

    return " ".join(corrected_tokens).strip()


def _contains_any(text: str, tokens: Iterable[str]) -> bool:
    return any(token in text for token in tokens)


def _with_followups(text: str, prompts: list[str]) -> str:
    cleaned = text.strip()
    if not cleaned.endswith((".", "!", "?")):
        cleaned = f"{cleaned}."
    preview = ", ".join(prompts[:3])
    return f"{cleaned} You can also ask: {preview}."


def _detect_intent(query: str) -> str:
    normalized = _normalize_query(query)
    scores = {}
    for intent, keywords in INTENT_KEYWORDS.items():
        score = 0
        for keyword in keywords:
            if keyword in normalized:
                score += 2 if " " in keyword else 1
        if score:
            scores[intent] = score
    if not scores:
        return "academic_guidance"
    return max(scores, key=scores.get)


def _to_int(value):
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def _to_bool(value) -> bool:
    if isinstance(value, bool):
        return value
    if isinstance(value, (int, float)):
        return value != 0
    if isinstance(value, str):
        return value.strip().lower() in {"1", "true", "yes", "y", "on"}
    return False


def _resolve_conversation(user, requested_id=None, force_new=False):
    if force_new:
        return Conversation.objects.create(user=user, title="Student assistant", state={})

    conv_id = _to_int(requested_id)
    if conv_id:
        conversation = Conversation.objects.filter(id=conv_id, user=user).first()
        if conversation:
            return conversation

    existing = Conversation.objects.filter(user=user).order_by("-updated_at").first()
    if existing:
        return existing
    return Conversation.objects.create(user=user, title="Student assistant", state={})


def _append_turn(conversation: Conversation, sender: str, text: str):
    Turn.objects.create(conversation=conversation, sender=sender, text=text)
    extra_turn_ids = list(
        Turn.objects.filter(conversation=conversation)
        .order_by("-created_at")
        .values_list("id", flat=True)[MEMORY_TURNS_LIMIT:]
    )
    if extra_turn_ids:
        Turn.objects.filter(id__in=extra_turn_ids).delete()


def _recent_turns(conversation: Conversation, limit: int = MEMORY_CONTEXT_TURNS):
    return list(Turn.objects.filter(conversation=conversation).order_by("-created_at")[:limit])


def _latest_bot_turn(conversation: Conversation):
    return (
        Turn.objects.filter(conversation=conversation, sender="bot")
        .order_by("-created_at")
        .first()
    )


def _memory_intent(query: str, conversation: Conversation):
    normalized = _normalize_query(query)
    if not normalized:
        return None

    repeat_markers = (
        "repeat",
        "say that again",
        "again please",
        "can you repeat",
        "repeat that",
    )
    recap_markers = (
        "what did we talk about",
        "what have we discussed",
        "recap",
        "summary",
        "summarize",
        "remind me what we discussed",
        "conversation history",
    )

    if _contains_any(normalized, repeat_markers):
        last_bot = _latest_bot_turn(conversation)
        if last_bot:
            return {
                "text": _with_followups(
                    f"Sure. Here is that again: {last_bot.text}",
                    ["When is my next class?", "What assignments are due?", "Any upcoming calls?"],
                ),
                "visual_cue": "memory",
                "intent": "memory",
            }
        return {
            "text": "I do not have a previous answer yet. Ask me a question and I will remember our chat.",
            "visual_cue": "memory",
            "intent": "memory",
        }

    if _contains_any(normalized, recap_markers):
        user_turns = [
            turn.text.strip()
            for turn in _recent_turns(conversation, limit=12)
            if turn.sender == "user"
        ][:4]
        if not user_turns:
            return {
                "text": "We have not discussed much yet. Ask me about class timing, calls, assignments, or revision topics.",
                "visual_cue": "memory",
                "intent": "memory",
            }
        recap = "; ".join(user_turns)
        return {
            "text": _with_followups(
                f"Here is a quick recap of your recent questions: {recap}",
                ["Which one should we continue with?", "When is my next class?", "What should I revise first?"],
            ),
            "visual_cue": "memory",
            "intent": "memory",
        }

    return None


def _resolve_intent_with_memory(query: str, conversation: Conversation):
    detected = _detect_intent(query)
    normalized = _normalize_query(query)
    if detected != "academic_guidance":
        return detected

    state = conversation.state if isinstance(conversation.state, dict) else {}
    last_intent = state.get("last_intent")
    if last_intent in ALLOWED_STUDENT_INTENTS and (
        any(normalized.startswith(marker) for marker in FOLLOWUP_MARKERS)
        or len(normalized.split()) <= 4
    ):
        return last_intent
    return detected


def _save_conversation_state(conversation: Conversation, query: str, intent: str, visual_cue: str | None):
    state = conversation.state if isinstance(conversation.state, dict) else {}
    state.update(
        {
            "last_intent": intent,
            "last_query": query[:240],
            "last_visual_cue": visual_cue or "",
            "last_updated_at": timezone.now().isoformat(),
        }
    )
    conversation.state = state
    conversation.save(update_fields=["state", "updated_at"])


def _smalltalk_response(query: str):
    normalized = _normalize_query(query)
    stripped = normalized.strip(".,!?")

    greeting_tokens = (
        "hi",
        "hello",
        "hey",
        "good morning",
        "good afternoon",
        "good evening",
        "sasa",
    )
    wellbeing_tokens = (
        "how are you",
        "how are u",
        "how r you",
        "how is it going",
        "are you okay",
    )
    thanks_tokens = ("thanks", "thank you", "asante", "thankyou")
    capability_tokens = ("what can you do", "help me", "how can you help", "who are you")

    if stripped in {"ok", "okay", "cool", "nice", "great"}:
        return {
            "text": "Great. I am ready when you are. Ask me about classes, calls, assignments, or school activities.",
            "visual_cue": "smalltalk",
        }

    if _contains_any(normalized, wellbeing_tokens):
        return {
            "text": (
                "I am doing well and ready to support you. "
                "Tell me what you need, and I will keep it simple and clear."
            ),
            "visual_cue": "smalltalk",
        }

    if _contains_any(normalized, greeting_tokens):
        return {
            "text": (
                "Hello. I can help with class times, scheduled calls, assignments, CAT reminders, and school notices."
            ),
            "visual_cue": "smalltalk",
        }

    if _contains_any(normalized, thanks_tokens):
        return {
            "text": "You are welcome. I am always here to help with your academic and schedule questions.",
            "visual_cue": "smalltalk",
        }

    if _contains_any(normalized, capability_tokens):
        return {
            "text": _with_followups(
                "I can answer course and schedule questions, check upcoming calls, and explain what to do next.",
                [
                    "When is my next class?",
                    "Do I have any upcoming class calls?",
                    "What assignments are due soon?",
                ],
            ),
            "visual_cue": "smalltalk",
        }

    return None


def _is_restricted_query(query: str) -> bool:
    normalized = _normalize_query(query)
    return any(pattern in normalized for pattern in RESTRICTED_PATTERNS)


def _format_upcoming_calls(user):
    now = timezone.now()
    events = (
        CalendarEvent.objects.filter(
            owner_user=user,
            source_type="class_call",
            end_at__gte=now,
            is_active=True,
        )
        .order_by("start_at")[:3]
    )
    if not events:
        return "You do not have an upcoming class call right now."
    lines = []
    for event in events:
        unit = event.metadata.get("unit_code") or "CLASS"
        lines.append(f"{unit} at {event.start_at.strftime('%a %d %b %I:%M %p')}")
    return "Upcoming class calls: " + "; ".join(lines)


def _get_student_profile(user):
    return getattr(user, "student_profile", None)


def _get_registered_unit_ids(student_profile):
    return list(
        Registration.objects.filter(
            student=student_profile,
            status=Registration.Status.APPROVED,
        ).values_list("unit_id", flat=True)
    )


def _format_next_classes(user):
    student_profile = _get_student_profile(user)
    if not student_profile:
        return "Student timetable data is not available for this account yet."

    now = timezone.now()
    unit_ids = _get_registered_unit_ids(student_profile)
    timetable_qs = Timetable.objects.filter(end_datetime__gte=now).select_related("unit")
    if unit_ids:
        timetable_qs = timetable_qs.filter(unit_id__in=unit_ids)
    elif student_profile.programme_id:
        timetable_qs = timetable_qs.filter(programme_id=student_profile.programme_id)

    rows = timetable_qs.order_by("start_datetime")[:3]
    if not rows:
        return "No upcoming timetable entries are available right now."

    lines = []
    for row in rows:
        unit_code = getattr(row.unit, "code", None) or "Class"
        start = row.start_datetime.strftime("%a %d %b %I:%M %p")
        room = row.room or "room not set"
        lines.append(f"{unit_code} at {start} in {room}")
    return "Your next classes: " + "; ".join(lines)


def _format_upcoming_assignments(user):
    student_profile = _get_student_profile(user)
    if not student_profile:
        return "Assignment details are not available for this account yet."

    now = timezone.now()
    unit_ids = _get_registered_unit_ids(student_profile)
    assignments = Assignment.objects.filter(
        due_at__isnull=False,
        due_at__gte=now,
    ).select_related("unit")
    if unit_ids:
        assignments = assignments.filter(unit_id__in=unit_ids)
    elif student_profile.programme_id:
        assignments = assignments.filter(unit__programme_id=student_profile.programme_id)

    rows = assignments.order_by("due_at")[:3]
    if not rows:
        return "No assignment or CAT deadlines are currently listed."

    lines = []
    for item in rows:
        unit_code = getattr(item.unit, "code", None) or "UNIT"
        when = item.due_at.strftime("%a %d %b %I:%M %p")
        lines.append(f"{unit_code} - {item.title} due {when}")
    return "Upcoming deadlines: " + "; ".join(lines)


def _format_school_activity_notices(user):
    notices = Notification.objects.filter(user=user).order_by("-created_at")[:4]
    if not notices:
        return "No recent school notices were found."
    lines = []
    for notice in notices:
        payload = notice.payload or {}
        title = payload.get("title") or payload.get("message") or notice.type.replace("_", " ")
        when = payload.get("start_at") or payload.get("due_at") or payload.get("send_at")
        title_text = str(title).strip().capitalize()
        if when:
            lines.append(f"{title_text} ({when})")
        else:
            lines.append(title_text)
    return "Recent notices: " + "; ".join(lines)


def _tourism_knowledge_response():
    units = ", ".join(KEMU_TOURISM_KNOWLEDGE["sample_units"][:6])
    return (
        f"{KEMU_TOURISM_KNOWLEDGE['certificate_note']} "
        f"{KEMU_TOURISM_KNOWLEDGE['degree_note']} "
        f"Example units include: {units}. "
        f"If you want revision help, ask for one topic at a time."
    )


def _is_tourism_context(user, query: str) -> bool:
    normalized = _normalize_query(query)
    tourism_keywords = {
        "tourism",
        "travel",
        "destination",
        "tour operations",
        "tour",
        "reservation",
        "agency",
    }
    if any(keyword in normalized for keyword in tourism_keywords):
        return True

    student_profile = _get_student_profile(user)
    if not student_profile or not student_profile.programme_id:
        return False
    programme_name = (student_profile.programme.name or "").lower()
    return "tourism" in programme_name or "travel" in programme_name


class AskView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def _finalize_response(
        self,
        conversation: Conversation,
        query: str,
        text: str,
        visual_cue: str | None,
        intent: str,
    ):
        _append_turn(conversation, "bot", text)
        _save_conversation_state(conversation, query=query, intent=intent, visual_cue=visual_cue)
        return Response(
            {
                "text": text,
                "visual_cue": visual_cue,
                "conversation_id": conversation.id,
            }
        )

    def post(self, request):
        query = (request.data.get("query") or "").strip()
        user = request.user
        requested_id = request.data.get("conversation_id")
        force_new = _to_bool(request.data.get("new_conversation"))
        conversation = _resolve_conversation(user, requested_id=requested_id, force_new=force_new)

        if not query:
            text = _with_followups(
                "Please ask a clear question",
                [
                    "When is my next class?",
                    "Do I have upcoming class calls?",
                    "What assignments are due soon?",
                ],
            )
            return self._finalize_response(
                conversation=conversation,
                query="",
                text=text,
                visual_cue=None,
                intent="empty",
            )

        _append_turn(conversation, "user", query)

        memory_reply = _memory_intent(query, conversation)
        if memory_reply:
            return self._finalize_response(
                conversation=conversation,
                query=query,
                text=memory_reply["text"],
                visual_cue=memory_reply["visual_cue"],
                intent=memory_reply["intent"],
            )

        if _is_restricted_query(query):
            text = (
                "I can only assist with academic support, class schedules, calls, and approved school activities."
            )
            return self._finalize_response(
                conversation=conversation,
                query=query,
                text=text,
                visual_cue="restricted",
                intent="restricted",
            )

        smalltalk = _smalltalk_response(query)
        if smalltalk:
            return self._finalize_response(
                conversation=conversation,
                query=query,
                text=smalltalk["text"],
                visual_cue=smalltalk["visual_cue"],
                intent="smalltalk",
            )

        intent = _resolve_intent_with_memory(query, conversation)
        normalized = _normalize_query(query)

        if user.role == "student":
            if intent not in ALLOWED_STUDENT_INTENTS:
                text = _with_followups(
                    "I can answer course-focused academic questions, class timing, scheduled calls, and school activities",
                    [
                        "When is my next class?",
                        "Show my upcoming calls",
                        "What should I revise this week?",
                    ],
                )
                return self._finalize_response(
                    conversation=conversation,
                    query=query,
                    text=text,
                    visual_cue="scope_guard",
                    intent="scope_guard",
                )

            if intent == "class_timing":
                message = f"{_format_next_classes(user)} {_format_upcoming_calls(user)}"
                text = _with_followups(
                    message,
                    [
                        "Which class is first tomorrow?",
                        "Do I have a call link for my next class?",
                        "Any deadlines this week?",
                    ],
                )
                return self._finalize_response(
                    conversation=conversation,
                    query=query,
                    text=text,
                    visual_cue="schedule",
                    intent=intent,
                )

            if intent == "scheduled_calls":
                text = _with_followups(
                    _format_upcoming_calls(user),
                    [
                        "When is my next class?",
                        "Show class communities",
                        "Any school notices?",
                    ],
                )
                return self._finalize_response(
                    conversation=conversation,
                    query=query,
                    text=text,
                    visual_cue="call",
                    intent=intent,
                )

            if intent == "school_activities":
                text = _with_followups(
                    _format_school_activity_notices(user),
                    [
                        "Do I have upcoming calls?",
                        "What classes are next?",
                        "Any assignment deadlines?",
                    ],
                )
                return self._finalize_response(
                    conversation=conversation,
                    query=query,
                    text=text,
                    visual_cue="activity",
                    intent=intent,
                )

            if _contains_any(
                normalized,
                ("assignment", "assignments", "cat", "cats", "due", "deadline", "grade", "exam"),
            ):
                text = _with_followups(
                    _format_upcoming_assignments(user),
                    [
                        "What should I revise first?",
                        "When is my next class?",
                        "Do I have an online class call?",
                    ],
                )
                return self._finalize_response(
                    conversation=conversation,
                    query=query,
                    text=text,
                    visual_cue="academic",
                    intent="course_content",
                )

            if _is_tourism_context(user, query):
                text = _with_followups(
                    _tourism_knowledge_response(),
                    [
                        "Explain destination management simply",
                        "Help me revise tour operations",
                        "What should I focus on this week?",
                    ],
                )
                return self._finalize_response(
                    conversation=conversation,
                    query=query,
                    text=text,
                    visual_cue="course",
                    intent="course_content",
                )

            guidance = (
                "I can guide you step by step on your course topics, timetable, class calls, assignments, and CAT planning."
            )
            if _contains_any(normalized, ("revise", "revision", "study", "topic", "notes", "explain")):
                guidance += " Tell me one specific unit or topic and I will simplify it."
            text = _with_followups(
                guidance,
                [
                    "When is my next class?",
                    "What assignments are due this week?",
                    "Help me revise one topic",
                ],
            )
            return self._finalize_response(
                conversation=conversation,
                query=query,
                text=text,
                visual_cue="academic",
                intent="academic_guidance",
            )

        # Non-student roles get concise operations-focused responses.
        if intent == "scheduled_calls":
            text = _with_followups(
                _format_upcoming_calls(user),
                ["Show recent notices", "What can you help with?"],
            )
            return self._finalize_response(
                conversation=conversation,
                query=query,
                text=text,
                visual_cue="call",
                intent=intent,
            )
        if intent == "school_activities":
            text = _with_followups(
                _format_school_activity_notices(user),
                ["Show upcoming calls", "What can you help with?"],
            )
            return self._finalize_response(
                conversation=conversation,
                query=query,
                text=text,
                visual_cue="activity",
                intent=intent,
            )
        text = _with_followups(
            (
                "I am optimized for student academic support and schedule awareness. "
                "For operations, use your role dashboard modules."
            ),
            ["Show upcoming calls", "Show recent notices"],
        )
        return self._finalize_response(
            conversation=conversation,
            query=query,
            text=text,
            visual_cue="info",
            intent="info",
        )
