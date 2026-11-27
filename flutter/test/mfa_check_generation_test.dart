import 'dart:convert';
import 'package:flutter_test/flutter_test.dart';
import 'package:trillionai_identity/mfa_check_generation.dart';

const user='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const another='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const sid='cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const nextSid='dddddddd-dddd-4ddd-8ddd-dddddddddddd';

String token(String sessionId,{int version=1}) {
  final payload=base64Url.encode(utf8.encode(jsonEncode({
    'session_id':sessionId,'version':version,
  }))).replaceAll('=','');
  return 'eyJhbGciOiJIUzI1NiJ9.$payload.signature';
}

void main(){
  test('newer assurance check supersedes older pending result',(){
    final g=MfaCheckGeneration();
    final first=g.begin();
    final second=g.begin();
    expect(g.isCurrent(first,token(sid),user,token(sid),user),isFalse);
    expect(g.isCurrent(second,token(sid),user,token(sid),user),isTrue);
  });
  test('same session tolerates provider token rotation',(){
    final g=MfaCheckGeneration();
    final t=g.begin();
    expect(g.isCurrent(t,token(sid),user,token(sid,version:2),user),isTrue);
  });
  test('sign-out, account switch and new login invalidate results',(){
    final g=MfaCheckGeneration();
    final t=g.begin();
    expect(g.isCurrent(t,token(sid),user,null,null),isFalse);
    expect(g.isCurrent(t,token(sid),user,token(sid),another),isFalse);
    expect(g.isCurrent(t,token(sid),user,token(nextSid),user),isFalse);
    g.invalidate();
    expect(g.isCurrent(t,token(sid),user,token(sid),user),isFalse);
  });
  test('malformed session token or invalid ticket fails closed',(){
    final g=MfaCheckGeneration();
    final t=g.begin();
    expect(g.isCurrent(0,token(sid),user,token(sid),user),isFalse);
    expect(g.isCurrent(t,'invalid',user,token(sid),user),isFalse);
  });
}
