import 'dart:async';
import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:qr_flutter/qr_flutter.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'identity_api.dart';
import 'validation.dart';

const redirectUrl = String.fromEnvironment('AUTH_REDIRECT_URL');

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  const url = String.fromEnvironment('SUPABASE_URL');
  const key = String.fromEnvironment('SUPABASE_PUBLISHABLE_KEY');
  if (url.isEmpty || key.isEmpty) {
    throw StateError('Missing Supabase URL or publishable key');
  }
  await Supabase.initialize(url: url, anonKey: key);
  runApp(const MaterialApp(home: IdentityScreen()));
}

class IdentityScreen extends StatefulWidget {
  const IdentityScreen({super.key});
  @override
  State<IdentityScreen> createState() => _IdentityScreenState();
}

class _IdentityScreenState extends State<IdentityScreen> {
  final email = TextEditingController();
  final password = TextEditingController();
  final confirm = TextEditingController();
  final code = TextEditingController();
  final displayName = TextEditingController();
  final deletePassword = TextEditingController();
  final deleteConfirmation = TextEditingController();
  late StreamSubscription<AuthState> changes;
  SupabaseClient get supabase => Supabase.instance.client;
  IdentityApi get api => IdentityApi(supabase);
  bool busy = false;
  bool needsMfa = false;
  String page = 'signin';
  String message = '';
  String? factorId;
  String? enrollId;
  String? qr;
  String? secret;
  List<dynamic>? subscriptions;

  @override
  void initState() {
    super.initState();
    changes = supabase.auth.onAuthStateChange.listen((state) {
      if (state.event == AuthChangeEvent.passwordRecovery) page = 'reset';
      if (mounted) setState(() {});
      if (state.event == AuthChangeEvent.signedIn ||
          state.event == AuthChangeEvent.tokenRefreshed) {
        unawaited(checkMfa());
      }
    });
    unawaited(checkMfa());
  }

  Future<void> checkMfa() async {
    if (supabase.auth.currentSession == null) {
      if (mounted) setState(() { needsMfa = false; factorId = null; });
      return;
    }
    try {
      final level = supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      final factors = await supabase.auth.mfa.listFactors();
      final totp = factors.totp.where((f) => f.status == FactorStatus.verified).toList();
      if (mounted) setState(() {
        factorId = totp.isEmpty ? null : totp.first.id;
        needsMfa = factorId != null &&
          level.currentLevel != AuthenticatorAssuranceLevels.aal2;
      });
    } catch (_) {
      if (mounted) setState(() => message = 'MFA check unavailable. Please retry.');
    }
  }

