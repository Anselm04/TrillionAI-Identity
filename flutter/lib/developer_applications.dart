import 'package:flutter/material.dart';
import 'identity_api.dart';

class DeveloperApplications extends StatefulWidget {
  const DeveloperApplications({super.key, required this.api});
  final IdentityApi api;
  @override State<DeveloperApplications> createState()=>_DeveloperApplicationsState();
}
class _DeveloperApplicationsState extends State<DeveloperApplications> {
  final name=TextEditingController(), redirects=TextEditingController();
  List<Map<String,dynamic>> orgs=[], clients=[];
  String? org, cursor;
  String kind='public', message='';
  bool busy=false;
  @override void dispose(){name.dispose();redirects.dispose();super.dispose();}
  String path(String id)=>'/v1/organisations/${Uri.encodeComponent(id)}/clients';
  List<Map<String,dynamic>> rows(dynamic value)=>(value as List).map((v)=>Map<String,dynamic>.from(v as Map)).toList();
  Future<void> run(Future<void> Function() action) async {
    if(busy||!mounted)return;
    setState((){busy=true;message='';});
    try{await action();}catch(e){if(mounted)setState(()=>message=e.toString());}
    finally{if(mounted)setState(()=>busy=false);}
  }
  Future<void> loadOrgs() async {
    final r=await widget.api.request('GET','/v1/organisations');
    if(!mounted)return;
    setState((){orgs=rows(r['organisations']).where((o)=>['owner','admin'].contains(o['role'])).toList();org=null;clients=[];cursor=null;});
  }
  Future<void> load(String id,{String? after}) async {
    final r=await widget.api.request('GET',path(id)+(after==null?'':'?after=${Uri.encodeComponent(after)}'));
    if(!mounted||org!=id)return;
    setState((){clients=after==null?rows(r['clients']):[...clients,...rows(r['clients'])];cursor=r['next_cursor'] as String?;});
  }
  Future<void> register() async {
    final id=org;
    if(id==null||name.text.trim().isEmpty)return;
    final urls=redirects.text.split(RegExp(r'\r?\n')).map((v)=>v.trim()).where((v)=>v.isNotEmpty).toList();
    if(urls.isEmpty)throw StateError('Enter at least one HTTPS callback URL.');
    await widget.api.request('POST',path(id),{'name':name.text.trim(),'client_type':kind,'redirect_uris':urls});
    if(!mounted)return;
    name.clear();redirects.clear();await load(id);
    if(mounted)setState(()=>message='Application registered.');
  }
  Future<void> revoke(String id,String client) async {
    await widget.api.request('DELETE','${path(id)}/${Uri.encodeComponent(client)}');
    if(mounted)await load(id);
  }
  @override Widget build(BuildContext context)=>Column(crossAxisAlignment:CrossAxisAlignment.stretch,children:[
    const Divider(),const Text('Developer applications',style:TextStyle(fontWeight:FontWeight.bold)),
    const Text('Manage registration metadata. OAuth sign-in is not yet available through this registry.'),
    OutlinedButton(onPressed:busy?null:()=>run(loadOrgs),child:const Text('Refresh organisations')),
    DropdownButton<String>(isExpanded:true,value:org,hint:const Text('Select organisation'),items:orgs.map((o)=>DropdownMenuItem<String>(value:o['id'] as String,child:Text(o['name'] as String))).toList(),onChanged:busy?null:(id){setState((){org=id;clients=[];cursor=null;});if(id!=null)run(()=>load(id));}),
    if(org!=null)...[
      TextField(controller:name,maxLength:100,enabled:!busy,decoration:const InputDecoration(labelText:'Application name')),
      DropdownButton<String>(value:kind,items:const [DropdownMenuItem(value:'public',child:Text('Public')),DropdownMenuItem(value:'confidential',child:Text('Confidential'))],onChanged:busy?null:(v){if(v!=null)setState(()=>kind=v);}),
      TextField(controller:redirects,enabled:!busy,maxLines:4,decoration:const InputDecoration(labelText:'HTTPS callback URLs (one per line)')),
      ElevatedButton(onPressed:busy?null:()=>run(register),child:const Text('Register application')),
      for(final c in clients) Card(child:ListTile(title:Text(c['name'].toString()),subtitle:Text('${c['id']}\n${c['client_type']} — ${c['revoked_at']==null?'Registered':'Revoked'}\n${(c['redirect_uris'] as List).join('\n')}'),trailing:c['revoked_at']!=null?null:TextButton(onPressed:busy?null:()async {final id=org;final ok=await showDialog<bool>(context:context,builder:(ctx)=>AlertDialog(title:const Text('Revoke registration?'),actions:[TextButton(onPressed:()=>Navigator.pop(ctx,false),child:const Text('Cancel')),TextButton(onPressed:()=>Navigator.pop(ctx,true),child:const Text('Revoke'))]));if(ok==true&&mounted&&id!=null&&org==id)await run(()=>revoke(id,c['id'] as String));},child:const Text('Revoke')))),
      if(cursor!=null) OutlinedButton(onPressed:busy?null:()=>run(()=>load(org!,after:cursor)),child:const Text('Load more')),
    ],
    if(message.isNotEmpty) Text(message),
  ]);
}
