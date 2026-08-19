create table public.matches (
  id                    text primary key,
  division              text not null,
  round                 text not null,
  match_date            date not null,
  date_label            text not null,
  tee_time              text not null,
  is_bye                boolean not null default false,
  p1_name               text,
  p1_seed               int,
  p1_hcp                int,
  p2_name               text,
  p2_seed               int,
  p2_hcp                int,
  status                text not null default 'upcoming',
  winner                text,
  result_text           text,
  comment               text default '',
  feeds_into_match_id   text references public.matches(id),
  feeds_into_slot       int,
  updated_at            timestamptz not null default now()
);

create table public.hole_results (
  id          bigint generated always as identity primary key,
  match_id    text not null references public.matches(id),
  hole_number int not null,
  result      text not null,
  created_at  timestamptz not null default now(),
  unique (match_id, hole_number)
);

create table public.player_photos (
  player_name text primary key,
  photo_url   text not null,
  updated_at  timestamptz not null default now()
);

create table public.app_config (
  key   text primary key,
  value jsonb not null
);

grant select on public.matches to anon, authenticated;
grant select on public.hole_results to anon, authenticated;
grant select on public.player_photos to anon, authenticated;
grant select on public.app_config to anon, authenticated;
grant all on public.matches to service_role;
grant all on public.hole_results to service_role;
grant all on public.player_photos to service_role;
grant all on public.app_config to service_role;

alter table public.matches enable row level security;
alter table public.hole_results enable row level security;
alter table public.player_photos enable row level security;
alter table public.app_config enable row level security;

create policy "Matches are publicly viewable" on public.matches for select to anon, authenticated using (true);
create policy "Hole results are publicly viewable" on public.hole_results for select to anon, authenticated using (true);
create policy "Player photos are publicly viewable" on public.player_photos for select to anon, authenticated using (true);
create policy "App config is publicly viewable" on public.app_config for select to anon, authenticated using (true);

alter publication supabase_realtime add table public.matches;
alter publication supabase_realtime add table public.hole_results;
alter table public.matches replica identity full;
alter table public.hole_results replica identity full;

