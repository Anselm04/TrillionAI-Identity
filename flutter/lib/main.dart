import 'developer_applications.dart';
import 'team_administration.dart';
import 'dart:async';
import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:qr_flutter/qr_flutter.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'identity_api.dart';
import 'account_operation_generation.dart';
import 'organisation_invitations.dart';
import 'validation.dart';
import 'mfa_factor_selection.dart';

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
  final currentPassword = TextEditingController();
  final confirm = TextEditingController();
  final code = TextEditingController();
  final displayName = TextEditingController();
  final newEmail = TextEditingController();
  final deletePassword = TextEditingController();
  final deleteConfirmation = TextEditingController();
  late StreamSubscription<AuthState> changes;
  SupabaseClient get supabase => Supabase.instance.client;
  IdentityApi get api => IdentityApi(supabase);
  bool busy = false;
  final accountOperations = AccountOperationGeneration();
  int? operationTicket;
  bool needsMfa = false;
  String page = 'signin';
  String message = '';
  String? factorId;
  List<String> verifiedFactorIds = [];
  String? accountRole;
  String? enrollId;
  String? qr;
  String? secret;
  List<dynamic>? subscriptions;
  List<Map<String,dynamic>>? accountSessions;
  final passwordlessCode=TextEditingController();
  String? passwordlessEmail;

  @override
  void initState() {
    super.initState();
    changes = supabase.auth.onAuthStateChange.listen((state) {
      if (state.event == AuthChangeEvent.signedIn ||
          state.event == AuthChangeEvent.signedOut) {
        accountOperations.invalidate();
        operationTicket = null;
        busy = false;
        subscriptions = null;
        accountSessions = null;
      }
      if (state.event == AuthChangeEvent.passwordRecovery) page = 'reset';
      if (state.event == AuthChangeEvent.signedOut) {
        page = 'signin'; needsMfa = false; factorId = null; verifiedFactorIds = []; accountRole = null;
        enrollId = null; qr = null; secret = null; subscriptions = null; accountSessions = null; passwordlessEmail=null; passwordlessCode.clear();
        for (final controller in [password,currentPassword,confirm,code,displayName,newEmail,deletePassword,deleteConfirmation]) { controller.clear(); }
      }
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
      if (mounted) setState(() { needsMfa = false; factorId = null; verifiedFactorIds = []; accountRole = null; });
      return;
    }
    try {
      final level = supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      final factors = await supabase.auth.mfa.listFactors();
      final totp = factors.totp.where((f) => f.status == FactorStatus.verified).toList();
      final ids = totp.map((factor) => factor.id).toSet().toList();
      final pending = ids.isNotEmpty &&
        level.currentLevel != AuthenticatorAssuranceLevels.aal2;
      if (mounted) setState(() {
        factorId = chooseVerifiedFactor(ids, factorId);
        verifiedFactorIds = ids;
        needsMfa = pending;
      });
      if (!pending) {
        try {
          final me = await api.request('GET', '/me');
          if (mounted) setState(() => accountRole = me['role'] as String?);
        } catch (_) {
          if (mounted) setState(() => accountRole = null);
        }
      }
    } catch (_) {
      if (mounted) setState(() => message = 'MFA check unavailable. Please retry.');
    }
  }

  Future<void> perform(Future<void> Function() operation) async {
    final ticket = accountOperations.begin();
    if (ticket == null || !mounted) return;
    operationTicket = ticket;
    setState(() { busy = true; message = ''; });
    try {
      await operation();
    } on AuthException catch (e) {
      if (mounted && accountOperations.isCurrent(ticket)) {
        setState(() => message = e.message);
      }
    } catch (e) {
      if (mounted && accountOperations.isCurrent(ticket)) {
        setState(() => message = e.toString());
      }
    } finally {
      if (accountOperations.finish(ticket)) {
        operationTicket = null;
        if (mounted) setState(() => busy = false);
      }
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
    if (password.text.length < 12 || password.text.length > 128 || password.text != confirm.text) {
      throw StateError('Passwords must match and contain 12 or more characters.');
    }
    if (page == 'reset') {
      await supabase.auth.updateUser(UserAttributes(password: password.text));
      await supabase.auth.signOut(scope: SignOutScope.global);
    } else {
      if (currentPassword.text.isEmpty) throw StateError('Enter your current password.');
      final changed = await api.request('POST', '/auth/change-password', {
        'current_password': currentPassword.text, 'new_password': password.text,
      });
      if (changed['updated'] != true) throw StateError('Password change was not confirmed.');
      await supabase.auth.signOut(scope: SignOutScope.local);
    }
    password.clear(); confirm.clear(); currentPassword.clear();
    setState(() { page = 'signin'; message = 'Password updated.'; });
  });

  Future<void> stepUpOwner() => perform(() async {
    final id = factorId;
    if (id == null || accountRole != 'owner') throw StateError('Owner MFA not configured.');
    await supabase.auth.mfa.challengeAndVerify(factorId: id, code: code.text.trim());
    code.clear();
    final verified = await api.request('GET', '/owner/ping');
    if (verified['ok'] != true) throw StateError('Privileged access not confirmed.');
    setState(() => message = 'Fresh owner verification accepted.');
  });

  Future<void> startMfa() => perform(() async {
    final level = supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (!canEnrollBackupFactor(verifiedFactorIds.isNotEmpty,
        level.currentLevel == AuthenticatorAssuranceLevels.aal2)) {
      throw StateError('Verify an existing authenticator before adding a backup.');
    }
    final r = await supabase.auth.mfa.enroll(
      factorType: FactorType.totp,
      friendlyName: verifiedFactorIds.isEmpty ? 'TrillionAI Identity' : 'TrillionAI backup authenticator');
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

  Future<void> changeEmail() => perform(() async {
    final address = newEmail.text.trim();
    if (!address.contains('@')) throw StateError('Enter a valid new email.');
    await supabase.auth.updateUser(UserAttributes(email: address),
      emailRedirectTo: redirectUrl.isEmpty ? null : redirectUrl);
    setState(() => message = 'Confirm the change using your verification emails.');
  });

  Future<void> disableMfa() => perform(() async {
    if (accountRole == 'owner' || accountRole == 'admin') {
      throw StateError('Privileged authenticator removal requires a separate security-reviewed process.');
    }
    final id = factorId;
    if (id == null) return;
    final approved = await showDialog<bool>(context: context, builder: (ctx) =>
      AlertDialog(title: const Text('Remove authenticator?'),
        content: const Text('This reduces your account protection. Owner accounts should keep MFA enabled.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Keep')),
          TextButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Remove')),
        ]));
    if (approved != true) return;
    await supabase.auth.mfa.unenroll(id);
    await supabase.auth.refreshSession();
    await checkMfa();
  });

  Future<void> saveProfile() => perform(() async {
    final ticket = operationTicket!;
    final name = displayName.text.trim();
    await api.request('PATCH', '/account/profile', {'display_name': name});
    if (mounted && accountOperations.isCurrent(ticket)) {
      setState(() => message = 'Profile saved.');
    }
  });

  Future<void> listSubscriptions() => perform(() async {
    final ticket = operationTicket!;
    final result = await api.request('GET', '/account/subscriptions');
    if (!mounted || !accountOperations.isCurrent(ticket)) return;
    final rows = result['subscriptions'];
    if (rows is! List<dynamic>) throw StateError('Invalid subscriptions response.');
    setState(() => subscriptions = rows);
  });

  Future<void> cancelSubscription(String id) => perform(() async {
    final ticket = operationTicket!;
    final result = await api.request('POST',
      '/account/subscriptions/' + Uri.encodeComponent(id) + '/cancel');
    if (!mounted || !accountOperations.isCurrent(ticket)) return;
    if (result['cancelled'] != true) throw StateError('Cancellation not confirmed.');
    setState(() { subscriptions = null; message = 'Cancellation confirmed. Refresh subscriptions to verify status.'; });
  });

  Future<void> exportData() => perform(() async {
    final data = await api.request('GET', '/account/export');
    await Clipboard.setData(ClipboardData(
      text: const JsonEncoder.withIndent('  ').convert(data)));
    setState(() => message = 'Data copied. Save the export securely.');
  });

  Future<void> deleteAccount() => perform(() async {
    final ticket = operationTicket!;
    if (deletePassword.text.isEmpty || deleteConfirmation.text != 'DELETE') {
      throw StateError('Enter current password and type DELETE to confirm.');
    }
    Map<String, dynamic> result;
    try {
      result = await api.request('DELETE', '/account',
        {'password': deletePassword.text, 'confirm': 'DELETE'});
    } on IdentityRequestException catch (error) {
      if (error.status != 409 ||
          error.error != 'store_subscription_needs_cancellation') rethrow;
      if (!mounted || !accountOperations.isCurrent(ticket)) return;
      final urls = (error.data['manageUrls'] as List<dynamic>? ?? [])
          .whereType<String>().where((url) => url.isNotEmpty).join('\\n');
      final confirmed = await showDialog<bool>(context: context, builder: (ctx) =>
        AlertDialog(title: const Text('Store subscription warning'),
          content: Text('Deleting your account does NOT cancel Apple/Google subscriptions. '
            'Cancel them through your app store.\\n$urls\\n\\nDelete the account anyway?'),
          actions: [
            TextButton(onPressed: () => Navigator.pop(ctx, false),
              child: const Text('Keep account')),
            TextButton(onPressed: () => Navigator.pop(ctx, true),
              child: const Text('Delete anyway')),
          ]));
      if (confirmed != true || !mounted || !accountOperations.isCurrent(ticket)) return;
      result = await api.request('DELETE', '/account', {
        'password': deletePassword.text, 'confirm': 'DELETE',
        'acknowledge_store_subscriptions': true,
      });
    }
    if (!mounted || !accountOperations.isCurrent(ticket)) return;
    if (result['deleted'] != true) throw StateError('Deletion not confirmed.');
    await supabase.auth.signOut(scope: SignOutScope.local);
    if (mounted && accountOperations.isCurrent(ticket)) {
      setState(() => message = 'Account deletion confirmed.');
    }
  });

  Widget field(String label, TextEditingController controller,
      {bool obscured = false}) => Padding(
    padding: const EdgeInsets.symmetric(vertical: 8),
    child: TextField(controller: controller, obscureText: obscured,
      decoration: InputDecoration(labelText: label, border: const OutlineInputBorder())),
  );

  Future<void> requestPasswordless() => perform(() async {
    final address=email.text.trim().toLowerCase();
    if(!address.contains('@'))throw StateError('Enter a valid email.');
    try {
      await supabase.auth.signInWithOtp(email:address,shouldCreateUser:false,
        emailRedirectTo:redirectUrl.isEmpty?null:redirectUrl);
    } on AuthException catch(e) {
      if(e.statusCode=='429'||(int.tryParse(e.statusCode??'')??500)>=500)rethrow;
    }
    if(mounted)setState((){passwordlessEmail=address;passwordlessCode.clear();message='If eligible, check your email for a sign-in link or code.';});
  });
  Future<void> verifyPasswordless() => perform(() async {
    final address=passwordlessEmail;
    if(address==null||address!=email.text.trim().toLowerCase())throw StateError('Request a code for this address first.');
    final value=passwordlessCode.text.trim();
    if (!RegExp(r'^[0-9]{6,10}$').hasMatch(value)) {
      throw StateError('Enter a valid email code.');
    }
    await supabase.auth.verifyOTP(email: address, token: value, type: OtpType.email);
    passwordlessCode.clear();
    if (mounted) setState(() => passwordlessEmail = null);
    await checkMfa();
  });

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
    if(page=='signin') ...[
      OutlinedButton(onPressed:busy?null:requestPasswordless,child:const Text('Send passwordless sign-in email')),
      if(passwordlessEmail!=null)...[
        field('Email code (if included)',passwordlessCode),
        OutlinedButton(onPressed:busy?null:verifyPasswordless,child:const Text('Verify email code')),
      ],
    ],
    Wrap(children: [
      TextButton(onPressed: () => setState(() => page = 'signup'), child: const Text('Create account')),
      TextButton(onPressed: () => setState(() => page = 'signin'), child: const Text('Sign in')),
      TextButton(onPressed: () => setState(() => page = 'forgot'), child: const Text('Forgot password')),
      TextButton(onPressed: () => setState(() => page = 'resend'), child: const Text('Resend verification')),
    ]),
  ]);

  Future<void> reportLostAuthenticators() => perform(() async {
    final response = await api.request('POST', '/account/mfa/recovery-request', {});
    if (response['requested'] != true) {
      throw StateError('Recovery intake was not confirmed.');
    }
    if (mounted) setState(() =>
      message = 'Lost-factor request recorded. Your account remains protected; MFA was not reset.');
  });

  Widget mfaForm() => Column(children: [
    const Text('Enter the six-digit code from your authenticator app.'),
    if (verifiedFactorIds.length > 1)
      DropdownButton<String>(
        value: factorId,
        isExpanded: true,
        items: [
          for (var index = 0; index < verifiedFactorIds.length; index++)
            DropdownMenuItem<String>(
              value: verifiedFactorIds[index],
              child: Text('Authenticator ${index + 1}')),
        ],
        onChanged: busy ? null : (id) => setState(() { factorId = id; code.clear(); }),
      ),
    field('Code', code),
    FilledButton(onPressed: busy || factorId == null ? null : () => verifyMfa(factorId!),
      child: const Text('Verify authenticator')),
    const Text('Use your backup authenticator if the primary device is lost. Password recovery does not disable MFA.'),
    OutlinedButton(onPressed: busy ? null : reportLostAuthenticators,
      child: const Text('I lost access to every authenticator')),
    const Text('This records a security-review request only. It does not unlock the account or reset MFA.'),
    TextButton(onPressed: () => perform(() async {
      await supabase.auth.signOut(); await checkMfa();
    }), child: const Text('Sign out')),
  ]);

  Future<void> revokeSessions(SignOutScope scope) => perform(() async {
    final approved = await showDialog<bool>(context: context, builder: (ctx) =>
      AlertDialog(title: const Text('Sign out devices?'),
        content: Text(scope == SignOutScope.others
          ? 'All other devices will be signed out. This device stays signed in.'
          : 'All devices, including this one, will be signed out.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
          TextButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Sign out')),
        ]));
    if (approved != true || !mounted) return;
    await supabase.auth.signOut(scope: scope);
    if (scope == SignOutScope.others && mounted) {
      setState(() { accountSessions = null; message = 'Other sessions signed out.'; });
    }
  });

  Future<void> loadAccountSessions() => perform(() async {
    final userId = supabase.auth.currentUser?.id;
    final result = await api.request('GET', '/account/sessions');
    final rows = result['sessions'];
    if (rows is! List) throw StateError('Invalid session response.');
    if (!mounted || userId == null || supabase.auth.currentUser?.id != userId) return;
    setState(() => accountSessions = rows.map((row) => Map<String,dynamic>.from(row as Map)).toList());
  });

  Future<void> revokeAccountSession(String id) => perform(() async {
    final userId = supabase.auth.currentUser?.id;
    final approved = await showDialog<bool>(context: context, builder: (ctx) =>
      AlertDialog(title: const Text('Revoke this session?'), actions: [
        TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
        TextButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Revoke')),
      ]));
    if (approved != true || !mounted || userId == null || supabase.auth.currentUser?.id != userId) return;
    await api.request('DELETE', '/account/sessions/' + Uri.encodeComponent(id));
    if (!mounted || supabase.auth.currentUser?.id != userId) return;
    setState(() {
      accountSessions?.removeWhere((row) => row['id'] == id);
      message = 'Session revoked.';
    });
  });

  Widget accountForm() => Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
    Text(supabase.auth.currentUser?.email ?? 'Account'),
    const Divider(),
    TeamAdministration(key: ValueKey('team:'+ (supabase.auth.currentUser?.id ?? '')), api: api),
    DeveloperApplications(key: ValueKey('clients:'+ (supabase.auth.currentUser?.id ?? '')), api: api),
    const Divider(),
    OrganisationInvitations(key: ValueKey(supabase.auth.currentUser?.id), api: api),
    const Divider(),
    const Text('Session management'),
    OutlinedButton(onPressed: busy ? null : loadAccountSessions,
      child: const Text('View or refresh sessions')),
    if (accountSessions != null)
      for (final row in accountSessions!)
        ListTile(
          title: Text(row['current_session'] == true ? 'Current session' : 'Other session'),
          subtitle: Text(DateTime.tryParse(row['created_at']?.toString() ?? '')?.toLocal().toString() ?? 'Creation time unavailable'),
          trailing: row['current_session'] == true || row['id'] is! String ? null :
            TextButton(onPressed: busy ? null : () => revokeAccountSession(row['id'] as String), child: const Text('Revoke')),
        ),
    OutlinedButton(onPressed: busy ? null : () => revokeSessions(SignOutScope.others),
      child: const Text('Sign out other devices')),
    OutlinedButton(onPressed: busy ? null : () => revokeSessions(SignOutScope.global),
      child: const Text('Sign out all devices')),
    const Text('Revoked sessions cannot refresh. Existing access tokens may remain valid until expiry.'),
    const Divider(),
    if (enrollId == null)
      FilledButton(onPressed: busy ? null : startMfa,
        child: Text(verifiedFactorIds.isEmpty
            ? 'Enable authenticator MFA' : 'Enroll backup authenticator')),
    if (enrollId != null) ...[
      const Text('Scan with an authenticator app, or enter the secret:'),
      if (qr != null) SizedBox(height: 190, child: QrImageView(data: qr!)),
      if (secret != null) SelectableText(secret!),
      field('Code', code),
      FilledButton(onPressed: busy ? null : () => verifyMfa(enrollId!),
        child: const Text('Confirm authenticator')),
    ],
    if (factorId != null) ...[
      Text('${verifiedFactorIds.length} verified authenticator(s) enrolled.'),
      if (verifiedFactorIds.length == 1)
        const Text('Enroll a backup authenticator on a separate device. The provider does not issue recovery codes.'),
      if (verifiedFactorIds.length > 1)
        const Text('Either verified authenticator can complete MFA. Keep both devices secure.'),
      if (accountRole == 'customer')
        TextButton(onPressed: busy ? null : disableMfa,
          child: const Text('Remove selected authenticator')),
    ],
    if (accountRole == 'owner' && factorId != null) ...[
      const Divider(),
      const Text('Private owner verification'),
      const Text('A fresh authenticator challenge is required for privileged actions.'),
      field('Owner verification code', code),
      FilledButton(onPressed: busy ? null : stepUpOwner,
        child: const Text('Verify owner access')),
    ],
    const Divider(),
    field('Display name', displayName),
    FilledButton(onPressed: busy ? null : saveProfile, child: const Text('Save profile')),
    const Divider(),
    field('New email', newEmail),
    FilledButton(onPressed: busy ? null : changeEmail, child: const Text('Change email')),
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
    field('Current password', currentPassword, obscured: true),
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
      await supabase.auth.signOut(scope: SignOutScope.local);
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
          else if (accountRole == null) Column(children: [
            const Text('Checking verified account access.'),
            TextButton(onPressed: busy ? null : checkMfa, child: const Text('Retry')),
            TextButton(onPressed: busy ? null : () => perform(() async { await supabase.auth.signOut(scope: SignOutScope.local); }), child: const Text('Sign out')),
          ])
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
    accountOperations.invalidate();
    operationTicket = null;
    changes.cancel();
    passwordlessCode.dispose();
    for (final c in [email, password, currentPassword, confirm, code, displayName, newEmail, deletePassword, deleteConfirmation]) {
      c.dispose();
    }
    super.dispose();
  }
}