  Future<void> perform(Future<void> Function() operation) async {
    if (busy) return;
    setState(() { busy = true; message = ''; });
    try {
      await operation();
    } on AuthException catch (e) {
      if (mounted) setState(() => message = e.message);
    } catch (e) {
      if (mounted) setState(() => message = e.toString());
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  Future<void> register() => perform(() async {
    final error = registrationValidation(email.text, password.text, confirm.text);
    if (error != null) throw StateError(error);
    await supabase.auth.signUp(email: email.text.trim(), password: password.text,
      emailRedirectTo: redirectUrl.isEmpty ? null : redirectUrl);
    setState(() => message = 'Check your email and click the confirmation link.');
  });

  Future<void> signin() => perform(() async {
    await supabase.auth.signInWithPassword(email: email.text.trim(),
      password: password.text);
    await checkMfa();
  });

  Future<void> resend() => perform(() async {
    await supabase.auth.resend(type: OtpType.signup, email: email.text.trim());
    setState(() => message = 'A new confirmation email has been requested.');
  });

  Future<void> forgot() => perform(() async {
    await supabase.auth.resetPasswordForEmail(email.text.trim(),
      redirectTo: redirectUrl.isEmpty ? null : redirectUrl);
    setState(() => message = 'If the address is registered, a reset email was requested.');
  });

  Future<void> savePassword() => perform(() async {
    if (password.text.length < 12 || password.text != confirm.text) {
      throw StateError('Passwords must match and contain 12 or more characters.');
    }
    await supabase.auth.updateUser(UserAttributes(password: password.text));
    await supabase.auth.signOut(scope: SignOutScope.global);
    password.clear(); confirm.clear();
    setState(() { page = 'signin'; message = 'Password updated.'; });
  });

  Future<void> startMfa() => perform(() async {
    final r = await supabase.auth.mfa.enroll(
      factorType: FactorType.totp, friendlyName: 'TrillionAI Identity');
    setState(() {
      enrollId = r.id;
      qr = r.totp?.uri;
      secret = r.totp?.secret;
    });
  });

  Future<void> verifyMfa(String id) => perform(() async {
    await supabase.auth.mfa.challengeAndVerify(factorId: id, code: code.text.trim());
    code.clear();
    setState(() { enrollId = null; qr = null; secret = null; });
    await checkMfa();
  });

  Future<void> saveProfile() => perform(() async {
    await api.request('PATCH', '/account/profile', {'display_name': displayName.text.trim()});
    setState(() => message = 'Profile saved.');
  });

  Future<void> listSubscriptions() => perform(() async {
    final result = await api.request('GET', '/account/subscriptions');
    setState(() => subscriptions = result['subscriptions'] as List<dynamic>);
  });

  Future<void> cancelSubscription(String id) => perform(() async {
    final result = await api.request('POST',
      '/account/subscriptions/' + Uri.encodeComponent(id) + '/cancel');
    if (result['cancelled'] != true) throw StateError('Cancellation not confirmed.');
    setState(() => message = 'Cancellation confirmed.');
  });

  Future<void> exportData() => perform(() async {
    final data = await api.request('GET', '/account/export');
    await Clipboard.setData(ClipboardData(
      text: const JsonEncoder.withIndent('  ').convert(data)));
    setState(() => message = 'Data copied. Save the export securely.');
  });

  Future<void> deleteAccount() => perform(() async {
    if (deletePassword.text.isEmpty || deleteConfirmation.text != 'DELETE') {
      throw StateError('Enter current password and type DELETE to confirm.');
    }
    final result = await api.request('DELETE', '/account',
      {'password': deletePassword.text, 'confirm': 'DELETE'});
    if (result['deleted'] != true) throw StateError('Deletion not confirmed.');
    await supabase.auth.signOut(scope: SignOutScope.local);
    setState(() => message = 'Account deletion confirmed.');
  });

  Widget field(String label, TextEditingController controller,
      {bool obscured = false}) => Padding(
    padding: const EdgeInsets.symmetric(vertical: 8),
    child: TextField(controller: controller, obscureText: obscured,
      decoration: InputDecoration(labelText: label, border: const OutlineInputBorder())),
  );

  Widget authForm() => Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
    Text(page == 'signup' ? 'Create account' : page == 'forgot'
      ? 'Forgot password' : page == 'resend' ? 'Resend verification' : 'Sign in',
      style: Theme.of(context).textTheme.headlineSmall),
    field('Email', email),
    if (page == 'signin' || page == 'signup') field('Password', password, obscured: true),
    if (page == 'signup') field('Confirm password', confirm, obscured: true),
    FilledButton(onPressed: busy ? null : page == 'signup' ? register :
      page == 'forgot' ? forgot : page == 'resend' ? resend : signin,
      child: Text(page == 'signup' ? 'Create account' : page == 'forgot'
        ? 'Send recovery email' : page == 'resend' ? 'Resend email' : 'Sign in')),
    Wrap(children: [
      TextButton(onPressed: () => setState(() => page = 'signup'), child: const Text('Create account')),
      TextButton(onPressed: () => setState(() => page = 'signin'), child: const Text('Sign in')),
      TextButton(onPressed: () => setState(() => page = 'forgot'), child: const Text('Forgot password')),
      TextButton(onPressed: () => setState(() => page = 'resend'), child: const Text('Resend verification')),
    ]),
  ]);

