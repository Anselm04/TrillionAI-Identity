String? registrationValidation(String email, String password, String confirmation) {
  final address = email.trim();
  if (!RegExp(r'^[^\s@]+@[^\s@]+\.[^\s@]+$').hasMatch(address)) {
    return 'Enter a valid email.';
  }
  if (password.length < 12 || password.length > 128) {
    return 'Use a password containing 12–128 characters.';
  }
  if (password != confirmation) return 'Passwords do not match.';
  return null;
}
