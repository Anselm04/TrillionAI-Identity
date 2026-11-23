/// Select among provider-verified TOTP factors; never treats an ID as authorization.
String? chooseVerifiedFactor(List<String> ids, String? previous) {
  if (previous != null && ids.contains(previous)) return previous;
  return ids.isEmpty ? null : ids.first;
}
bool canEnrollBackupFactor(bool hasVerifiedFactor, bool isAal2) =>
    !hasVerifiedFactor || isAal2;
