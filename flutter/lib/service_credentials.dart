import 'package:flutter/material.dart';
import 'identity_api.dart';

class ServiceCredentials extends StatefulWidget {
 const ServiceCredentials({super.key,required this.api,required this.organisationId,required this.clientId});
 final IdentityApi api;
 final String organisationId,clientId;
 @override State<ServiceCredentials> createState()=>_ServiceCredentialsState();
}
class _ServiceCredentialsState extends State<ServiceCredentials> {
 final name=TextEditingController();
 List<Map<String,dynamic>> credentials=[];
 String? cursor,oneTimeSecret;
 String message='';
 int days=30;
 bool busy=false;
 String get path=>'/v1/organisations/${Uri.encodeComponent(widget.organisationId)}/clients/${Uri.encodeComponent(widget.clientId)}/credentials';
 @override void dispose(){name.dispose();oneTimeSecret=null;super.dispose();}
 Future<void> run(Future<void> Function() task) async {
  if(busy||!mounted)return;
  setState((){busy=true;message='';});
  try{await task();}catch(e){if(mounted)setState(()=>message=e.toString());}
  finally{if(mounted)setState(()=>busy=false);}
 }
 Future<void> load({String? after}) async {
  final data=await widget.api.request('GET',path+(after==null?'':'?after=${Uri.encodeComponent(after)}'));
  if(!mounted)return;
  final rows=(data['credentials'] as List).map((v)=>Map<String,dynamic>.from(v as Map)).toList();
  setState((){credentials=after==null?rows:[...credentials,...rows];cursor=data['next_cursor'] as String?;});
 }
 Future<void> create() async {
  final title=name.text.trim();
  if(title.isEmpty)throw StateError('Enter a credential name.');
  final data=await widget.api.request('POST',path,{'name':title,'expires_in_days':days,'scopes':['identity:service:read']});
  if(!mounted)return;
  final secret=data['secret'] as String?;
  if(secret==null)throw StateError('Credential generation was not confirmed.');
  name.clear();
  setState(()=>oneTimeSecret=secret);
  await load();
 }
 Future<void> revoke(String id) async {
  await widget.api.request('DELETE','$path/${Uri.encodeComponent(id)}');
  if(!mounted)return;
  setState(()=>oneTimeSecret=null);
  await load();
 }
 @override Widget build(BuildContext context)=>Padding(padding:const EdgeInsets.all(12),child:Column(
  crossAxisAlignment:CrossAxisAlignment.stretch,children:[
   const Text('Server-to-server credentials',style:TextStyle(fontWeight:FontWeight.bold)),
   const Text('Confidential server applications only. These are not OAuth client secrets.'),
   OutlinedButton(onPressed:busy?null:()=>run(load),child:const Text('Refresh credentials')),
   TextField(controller:name,maxLength:100,enabled:!busy,decoration:const InputDecoration(labelText:'Credential name')),
   DropdownButton<int>(value:days,items:const [
    DropdownMenuItem(value:7,child:Text('7 days')),DropdownMenuItem(value:30,child:Text('30 days')),
    DropdownMenuItem(value:90,child:Text('90 days'))],
    onChanged:busy?null:(v){if(v!=null)setState(()=>days=v);}),
   FilledButton(onPressed:busy?null:()=>run(create),child:const Text('Generate credential')),
   if(oneTimeSecret!=null) Card(child:Padding(padding:const EdgeInsets.all(12),child:Column(
    crossAxisAlignment:CrossAxisAlignment.start,children:[
     const Text('Copy now. This secret will not be displayed again.'),
     SelectableText(oneTimeSecret!),
     TextButton(onPressed:()=>setState(()=>oneTimeSecret=null),child:const Text('I have saved this key — hide it'))
   ]))),
   for(final item in credentials) ListTile(
    title:Text(item['name']?.toString()??'Credential'),
    subtitle:Text('${item['secret_hint']??''}… — ${item['revoked_at']!=null?'Revoked':'Expires '+(item['expires_at']?.toString()??'unknown')}'),
    trailing:item['revoked_at']!=null?null:TextButton(onPressed:busy?null:()async {
      final ok=await showDialog<bool>(context:context,builder:(ctx)=>AlertDialog(
       title:const Text('Revoke this credential?'),actions:[
        TextButton(onPressed:()=>Navigator.pop(ctx,false),child:const Text('Cancel')),
        TextButton(onPressed:()=>Navigator.pop(ctx,true),child:const Text('Revoke'))]));
      if(ok==true&&mounted)await run(()=>revoke(item['id'] as String));
    },child:const Text('Revoke'))),
   if(cursor!=null) OutlinedButton(onPressed:busy?null:()=>run(()=>load(after:cursor)),child:const Text('Load more')),
   if(message.isNotEmpty)Text(message)
  ]));
}
