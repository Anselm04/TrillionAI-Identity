import 'package:flutter/material.dart';
import 'identity_api.dart';

class TeamAdministration extends StatefulWidget {
  const TeamAdministration({super.key, required this.api});
  final IdentityApi api;
  @override
  State<TeamAdministration> createState() => _TeamAdministrationState();
}
class _TeamAdministrationState extends State<TeamAdministration> {
  final name = TextEditingController();
  List<Map<String,dynamic>> organisations = [], members = [];
  String? selected, cursor;
  bool busy = false;
  String message = '';
  Map<String,dynamic>? get organisation {
    for (final row in organisations) { if (row['id'] == selected) return row; }
    return null;
  }
  Future<void> run(Future<void> Function() work) async {
    if (busy) return;
    setState(() { busy = true; message = ''; });
    try { await work(); }
    catch (e) { if (mounted) setState(() => message = e.toString()); }
    finally { if (mounted) setState(() => busy = false); }
  }
  List<Map<String,dynamic>> rows(dynamic value) {
    if (value is! List) throw StateError('Invalid server response');
    return value.map((r) => Map<String,dynamic>.from(r as Map)).toList();
  }
  Future<void> loadOrganisations() async {
    final result = await widget.api.request('GET','/v1/organisations');
    if (!mounted) return;
    final next = rows(result['organisations']);
    setState(() {
      organisations = next;
      if (!next.any((o) => o['id'] == selected)) { selected=null; members=[]; cursor=null; }
    });
  }
  Future<void> loadMembers({bool append=false}) async {
    final id=selected;
    if (id==null) return;
    final after=append?cursor:null;
    final path='/v1/organisations/'+Uri.encodeComponent(id)+'/members'+
      (after==null?'':'?after='+Uri.encodeComponent(after));
    final result=await widget.api.request('GET',path);
    if (!mounted || selected!=id) return;
    setState(() { members=[if(append)...members,...rows(result['members'])]; cursor=result['next_cursor'] as String?; });
  }
  Future<void> change(Map<String,dynamic> member,String role,String status,{bool remove=false}) => run(() async {
    final id=selected;
    if(id==null)return;
    final confirmed=await showDialog<bool>(context:context,builder:(ctx)=>AlertDialog(
      title:Text(remove?'Remove member?':'Change membership?'),
      actions:[TextButton(onPressed:()=>Navigator.pop(ctx,false),child:const Text('Cancel')),
        TextButton(onPressed:()=>Navigator.pop(ctx,true),child:const Text('Confirm'))]));
    if(confirmed!=true || !mounted || selected!=id)return;
    await widget.api.request(remove?'DELETE':'PATCH','/v1/organisations/'+Uri.encodeComponent(id)+'/members/'+Uri.encodeComponent(member['user_id'] as String),remove?null:{'role':role,'status':status});
    if(!mounted)return;
    await loadOrganisations();
    if(!mounted)return;
    if(selected!=null && organisation?['role']!='customer') { await loadMembers(); }
    else { setState(() { members=[];cursor=null; }); }
  });
  @override
  Widget build(BuildContext context) {
    final actor=organisation?['role'];
    return Column(crossAxisAlignment:CrossAxisAlignment.stretch,children:[
      const Text('Team administration'),
      TextField(controller:name,maxLength:200,decoration:const InputDecoration(labelText:'New organisation name')),
      FilledButton(onPressed:busy?null:()=>run(()async{
        if(name.text.trim().isEmpty)throw StateError('Enter an organisation name');
        await widget.api.request('POST','/v1/organisations',{'name':name.text.trim()});
        if(!mounted)return;name.clear();await loadOrganisations();
      }),child:const Text('Create organisation')),
      OutlinedButton(onPressed:busy?null:()=>run(loadOrganisations),child:const Text('Refresh organisations')),
      DropdownButton<String>(isExpanded:true,value:selected, hint:const Text('Select organisation'),
        items:organisations.map((o)=>DropdownMenuItem<String>(value:o['id'] as String,child:Text('${o['name']} (${o['role']})'))).toList(),
        onChanged:busy?null:(id){setState((){selected=id;members=[];cursor=null;});if(id!=null&&organisation?['role']!='customer')run(loadMembers);}),
      if(selected!=null) SelectableText('Organisation ID: $selected'),
      for(final member in members) ...[
        Text('${member['user_id']} — ${member['role']} — ${member['status']}'),
        if(actor=='owner'||(actor=='admin'&&['staff','customer'].contains(member['role']))) ...[
          if(member['status']!='invited') ...[
            DropdownButton<String>(value:member['role'] as String,items:(actor=='owner'?['owner','admin','staff','customer']:['staff','customer']).map((role)=>DropdownMenuItem(value:role,child:Text(role))).toList(),
              onChanged:busy?null:(role){if(role!=null)change(member,role,member['status'] as String);}),
            TextButton(onPressed:busy?null:()=>change(member,member['role'] as String,member['status']=='active'?'suspended':'active'),child:Text(member['status']=='active'?'Suspend':'Reactivate')),
          ],
          TextButton(onPressed:busy?null:()=>change(member,member['role'] as String,member['status'] as String,remove:true),child:const Text('Remove member')),
        ],
        const Divider(),
      ],
      if(cursor!=null)OutlinedButton(onPressed:busy?null:()=>run(()=>loadMembers(append:true)),child:const Text('Load more members')),
      if(message.isNotEmpty)Text(message),
    ]);
  }
  @override
  void dispose(){name.dispose();super.dispose();}
}
