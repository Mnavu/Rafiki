"""
Focused chatbot knowledge for student support.

Sources:
- https://www.kemu.ac.ke/school-of-business-and-economics/
- https://www.kemu.ac.ke/programmes/
- https://www.kemu.ac.ke/wp-content/uploads/2024/11/BSc.-Travel-and-Tourism-Management.pdf
"""

KEMU_TOURISM_KNOWLEDGE = {
    "programme_name": "Travel and Tourism",
    "certificate_note": (
        "Certificate in Travel and Tourism Operations is listed under the School of Business and Economics programmes."
    ),
    "degree_note": (
        "BSc Travel and Tourism Management includes foundations in geography, communication, principles of management, "
        "accounting, economics, tourism products, destination management, and responsible tourism."
    ),
    "sample_units": [
        "Principles of Management",
        "Business Communication",
        "Introduction to Human Geography",
        "Financial Accounting",
        "Macro Economics",
        "Micro Economics",
        "Tourism Geography and Transport",
        "Sustainable and Responsible Tourism",
        "World Tourism and Emerging Destinations",
        "Tour Operations and Management",
        "Travel Agency and Reservation Systems",
    ],
    "student_support_topics": [
        "class timing guidance",
        "assignment and CAT reminders",
        "scheduled call reminders",
        "school activity notices",
    ],
}


ALLOWED_STUDENT_INTENTS = {
    "course_content",
    "academic_guidance",
    "class_timing",
    "scheduled_calls",
    "school_activities",
}


RESTRICTED_PATTERNS = [
    "bet",
    "gamble",
    "adult",
    "porn",
    "crypto price",
    "politics gossip",
]