  Widget mfaForm() => Column(children: [
    const Text('Enter the six-digit code from your authenticator app.'),
    field('Code', code),
    FilledButton(onPressed: busy || factorId == null ? null : () => verifyMfa(factorId!),
      child: const Text('Verify authenticator')),
    TextButton(onPressed: () => perform(() async {
      await supabase.auth.signOut(); await checkMfa();
    }), child: const Text('Sign out')),
  ]);

  Widget accountForm() => Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
    Text(supabase.auth.currentUser?.email ?? 'Account'),
    const Divider(),
    if (factorId == null && enrollId == null)
      FilledButton(onPressed: busy ? null : startMfa,
        child: const Text('Enable authenticator MFA')),
    if (enrollId != null) ...[
      const Text('Scan with an authenticator app, or enter the secret:'),
      if (qr != null) SizedBox(height: 190, child: QrImageView(data: qr!)),
      if (secret != null) SelectableText(secret!),
      field('Code', code),
      FilledButton(onPressed: busy ? null : () => verifyMfa(enrollId!),
        child: const Text('Confirm authenticator')),
    ],
    if (factorId != null) const Text('Authenticator MFA enabled.'),
    const Divider(),
    field('Display name', displayName),
    FilledButton(onPressed: busy ? null : saveProfile, child: const Text('Save profile')),
    const Divider(),
    FilledButton(onPressed: busy ? null : listSubscriptions,
      child: const Text('Manage subscriptions')),
    if (subscriptions != null)
      for (final raw in subscriptions!)
        if (raw is Map<String, dynamic>)
          ListTile(
            title: Text(raw['plan']?.toString() ?? 'Subscription'),
            subtitle: Text(raw['status']?.toString() ?? ''),
            trailing: raw['store'] == 'direct' && raw['status'] != 'cancelled'
              ? TextButton(onPressed: busy ? null :
                  () => cancelSubscription(raw['id'].toString()),
                  child: const Text('Cancel')) : null,
          ),
    const Divider(),
    FilledButton(onPressed: busy ? null : exportData, child: const Text('Export my data')),
    const Divider(),
    const Text('Change password'),
    field('New password', password, obscured: true),
    field('Confirm new password', confirm, obscured: true),
    FilledButton(onPressed: busy ? null : savePassword, child: const Text('Change password')),
    const Divider(),
    const Text('Delete account (irreversible)'),
    const Text('Enter your CURRENT password and type DELETE into confirmation.'),
    field('Current password', deletePassword, obscured: true),
    field('Type DELETE', deleteConfirmation),
    FilledButton(onPressed: busy ? null : deleteAccount,
      style: FilledButton.styleFrom(backgroundColor: Colors.red),
      child: const Text('Delete my account')),
    const Divider(),
    FilledButton(onPressed: busy ? null : () => perform(() async {
      await supabase.auth.signOut(scope: SignOutScope.global);
      await checkMfa();
    }), child: const Text('Sign out')),
  ]);

  @override
  Widget build(BuildContext context) {
    final signedIn = supabase.auth.currentSession != null;
    return Scaffold(
      appBar: AppBar(title: const Text('TrillionAI Identity')),
      body: Center(child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 520),
        child: ListView(padding: const EdgeInsets.all(20), children: [
          if (!signedIn) authForm()
          else if (page == 'reset') Column(children: [
            const Text('Set new password'),
            field('New password', password, obscured: true),
            field('Confirm password', confirm, obscured: true),
            FilledButton(onPressed: busy ? null : savePassword,
              child: const Text('Save password')),
          ])
          else if (needsMfa) mfaForm()
          else accountForm(),
          if (busy) const LinearProgressIndicator(),
          if (message.isNotEmpty) Padding(
            padding: const EdgeInsets.only(top: 12),
            child: Text(message)),
        ]),
      )));
  }

  @override
  void dispose() {
    changes.cancel();
    for (final c in [email, password, confirm, code, displayName, deletePassword, deleteConfirmation]) {
      c.dispose();
    }
    super.dispose();
  }
}
