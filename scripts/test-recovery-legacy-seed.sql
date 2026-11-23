-- Transactional smoke coverage: old-data migration, repeat intake, closure,
-- new case generation and isolation of reviews/decisions, including RLS.
\set ON_ERROR_STOP on
-- Seed legacy history BEFORE applying the forward migration.
insert into auth.users(id) values
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
 ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'),
 ('cccccccc-cccc-4ccc-8ccc-cccccccccccc');
insert into auth.sessions(id,user_id) values
 ('11111111-1111-4111-8111-111111111111','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
 ('22222222-2222-4222-8222-222222222222','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'),
 ('33333333-3333-4333-8333-333333333333','cccccccc-cccc-4ccc-8ccc-cccccccccccc');
insert into public.identity_global_roles(user_id,role) values
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','owner'),
 ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','admin');
insert into public.identity_mfa_recovery_requests(user_id,requested_role,session_id,status)
values('cccccccc-cccc-4ccc-8ccc-cccccccccccc','customer',
 '33333333-3333-4333-8333-333333333333','pending');
insert into public.identity_mfa_recovery_reviews(case_user_id,reviewer_id,reviewer_session,
 review_outcome,evidence_method,evidence_reference_sha256)
values('cccccccc-cccc-4ccc-8ccc-cccccccccccc',
 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
 '22222222-2222-4222-8222-222222222222',
 'insufficient_evidence','in_person',repeat('a',64));
