"""
Curated revision-bank content for tourism and travel units.

The entries below are intentionally concise and student-facing. They are
grounded in public programme information from KeMU and official sector sources
such as UN Tourism, IATA, Kenya Tourism Board, the Ministry of Tourism and
Wildlife, and Kenya Wildlife Service.
"""

SOURCE_CATALOG = {
    "kemu_programmes": {
        "title": "KeMU Programmes - School of Business and Economics",
        "url": "https://www.kemu.ac.ke/school-of-business-and-economics/programmes",
    },
    "kemu_business_school": {
        "title": "KeMU Business School",
        "url": "https://www.kemu.ac.ke/school-of-business-and-economics",
    },
    "un_tourism_definitions": {
        "title": "UN Tourism Definitions",
        "url": "https://www.unwto.org/global/publication/UNWTO-Tourism-definitions",
    },
    "un_destination_management": {
        "title": "UN Tourism Practical Guide to Tourism Destination Management",
        "url": "https://www.unwto.org/global/publication/practical-guide-tourism-destination-management",
    },
    "un_ethics": {
        "title": "UN Tourism Global Code of Ethics for Tourism",
        "url": "https://www.unwto.org/global-code-of-ethics-for-tourism",
    },
    "un_ecotourism": {
        "title": "UN Tourism Ecotourism and Protected Areas",
        "url": "https://www.unwto.org/sustainable-development/ecotourism-and-protected-areas",
    },
    "un_statistics": {
        "title": "UN Tourism Statistics Database",
        "url": "https://www.unwto.org/tourism-statistics/tourism-statistics-database",
    },
    "un_mst": {
        "title": "UN Tourism Measuring the Sustainability of Tourism",
        "url": "https://www.unwto.org/tourism-statistics/measuring-sustainability-tourism",
    },
    "un_safe_d": {
        "title": "UN Tourism SAFE-D Initiative",
        "url": "https://www.unwto.org/technical-cooperation/safe-d",
    },
    "un_cultural_tourism": {
        "title": "UN Tourism Tourism and Culture",
        "url": "https://www.unwto.org/tourism-and-culture",
    },
    "un_tourism_strategy": {
        "title": "UN Tourism Mission and priorities",
        "url": "https://www.unwto.org/about-us",
    },
    "iata_foundation": {
        "title": "IATA Foundation in Travel and Tourism with Sabre Diploma",
        "url": "https://www.iata.org/en/training/courses/foundation-in-travel-and-tourism-with-sabre-diploma/ttc008eben01/en/",
    },
    "iata_passenger_handling": {
        "title": "IATA Passenger Handling Supervision",
        "url": "https://www.iata.org/en/training/courses/airport-passenger-services/talp10/en/",
    },
    "magical_kenya": {
        "title": "Magical Kenya",
        "url": "https://magicalkenya.com/",
    },
    "kenya_tourism_ministry": {
        "title": "Kenya Ministry of Tourism and Wildlife - Sustainable tourism initiative",
        "url": "https://www.tourism.go.ke/ministry-of-tourism-and-wildlife-launches-initiative-for-tourists-to-plant-trees-promoting-sustainable-tourism-10-05-2024/",
    },
    "kws_amboseli": {
        "title": "Kenya Wildlife Service - Amboseli National Park",
        "url": "https://www.kws.go.ke/index.php/amboseli-national-park",
    },
}


