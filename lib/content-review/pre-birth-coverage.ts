export type PreBirthAreaItem = {
  key: string;
  label: string;
  keywords: string[];
};

export type PreBirthAreaGroup = {
  key: string;
  label: string;
  items: PreBirthAreaItem[];
};

export const PRE_BIRTH_COVERAGE_AREAS: PreBirthAreaGroup[] = [
  {
    key: "hospital_and_birth",
    label: "Hospital and birth",
    items: [
      { key: "hospital_registration", label: "Hospital registration", keywords: ["hospital registration", "register"] },
      { key: "route_transportation", label: "Route and transportation", keywords: ["route to hospital", "transport"] },
      { key: "birth_preferences", label: "Birth preferences", keywords: ["birth plan", "birth preference"] },
      { key: "labor_support", label: "Labor support", keywords: ["labor support", "doula", "support during labor"] },
      { key: "visitor_rules", label: "Visitor rules", keywords: ["visitor", "visitors during labor"] },
      { key: "hospital_bags", label: "Hospital bags", keywords: ["hospital bag"] },
      { key: "cord_blood", label: "Cord blood decision", keywords: ["cord blood"] },
      { key: "circumcision", label: "Circumcision decision", keywords: ["circumcision"] },
      { key: "pain_management", label: "Pain management discussion", keywords: ["pain management", "epidural"] },
      { key: "delivery_contingency", label: "Delivery contingency plan", keywords: ["contingency", "c-section", "cesarean", "emergency delivery"] },
    ],
  },
  {
    key: "medical",
    label: "Medical",
    items: [
      { key: "pediatrician", label: "Pediatrician", keywords: ["pediatrician"] },
      { key: "insurance", label: "Insurance", keywords: ["insurance"] },
      { key: "prenatal_classes", label: "Prenatal classes", keywords: ["prenatal class"] },
      { key: "infant_cpr", label: "Infant CPR", keywords: ["cpr"] },
      { key: "choking", label: "Choking", keywords: ["choking"] },
      { key: "emergency_contacts", label: "Emergency contacts", keywords: ["emergency number", "emergency contact"] },
      { key: "medication_plan", label: "Medication plan", keywords: ["medication"] },
      { key: "postpartum_care", label: "Postpartum care", keywords: ["postpartum"] },
      { key: "first_pediatric_visit", label: "First pediatric visit", keywords: ["first pediatric"] },
    ],
  },
  {
    key: "home",
    label: "Home",
    items: [
      { key: "safe_sleep", label: "Safe sleep setup", keywords: ["safe sleep"] },
      { key: "bassinet", label: "Bassinet", keywords: ["bassinet"] },
      { key: "crib", label: "Crib", keywords: ["crib"] },
      { key: "changing_area", label: "Changing area", keywords: ["changing"] },
      { key: "feeding_area", label: "Feeding area", keywords: ["feeding station"] },
      { key: "laundry", label: "Laundry", keywords: ["wash baby", "laundry"] },
      { key: "meal_prep", label: "Meal prep", keywords: ["freeze meal", "meal prep", "stock pantry"] },
      { key: "cleaning", label: "Cleaning", keywords: ["clean"] },
      { key: "temperature", label: "Temperature", keywords: ["temperature", "thermostat"] },
      { key: "night_lighting", label: "Night lighting", keywords: ["night light", "blackout"] },
      { key: "baby_proofing", label: "Baby-proofing priorities", keywords: ["baby-proof", "baby proof"] },
    ],
  },
  {
    key: "gear",
    label: "Gear",
    items: [
      { key: "car_seat", label: "Car seat", keywords: ["car seat"] },
      { key: "stroller", label: "Stroller", keywords: ["stroller"] },
      { key: "carrier", label: "Carrier", keywords: ["carrier"] },
      { key: "bottles", label: "Bottles", keywords: ["bottle"] },
      { key: "pump", label: "Pump", keywords: ["pump"] },
      { key: "formula_backup", label: "Formula backup", keywords: ["formula"] },
      { key: "diapers", label: "Diapers", keywords: ["diaper"] },
      { key: "clothes", label: "Clothes", keywords: ["baby clothes", "onesie"] },
      { key: "monitor", label: "Monitor", keywords: ["monitor"] },
      { key: "thermometer", label: "Thermometer", keywords: ["thermometer"] },
      { key: "first_aid", label: "First-aid items", keywords: ["first aid", "first-aid"] },
    ],
  },
  {
    key: "work_and_leave",
    label: "Work and leave",
    items: [
      { key: "parental_leave", label: "Parental leave", keywords: ["leave", "parental leave"] },
      { key: "employer_forms", label: "Employer forms", keywords: ["employer", "fmla", "hr"] },
      { key: "handoff_plan", label: "Handoff plan", keywords: ["handoff", "coverage at work"] },
      { key: "childcare_timing", label: "Childcare timing", keywords: ["childcare"] },
      { key: "return_to_work", label: "Return-to-work plan", keywords: ["return to work"] },
      { key: "backup_childcare", label: "Backup childcare", keywords: ["backup childcare", "backup care"] },
    ],
  },
  {
    key: "legal_and_financial",
    label: "Legal and financial",
    items: [
      { key: "health_insurance_enrollment", label: "Health insurance enrollment", keywords: ["add baby to insurance", "insurance enrollment"] },
      { key: "beneficiaries", label: "Beneficiaries", keywords: ["beneficiary"] },
      { key: "life_insurance", label: "Life insurance", keywords: ["life insurance"] },
      { key: "will", label: "Will", keywords: ["will"] },
      { key: "guardians", label: "Guardians", keywords: ["guardian"] },
      { key: "emergency_fund", label: "Emergency fund", keywords: ["emergency fund"] },
      { key: "first_year_budget", label: "First-year budget", keywords: ["budget"] },
      { key: "college_savings", label: "College savings decision", keywords: ["529", "college savings"] },
    ],
  },
  {
    key: "relationship_and_household",
    label: "Relationship and household",
    items: [
      { key: "overnight_shifts", label: "Overnight shifts", keywords: ["overnight", "night shift"] },
      { key: "feeding_roles", label: "Feeding roles", keywords: ["feeding role", "who feeds"] },
      { key: "visitors", label: "Visitors", keywords: ["visitor"] },
      { key: "chores", label: "Chores", keywords: ["chore"] },
      { key: "communication_stress", label: "Communication during stress", keywords: ["stress", "communication"] },
      { key: "postpartum_support", label: "Postpartum support", keywords: ["postpartum support"] },
      { key: "connection_plan", label: "Date and connection plan", keywords: ["date night", "connection"] },
    ],
  },
  {
    key: "dog_and_home_logistics",
    label: "Dog and home logistics",
    items: [
      { key: "lulu_care_labor", label: "Lulu care during labor", keywords: ["lulu", "dog sitter", "pet sitter"] },
      { key: "sitter_backup", label: "Sitter backup", keywords: ["sitter backup", "backup sitter"] },
      { key: "introduction_plan", label: "Introduction plan", keywords: ["introduce", "dog introduction"] },
      { key: "stroller_practice", label: "Stroller practice", keywords: ["stroller practice"] },
      { key: "pet_boundaries", label: "Pet boundaries", keywords: ["pet boundar"] },
      { key: "noise_preparation", label: "Noise preparation", keywords: ["noise"] },
    ],
  },
  {
    key: "final_days",
    label: "Final days",
    items: [
      { key: "fuel", label: "Fuel", keywords: ["gas", "fuel"] },
      { key: "charged_devices", label: "Charged devices", keywords: ["charge", "charg"] },
      { key: "bags_loaded", label: "Bags loaded", keywords: ["bag in car", "bags loaded", "hospital bag"] },
      { key: "car_seat_checked", label: "Car seat checked", keywords: ["car seat inspect", "car seat"] },
      { key: "food_stocked", label: "Food stocked", keywords: ["stock pantry", "freeze meal"] },
      { key: "house_reset", label: "House reset", keywords: ["house reset", "tidy"] },
      { key: "final_confirmations", label: "Final confirmations", keywords: ["final week", "confirm"] },
    ],
  },
];

export function textMatchesKeywords(text: string, keywords: string[]): boolean {
  const hay = text.toLowerCase();
  return keywords.some((kw) => hay.includes(kw.toLowerCase()));
}
