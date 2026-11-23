import 'package:flutter_test/flutter_test.dart';
import 'package:trillionai_identity/mfa_factor_selection.dart';

void main() {
  test('retains a selected verified backup factor', () {
    expect(chooseVerifiedFactor(['primary','backup'],'backup'),'backup');
  });
  test('falls back if selected factor was revoked', () {
    expect(chooseVerifiedFactor(['primary'],'backup'),'primary');
    expect(chooseVerifiedFactor([],'backup'),isNull);
  });
  test('backup enrollment requires existing AAL2', () {
    expect(canEnrollBackupFactor(true,false),isFalse);
    expect(canEnrollBackupFactor(true,true),isTrue);
    expect(canEnrollBackupFactor(false,false),isTrue);
  });
}
