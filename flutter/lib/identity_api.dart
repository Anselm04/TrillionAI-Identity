import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:supabase_flutter/supabase_flutter.dart';
import 'session_continuity.dart';

const apiUrl = String.fromEnvironment('IDENTITY_API_URL',
    defaultValue: 'http://10.0.2.2:3000');

class IdentityRequestException implements Exception {
  IdentityRequestException(this.status, this.error, this.data);
  final int status;
  final String error;
  final Map<String, dynamic> data;
  @override String toString() => error;
}

class IdentityApi {
  IdentityApi(this.client);
  final SupabaseClient client;

  /// Unauthenticated endpoints only; never attaches an existing session token.
  Future<Map<String, dynamic>> publicPost(String path, Object body) async {
    const allowedPaths = {'/auth/passwordless/email'};
    if (!allowedPaths.contains(path)) throw ArgumentError('Unsupported public API path');
    final base = Uri.parse(apiUrl);
    if (base.scheme != 'https' &&
        !(base.scheme == 'http' &&
          const ['localhost', '127.0.0.1', '10.0.2.2'].contains(base.host))) {
      throw StateError('Identity API requires HTTPS outside local development.');
    }
    if (base.userInfo.isNotEmpty || base.hasQuery || base.hasFragment ||
        base.host.isEmpty || (base.path.isNotEmpty && base.path != '/')) {
      throw StateError('Invalid Identity API base URL.');
    }
    final target = base.replace(path: path, query: null, fragment: null);
    if (target.scheme != base.scheme || target.host != base.host ||
        target.port != base.port) {
      throw StateError('Cross-origin Identity API request rejected.');
    }
    final req = http.Request('POST', target);
    req.followRedirects = false;
    req.headers['Content-Type'] = 'application/json';
    req.body = jsonEncode(body);
    final response = await http.Response.fromStream(
      await req.send().timeout(const Duration(seconds: 20)));
    Map<String, dynamic> data = {};
    try {
      final decoded = jsonDecode(response.body);
      if (decoded is Map<String, dynamic>) data = decoded;
    } catch (_) {
      if (response.statusCode >= 200 && response.statusCode < 300) {
        throw StateError('Invalid identity API response.');
      }
    }
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw IdentityRequestException(response.statusCode,
        data['error']?.toString() ?? 'Request failed', data);
    }
    if (data.isEmpty) throw StateError('Invalid identity API response.');
    return data;
  }

  Future<Map<String, dynamic>> request(String method, String path,
      [Object? body]) async {
    final started = client.auth.currentSession;
    final token = started?.accessToken;
    if (token == null) throw StateError('Please sign in.');
    final base = Uri.parse(apiUrl);
    if (base.scheme != 'https' &&
        !(base.scheme == 'http' &&
          const ['localhost', '127.0.0.1', '10.0.2.2'].contains(base.host))) {
      throw StateError('Identity API requires HTTPS outside local development.');
    }
    if (base.userInfo.isNotEmpty || base.hasQuery || base.hasFragment ||
        base.host.isEmpty || (base.path.isNotEmpty && base.path != '/')) {
      throw StateError('Invalid Identity API base URL.');
    }
    // Treat the API path as a relative route, never as a second URL or
    // a path that can be normalised outside the intended endpoint.
    if (!path.startsWith('/') || path.startsWith('//') ||
        path.contains('?') || path.contains('#') || path.contains('\\\\') ||
        path.runes.any((code) => code < 0x20 || code == 0x7f)) {
      throw ArgumentError('Invalid API path');
    }
    for (final segment in path.substring(1).split('/')) {
      String decoded;
      try {
        decoded = Uri.decodeComponent(segment);
      } on FormatException {
        throw ArgumentError('Invalid API path encoding');
      }
      if (decoded == '.' || decoded == '..' ||
          decoded.contains('/') || decoded.contains('\\\\') ||
          decoded.runes.any((code) => code < 0x20 || code == 0x7f)) {
        throw ArgumentError('Unsafe API path segment');
      }
    }
    final target = base.replace(path: path, query: null, fragment: null);
    if (target.scheme != base.scheme || target.host != base.host ||
        target.port != base.port) {
      throw StateError('Cross-origin Identity API request rejected.');
    }
    final req = http.Request(method, target);
    req.followRedirects = false;
    req.headers.addAll({
      'Authorization': 'Bearer $token',
      'Content-Type': 'application/json',
    });
    if (body != null) req.body = jsonEncode(body);
    final response = await http.Response.fromStream(
        await req.send().timeout(const Duration(seconds: 20)));
    // Never parse or expose a response from a superseded authentication session.
    // A logout or account switch can occur while the HTTP request is in flight.
    final latest = client.auth.currentSession;
    if (!sameIdentitySession(token, started?.user.id,
        latest?.accessToken, latest?.user.id)) {
      throw StateError('Session changed. Please retry.');
    }
    Map<String, dynamic> data;
    try {
      if (response.statusCode == 204 && response.body.trim().isEmpty) {
        data = <String, dynamic>{};
      } else {
        final decoded = jsonDecode(response.body);
        if (decoded is! Map<String, dynamic>) {
          throw const FormatException('Expected JSON object');
        }
        data = decoded;
      }
    } on FormatException {
      if (response.statusCode >= 200 && response.statusCode < 300) {
        throw StateError('Invalid identity API response.');
      }
      data = <String, dynamic>{};
    }
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw IdentityRequestException(response.statusCode,
        data['error']?.toString() ?? 'Request failed', data);
    }
    return data;
  }
}
