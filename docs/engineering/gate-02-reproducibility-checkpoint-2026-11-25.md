# Gate 2 — reproducibility checkpoint (2026-11-25)

PR #37; verified run head `d046a12774cb4e78b29a50b2202a85d17d7fb8bd`; baseline source `ca74a61593c412c17295dd02f9a751fa62f9d83a`.

## Observed CI evidence

[Run 85 / ID 45509172718](https://github.com/Anselm04/TrillionAI-Identity/actions/runs/45509172718), pull_request event, completed success, exact head SHA confirmed from API. All five jobs and logs inspected.

| Job | ID | Result |
|---|---|---|
| backend | 138852135342 | 43 offline tests + 68 Vitest tests (13 files), typecheck and build passed |
| web | 138852135826 | 22 tests, typecheck and build passed |
| oauth-sdk | 138852135688 | 52 tests passed |
| flutter | 138852135820 | 17 tests passed; analysis successful with nonfatal deprecation infos |
| postgres-recovery | 138852135819 | Recovery migration/backfill/replay, session inventory cross-account denial/revocation and atomic audit rollback SQL assertions passed |

202 reported JS/Dart tests passed (43+68+22+52+17), plus SQL assertions. No live services tested. SQL harness does not qualify every migration history or entire deployed schema.

## Dependencies and toolchain

Backend manifest exact direct versions: supabase-js 2.57.0, cors 2.8.5, dotenv 16.5.0, express 4.21.2, express-rate-limit 8.0.1, helmet 8.1.0, zod 3.25.76; dev @types/cors 2.8.19, @types/express 4.17.23, @types/node 22.18.6, tsx 4.20.5, TypeScript 5.9.2, Vitest 3.2.4. Web: supabase-js 2.57.0, plugin-react 4.7.0, Vite 6.3.6, React/react-dom 19.1.1; dev @types/react 19.1.13, @types/react-dom 19.1.9, TypeScript 5.9.2. Direct pins do not lock transitive dependencies.

Flutter manifest Dart >=3.5.0 <4.0.0; supabase_flutter ^2.8.4, http ^1.3.0, qr_flutter ^4.1.0, flutter_lints ^5.0.0. Actual run resolved 2.18.3, 1.6.0, 4.1.0, 5.0.0 respectively. Flutter 3.50.1, Node 22.23.5, npm 10.9.9 and PostgreSQL 16.16 observed; exact Dart version not established from logs. CI selectors Node 22, Flutter stable, ubuntu-latest, postgres:16-alpine and action version tags are movable. Image digest and entire resolved npm graph not archived here.

## Clean installation and missing artifacts

Recursive tree confirms no backend/package-lock.json, web/package-lock.json, flutter/pubspec.lock or Android/iOS runner tree. Current npm install and flutter pub get succeeded but resolve dependencies at execution time. Direct npm ci in backend/web on this checkout is expected to fail due to absent npm lockfile (not executed here); flutter pub get can resolve anew and generate a lock. scripts/qualify-local.sh automatically generates npm locks before npm ci, then runs flutter pub get, so deliberately not executed under owner's no-generation restriction. Fully locked, clean repeat installation is NOT proven. Package registry downloads are needed on uncached runners; offline denotes no live product services, not an air-gapped build.

## Native build inventory (expected minimum, not generated)

Android: android/settings.gradle(.kts), root and app build.gradle(.kts), gradle.properties, Gradle wrapper scripts/config and applicable wrapper binary, app/src/main/AndroidManifest.xml, Kotlin/Java MainActivity, required app resources (launch theme/icons), application ID, SDK configuration and plugin integration. Generated local.properties/build outputs are not source requirements. Release signing configuration and credentials are separate, never commit secrets.

iOS: ios/Runner.xcodeproj/project.pbxproj and shared build scheme, Runner/Info.plist, AppDelegate (and scene delegate/config if required by chosen template), Flutter build configuration, launch screen/assets and native plugin integration. CocoaPods Podfile/lock if using CocoaPods, or applicable Swift Package Manager integration if using that path; generated workspace/config artifacts depend on toolchain. Bundle ID, deployment target, URL callbacks/associated domains as applicable, signing/provisioning and macOS/Xcode are needed for device/release builds. Do not invent IDs, callback schemes or signing credentials. Exact template filenames depend on pinned Flutter version. flutter build apk/appbundle and flutter build ios/ipa are not currently qualified: missing runners; iOS also requires macOS/Xcode. These commands were not run.

## Disposition

Gate 2 remains OPEN. Current CI passes but is not reproducible in the strict locked-toolchain/dependency sense. No lockfiles generated, native projects created, production files modified, new test runs manually dispatched, live tests, merges or deployments. Documentation-only commit may trigger existing offline CI. Further lockfile/native scaffolding changes require owner authorization.
