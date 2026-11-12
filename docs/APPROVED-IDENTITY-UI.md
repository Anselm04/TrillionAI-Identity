# TrillionAI Identity — Approved Interface Design Specification

**Status:** APPROVED DESIGN DIRECTION / LOCKED  
**Approved by:** Product owner, 2026-11-06 (Pacific/Auckland)  
**Applies to:** TrillionAI Identity standalone SaaS only  
**Design name:** **TrillionAI Identity Command Centre**  
**Source visual:** approved generated dashboard image in the originating design conversation. The screenshot is concept art, **not real operational data**.

## Design intent

Implement a distinctive, premium, purpose-built identity-and-access-management command centre for administrators, developers, and organisation owners. Match the approved screenshot's visual structure: dark navy high-tech atmosphere, glowing cyan and electric blue, restrained violet accents, accessible green/amber/red state colours, professional crisp type, a branded left sidebar, meaningful status cards, high-density yet legible dashboard content, and readable action buttons.

The screenshot's sample account counts, earnings, security posture, online status, provider connections, personal details, availability and timestamps are **illustrative placeholder values only**. Never hard-code them as if the service is functional. Each metric must come from verified, authorised backend data; display honest zero, unavailable, or not configured states otherwise.

## Global layout

- Desktop-first responsive application shell: persistent left navigation, top contextual title, search, notification centre, help, profile and organisation switcher.
- Sidebar branding: TrillionAI shield-and-key identity emblem, **TrillionAI Identity**, tagline **Secure Authentication · Identity · Access · Organisations**.
- Top page: **Identity Command Centre** with concise description of the independent multi-tenant SaaS platform.
- Layout uses consistent card borders, subdued gradients, modest luminous accents and purposeful whitespace. Avoid overwhelming neon and unnecessary decoration.
- Mobile: collapsible drawer, stacked cards, scrollable life-cycle flow and condensed tables. Meet keyboard, touch, screen-reader, colour-contrast and reduced-motion accessibility requirements.
- No product-wide admin controls or tenant-wide data should appear in customer self-service account pages.

## Locked navigation structure

1. Command Centre
2. Users & Accounts
3. Organisations & Teams
4. Applications & APIs
5. Authentication & MFA
6. Account Lifecycle
7. Security & Threats
8. Developer Portal
9. Billing & Subscriptions
10. Audit & Compliance
11. Settings

Each section must have an informative empty/loading/error state and honest permission-aware visibility. Do not render inaccessible actions merely because they appear in the concept design.

## Command Centre dashboard sections

### Top KPI row
- Total Accounts
- Active Sessions
- Verified Accounts
- Security Alerts
- Pending Verification
- API Requests (24h)
- Monthly Revenue (show currency/period clearly)

All cards show real scoped metrics, deltas only when comparative historical data exists, freshness indicator, tooltip explaining numerator and denominator, and drill-down navigation.

### Account Lifecycle visualization
A prominent connected, labelled and interactive flow:
**Register → Verify Email → Verify Phone (if required) → Configure MFA → Active Account → Manage / Recover**.

Each stage displays live aggregate stage counts, errors, stalled users and relevant operator actions. Account deletion/deactivation, session revocation and account recovery must be discoverable from the full lifecycle page. Never misrepresent optional verification as mandatory.

### System Health
Distinct health rows for Identity API, PostgreSQL, Redis, identity provider, email provider, SMS provider and Stripe, with last-checked time, dependency condition and incident drill-down. `Online` and uptime percentages require real probes and monitoring history, not successful application startup alone.

### Recent Activity
Scoped security/audit events with searchable action names, actor (privacy masked as appropriate), timestamps, outcomes, IP details only for authorized personnel and incident links. Never leak credentials, codes, raw tokens or sensitive event payloads.

### Authentication & Security
Security posture and individual capabilities (passwords, WebAuthn/passkeys, authenticator TOTP, SMS as lower-assurance, Google/Apple connections, step-up authentication). Only indicate `Enabled` or `Excellent` when verified policies and controls justify it. Surface specific remediations instead of marketing scores.

### Users by Status
Accessible segmented/donut presentation for active, pending verification, inactive, suspended and deleted states. Counts must be mutually intelligible and correctly defined; avoid adding deleted users to live-account totals without disclosure.

### Quick Actions
Add/invite users, invite to organisation, register application, manage MFA policies, inspect security alerts, open billing and subscriptions. Sensitive actions require adequate roles, MFA step-up, audit events and confirmations.

### Developer Portal shortcuts
API credentials, Flutter & Node.js SDKs, documentation, integration guides, usage and quotas. Credentials are never exposed in screenshots/logs; show newly created secrets only once, and provide rotation/revocation workflows.

## Design tokens (initial implementation values; refinable for accessibility)

- Canvas: `#050B1D`
- Sidebar: `#091329`
- Elevated panels: `#0D1934`
- Panel outlines: `#254579`
- Electric blue: `#3288FF`
- Cyan: `#31DBFF`
- Violet: `#A55CFF`
- Positive green: `#39D987`
- Warning amber: `#FFC857`
- Critical red: `#FF596B`
- Main text: `#F5F8FF`
- Muted text: `#AABCD9`

Use readable text labels and icons alongside state colours; colour alone must never convey security decisions. Typography: contemporary sans-serif with strong hierarchy and consistent numeric alignment.

## Separate experiences

- **Operator/admin console:** scope-bound telemetry, organisation/user administration, applications, security, audit, billing and developer operations.
- **Organisation owner/developer portal:** only their own tenants, team members, applications, integrations, quotas, invoices and security configuration.
- **End-user hosted authentication and account pages:** minimal, reassuring, branded welcome, registration, email/phone verification, MFA, passkeys, login, recovery, settings and account deletion; **not** the dense command centre.

## Security and acceptance requirements

- Strong tenancy boundaries must be enforced server-side; navigation or hidden buttons are not authorization.
- Screens, health states and KPIs must be backed by verifiable services and permission-scoped APIs.
- Account recovery and MFA configuration require phishing-resistant security paths for privileged operators.
- Provide full loading, empty, success, failure, timeout, retry, permission-denied and provider-outage states.
- No fictitious customers, revenue, operating status, uptime or provider success may be presented in production.
- Apply this design to Flutter implementation after security-critical lifecycle flows; evolve without deleting tested functionality.
- All integrations with other TrillionAI products remain expressly prohibited until separate approval.

## Implementation checklist

- [ ] Branded responsive Flutter app shell and navigation
- [ ] Theme tokens and reusable accessible component library
- [ ] Backend-authorised KPI service and dashboards
- [ ] Account lifecycle UI connected to real provider state
- [ ] System health probes and incident views
- [ ] Secure audit and suspicious-activity views
- [ ] Organisations, permission-aware users and settings
- [ ] Developer portal and integration documentation
- [ ] Tenant-scoped billing and verified revenue metrics
- [ ] Responsive, accessibility and end-to-end UI validation

**This is the approved visual target, not a statement of implementation or production readiness.**
