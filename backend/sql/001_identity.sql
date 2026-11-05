-- Tenant membership is derived server-side from the verified OIDC subject.
-- Never grant access based solely on caller-supplied organisation IDs or JWT role claims.
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE TABLE IF NOT EXISTS organisations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (length(name) BETWEEN 1 AND 200),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS memberships (
  organisation_id uuid NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  subject text NOT NULL CHECK (length(subject) BETWEEN 1 AND 255),
  role text NOT NULL CHECK (role IN ('owner','admin','staff','customer')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','invited','suspended')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (organisation_id, subject)
);
CREATE INDEX IF NOT EXISTS memberships_subject_active_idx ON memberships(subject) WHERE status = 'active';
CREATE TABLE IF NOT EXISTS security_audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid REFERENCES organisations(id) ON DELETE SET NULL,
  actor_subject text,
  action text NOT NULL,
  resource_id text,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS security_audit_org_date ON security_audit_events(organisation_id, occurred_at DESC);
REVOKE ALL ON organisations, memberships, security_audit_events FROM PUBLIC;
