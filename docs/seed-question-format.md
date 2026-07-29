# Seed question JSON format

Each question in `data/seed/questions.json` should match:

```json
{
  "id": "q_sleep_goals_first_year",
  "slug": "sleep-goals-first-year",
  "text": "What are our goals for sleep during the first year?",
  "short_title": "Sleep goals (year 1)",
  "why_it_matters": "...",
  "discussion_guidance": "...",
  "question_type": "joint_discussion",
  "response_schema": { "mode": "open_or_policy" },
  "life_stages": ["newborn_0_3", "infant_3_12"],
  "categories": ["sleep"],
  "subcategories": [],
  "outcomes": ["secure_attachment", "stress_management"],
  "related_principles": [],
  "related_questions": [],
  "parent_decision_dependency": null,
  "logical_order": 120,
  "priority": "essential_before_birth",
  "estimated_minutes": 8,
  "emotional_weight": 4,
  "evidence_needed": false,
  "evidence_available": false,
  "evidence_summary": null,
  "practical_tip": null,
  "separate_answers_recommended": true,
  "cooling_off_recommended": true,
  "follow_up_prompts": ["What would make us revisit this?"],
  "review_recommendation": null,
  "child_dependent": true,
  "required_before_birth": true,
  "babymoon_priority": true,
  "research_mode": "helpful_before_decision",
  "active": true
}
```

Generate with:

```bash
pnpm generate:questions
pnpm seed
```

Import outcomes from `data/seed/outcomes.json` via the same seed script.
