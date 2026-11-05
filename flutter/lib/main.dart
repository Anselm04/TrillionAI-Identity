import 'package:flutter/material.dart';
import 'identity_client.dart';

void main() => runApp(const IdentityApp());

class IdentityApp extends StatelessWidget {
  const IdentityApp({super.key});
  @override
  Widget build(BuildContext context) => MaterialApp(
    title: 'TrillionAI Identity',
    theme: ThemeData(colorScheme: ColorScheme.fromSeed(seedColor: const Color(0xFF3155A5)), useMaterial3: true),
    home: const WelcomePage(),
  );
}

class WelcomePage extends StatefulWidget {
  const WelcomePage({super.key});
  @override
  State<WelcomePage> createState() => _WelcomePageState();
}

class _WelcomePageState extends State<WelcomePage> {
  final client = IdentityClient(
    issuer: const String.fromEnvironment('OIDC_ISSUER'),
    clientId: const String.fromEnvironment('OIDC_CLIENT_ID'),
    redirectUri: const String.fromEnvironment('OIDC_REDIRECT_URI'),
    apiBaseUrl: const String.fromEnvironment('IDENTITY_API_URL'),
  );
  String message = 'Secure authentication for developers and customers';
  bool loading = false;

  Future<void> signIn() async {
    setState(() => loading = true);
    try {
      if (!await client.login()) throw StateError('Authentication cancelled');
      final user = await client.me();
      if (!mounted) return;
      setState(() => message = 'Signed in as ${user['subject']}');
    } catch (_) {
      if (mounted) setState(() => message = 'Sign-in could not be completed. Please retry.');
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }
  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('TrillionAI Identity')),
    body: Center(child: ConstrainedBox(
      constraints: const BoxConstraints(maxWidth: 420),
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          const Icon(Icons.verified_user_outlined, size: 72),
          const SizedBox(height: 20),
          Text('One secure identity foundation', style: Theme.of(context).textTheme.headlineSmall, textAlign: TextAlign.center),
          const SizedBox(height: 16),
          Text(message, textAlign: TextAlign.center),
          const SizedBox(height: 24),
          FilledButton(onPressed: loading ? null : signIn, child: Text(loading ? 'Signing in…' : 'Sign in / Create account')),
        ]),
      ),
    )),
  );
}
