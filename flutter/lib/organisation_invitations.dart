import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'identity_api.dart';

class OrganisationInvitations extends StatefulWidget {
  const OrganisationInvitations({super.key, required this.api});
  final IdentityApi api;
  @override
  State<OrganisationInvitations> createState() => _OrganisationInvitationsState();
}

class _OrganisationInvitationsState extends State<OrganisationInvitations> {
  final organisation = TextEditingController();
  final email = TextEditingController();
  final code = TextEditingController();
  String role = 'staff', message = '';
  String? issuedCode, issuedId, issuedOrg, expires;
  bool busy = false;
  Future<void> run(Future<void> Function() work) async {
    if (busy) return;
    setState(() { busy = true; message = ''; });
    try { await work(); }
    catch (e) { if (mounted) setState(() => message = e.toString()); }
    finally { if (mounted) setState(() => busy = false); }
  }
  Future<void> issue() => run(() async {
    final org = organisation.text.trim();
    setState(() { issuedCode = null; issuedId = null; issuedOrg = null; expires = null; });
    final result = await widget.api.request('POST',
      '/v1/organisations/' + Uri.encodeComponent(org) + '/invitations',
      {'email': email.text.trim(), 'role': role});
    if (!mounted) return;
    setState(() {
      issuedCode = result['token'] as String;
      issuedId = result['id'] as String;
      issuedOrg = org;
      expires = result['expiresAt'] as String;
      message = 'Share the invitation code privately with the intended recipient.';
    });
  });
  Future<void> accept() => run(() async {
    await widget.api.request('POST', '/v1/invitations/accept', {'token': code.text.trim()});
    if (!mounted) return;
    code.clear();
    setState(() => message = 'Invitation accepted.');
  });
  Future<void> revoke() => run(() async {
    if (issuedId == null || issuedOrg == null) return;
    await widget.api.request('DELETE', '/v1/organisations/' +
      Uri.encodeComponent(issuedOrg!) + '/invitations/' + Uri.encodeComponent(issuedId!));
    if (!mounted) return;
    setState(() { issuedCode = null; issuedId = null; message = 'Invitation revoked.'; });
  });
  @override
  Widget build(BuildContext context) => Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
    const Text('Organisation invitations'),
    TextField(controller: organisation, decoration: const InputDecoration(labelText: 'Organisation ID')),
    TextField(controller: email, keyboardType: TextInputType.emailAddress, decoration: const InputDecoration(labelText: 'Recipient email')),
    DropdownButton<String>(value: role, items: const [
      DropdownMenuItem(value:'staff',child:Text('Staff')),
      DropdownMenuItem(value:'customer',child:Text('Customer')),
      DropdownMenuItem(value:'admin',child:Text('Admin')),
    ], onChanged: busy ? null : (v) { if (v != null) setState(() => role = v); }),
    FilledButton(onPressed: busy ? null : issue, child: const Text('Create invitation')),
    if (issuedCode != null) ...[
      SelectableText(issuedCode!),
      Text('Expires: ${expires ?? ""}'),
      TextButton(onPressed: busy ? null : () => Clipboard.setData(ClipboardData(text:issuedCode!)), child: const Text('Copy private code')),
      TextButton(onPressed: busy ? null : revoke, child: const Text('Revoke invitation')),
      TextButton(onPressed: busy ? null : () => setState(() { issuedCode = null; issuedId = null; }), child: const Text('Hide code')),
    ],
    TextField(controller: code, autocorrect:false, enableSuggestions:false, decoration: const InputDecoration(labelText:'Invitation code')),
    FilledButton(onPressed: busy ? null : accept, child: const Text('Accept invitation')),
    if (message.isNotEmpty) Text(message),
  ]);
  @override
  void dispose() { organisation.dispose(); email.dispose(); code.dispose(); super.dispose(); }
}
