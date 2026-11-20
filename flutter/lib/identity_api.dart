import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:supabase_flutter/supabase_flutter.dart';

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

  Future<Map<String, dynamic>> request(String method, String path,
      [Object? body]) async {
    final token = client.auth.currentSession?.accessToken;
    if (token == null) throw StateError('Please sign in.');
    final base = Uri.parse(apiUrl);
    if (base.scheme != 'https' && !(base.scheme == 'http' && const ['localhost','127.0.0.1','10.0.2.2'].contains(base.host))) {
      throw StateError('Identity API requires HTTPS outside local development.');
    }
    if (!path.startsWith('/') || path.startsWith('//')) throw ArgumentError('Invalid API path');
    final req = http.Request(method, Uri.parse('$apiUrl$path'));
    req.followRedirects = false;
    req.headers.addAll({
      'Authorization': 'Bearer $token',
      'Content-Type': 'application/json',
    });
    if (body != null) req.body = jsonEncode(body);
    final response = await http.Response.fromStream(
        await req.send().timeout(const Duration(seconds: 20)));
    final decoded = jsonDecode(response.body);
    final data = decoded is Map<String, dynamic>
        ? decoded : <String, dynamic>{};
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw IdentityRequestException(response.statusCode,
        data['error']?.toString() ?? 'Request failed', data);
    }
    return data;
  }
}
