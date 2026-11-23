import 'dart:convert';

/// UI session continuity only; JWT claims are NOT authorization evidence.
final RegExp _uuid = RegExp(
  r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$',
  caseSensitive: false,
);

String? clientSessionId(String token) {
  try {
    final parts = token.split('.');
    if (parts.length != 3 || parts.any((part) => part.isEmpty)) return null;
    final decoded = utf8.decode(base64Url.decode(base64Url.normalize(parts[1])));
    final payload = jsonDecode(decoded);
    if (payload is! Map<String, dynamic>) return null;
    final id = payload['session_id'];
    return id is String && _uuid.hasMatch(id) ? id.toLowerCase() : null;
  } catch (_) {
    return null;
  }
}

/// Same Supabase session survives access-token refresh, but not re-login.
bool sameIdentitySession(String? oldToken, String? oldUser,
    String? newToken, String? newUser) {
  if (oldToken == null || newToken == null ||
      oldUser == null || newUser == null ||
      oldUser != newUser || !_uuid.hasMatch(oldUser)) return false;
  final oldId = clientSessionId(oldToken);
  return oldId != null && oldId == clientSessionId(newToken);
}
