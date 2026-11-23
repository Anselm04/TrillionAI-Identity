import 'dart:convert';
import 'package:flutter_test/flutter_test.dart';
import 'package:trillionai_identity/session_continuity.dart';

const user = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const otherUser = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const session = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const otherSession = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';

String jwt(String sid, {int version = 1}) =>
    'eyJhbGciOiJIUzI1NiJ9.${base64Url.encode(utf8.encode(jsonEncode({
      'session_id': sid, 'version': version
    }))).replaceAll('=', '')}.signature';

void main() {
  test('permits access-token rotation within the same provider session', () {
    expect(sameIdentitySession(jwt(session), user,
      jwt(session, version: 2), user), isTrue);
  });
  test('discards response across sign-out or session/account change', () {
    expect(sameIdentitySession(jwt(session),user,null,null),isFalse);
    expect(sameIdentitySession(jwt(session),user,jwt(session),otherUser),isFalse);
    expect(sameIdentitySession(jwt(session),user,jwt(otherSession),user),isFalse);
  });
  test('fails closed on invalid JWT and missing session ID', () {
    expect(clientSessionId('broken'),isNull);
    expect(sameIdentitySession(jwt(session),user,'broken',user),isFalse);
  });
}
