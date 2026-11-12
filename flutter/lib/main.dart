import 'dart:async';

import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  const url = String.fromEnvironment('SUPABASE_URL');
  const key = String.fromEnvironment('SUPABASE_PUBLISHABLE_KEY');
  if (url.isEmpty || key.isEmpty) {
    throw StateError('Set SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY using --dart-define.');
  }
  await Supabase.initialize(url: url, anonKey: key);
  runApp(const IdentityApp());
}

class IdentityApp extends StatelessWidget {
  const IdentityApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'TrillionAI Identity',
      theme: ThemeData(useMaterial3: true, colorSchemeSeed: Colors.indigo),
      home: const IdentityHome(),
    );
  }
}

class IdentityHome extends StatefulWidget {
  const IdentityHome({super.key});

  @override
  State<IdentityHome> createState() => _IdentityHomeState();
}

class _IdentityHomeState extends State<IdentityHome> {
  final email = TextEditingController();
  final password = TextEditingController();
  final token = TextEditingController();
  String notice = '';
  bool busy = false;
  late final StreamSubscription<AuthState> authSubscription;

  @override
  void initState() {
    super.initState();
    authSubscription = Supabase.instance.client.auth.onAuthStateChange.listen((_) {
      if (mounted) setState(() {});
    });
  }

  SupabaseClient get client => Supabase.instance.client;

  Future<void> perform(Future<void> Function() action) async {
    setState(() { busy = true; notice = ''; });
    try {
      await action();
    } on AuthException catch (error) {
      if (mounted) setState(() => notice = error.message);
    } on FormatException catch (error) {
      if (mounted) setState(() => notice = error.message);
    } catch (_) {
      if (mounted) setState(() => notice = 'Request failed. Please try again.');
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  void dispose() {
    authSubscription.cancel();
    email.dispose();
    password.dispose();
    token.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final user = client.auth.currentUser;
    return Scaffold(
      appBar: AppBar(title: const Text('TrillionAI Identity')),
      body: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 440),
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: ListView(shrinkWrap: true, children: [
              Text(user == null ? 'Create account or sign in' : 'Account management',
                style: Theme.of(context).textTheme.headlineSmall),
              const SizedBox(height: 18),
              if (user == null) ...[
                TextField(controller: email, keyboardType: TextInputType.emailAddress,
                  autofillHints: const [AutofillHints.email], decoration: const InputDecoration(labelText: 'Email')),
                TextField(controller: password, obscureText: true,
                  autofillHints: const [AutofillHints.password], decoration: const InputDecoration(labelText: 'Password')),
                const SizedBox(height: 12),
                FilledButton(onPressed: busy ? null : () => perform(() async {
                  if (password.text.length < 8 || !email.text.contains('@')) {
                    throw const FormatException('Valid email and minimum 8-character password required');
                  }
                  await client.auth.signUp(email: email.text.trim(), password: password.text);
                  setState(() => notice = 'Check your email and open the confirmation link before signing in.');
                }), child: const Text('Create account')),
                OutlinedButton(onPressed: busy ? null : () => perform(() async {
                  await client.auth.signInWithPassword(email: email.text.trim(), password: password.text);
                  setState(() => notice = 'Signed in.');
                }), child: const Text('Sign in')),
                TextButton(onPressed: busy ? null : () => perform(() async {
                  await client.auth.resetPasswordForEmail(email.text.trim());
                  setState(() => notice = 'If an account exists, a recovery email has been requested.');
                }), child: const Text('Forgot password?')),
              ] else ...[
                Text('Signed in as ${user.email ?? 'account'}'),
                const SizedBox(height: 12),
                FilledButton(onPressed: busy ? null : () => perform(() async {
                  await client.auth.signOut(scope: SignOutScope.global);
                  setState(() => notice = 'Signed out.');
                }), child: const Text('Sign out of all sessions')),
                TextField(controller: password, obscureText: true,
                  decoration: const InputDecoration(labelText: 'New password')),
                OutlinedButton(onPressed: busy ? null : () => perform(() async {
                  if (password.text.length < 8) {
                    throw const FormatException('Password must have at least eight characters');
                  }
                  await client.auth.updateUser(UserAttributes(password: password.text));
                  setState(() => notice = 'Password update requested.');
                }), child: const Text('Change password')),
              ],
              const SizedBox(height: 16),
              if (busy) const LinearProgressIndicator(),
              if (notice.isNotEmpty) Text(notice),
            ]),
          ),
        ),
      ),
    );
  }
}
