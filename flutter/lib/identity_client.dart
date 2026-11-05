import 'dart:convert';
import 'package:flutter_appauth/flutter_appauth.dart';
import 'package:http/http.dart' as http;

/// Authorization Code + PKCE. Do not embed client secrets in mobile apps.
class IdentityClient {
  IdentityClient({
    required this.issuer,
    required this.clientId,
    required this.redirectUri,
    required this.apiBaseUrl,
    FlutterAppAuth? appAuth,
    http.Client? httpClient,
  }) : _appAuth = appAuth ?? const FlutterAppAuth(),
       _http = httpClient ?? http.Client();

  final String issuer, clientId, redirectUri, apiBaseUrl;
  final FlutterAppAuth _appAuth;
  final http.Client _http;
  String? _accessToken;

  bool get isAuthenticated => _accessToken != null;

  Future<bool> login() async {
    final response = await _appAuth.authorizeAndExchangeCode(
      AuthorizationTokenRequest(
        clientId, redirectUri,
        issuer: issuer,
        scopes: const ['openid', 'profile', 'email'],
      ),
    );
    _accessToken = response?.accessToken;
    return isAuthenticated;
  }

  Future<Map<String, dynamic>> me() async {
    final accessToken = _accessToken;
    if (accessToken == null) throw StateError('Not signed in');
    final response = await _http.get(
      Uri.parse('$apiBaseUrl/v1/me'),
      headers: {'Authorization': 'Bearer $accessToken'},
    );
    if (response.statusCode != 200) throw StateError('Identity API rejected request');
    return jsonDecode(response.body) as Map<String, dynamic>;
  }

  /// Local token disposal only: remote session revocation must be implemented separately.
  void clearLocalSession() => _accessToken = null;
}
