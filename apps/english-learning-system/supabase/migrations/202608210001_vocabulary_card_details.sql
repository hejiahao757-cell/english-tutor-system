alter table public.vocabulary_cards
  add column if not exists details jsonb not null default '{}'::jsonb;

comment on column public.vocabulary_cards.details is
  'Expanded Tutor vocabulary card data: part of speech, source context, word family, phrases and contrasts.';

