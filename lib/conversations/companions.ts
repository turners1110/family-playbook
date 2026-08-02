/**
 * Quick companions linked to Essentials deep questions.
 */
export const ESSENTIALS_COMPANIONS: Array<{
  companion_prompt_id: string;
  deep_question_id: string;
  label: string;
}> = [
  {
    companion_prompt_id: "qp_birth_room_word",
    deep_question_id: "q_what_role_should_each_parent_have_during_labor",
    label: "Birth preferences",
  },
  {
    companion_prompt_id: "qp_first_week_home",
    deep_question_id:
      "q_what_is_our_plan_for_accepting_or_declining_visitors_in_week_o",
    label: "Visitors",
  },
  {
    companion_prompt_id: "qp_advice_default",
    deep_question_id: "q_how_should_we_handle_unsolicited_parenting_advice",
    label: "Advice boundaries",
  },
  {
    companion_prompt_id: "qp_parent_word",
    deep_question_id: "q_what_does_success_as_parents_mean_to_us",
    label: "Success as parents",
  },
  {
    companion_prompt_id: "qp_night_person",
    deep_question_id: "q_how_should_we_divide_overnight_care_in_the_first_weeks",
    label: "Overnight roles",
  },
  {
    companion_prompt_id: "qp_morning_person",
    deep_question_id: "q_how_should_we_divide_overnight_care_in_the_first_weeks",
    label: "Division of labor",
  },
  {
    companion_prompt_id: "qp_feeding_start",
    deep_question_id: "q_what_is_our_approach_to_feeding_in_the_newborn_stage",
    label: "Feeding",
  },
  {
    companion_prompt_id: "qp_baby_face_online",
    deep_question_id:
      "q_how_do_we_want_to_handle_photos_and_social_media_after_birth",
    label: "Social media",
  },
  {
    companion_prompt_id: "qp_lulu_nursery",
    deep_question_id: "q_what_safety_rules_apply_to_pets_and_the_baby",
    label: "Lulu",
  },
  {
    companion_prompt_id: "qp_holiday_size",
    deep_question_id: "q_what_does_a_loving_home_look_and_feel_like_to_us",
    label: "Holidays",
  },
];

export function companionForDeepQuestion(questionId: string) {
  return ESSENTIALS_COMPANIONS.find((c) => c.deep_question_id === questionId);
}