REVISION_BANK_ENTRIES = [
    {
        "topic_title": "Tourism basics and the visitor journey",
        "unit_codes": ["TT-111", "DTM101", "TTM101-U1"],
        "trigger_phrases": [
            "tourism basics",
            "introduction to tourism",
            "tourism foundations",
            "visitor journey",
            "tourism industry",
            "tourism value chain",
        ],
        "explanation": (
            "Tourism is about visitors moving through a full journey: planning, booking, travelling, staying, "
            "experiencing the destination, and giving feedback after the trip. UN Tourism frames tourism as a value "
            "chain with destination appeal, products, supply, governance, and market dynamics, while IATA training "
            "breaks the industry into transport, accommodation, tour products, customer service, and travel documents."
        ),
        "revision_tips": (
            "Define tourism clearly. Distinguish the visitor from the service provider. Be ready to explain the trip "
            "from inspiration to post-trip review using one Kenyan example."
        ),
        "practice_prompt": "Explain the visitor journey for a student traveller planning a trip from Nairobi to Amboseli.",
        "priority": 10,
        "source_keys": ["kemu_programmes", "un_tourism_definitions", "iata_foundation", "magical_kenya"],
    },
    {
        "topic_title": "Travel geography and travel products",
        "unit_codes": ["TT-112", "DTM102"],
        "trigger_phrases": [
            "travel geography",
            "geography and industry codes",
            "travel products",
            "tourism products",
            "itinerary planning",
            "destination and transport",
        ],
        "explanation": (
            "Travel geography connects place, season, route, climate, transport links, and traveller purpose. IATA "
            "course content highlights geography and industry codes because travel staff must match destinations to air, "
            "hotel, rail, car hire, cruise, and packaged tour products."
        ),
        "revision_tips": (
            "Link every destination to access, seasonality, and product choice. Use route logic, not just memorised "
            "place names. Explain why one product fits one traveller better than another."
        ),
        "practice_prompt": "Build a simple Kenya itinerary and justify the transport, accommodation, and tour products chosen.",
        "priority": 12,
        "source_keys": ["iata_foundation", "magical_kenya", "kemu_programmes"],
    },
    {
        "topic_title": "Customer service and service recovery",
        "unit_codes": ["TT-113", "DTM103"],
        "trigger_phrases": [
            "customer service",
            "service recovery",
            "complaints",
            "customer expectations",
            "listening skills",
            "difficult customer",
        ],
        "explanation": (
            "Strong travel service depends on listening, clear information, cultural awareness, and calm problem-solving "
            "at every customer touch point. IATA passenger-service guidance treats complaints, conflict management, "
            "boarding problems, and baggage issues as service moments that should be handled professionally and quickly."
        ),
        "revision_tips": (
            "Use a clear sequence: greet, listen, confirm the issue, explain options, resolve, and follow up. Show how "
            "good service keeps trust even when something goes wrong."
        ),
        "practice_prompt": "How would you handle an angry traveller whose transfer or baggage has been delayed?",
        "priority": 14,
        "source_keys": ["iata_foundation", "iata_passenger_handling"],
    },
    {
        "topic_title": "Destination management and destination quality",
        "unit_codes": ["TT-121"],
        "trigger_phrases": [
            "destination management",
            "destination awareness",
            "destination quality",
            "destination stakeholders",
            "visitor expectations",
        ],
        "explanation": (
            "Destination management is not only about attracting visitors. UN Tourism describes it as creating the right "
            "environment on the ground so the destination meets visitor expectations while coordinating quality, access, "
            "stakeholders, and long-term sustainability."
        ),
        "revision_tips": (
            "Revise the four basics: attraction, access, quality delivery, and coordination. Include who manages each part: "
            "government, operators, communities, and destination managers."
        ),
        "practice_prompt": "What must a destination manager coordinate to keep a destination attractive and well-run?",
        "priority": 16,
        "source_keys": ["un_destination_management", "kemu_programmes"],
    },
    {
        "topic_title": "Tourism marketing and matching products to travellers",
        "unit_codes": ["TT-122", "DTM201"],
        "trigger_phrases": [
            "tourism marketing",
            "travel marketing",
            "sales in tourism",
            "customer loyalty",
            "matching products to travellers",
        ],
        "explanation": (
            "Tourism marketing is about matching the right traveller to the right product at the right time with clear value. "
            "IATA training links this to customer advice, customer loyalty, and accurate knowledge of destinations, timing, "
            "transport, and tourism products."
        ),
        "revision_tips": (
            "Think in segments: who is travelling, why they are travelling, what season they want, and what budget they have. "
            "Then connect those needs to a product, channel, and message."
        ),
        "practice_prompt": "How would you market a Kenya wildlife package differently for a family, a student group, and a luxury traveller?",
        "priority": 18,
        "source_keys": ["iata_foundation", "magical_kenya", "un_tourism_strategy"],
    },
    {
        "topic_title": "Reservations, travel documents, and agency workflow",
        "unit_codes": ["TT-123", "DTM202"],
        "trigger_phrases": [
            "travel agency operations",
            "reservation systems",
            "travel documents",
            "passport and visa",
            "agency workflow",
            "tour operations",
        ],
        "explanation": (
            "Travel agency work follows a clear flow: identify traveller needs, check travel requirements, compare products, "
            "make reservations, confirm documents, and maintain the booking. IATA course content emphasises passport and visa "
            "requirements, insurance options, travel itineraries, reservations, and issuing travel documents correctly."
        ),
        "revision_tips": (
            "Be ready to explain each step from inquiry to final confirmation. Mention document checks, itinerary building, "
            "pricing, and reservation maintenance."
        ),
        "practice_prompt": "Outline the workflow a travel consultant follows from first customer inquiry to final booking confirmation.",
        "priority": 20,
        "source_keys": ["iata_foundation"],
    },
    {
        "topic_title": "Booking platforms and digital distribution channels",
        "unit_codes": ["TT-131"],
        "trigger_phrases": [
            "booking platforms",
            "digital distribution",
            "gds",
            "sabre",
            "distribution channels",
            "online booking",
        ],
        "explanation": (
            "Digital distribution in tourism connects suppliers and customers through channels such as GDS tools, airline systems, "
            "hotel systems, and tour platforms. IATA training highlights Sabre-based reservation skills because modern tourism sales "
            "depend on accurate coding, live availability, and clean booking records."
        ),
        "revision_tips": (
            "Differentiate the channel from the product. Revise why accuracy matters in codes, names, dates, and booking status."
        ),
        "practice_prompt": "Why are digital distribution channels important in modern tour operations and reservation work?",
        "priority": 22,
        "source_keys": ["iata_foundation"],
    },
    {
        "topic_title": "Travel regulations, safety, and passenger handling",
        "unit_codes": ["TT-132"],
        "trigger_phrases": [
            "travel regulations",
            "travel safety",
            "passenger handling",
            "baggage rules",
            "boarding",
            "travel requirements",
        ],
        "explanation": (
            "Travel safety work includes checking travel requirements, handling passengers correctly, following baggage and boarding "
            "rules, and managing disruptions without losing control. IATA passenger-service guidance ties customer care to compliance "
            "with passenger and baggage handling standards."
        ),
        "revision_tips": (
            "Revise documents, baggage rules, complaints, denied boarding, and disruption handling as one connected service process."
        ),
        "practice_prompt": "What should front-line travel staff do when a passenger faces a document or baggage problem at departure?",
        "priority": 24,
        "source_keys": ["iata_foundation", "iata_passenger_handling"],
    },
    {
        "topic_title": "The business of tourism and the tourism value chain",
        "unit_codes": ["TT-133"],
        "trigger_phrases": [
            "business of tourism",
            "tourism value chain",
            "tourism stakeholders",
            "tourism economy",
            "tourism sectors",
        ],
        "explanation": (
            "Tourism works as a connected business system rather than a single product. UN Tourism links competitiveness to governance, "
            "market dynamics, destination appeal, products, and supply, while its wider mission emphasises growth, jobs, sustainability, "
            "innovation, and local community benefit."
        ),
        "revision_tips": (
            "Explain how transport, accommodation, attractions, travel intermediaries, communities, and regulators depend on each other."
        ),
        "practice_prompt": "Why should tourism be studied as a value chain instead of as isolated businesses?",
        "priority": 26,
        "source_keys": ["un_tourism_definitions", "un_tourism_strategy"],
    },
    {
        "topic_title": "Sustainable and responsible tourism",
        "unit_codes": ["TT-212", "DTM105"],
        "trigger_phrases": [
            "sustainable tourism",
            "responsible tourism",
            "tourism and sdgs",
            "local community benefit",
            "tourism ethics",
        ],
        "explanation": (
            "Sustainable tourism balances economic benefit, community wellbeing, and environmental protection. UN Tourism treats the "
            "ethics and sustainability agenda as practical work: protect heritage, reduce harm, support local communities, and measure "
            "tourism impacts instead of only chasing arrivals."
        ),
        "revision_tips": (
            "Always discuss the three dimensions together: economic, social, and environmental. Use one Kenya example to show how tourism "
            "can support livelihoods and conservation at the same time."
        ),
        "practice_prompt": "How can a tourism destination grow visitor numbers without damaging local culture or ecosystems?",
        "priority": 28,
        "source_keys": ["un_ethics", "un_mst", "kenya_tourism_ministry"],
    },
    {
        "topic_title": "Ecotourism and protected area management",
        "unit_codes": ["TT-221"],
        "trigger_phrases": [
            "ecotourism",
            "protected areas",
            "nature based tourism",
            "conservation tourism",
            "protected area management",
        ],
        "explanation": (
            "UN Tourism defines ecotourism as nature-based tourism with education, interpretation, low impact, and support for local "
            "communities and conservation. Kenyan protected areas such as Amboseli show how wildlife, landscape, culture, and conservation "
            "management all shape the tourism product."
        ),
        "revision_tips": (
            "State the core ecotourism features: nature focus, education, low impact, community benefit, and conservation support. Then "
            "connect them to one protected area example."
        ),
        "practice_prompt": "Why is ecotourism more than simply visiting a national park?",
        "priority": 30,
        "source_keys": ["un_ecotourism", "kws_amboseli"],
    },
    {
        "topic_title": "Niche and cultural tourism products",
        "unit_codes": ["TT-222"],
        "trigger_phrases": [
            "niche tourism",
            "cultural tourism",
            "special interest tourism",
            "heritage tourism",
            "tourism products",
        ],
        "explanation": (
            "Niche tourism focuses on a specific interest, motivation, or experience instead of a mass-market offer. UN Tourism's cultural "
            "tourism guidance shows that specialised products often depend on heritage, food, creativity, traditions, and local lifestyles, "
            "so the product must respect culture while still creating value for visitors and communities."
        ),
        "revision_tips": (
            "Differentiate niche tourism from mass tourism. Use examples such as cultural tourism, ecotourism, birding, or educational travel."
        ),
        "practice_prompt": "What makes a tourism product niche, and how should it be marketed differently?",
        "priority": 32,
        "source_keys": ["un_cultural_tourism", "magical_kenya"],
    },
    {
        "topic_title": "Crisis preparedness and recovery in tourism",
        "unit_codes": ["TT-223"],
        "trigger_phrases": [
            "crisis management",
            "tourism crisis",
            "crisis preparedness",
            "recovery",
            "risk assessment",
        ],
        "explanation": (
            "Tourism crisis management starts before the crisis. UN Tourism's SAFE-D work stresses risk assessment, monitoring, preparedness, "
            "response, recovery, and coordination so destinations can protect travellers, businesses, and communities while restoring confidence."
        ),
        "revision_tips": (
            "Structure your answer around the crisis cycle: prepare, respond, recover, review. Include communication and stakeholder coordination."
        ),
        "practice_prompt": "How should a destination respond to a major safety incident without damaging long-term visitor confidence?",
        "priority": 34,
        "source_keys": ["un_safe_d"],
    },
    {
        "topic_title": "Tourism research methods and evidence-based decisions",
        "unit_codes": ["TT-224"],
        "trigger_phrases": [
            "research methods",
            "tourism research",
            "tourism statistics",
            "questionnaires",
            "evidence based decisions",
        ],
        "explanation": (
            "Tourism research depends on clear questions, reliable indicators, and methods that can be compared across places and time. "
            "UN Tourism's statistics guidance emphasises standardised data collection, internationally comparable indicators, and evidence-based "
            "decision making rather than guesswork."
        ),
        "revision_tips": (
            "Revise problem statement, objectives, data collection method, indicator choice, and interpretation. Show why bad data leads to bad decisions."
        ),
        "practice_prompt": "Why are standard indicators and reliable data collection important in tourism research?",
        "priority": 36,
        "source_keys": ["un_statistics", "un_mst"],
    },
    {
        "topic_title": "Airline and airport operations",
        "unit_codes": ["TT-233"],
        "trigger_phrases": [
            "airline operations",
            "airport operations",
            "ground handling",
            "passenger service",
            "boarding operations",
        ],
        "explanation": (
            "Airline and airport operations combine customer service, baggage handling, boarding control, safety standards, and coordination between "
            "airlines and ground teams. IATA training places strong emphasis on passenger handling, on-time performance, baggage control, and safe, "
            "efficient ground operations."
        ),
        "revision_tips": (
            "Connect airside work, landside work, passenger care, baggage flow, and disruption handling in one answer."
        ),
        "practice_prompt": "What areas must airport operations teams control to keep passenger service safe and efficient?",
        "priority": 38,
        "source_keys": ["iata_passenger_handling", "iata_foundation"],
    },
    {
        "topic_title": "Entrepreneurship and innovation in tourism",
        "unit_codes": ["TT-234"],
        "trigger_phrases": [
            "tourism entrepreneurship",
            "innovation in tourism",
            "tourism business idea",
            "tourism startup",
            "tourism opportunity",
        ],
        "explanation": (
            "Tourism entrepreneurship is about spotting unmet visitor needs and building viable services around them. UN Tourism's strategic priorities "
            "tie innovation and entrepreneurship to competitiveness, jobs, investment, and long-term sector growth."
        ),
        "revision_tips": (
            "Show the link between problem, customer segment, product idea, delivery channel, and revenue source. Use a realistic tourism example."
        ),
        "practice_prompt": "How would you turn one tourism need in Kenya into a viable small business idea?",
        "priority": 40,
        "source_keys": ["un_tourism_strategy", "magical_kenya"],
    },
]

