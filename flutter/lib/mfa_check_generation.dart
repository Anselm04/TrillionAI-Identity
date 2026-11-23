import 'session_continuity.dart';

/// UI-only guard for async MFA and role presentation checks.
/// The backend independently verifies all authorization and assurance.
class MfaCheckGeneration {
  int _revision = 0;

  int begin() => ++_revision;

  void invalidate() { _revision++; }

  bool isCurrent(int ticket, String? startedToken, String? startedUser,
      String? currentToken, String? currentUser) =>
    ticket > 0 && ticket == _revision &&
    sameIdentitySession(startedToken, startedUser, currentToken, currentUser);
}
