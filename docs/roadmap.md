# Roadmap and known limitations

## Future roadmap

1. Live Supabase Auth magic-link UI wired end-to-end
2. Real AI playbook generation with approval workflow
3. PDF / Word export
4. Richer offline sync / PWA caching
5. Additional family members and children profiles
6. Annual review workflows and reminders
7. Deeper contradiction detection across decisions
8. Caregiver-safe playbook subsets

## Known limitations (MVP)

- Local demo uses a JSON file store; Supabase schema/RLS are provided for production
- AI generation is mocked
- PDF/Word export not included
- Offline mode is save-status + resume based, not full offline sync
- Development maps exist as data model + sample financial maps, not for every outcome
- Public signup / multi-tenant onboarding UI is intentionally omitted
