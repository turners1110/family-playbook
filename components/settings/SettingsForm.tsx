"use client";

import { useState, useTransition } from "react";
import { useTheme } from "next-themes";
import { actionUpdateSettings } from "@/lib/actions";
import type { FamilySettings } from "@/lib/types/models";
import { BeforeBabySchedulingSettings } from "@/components/checklists/BeforeBabySchedulingSettings";

export function SettingsForm({ settings }: { settings: FamilySettings }) {
  const { setTheme } = useTheme();
  const [pending, startTransition] = useTransition();
  const [hide, setHide] = useState(settings.hide_partner_answers_until_both_saved);
  const [darkMode, setDarkMode] = useState(settings.dark_mode);
  const [target, setTarget] = useState(settings.babymoon_target_date ?? "");
  const [daily, setDaily] = useState(settings.babymoon_daily_questions);
  const [history, setHistory] = useState(settings.include_perspective_history_in_playbook);
  const [due, setDue] = useState(settings.expected_due_date ?? "");
  const [saved, setSaved] = useState(false);

  return (
    <div className="space-y-6">
      <form
        className="mt-4 space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          startTransition(async () => {
            await actionUpdateSettings({
              hide_partner_answers_until_both_saved: hide,
              dark_mode: darkMode,
              babymoon_target_date: target || null,
              babymoon_daily_questions: daily,
              include_perspective_history_in_playbook: history,
              expected_due_date: due || null,
            });
            setTheme(darkMode);
            setSaved(true);
          });
        }}
      >
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={hide} onChange={(e) => setHide(e.target.checked)} />
          Hide partner answers until both are saved
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={history} onChange={(e) => setHistory(e.target.checked)} />
          Include perspective history in playbook by default
        </label>
        <div className="field">
          <label htmlFor="theme">Theme</label>
          <select
            id="theme"
            className="select"
            value={darkMode}
            onChange={(e) => setDarkMode(e.target.value as typeof darkMode)}
          >
            <option value="system">System</option>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="due">Expected due date</label>
          <input
            id="due"
            type="date"
            className="input"
            value={due}
            onChange={(e) => setDue(e.target.value)}
          />
          <p className="mt-1 text-xs text-ink-subtle">
            Used by Before Baby scheduling. Date math only — not medical advice.
          </p>
        </div>
        <div className="field">
          <label htmlFor="target">Babymoon target date</label>
          <input
            id="target"
            type="date"
            className="input"
            value={target}
            onChange={(e) => setTarget(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="daily">Recommended daily questions</label>
          <input
            id="daily"
            type="number"
            min={1}
            max={50}
            className="input"
            value={daily}
            onChange={(e) => setDaily(Number(e.target.value))}
          />
        </div>
        <button type="submit" className="btn btn-primary" disabled={pending}>
          {pending ? "Saving…" : "Save settings"}
        </button>
        {saved && <p className="text-sm text-accent-strong">Settings saved.</p>}
      </form>

      <BeforeBabySchedulingSettings settings={settings} />
    </div>
  );
}
