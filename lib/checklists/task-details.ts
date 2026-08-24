/**
 * Explanatory content for Before Baby checklist tasks, keyed by template_task_slug.
 * Shown in the task detail modal alongside the task's live scheduling data
 * (due date, owner, timing reason) — this file only holds static "what/why/tip"
 * context, not anything that changes per-family.
 */

export type TaskDetail = {
  explanation: string;
  rationale: string;
  tips?: string[];
};

export const TASK_DETAILS: Record<string, TaskDetail> = {
  // --- Hospital & Birth ---
  hospital_birth_1: {
    explanation: "Pick which hospital or birth center you'll deliver at.",
    rationale:
      "Everything downstream — registration, tours, your OB/midwife relationship, even which pediatricians are convenient — depends on this choice, so it needs to happen first.",
    tips: ["Check whether your OB/midwife has delivery privileges at more than one hospital before you decide."],
  },
  hospital_birth_2: {
    explanation: "Complete the hospital's own paperwork and account setup ahead of time.",
    rationale:
      "Doing this now means one less form to fill out while in labor, and avoids delays being admitted.",
  },
  hospital_birth_3: {
    explanation: "Call your insurer to confirm the hospital, OB/midwife, and anesthesiologist are in-network.",
    rationale:
      "Delivery is expensive; an out-of-network surprise (anesthesia in particular is a common gap) is one of the most avoidable financial shocks of the whole process.",
    tips: ["Ask specifically about anesthesia/anesthesiologist network status — it's billed separately from the hospital."],
  },
  hospital_birth_4: {
    explanation: "Take the hospital's maternity ward tour, in person or virtual.",
    rationale:
      "Knowing the layout (parking, entrance, labor/delivery/postpartum floor) removes one unknown from an already stressful day.",
  },
  hospital_birth_5: {
    explanation: "Get the infant car seat physically installed in the car you'll bring the baby home in.",
    rationale: "You cannot leave the hospital without a properly installed car seat — hospitals check.",
  },
  hospital_birth_6: {
    explanation: "Have a certified technician inspect the car seat installation.",
    rationale:
      "Car seat misuse is extremely common even when people think they've done it right; a free inspection (many fire stations offer this) catches it before it matters.",
    tips: ["Search \"car seat inspection station\" + your city — most fire departments do this for free."],
  },
  hospital_birth_7: {
    explanation: "Pack Michelle's hospital bag: clothing, toiletries, chargers, comfort items, going-home outfit.",
    rationale: "Packed in advance means no last-minute scramble once labor starts.",
  },
  hospital_birth_8: {
    explanation: "Pack Sam's hospital bag: change of clothes, toiletries, chargers, snacks, entertainment for a possibly long stay.",
    rationale: "Support person comfort matters over what can be a multi-day hospital stay.",
  },
  hospital_birth_9: {
    explanation: "Stock snacks for the hospital stay — for both of you.",
    rationale: "Hospital food service can be limited or slow; labor and recovery both burn a lot of energy.",
  },
  hospital_birth_10: {
    explanation: "Get a rear-facing car mirror so you can see the baby from the driver's seat.",
    rationale: "A small item, but it's genuinely reassuring on the first drives home and after.",
  },
  hospital_birth_11: {
    explanation: "Save your chosen pediatrician's phone number in both phones.",
    rationale: "You'll want this reachable instantly, not searched for, in the first anxious days.",
  },
  hospital_birth_12: {
    explanation: "Save your OB/midwife's emergency or after-hours number.",
    rationale: "Late pregnancy and early postpartum both have real reasons to call urgently — have the number ready before you need it.",
  },
  hospital_birth_13: {
    explanation: "Drive the actual route to the hospital, ideally at a time of day similar to when you might go into labor.",
    rationale: "Removes a real unknown (traffic, parking, entrance) exactly when you'll have the least bandwidth to problem-solve it.",
  },
  hospital_birth_14: {
    explanation: "Write down your preferences for labor and delivery — pain management, interventions, who's present, etc.",
    rationale:
      "A birth plan isn't a guarantee, but it forces the two of you to actually discuss preferences in advance rather than mid-labor, and gives the care team a fast reference.",
    tips: ["Keep it to one page — long birth plans are less likely to be read in the moment."],
  },
  hospital_birth_15: {
    explanation: "Print physical copies of the birth plan to bring to the hospital.",
    rationale: "Not everyone on a rotating hospital staff will have digital access to it; a printed copy is the reliable fallback.",
  },
  hospital_birth_16: {
    explanation: "Decide together who, if anyone, is welcome during active labor — and communicate it to family in advance.",
    rationale: "Deciding this ahead of time avoids an awkward, high-stress negotiation with relatives at the hospital door.",
  },
  hospital_birth_17: {
    explanation: "Decide whether to bank cord blood, and with which provider if so.",
    rationale: "This has to be arranged before delivery — it cannot be added retroactively once the cord is cut.",
    tips: ["If interested, request a kit from the provider several weeks ahead; some hospitals require it pre-registered."],
  },
  hospital_birth_18: {
    explanation: "If you're having a boy, decide on circumcision ahead of delivery.",
    rationale: "Hospitals usually ask this early in the admission process; deciding in advance avoids making the call under time pressure.",
  },
  hospital_birth_19: {
    explanation: "Discuss what pain management options (epidural, unmedicated, other) you're each hoping for.",
    rationale:
      "This is one of the most consequential in-the-moment decisions of labor — talking it through beforehand means Sam knows how to advocate if Michelle can't easily communicate preferences at the time.",
  },
  hospital_birth_20: {
    explanation: "Decide who is in the delivery room beyond hospital staff — just Sam, a doula, family, etc.",
    rationale: "Setting this expectation early avoids an uncomfortable in-the-moment conversation with anyone hoping to be present.",
  },
  hospital_birth_21: {
    explanation: "Agree on what photos/video are okay during labor, delivery, and immediate recovery — and by whom.",
    rationale: "Preferences here vary widely and change under stress; deciding calmly beforehand prevents a moment of miscommunication being caught on camera.",
  },

  // --- Medical ---
  medical_1: {
    explanation: "Choose the pediatrician or pediatric practice you'll use.",
    rationale: "The hospital typically asks who your pediatrician is at admission, and the first visit happens within days of birth.",
  },
  medical_2: {
    explanation: "Book the first newborn well-visit in advance.",
    rationale: "Many practices are booked out; scheduling before birth avoids scrambling for an appointment in the first exhausted week.",
  },
  medical_3: {
    explanation: "Read through the standard infant vaccine schedule so it's not new information at the first visits.",
    rationale: "Knowing what's coming lets you ask informed questions rather than deciding cold in a 15-minute appointment.",
  },
  medical_4: {
    explanation: "Finish any childbirth/prenatal education classes you've signed up for.",
    rationale: "These are usually only offered on a schedule tied to your due date — there's a real deadline here, not just a suggestion.",
  },
  medical_5: {
    explanation: "Take an infant CPR class.",
    rationale: "Statistically unlikely to need it, but it's the kind of skill you want in muscle memory, not looked up in a panic.",
  },
  medical_6: {
    explanation: "Take an infant choking-response class.",
    rationale: "Same logic as CPR — cheap insurance against a rare but high-stakes situation.",
  },
  medical_7: {
    explanation: "Know how to reach your pediatrician's practice outside business hours.",
    rationale: "Newborn concerns don't wait for office hours; knowing the after-hours process removes hesitation when something feels off at 2am.",
  },
  medical_8: {
    explanation: "Decide your intended feeding approach — breastfeeding, formula, or a combination — before gear-shopping locks you into one path.",
    rationale:
      "A lot of the baby-gear list (pump, bottles, formula) depends on this decision; deciding first avoids buying for a plan you haven't actually agreed on. It's fine to stay flexible — the point is discussing it together in advance, not committing irreversibly.",
  },
  medical_9: {
    explanation: "Take a hands-on class covering bathing, diapering, and swaddling a newborn.",
    rationale: "These are learnable skills, not instincts — a short class before birth means less fumbling in the first exhausted days.",
  },

  // --- Home ---
  home_1: {
    explanation: "Assemble the crib.",
    rationale: "Best done with unhurried time and the instructions in hand, not at 2am with a newborn asleep on someone's chest.",
  },
  home_2: {
    explanation: "Assemble the bassinet, if using one for early room-sharing.",
    rationale: "Same logic as the crib — do it while you have the time and patience for hardware.",
  },
  home_3: {
    explanation: "Install and test the baby monitor.",
    rationale: "Confirm it actually reaches your bedroom or wherever you'll be while baby sleeps, before you're relying on it.",
  },
  home_4: {
    explanation: "Install blackout curtains in the nursery/sleep space.",
    rationale: "Newborn sleep is fragile and light-sensitive; darkening the room is one of the cheapest, highest-leverage sleep aids available.",
  },
  home_5: {
    explanation: "Wash all baby clothes before first use.",
    rationale: "New fabric can carry manufacturing residue and irritate newborn skin; a wash first is standard advice.",
    tips: ["Use a fragrance-free, dye-free detergent made for baby clothes or sensitive skin."],
  },
  home_6: {
    explanation: "Wash swaddles and blankets before first use.",
    rationale: "Same reasoning as baby clothes — new fabric, sensitive skin.",
  },
  home_7: {
    explanation: "Wash crib and bassinet sheets before first use.",
    rationale: "Same reasoning as baby clothes — new fabric, sensitive skin.",
  },
  home_8: {
    explanation: "Baby-proof the areas the baby (and eventually a mobile infant) will spend time in.",
    rationale: "Easier to do a first pass calmly now than to retrofit around a fast-moving infant later.",
  },
  home_9: {
    explanation: "Set up a dedicated changing station with supplies within arm's reach.",
    rationale: "You'll do this many times a day; having everything at hand (never leaving baby unattended to grab something) matters for safety and sanity both.",
  },
  home_10: {
    explanation: "Stock and organize the diapering station.",
    rationale: "Same as above — frequency makes setup quality matter.",
  },
  home_11: {
    explanation: "Set up wherever you'll do most feedings — comfortable seating, water, snacks, burp cloths in reach.",
    rationale: "Feeding sessions are long and frequent in the early weeks; a comfortable, stocked spot reduces friction dozens of times a day.",
  },
  home_12: {
    explanation: "Batch-cook and freeze meals ahead of the due date.",
    rationale: "One of the highest-value prep tasks — you will not want to cook in the first weeks, and delivery/takeout gets expensive and repetitive fast.",
  },
  home_13: {
    explanation: "Stock the pantry with staples so grocery runs aren't urgent early on.",
    rationale: "Reduces the number of times someone has to leave the house in the first disorienting week.",
  },
  home_14: {
    explanation: "Install night lights in the nursery and the path from your room to it.",
    rationale: "Keeps late-night feeds/changes low-light (better for everyone's sleep) while still being able to see safely.",
  },

  // --- Baby Gear ---
  baby_gear_1: { explanation: "Buy an infant car seat.", rationale: "Required to leave the hospital — this is a hard deadline, not a nice-to-have." },
  baby_gear_2: { explanation: "Buy a stroller.", rationale: "Worth deciding on before birth since options (travel-system vs. standalone) depend on the car seat you chose." },
  baby_gear_3: { explanation: "Buy a baby carrier/wrap.", rationale: "Genuinely useful from week one for hands-free soothing and mobility." },
  baby_gear_4: { explanation: "Buy the bassinet.", rationale: "Needed before it can be assembled." },
  baby_gear_5: { explanation: "Buy the crib.", rationale: "Order early — shipping delays are common for larger furniture." },
  baby_gear_6: { explanation: "Buy the crib/bassinet mattress.", rationale: "Arrives with the crib/bassinet so assembly isn't blocked waiting on it." },
  baby_gear_7: { explanation: "Buy a waterproof mattress protector.", rationale: "Cheap, and saves you from replacing a mattress after the first blowout." },
  baby_gear_8: { explanation: "Buy a changing pad.", rationale: "Needed to set up the changing station." },
  baby_gear_9: { explanation: "Buy a diaper pail.", rationale: "Needed to set up the changing station; odor control matters more than people expect." },
  baby_gear_10: { explanation: "Buy the baby monitor.", rationale: "Needed before you can install and test it." },
  baby_gear_11: { explanation: "Buy a white noise machine, if desired.", rationale: "Optional but a common, low-cost sleep aid — mimics womb sound and masks household noise." },
  baby_gear_12: { explanation: "Buy an infant thermometer.", rationale: "You'll want this on hand before you need it for a first fever, not ordered same-day." },
  baby_gear_13: { explanation: "Buy a nasal aspirator (bulb syringe or electric).", rationale: "Newborns can't blow their nose; this is standard newborn-care-kit equipment." },
  baby_gear_14: { explanation: "Buy baby nail clippers.", rationale: "Newborn nails grow fast and are sharp enough to scratch — worth having from day one." },
  baby_gear_15: { explanation: "Buy bottles, if using them.", rationale: "Depends on the feeding decision (medical_8) — useful even for breastfeeding families for pumped milk." },
  baby_gear_16: { explanation: "Buy a bottle brush.", rationale: "Pairs with bottles for cleaning." },
  baby_gear_17: { explanation: "Buy a bottle drying rack.", rationale: "Pairs with bottle cleanup setup." },
  baby_gear_18: {
    explanation: "Get a breast pump.",
    rationale: "Often covered by insurance but frequently requires paperwork/prescription lead time — start this well before you need it.",
    tips: ["Call your insurer directly; the process and in-network suppliers vary a lot by plan."],
  },
  baby_gear_19: { explanation: "Buy pump accessories (extra flanges, storage bags, etc.).", rationale: "Easy to forget until you're already using the pump and missing a part." },
  baby_gear_20: { explanation: "Buy a small amount of formula as backup, if desired.", rationale: "Useful safety net regardless of feeding plan — avoid overbuying before you know what brand/type baby tolerates well." },
  baby_gear_21: { explanation: "Buy pacifiers, if desired.", rationale: "Optional; inexpensive to have on hand either way." },
  baby_gear_22: { explanation: "Buy swaddle blankets.", rationale: "Standard newborn sleep gear — needed before the wash-before-use step." },
  baby_gear_23: { explanation: "Buy sleep sacks for when baby outgrows swaddling.", rationale: "You won't need these immediately, but they're easy to add to the same shopping pass." },
  baby_gear_24: {
    explanation: "Set aside the specific outfit baby will wear leaving the hospital.",
    rationale: "Easy to overlook amid packing your own bags — worth a dedicated line so it's not forgotten in the moment.",
  },

  // --- Paperwork ---
  paperwork_1: { explanation: "Read your employer's parental leave policy in detail.", rationale: "You need this understood before you can plan leave dates or submit paperwork." },
  paperwork_2: { explanation: "File FMLA paperwork if your leave qualifies and you haven't already.", rationale: "FMLA has real lead-time and documentation requirements — don't leave this to the last minute." },
  paperwork_3: { explanation: "Understand what's needed to add baby to your health insurance.", rationale: "Most plans have a strict enrollment window (often 30 days) after birth — knowing the process now avoids missing it." },
  paperwork_4: { explanation: "Review whether your life insurance coverage still makes sense with a child.", rationale: "Financial responsibilities change with a new dependent; worth a deliberate look, not an assumption." },
  paperwork_5: { explanation: "Update beneficiaries on existing accounts and policies.", rationale: "A common thing people mean to do and never get around to — tie it to this checklist so it happens." },
  paperwork_6: {
    explanation: "Create or update your will to reflect having a child.",
    rationale: "This is the task most tied to your guardian decision below — a will is how that decision becomes legally binding.",
  },
  paperwork_7: { explanation: "Make sure emergency contacts are current across accounts, school/work records, apps, etc.", rationale: "Easy to let this go stale; worth a deliberate refresh before baby arrives." },
  paperwork_8: {
    explanation: "Decide who would raise your child if neither of you could.",
    rationale: "One of the harder conversations on this whole list, but also one of the most important — and it has to happen before the will can be finalized.",
  },
  paperwork_9: { explanation: "Confirm the hospital's pre-registration paperwork is fully submitted.", rationale: "Reduces admission friction on the day of delivery." },

  // --- Financial ---
  financial_1: { explanation: "Sketch a rough budget for baby's first year.", rationale: "Costs (childcare especially) can be a real surprise; a rough estimate now beats finding out live." },
  financial_2: { explanation: "Open a dedicated baby savings account, if you want one.", rationale: "Optional organizational choice — some families prefer separating baby-related savings from general accounts." },
  financial_3: { explanation: "Top up your emergency fund if you want extra cushion before a income/expense shift.", rationale: "A new baby often coincides with reduced income (leave) and increased expenses — a bigger buffer reduces stress." },
  financial_4: { explanation: "Buy any remaining gear once the list above is otherwise settled.", rationale: "A catch-all pass for whatever's left once decisions are made." },
  financial_5: { explanation: "Research actual childcare costs in your area for your planned start date.", rationale: "Costs and waitlists vary hugely by provider and region — this needs real research, not a guess, and ties directly into the return-to-work planning tasks." },

  // --- Relationship ---
  relationship_1: { explanation: "Decide how meals will work in the first month — freezer stock, meal train, delivery budget, or a mix.", rationale: "Deciding the strategy (not just cooking the meals) means you're not improvising food logistics while exhausted." },
  relationship_2: {
    explanation: "Talk through how you'll split overnight wake-ups.",
    rationale: "A frequent source of resentment in new parenthood is an unspoken, uneven default — deciding explicitly (even if the plan is \"we'll adjust\") heads that off.",
  },
  relationship_3: { explanation: "Agree on what you each want from visiting family — how much, how long, what help looks like versus what feels like extra hosting work.", rationale: "Expectations here differ a lot between partners and between each of your families; better to align before the visits start than mid-visit." },
  relationship_4: { explanation: "Get one date on the calendar before the due date.", rationale: "A small, concrete way to protect the relationship amid all this logistical planning." },
  relationship_5: {
    explanation: "Talk about how you want to communicate with each other during hard, sleep-deprived nights — what helps, what doesn't.",
    rationale: "Exhaustion changes how people communicate; agreeing in advance on things like \"tell me what you need, don't expect me to guess\" prevents avoidable conflict later.",
  },
  relationship_6: {
    explanation: "Learn the warning signs of postpartum depression and anxiety — for the birthing parent and, less commonly discussed, for partners too.",
    rationale:
      "Postpartum mood disorders are common and often go unrecognized because people don't know what to look for until they're already deep in it. Knowing the signs in advance, together, means you're each more likely to notice and act early if it happens.",
    tips: ["Agree now on what you'd do if either of you noticed these signs — who to call, that it's not a failure, that asking for help is the plan working."],
  },

  // --- Pets ---
  pets_1: { explanation: "Prepare Lulu for the household change generally — routines, gear, scent familiarity.", rationale: "Pets pick up on household shifts; some gradual preparation reduces stress for everyone once baby's home." },
  pets_2: { explanation: "Practice walking Lulu alongside a stroller before you need to do it for real.", rationale: "Better to work out any leash/stroller coordination issues without a baby in the mix." },
  pets_3: { explanation: "Plan who looks after Lulu while you're at the hospital for delivery.", rationale: "Labor can start with little warning — decide this before you need it, not while you're in the car." },
  pets_4: { explanation: "Line up a backup pet sitter in case the primary plan falls through.", rationale: "Simple redundancy for an unpredictable event." },

  // --- Work & Leave ---
  work_leave_1: { explanation: "Document what Sam is responsible for at work so someone else can cover it during leave.", rationale: "A clear handoff reduces the temptation to check in on work during leave and reduces stress for whoever's covering." },
  work_leave_2: { explanation: "Same handoff documentation for Michelle, if she's also returning to a role with coverage needs.", rationale: "Same reasoning as above." },
  work_leave_3: { explanation: "Lock in actual leave start/end dates with each employer.", rationale: "Needed before you can plan childcare start dates or submit final paperwork." },
  work_leave_4: { explanation: "Submit whatever formal leave paperwork each employer requires.", rationale: "Often has its own lead-time requirements separate from FMLA — don't assume it's the same form." },
  work_leave_5: { explanation: "Set yourself a reminder ahead of your actual return-to-work date.", rationale: "Easy to lose track of dates in the fog of early parenthood — a reminder protects against a scramble." },
  work_leave_6: { explanation: "Confirm the exact date childcare begins.", rationale: "Needs to align with your return-to-work date, and many providers require confirmation well ahead of start." },
  work_leave_7: { explanation: "Work out the actual daily drop-off and pickup logistics.", rationale: "Concrete plan (who, what time, what if traffic/a meeting runs long) avoids daily improvisation once you're both back at work." },
  work_leave_8: { explanation: "Have a backup plan for when primary childcare falls through (sick day, closure, etc.).", rationale: "This will happen — a backup plan decided calmly now beats scrambling on a random Tuesday." },

  // --- Postpartum preparation ---
  postpartum_prep_1: { explanation: "Save the labor and delivery triage line separately from the general hospital number.", rationale: "This is the number you'll actually call if something feels off before or during labor — worth having distinctly saved." },
  postpartum_prep_2: { explanation: "Save your OB's specific instructions for urgent postpartum contact.", rationale: "Postpartum complications are time-sensitive; knowing exactly who to call and when removes hesitation." },
  postpartum_prep_3: {
    explanation: "Stock recovery supplies for the birthing parent — pads, peri bottle, comfort items, appropriate for a vaginal or C-section recovery.",
    rationale: "Physical recovery needs are real and specific; having supplies ready at home means one less errand right after discharge.",
  },
  postpartum_prep_4: { explanation: "Know what the postpartum follow-up visit schedule looks like (typically ~6 weeks, sometimes earlier check-ins).", rationale: "Knowing this ahead of time means it doesn't get missed amid newborn chaos." },
  postpartum_prep_5: { explanation: "Identify a lactation consultant or support line ahead of time, if breastfeeding is part of your plan.", rationale: "Feeding problems are common in the first days and are much easier to solve with support lined up in advance rather than found in a crisis." },
  postpartum_prep_6: { explanation: "Write down current medications and allergies for both baby and birthing parent.", rationale: "Useful to have on hand for any urgent care visit, rather than trying to recall it under stress." },
  postpartum_prep_7: { explanation: "Compile a single emergency contact list — pediatrician, OB, poison control, family.", rationale: "One list, easy to find, beats searching multiple apps/contacts during an actual emergency." },
  postpartum_prep_8: {
    explanation: "Actually schedule out who's helping with meals, visits, and chores in the first two weeks, rather than leaving it as a vague understanding.",
    rationale: "A real schedule (not just \"people said they'd help\") avoids both the gap of no help showing up and the overwhelm of everyone showing up the same week.",
  },
  postpartum_prep_9: {
    explanation: "Decide whether a postpartum doula or night nurse is something you want, and if so, book it before the due date.",
    rationale: "These services often book up in advance and add real cost — worth deciding deliberately rather than reactively once you're already exhausted.",
  },

  // --- Legal & documents ---
  legal_extra_1: { explanation: "Review beneficiary designations across all accounts specifically for consistency with your updated will.", rationale: "Beneficiary designations on accounts can override a will if they're not aligned — worth explicitly checking." },
  legal_extra_2: { explanation: "Store your will, insurance, and other key documents somewhere secure and known.", rationale: "A document no one can find in an emergency is nearly as bad as not having one." },
  legal_extra_3: { explanation: "Tell a trusted person outside the household where those documents are kept.", rationale: "If something happened to both of you, someone else needs to know where to look." },
  legal_extra_4: { explanation: "Decide your approach to education savings — 529, other account, or none for now.", rationale: "Not urgent, but easier to decide deliberately once rather than let it drift indefinitely." },
  legal_extra_5: { explanation: "If you decided to open an education savings account, create the actual follow-up task for after birth (you'll need baby's SSN first).", rationale: "This can't be completed before birth — this task just makes sure it doesn't get forgotten." },
  legal_extra_6: { explanation: "Do a final pass updating any beneficiary designations that changed.", rationale: "Catches anything missed in the first review." },

  // --- Lulu details ---
  lulu_extra_1: { explanation: "Confirm who's the primary pet sitter/caretaker during the hospital stay and beyond.", rationale: "Needs a name and a confirmed yes, not just an assumption." },
  lulu_extra_2: { explanation: "Confirm a backup in case the primary caretaker isn't available.", rationale: "Redundancy for an unpredictable timeline." },
  lulu_extra_3: { explanation: "Write down care instructions (feeding, walks, quirks) for whoever's helping.", rationale: "Removes guesswork for someone else stepping into your routine." },
  lulu_extra_4: { explanation: "Practice whatever boundaries you'll want around baby's spaces (crib, play mat) before baby's home.", rationale: "Easier to establish a habit calmly in advance than to correct it under pressure later." },
  lulu_extra_5: { explanation: "Plan how you'll actually introduce Lulu to the baby the first time.", rationale: "A calm, deliberate first introduction (scent first, supervised, low-key) goes a long way for a smooth ongoing relationship." },
  lulu_extra_6: { explanation: "Confirm the specific plan for Lulu the day labor starts.", rationale: "Ties together the pieces above into one concrete plan for the actual day." },

  // --- Home readiness ---
  home_extra_1: { explanation: "Do a pass removing pillows, blankets, bumpers, and toys from the sleep space.", rationale: "Directly tied to safe sleep guidelines — loose items in the crib are a known suffocation risk." },
  home_extra_2: { explanation: "Do one final safe-sleep check right before the due date — firm mattress, fitted sheet only, nothing else in the crib.", rationale: "Worth a dedicated final check since setup can drift (gifts, well-meaning additions) between initial setup and the due date." },
  home_extra_3: {
    explanation: "Do a full house reset — dishes, trash, laundry, clean sheets, stocked bathroom and pet supplies, essential groceries.",
    rationale: "The goal is coming home to a house that requires nothing of you, since you'll have zero bandwidth for chores in the first days.",
  },

  // --- Final Week ---
  final_week_1: { explanation: "Make sure cameras are charged.", rationale: "You don't want to discover a dead battery in the delivery room." },
  final_week_2: { explanation: "Make sure phones are fully charged.", rationale: "Same reasoning — you'll want them working, possibly for hours, on the day." },
  final_week_3: { explanation: "Fill up the gas tank.", rationale: "One less thing to think about when leaving in a hurry." },
  final_week_4: { explanation: "Do a final check that the car seat is properly installed in the car you'll actually use.", rationale: "Confirms nothing shifted since the earlier inspection." },
  final_week_5: { explanation: "Put the packed hospital bags in the car.", rationale: "Removes the last step between \"it's time\" and actually leaving." },
  final_week_6: { explanation: "Do a final laundry and sheet-changing pass.", rationale: "Comfortable, clean linens waiting at home for your return." },
  final_week_7: { explanation: "Do a lighter version of the full house reset, closer to the due date.", rationale: "Keeps the home-readiness work current since time has passed since the earlier full reset." },
  final_week_8: { explanation: "Restock groceries close to the due date.", rationale: "Ensures fresh basics are on hand whenever you get home, on whatever day that turns out to be." },
  final_week_9: { explanation: "Reconfirm the pediatrician's contact info one more time.", rationale: "A quick final check that nothing changed since it was first saved." },
  final_week_10: { explanation: "Intentionally slow down and reduce workload/commitments in the final stretch.", rationale: "Physically and mentally, this is the moment to protect energy rather than spend it." },
  final_week_11: { explanation: "Reconfirm the dog sitter is still available and aware timing could be any day now.", rationale: "Plans made weeks ago are worth a quick reconfirmation once you're actually close." },
  final_week_12: { explanation: "Drive the hospital route one more time if it's been a while since you last did.", rationale: "Final confidence check before the real trip." },

  // --- Announcements & support network ---
  announcements_and_support_1: {
    explanation: "Decide together who gets the first call/text once baby arrives, and in what order after that.",
    rationale: "Avoids an awkward situation where someone finds out secondhand, or a stressed new parent trying to figure this out in the moment.",
  },
  announcements_and_support_2: {
    explanation: "Plan how and when you'll announce the birth more broadly — family group chat, social media, or not at all initially.",
    rationale: "Deciding your comfort level in advance (timing, what to share, whether photos are included) avoids a rushed decision made while sleep-deprived.",
  },
  announcements_and_support_3: {
    explanation: "Identify one person you'd trust to step in if something happened to both of you in the first weeks.",
    rationale: "A concrete backup name, distinct from the long-term guardian decision in your will — this is about who's reachable and available in the immediate, practical sense.",
  },
};

export function getTaskDetail(slug: string | null | undefined): TaskDetail | null {
  if (!slug) return null;
  return TASK_DETAILS[slug] ?? null;
}
