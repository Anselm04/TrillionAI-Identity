import 'dart:convert';

/// Client UI continuity only. Never authorize against decoded JWT claims.
String? clientSessionId(String token) {
  try {
    final parts = token.split('.');
    if (parts.length != 3 || parts.any((part) => part.isEmpty)) return null;
    final json = jsonDecode(utf8.decode(base64Url.decode(base64Url.normalize(parts[1]))));
    if (json is! Map<String, dynamic>) return null;
    final id = json['session_id'];
    if (id is! String || !RegExp(
      r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$',
      caseSensitive: false).hasMatch(id)) return null;
    return id.toLowerCase();
  } catch (_) {
    return null;
  }
}

bool sameIdentitySession(String? oldToken, String? oldUser,
    String? newToken, String? newUser) {
  if (oldToken == null || newToken == null || oldUser == null ||
      newUser == null || oldUser != newUser || !RegExp(
      r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12},
      caseSensitive: false).hasMatch(oldUser)) return false;
  final oldId = clientSessionId(oldToken);
  return oldId != null && oldId == clientSessionId(newToken);
}
,
      caseSensitive: false).hasMatch(oldUser)) return false;
  final oldId = clientSessionId(oldToken);
  return oldId != null && oldId == clientSessionId(newToken);
}
