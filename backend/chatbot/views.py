import re
import difflib
from typing import Iterable

from django.db.models import Q
from django.utils import timezone
from rest_framework import permissions
from rest_framework.response import Response
from rest_framework.views import APIView

from core.audit import create_audit_event
from core.models import CalendarEvent
from learning.models import Assignment, Registration, Timetable
from notifications.models import Notification
from users.display import resolve_user_display_name
from .models import ChatbotAnswerFeedback, Conversation, CourseRevisionKnowledge, Turn
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
        "exact next class",
        "class time",
        "when is class",
        "when is my class",
        "lesson time",
        "who teaches",
        "who is teaching",
        "teacher",
        "lecturer",
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
    "study_materials": (
        "study material",
        "study materials",
        "course material",
        "course materials",
        "material",
        "materials",
        "resources",
        "revision material",
        "notes",
        "lecture notes",
        "where do i find notes",
        "where do i find materials",
        "where are my notes",
    ),
    "app_navigation": (
        "how do i use this app",
        "how do i use the app",
        "navigate",
        "navigation",
        "how do i find",
        "where do i go",
        "where is",
        "how do i open",
        "open",
        "app help",
        "help me find",
        "how do i use",
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
    "material",
    "materials",
    "resource",
    "resources",
    "chatbot",
    "app",
    "navigate",
    "navigation",
    "find",
    "open",
    "help",
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


def _contains_phrase(text: str, phrases: Iterable[str]) -> bool:
    return any(re.search(rf"\b{re.escape(phrase)}\b", text) for phrase in phrases)


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
    turn = Turn.objects.create(conversation=conversation, sender=sender, text=text)
    extra_turn_ids = list(
        Turn.objects.filter(conversation=conversation)
        .order_by("-created_at")
        .values_list("id", flat=True)[MEMORY_TURNS_LIMIT:]
    )
    if extra_turn_ids:
        Turn.objects.filter(id__in=extra_turn_ids).delete()
    return turn


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
    capability_tokens = ("what can you do", "how can you help", "who are you", "help menu")

    if stripped in {"ok", "okay", "cool", "nice", "great"}:
        return {
            "text": "Great. I am ready when you are. Ask me about classes, calls, assignments, or school activities.",
            "visual_cue": "smalltalk",
        }

    if _contains_phrase(normalized, wellbeing_tokens):
        return {
            "text": (
                "I am doing well and ready to support you. "
                "Tell me what you need, and I will keep it simple and clear."
            ),
            "visual_cue": "smalltalk",
        }

    if _contains_phrase(normalized, greeting_tokens):
        return {
            "text": (
                "Hello. I can help with class times, study materials, app navigation, scheduled calls, assignments, CAT reminders, and school notices."
            ),
            "visual_cue": "smalltalk",
        }

    if _contains_phrase(normalized, thanks_tokens):
        return {
            "text": "You are welcome. I am always here to help with your academic and schedule questions.",
            "visual_cue": "smalltalk",
        }

    if _contains_phrase(normalized, capability_tokens):
        return {
            "text": _with_followups(
                "I can answer course and schedule questions, help you find study materials, explain where to tap in the app, and check upcoming calls.",
                [
                    "When is my next class?",
                    "Where do I find study materials?",
                    "How do I use this app?",
                    "Do I have any upcoming class calls?",
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


def _get_registered_units(student_profile, limit: int | None = None):
    qs = (
        Registration.objects.filter(
            student=student_profile,
            status=Registration.Status.APPROVED,
        )
        .select_related("unit")
        .order_by("unit__code")
    )
    if limit:
        qs = qs[:limit]
    return [registration.unit for registration in qs if registration.unit_id]


def _get_student_timetable_rows(user, limit: int = 3):
    student_profile = _get_student_profile(user)
    if not student_profile:
        return []

    now = timezone.now()
    unit_ids = _get_registered_unit_ids(student_profile)
    timetable_qs = Timetable.objects.filter(end_datetime__gte=now).select_related(
        "unit",
        "lecturer__user",
    )
    if unit_ids:
        timetable_qs = timetable_qs.filter(unit_id__in=unit_ids)
    elif student_profile.programme_id:
        timetable_qs = timetable_qs.filter(programme_id=student_profile.programme_id)
    return list(timetable_qs.order_by("start_datetime")[:limit])


def _format_next_class_exact(user):
    student_profile = _get_student_profile(user)
    if not student_profile:
        return "Student timetable data is not available for this account yet."

    rows = _get_student_timetable_rows(user, limit=1)
    if not rows:
        return "You do not have a next class scheduled right now."

    row = rows[0]
    unit_code = getattr(row.unit, "code", None) or "Class"
    start = row.start_datetime.strftime("%a %d %b %I:%M %p")
    room = row.room or "room not set"
    lecturer_name = (
        resolve_user_display_name(getattr(getattr(row, "lecturer", None), "user", None))
        or "lecturer not assigned yet"
    )
    return f"Your next class is {unit_code} at {start} in {room} with {lecturer_name}."


def _format_next_classes(user):
    student_profile = _get_student_profile(user)
    if not student_profile:
        return "Student timetable data is not available for this account yet."

    rows = _get_student_timetable_rows(user, limit=3)
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


def _match_registered_unit(student_profile, query: str):
    normalized = _normalize_query(query)
    units = _get_registered_units(student_profile)
    for unit in units:
        code = (getattr(unit, "code", "") or "").lower()
        title = (getattr(unit, "title", "") or "").lower()
        title_tokens = [token for token in re.findall(r"[a-z0-9]+", title) if len(token) > 3]
        if code and re.search(rf"\b{re.escape(code)}\b", normalized):
            return unit
        if title and all(token in normalized for token in title_tokens[:2]):
            return unit
        if any(token in normalized for token in title_tokens[:3]):
            return unit
    return None


def _parse_trigger_phrases(raw: str) -> list[str]:
    return [
        phrase.strip().lower()
        for phrase in (raw or "").replace("\n", ",").split(",")
        if phrase.strip()
    ]


def _find_revision_knowledge(student_profile, query: str, matched_unit=None):
    normalized = _normalize_query(query)
    qs = (
        CourseRevisionKnowledge.objects.filter(is_active=True)
        .select_related("programme", "unit")
        .order_by("priority", "topic_title")
    )

    if matched_unit:
        qs = qs.filter(
            Q(unit=matched_unit)
            | Q(programme=matched_unit.programme)
            | Q(unit__programme=matched_unit.programme)
        )
    elif student_profile.programme_id:
        qs = qs.filter(
            Q(programme=student_profile.programme)
            | Q(unit__programme=student_profile.programme)
        )

    best_card = None
    best_score = -1
    for card in qs[:24]:
        score = 0
        if matched_unit and card.unit_id == matched_unit.id:
            score += 8
        if student_profile.programme_id and (
            card.programme_id == student_profile.programme_id
            or getattr(card.unit, "programme_id", None) == student_profile.programme_id
        ):
            score += 2

        title_tokens = [
            token for token in re.findall(r"[a-z0-9]+", (card.topic_title or "").lower()) if len(token) > 3
        ]
        score += sum(2 for token in title_tokens[:4] if token in normalized)

        for phrase in _parse_trigger_phrases(card.trigger_phrases):
            if phrase in normalized:
                score += 4

        if score > best_score:
            best_card = card
            best_score = score

    if best_card and best_score > 0:
        return best_card
    return None


def _format_revision_knowledge_entry(card: CourseRevisionKnowledge):
    unit_label = ""
    if card.unit_id:
        unit_label = f" for {card.unit.code} {card.unit.title}"
    elif card.programme_id:
        unit_label = f" for {card.programme.name}"

    response = f"Revision topic: {card.topic_title}{unit_label}. {card.explanation}"
    if card.revision_tips:
        response += f" Focus on these points: {card.revision_tips}"
    if card.practice_prompt:
        response += f" Practice question: {card.practice_prompt}"
    return response


def _format_revision_help(user, query: str):
    student_profile = _get_student_profile(user)
    if not student_profile:
        return (
            "I can help you revise, but this account does not have student course data yet. "
            "Ask about one specific unit or topic after your student profile is connected."
        )

    matched_unit = _match_registered_unit(student_profile, query)
    matched_card = _find_revision_knowledge(student_profile, query, matched_unit=matched_unit)
    current_units = _get_registered_units(student_profile, limit=4)

    if matched_card:
        return _format_revision_knowledge_entry(matched_card)

    if matched_unit:
        unit_code = getattr(matched_unit, "code", None) or "this unit"
        unit_title = getattr(matched_unit, "title", None) or "your course topic"

        next_class = (
            Timetable.objects.filter(
                unit=matched_unit,
                end_datetime__gte=timezone.now(),
            )
            .order_by("start_datetime")
            .first()
        )
        next_class_line = ""
        if next_class:
            next_class_line = (
                f" Your next {unit_code} class is {next_class.start_datetime.strftime('%a %d %b %I:%M %p')} in "
                f"{next_class.room or 'the listed room'}."
            )

        next_assignment = (
            Assignment.objects.filter(
                unit=matched_unit,
                due_at__isnull=False,
                due_at__gte=timezone.now(),
            )
            .order_by("due_at")
            .first()
        )
        assignment_line = ""
        if next_assignment:
            assignment_line = (
                f" The next assessment is {next_assignment.title}, due "
                f"{next_assignment.due_at.strftime('%a %d %b %I:%M %p')}."
            )

        return (
            f"Start revising {unit_code} {unit_title} in small steps. "
            f"First open Class communities for lecturer notes and shared files. "
            f"Then open Assignments to review recent tasks and examinable areas.{next_class_line}{assignment_line} "
            f"If you want, ask me to explain one subtopic from {unit_code} simply."
        )

    if current_units:
        knowledge_preview = []
        knowledge_cards = (
            CourseRevisionKnowledge.objects.filter(
                is_active=True,
            )
            .filter(
                Q(programme=student_profile.programme)
                | Q(unit__programme=student_profile.programme)
            )
            .select_related("unit")
            .order_by("priority", "topic_title")[:3]
        )
        if knowledge_cards:
            knowledge_preview = [
                f"{card.topic_title}{f' ({card.unit.code})' if card.unit_id else ''}"
                for card in knowledge_cards
            ]
        unit_list = ", ".join(
            f"{getattr(unit, 'code', 'UNIT')} {getattr(unit, 'title', '')}".strip()
            for unit in current_units
        )
        knowledge_line = ""
        if knowledge_preview:
            knowledge_line = f" Good revision topics from the knowledge bank include {', '.join(knowledge_preview)}."
        return (
            f"I can help you revise, but I need one unit or topic at a time to stay accurate. "
            f"Your current units include {unit_list}.{knowledge_line} "
            f"Ask me something like: Help me revise {getattr(current_units[0], 'code', 'my first unit')}."
        )

    return (
        "I can help you revise, but I cannot see approved units on this account yet. "
        "Once your units are approved, ask me about one unit or topic at a time."
    )


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


def _format_study_materials_help(user):
    student_profile = _get_student_profile(user)
    base = (
        "Open Class communities to find weekly notes, shared class materials, and updates from your lecturer. "
        "Open Assignments to see tasks, instructions, and what needs to be submitted. "
        "If you cannot find a file, open Message center and ask your lecturer to share it there."
    )
    if not student_profile:
        return base

    registered_units = list(
        Registration.objects.filter(
            student=student_profile,
            status=Registration.Status.APPROVED,
        )
        .select_related("unit")
        .order_by("unit__code")[:3]
    )
    if not registered_units:
        return f"{base} Your units will appear after registration is approved."

    unit_preview = ", ".join(
        filter(None, [getattr(item.unit, "code", None) or getattr(item.unit, "title", None) for item in registered_units])
    )
    return f"{base} Your current approved units include {unit_preview}."


def _format_student_navigation_help(query: str):
    normalized = _normalize_query(query)
    sections: list[str] = []

    if _contains_any(normalized, ("material", "materials", "notes", "resource", "resources")):
        sections.append(
            "Open Class communities for shared notes and class files. Open Assignments for task instructions. Use Message center if you need your lecturer to resend materials."
        )

    if _contains_any(normalized, ("fee", "fees", "finance", "payment", "balance")):
        sections.append(
            "Open Finance and rewards to see your fee balance, payment history, and finance clearance status."
        )

    if _contains_any(normalized, ("register", "registration", "unit", "units", "course", "courses")):
        sections.append(
            "Open Unit registration to choose up to 4 units after finance clears your account. After that, records and HOD can review your choices."
        )

    if _contains_any(normalized, ("group", "groups", "community", "communities", "forum")):
        sections.append(
            "Open Class communities, or tap Class groups in Picture quick actions, to enter your class group chats."
        )

    if _contains_any(normalized, ("message", "messages", "lecturer", "contact", "chat", "talk", "communication")):
        sections.append(
            "Open Message center to talk to lecturers and keep your conversation history. Use Peer chats for private conversations with classmates."
        )

    if _contains_any(normalized, ("call", "calls", "video", "meeting", "online class")):
        sections.append(
            "Open Class calls to see scheduled online lessons. Tap a call card there to join the class."
        )

    if _contains_any(normalized, ("class", "classes", "timetable", "schedule", "calendar")):
        sections.append(
            "Open Upcoming classes to see your timetable entries, the next class time, and the room."
        )

    if _contains_any(normalized, ("chatbot", "help", "assistant", "robot")):
        sections.append(
            "Tap Help chatbot in Picture quick actions, or tap the robot bubble at the bottom right, to ask for help anytime."
        )

    if sections:
        return " ".join(sections[:3])

    return (
        "Use Picture quick actions near the top for the fastest navigation. "
        "Tap Upcoming classes for timetable, Unit registration for course choices, Class calls for online lessons, "
        "Class groups for group chat, Message center for lecturers, and Help chatbot for support."
    )


def _resolve_navigation_target(query: str, intent: str) -> str | None:
    normalized = _normalize_query(query)

    if _contains_any(normalized, ("fee", "fees", "finance", "payment", "balance")):
        return "finance"
    if _contains_any(normalized, ("group", "groups", "community", "communities", "forum")):
        return "class_communities"
    if _contains_any(normalized, ("message", "messages", "lecturer", "contact", "chat", "talk", "communication")):
        return "message_center"
    if _contains_any(normalized, ("peer", "classmate", "friend")):
        return "peer_chats"
    if _contains_any(normalized, ("register", "registration", "unit", "units", "course", "courses")):
        return "unit_registration"
    if _contains_any(normalized, ("call", "calls", "video", "meeting", "online class")):
        return "class_calls"
    if _contains_any(normalized, ("material", "materials", "notes", "resource", "resources")):
        return "class_communities"
    if _contains_any(normalized, ("assignment", "assignments", "cat", "cats", "deadline", "due", "grade", "exam")):
        return "assignments"
    if _contains_any(normalized, ("class", "classes", "timetable", "schedule", "calendar")):
        return "timetable"
    if _contains_any(normalized, ("chatbot", "assistant", "help")):
        return "chatbot"

    intent_defaults = {
        "class_timing": "timetable",
        "scheduled_calls": "class_calls",
        "study_materials": "class_communities",
        "app_navigation": "timetable",
    }
    return intent_defaults.get(intent)


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
    if _contains_phrase(normalized, tourism_keywords):
        return True

    student_profile = _get_student_profile(user)
    if not student_profile or not student_profile.programme_id:
        return False
    programme_name = (student_profile.programme.name or "").lower()
    if "tourism" not in programme_name and "travel" not in programme_name:
        return False

    academic_focus_tokens = {
        "course",
        "unit",
        "programme",
        "program",
        "topic",
        "revise",
        "revision",
        "study",
        "learn",
    }
    return _contains_phrase(normalized, academic_focus_tokens)


def _student_scope_terms(user) -> set[str]:
    student_profile = _get_student_profile(user)
    if not student_profile:
        return set()

    terms = set()
    if student_profile.programme_id:
        terms.update(re.findall(r"[a-z0-9]+", (student_profile.programme.name or "").lower()))

    registrations = (
        Registration.objects.filter(student=student_profile)
        .select_related("unit")[:16]
    )
    for registration in registrations:
        if not registration.unit_id:
            continue
        terms.add((registration.unit.code or "").lower())
        terms.update(re.findall(r"[a-z0-9]+", (registration.unit.title or "").lower()))

    for unit_title in KEMU_TOURISM_KNOWLEDGE.get("sample_units", []):
        terms.update(re.findall(r"[a-z0-9]+", unit_title.lower()))

    return {term for term in terms if len(term) > 2}


def _is_student_scope_query(user, query: str) -> bool:
    normalized = _normalize_query(query)
    if not normalized:
        return False
    if any(keyword in normalized for keywords in INTENT_KEYWORDS.values() for keyword in keywords):
        return True
    if _is_tourism_context(user, query):
        return True

    query_tokens = set(normalized.split())
    return bool(query_tokens & _student_scope_terms(user))


class AskView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def _finalize_response(
        self,
        conversation: Conversation,
        user,
        query: str,
        text: str,
        visual_cue: str | None,
        intent: str,
        navigation_target: str | None = None,
    ):
        bot_turn = _append_turn(conversation, "bot", text)
        _save_conversation_state(conversation, query=query, intent=intent, visual_cue=visual_cue)
        resolved_target = navigation_target
        if resolved_target is None and intent not in {"restricted", "smalltalk", "memory", "empty", "info", "scope_guard"}:
            resolved_target = _resolve_navigation_target(query, intent)
        create_audit_event(
            actor=user,
            action="chatbot_question_asked",
            target_table="chatbot.Conversation",
            target_id=str(conversation.id),
            metadata={
                "intent": intent,
                "query": query[:240],
                "visual_cue": visual_cue or "",
                "navigation_target": resolved_target or "",
            },
            after={
                "query": query[:240],
                "response": text[:500],
                "turn_id": bot_turn.id,
                "conversation_id": conversation.id,
            },
            request_status=200,
        )
        return Response(
            {
                "text": text,
                "visual_cue": visual_cue,
                "conversation_id": conversation.id,
                "turn_id": bot_turn.id,
                "navigation_target": resolved_target,
            }
        )

    def post(self, request):
        request._skip_api_audit = True
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
                user=user,
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
                user=user,
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
                user=user,
                query=query,
                text=text,
                visual_cue="restricted",
                intent="restricted",
            )

        smalltalk = _smalltalk_response(query)
        if smalltalk:
            return self._finalize_response(
                conversation=conversation,
                user=user,
                query=query,
                text=smalltalk["text"],
                visual_cue=smalltalk["visual_cue"],
                intent="smalltalk",
            )

        intent = _resolve_intent_with_memory(query, conversation)
        normalized = _normalize_query(query)

        if user.role == "student":
            if not _is_student_scope_query(user, query):
                text = (
                    "That question is not relevant to school work. "
                    "I can only help with classes, lecturers, assignments, calls, school activities, and course revision."
                )
                return self._finalize_response(
                    conversation=conversation,
                    user=user,
                    query=query,
                    text=text,
                    visual_cue="scope_guard",
                    intent="scope_guard",
                )

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
                    user=user,
                    query=query,
                    text=text,
                    visual_cue="scope_guard",
                    intent="scope_guard",
                )

            if intent == "class_timing":
                if _contains_any(
                    normalized,
                    (
                        "next class",
                        "exact",
                        "who teaches",
                        "who is teaching",
                        "teacher",
                        "lecturer",
                    ),
                ):
                    text = _format_next_class_exact(user)
                else:
                    text = _with_followups(
                        _format_next_classes(user),
                        [
                            "Which class is first tomorrow?",
                            "Do I have a call link for my next class?",
                            "Any deadlines this week?",
                        ],
                    )
                return self._finalize_response(
                    conversation=conversation,
                    user=user,
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
                    user=user,
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
                    user=user,
                    query=query,
                    text=text,
                    visual_cue="activity",
                    intent=intent,
                )

            if intent == "study_materials":
                text = _with_followups(
                    _format_study_materials_help(user),
                    [
                        "Open my class groups",
                        "What assignments are due this week?",
                        "How do I message my lecturer?",
                    ],
                )
                return self._finalize_response(
                    conversation=conversation,
                    user=user,
                    query=query,
                    text=text,
                    visual_cue="materials",
                    intent=intent,
                )

            if intent == "app_navigation":
                text = _with_followups(
                    _format_student_navigation_help(query),
                    [
                        "Where do I find study materials?",
                        "Where are my fees?",
                        "How do I open class groups?",
                    ],
                )
                return self._finalize_response(
                    conversation=conversation,
                    user=user,
                    query=query,
                    text=text,
                    visual_cue="navigation",
                    intent=intent,
                )

            if _contains_phrase(
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
                    user=user,
                    query=query,
                    text=text,
                    visual_cue="academic",
                    intent="course_content",
                )

            if _contains_any(
                normalized,
                ("revise", "revision", "study", "topic", "learn", "notes", "explain"),
            ):
                text = _with_followups(
                    _format_revision_help(user, query),
                    [
                        "Help me revise DTM101",
                        "Where do I find study materials?",
                        "What assignments are due this week?",
                    ],
                )
                return self._finalize_response(
                    conversation=conversation,
                    user=user,
                    query=query,
                    text=text,
                    visual_cue="revision",
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
                    user=user,
                    query=query,
                    text=text,
                    visual_cue="course",
                    intent="course_content",
                )

            guidance = (
                "I can guide you step by step on your course topics, timetable, study materials, app navigation, class calls, assignments, and CAT planning."
            )
            if _contains_any(normalized, ("revise", "revision", "study", "topic", "notes", "explain")):
                guidance += " Tell me one specific unit or topic and I will simplify it."
            text = _with_followups(
                guidance,
                [
                    "When is my next class?",
                    "Where do I find study materials?",
                    "How do I use this app?",
                    "What assignments are due this week?",
                ],
            )
            return self._finalize_response(
                conversation=conversation,
                user=user,
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
                user=user,
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
                user=user,
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
            user=user,
            query=query,
            text=text,
            visual_cue="info",
            intent="info",
        )


class FeedbackView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        request._skip_api_audit = True
        turn_id = _to_int(request.data.get("turn_id"))
        rating = (request.data.get("rating") or "").strip().lower()

        if not turn_id:
            return Response({"detail": "turn_id is required."}, status=400)
        if rating not in {
            ChatbotAnswerFeedback.Rating.HELPFUL,
            ChatbotAnswerFeedback.Rating.NOT_HELPFUL,
        }:
            return Response({"detail": "rating must be helpful or not_helpful."}, status=400)

        turn = (
            Turn.objects.filter(
                id=turn_id,
                sender="bot",
                conversation__user=request.user,
            )
            .select_related("conversation")
            .first()
        )
        if not turn:
            return Response({"detail": "Chatbot answer not found for this user."}, status=404)

        feedback, _ = ChatbotAnswerFeedback.objects.update_or_create(
            user=request.user,
            turn=turn,
            defaults={
                "conversation": turn.conversation,
                "rating": rating,
                "query_text": (request.data.get("query_text") or "").strip(),
                "answer_text": (request.data.get("answer_text") or turn.text).strip(),
                "visual_cue": (request.data.get("visual_cue") or "").strip(),
                "navigation_target": (request.data.get("navigation_target") or "").strip(),
                "needs_review": rating == ChatbotAnswerFeedback.Rating.NOT_HELPFUL,
                "reviewed_at": None if rating == ChatbotAnswerFeedback.Rating.NOT_HELPFUL else timezone.now(),
                "reviewed_by": None,
                "admin_notes": "",
            },
        )
        create_audit_event(
            actor=request.user,
            action="chatbot_feedback_submitted",
            target_table="chatbot.ChatbotAnswerFeedback",
            target_id=str(feedback.id),
            metadata={
                "rating": feedback.rating,
                "needs_review": feedback.needs_review,
                "turn_id": turn.id,
                "conversation_id": turn.conversation_id,
            },
            after={
                "rating": feedback.rating,
                "needs_review": feedback.needs_review,
                "query_text": feedback.query_text[:240],
            },
            request_status=200,
        )
        return Response(
            {
                "id": feedback.id,
                "rating": feedback.rating,
                "needs_review": feedback.needs_review,
            }
        )