insert into public.matches (id, division, round, match_date, date_label, tee_time, is_bye, p1_name, p1_seed, p1_hcp, p2_name, p2_seed, p2_hcp, feeds_into_match_id, feeds_into_slot) values
('m-final', 'men', 'Final', '2026-08-23', 'Sun 23 Aug', 'TBD', false, null, null, null, null, null, null, null, null),
('m-sf-1', 'men', 'Semi-Final', '2026-08-22', 'Sat 22 Aug', '12:50 PM', false, null, null, null, null, null, null, 'm-final', 1),
('m-sf-2', 'men', 'Semi-Final', '2026-08-22', 'Sat 22 Aug', '1:00 PM', false, null, null, null, null, null, null, 'm-final', 2),
('m-qf-1', 'men', 'Quarter-Final', '2026-08-21', 'Fri 21 Aug', '12:00 PM', false, null, null, null, null, null, null, 'm-sf-1', 1),
('m-qf-2', 'men', 'Quarter-Final', '2026-08-21', 'Fri 21 Aug', '12:10 PM', false, null, null, null, null, null, null, 'm-sf-1', 2),
('m-qf-3', 'men', 'Quarter-Final', '2026-08-21', 'Fri 21 Aug', '12:20 PM', false, null, null, null, null, null, null, 'm-sf-2', 1),
('m-qf-4', 'men', 'Quarter-Final', '2026-08-21', 'Fri 21 Aug', '12:30 PM', false, null, null, null, null, null, null, 'm-sf-2', 2),
('m-r16-1', 'men', 'Round of 16', '2026-08-20', 'Thu 20 Aug', '11:00 AM', false, 'K. Danushan', 1, -1, 'Omar Mizran', 16, 11, 'm-qf-1', 1),
('m-r16-2', 'men', 'Round of 16', '2026-08-20', 'Thu 20 Aug', '11:10 AM', false, 'Levon Niyarepola', 8, 5, 'Nishantha Perera', 9, 7, 'm-qf-1', 2),
('m-r16-3', 'men', 'Round of 16', '2026-08-20', 'Thu 20 Aug', '11:20 AM', false, 'Mahela Jayawardena', 4, 6, 'Romesh Abhayaratne', 13, 9, 'm-qf-2', 1),
('m-r16-4', 'men', 'Round of 16', '2026-08-20', 'Thu 20 Aug', '11:30 AM', false, 'Husni Uwise', 5, 1, 'Rusi Captain', 12, -2, 'm-qf-2', 2),
('m-r16-5', 'men', 'Round of 16', '2026-08-20', 'Thu 20 Aug', '11:40 AM', false, 'Sachin De Silva', 2, 0, 'Sheron Fernando', 15, 8, 'm-qf-3', 1),
('m-r16-6', 'men', 'Round of 16', '2026-08-20', 'Thu 20 Aug', '11:50 AM', false, 'Adam Fernando', 7, 4, 'Vinuda Weerasinghe', 10, 4, 'm-qf-3', 2),
('m-r16-7', 'men', 'Round of 16', '2026-08-20', 'Thu 20 Aug', '12:00 PM', false, 'Kaiyan Johnpillai', 3, 3, 'Murad Ismail', 14, 7, 'm-qf-4', 1),
('m-r16-8', 'men', 'Round of 16', '2026-08-20', 'Thu 20 Aug', '12:10 PM', false, 'Suhayb Sangani', 6, 6, 'Kushal Johnpillai', 11, 4, 'm-qf-4', 2),
('ls-final', 'silver', 'Final', '2026-08-23', 'Sun 23 Aug', '8:30 AM', false, null, null, null, null, null, null, null, null),
('ls-sf-1', 'silver', 'Semi-Final', '2026-08-22', 'Sat 22 Aug', '1:20 PM', false, null, null, null, null, null, null, 'ls-final', 1),
('ls-sf-2', 'silver', 'Semi-Final', '2026-08-22', 'Sat 22 Aug', '1:30 PM', false, null, null, null, null, null, null, 'ls-final', 2),
('ls-bye', 'silver', 'Quarter-Final', '2026-08-21', 'Fri 21 Aug', 'Bye', true, 'Kayla Perera', 1, 1, null, null, null, 'ls-sf-1', 1),
('ls-qf-1', 'silver', 'Quarter-Final', '2026-08-21', 'Fri 21 Aug', '12:50 PM', false, 'Anouk Chitty', 4, 8, 'Jade Jiggens', 5, 11, 'ls-sf-1', 2),
('ls-qf-2', 'silver', 'Quarter-Final', '2026-08-21', 'Fri 21 Aug', '1:00 PM', false, 'Keya Abhayaratne', 2, 10, 'Sanduni Wanasinghe', 7, 19, 'ls-sf-2', 1),
('ls-qf-3', 'silver', 'Quarter-Final', '2026-08-21', 'Fri 21 Aug', '1:10 PM', false, 'Kaitlyn Norton', 3, 18, 'Tiru Jesudasan', 6, 19, 'ls-sf-2', 2),
('lb-final', 'bronze', 'Final', '2026-08-22', 'Sat 22 Aug', 'TBD', false, null, null, null, null, null, null, null, null),
('lb-sf-1', 'bronze', 'Semi-Final', '2026-08-21', 'Fri 21 Aug', '1:40 PM', false, null, null, null, null, null, null, 'lb-final', 1),
('lb-sf-2', 'bronze', 'Semi-Final', '2026-08-21', 'Fri 21 Aug', '1:50 PM', false, null, null, null, null, null, null, 'lb-final', 2),
('lb-qf-1', 'bronze', 'Quarter-Final', '2026-08-20', 'Thu 20 Aug', '12:40 PM', false, 'Fran De Mel', 1, 32, 'Dinoo De Mel', 8, 30, 'lb-sf-1', 1),
('lb-qf-2', 'bronze', 'Quarter-Final', '2026-08-20', 'Thu 20 Aug', '12:50 PM', false, 'Mrs. Manori Jayakody', 4, 27, 'Gnei Jehan Lye', 5, 28, 'lb-sf-1', 2),
('lb-qf-3', 'bronze', 'Quarter-Final', '2026-08-20', 'Thu 20 Aug', '1:00 PM', false, 'Viv Fowler-Watt', 2, 23, 'Dilini Hennayake', 7, 32, 'lb-sf-2', 1),
('lb-qf-4', 'bronze', 'Quarter-Final', '2026-08-20', 'Thu 20 Aug', '1:10 PM', false, 'Mavali Weerasinghe', 3, 31, 'Deepani Gamage', 6, 27, 'lb-sf-2', 2);