import 'package:flutter_test/flutter_test.dart';
import 'package:trillionai_identity/account_operation_generation.dart';

void main() {
  test('prevents duplicate synchronous account mutations', () {
    final gate=AccountOperationGeneration();
    final current=gate.begin();
    expect(current, isNotNull);
    expect(gate.begin(), isNull);
    expect(gate.isCurrent(current!), isTrue);
    expect(gate.finish(current), isTrue);
    expect(gate.begin(), isNotNull);
  });

  test('sign out invalidates old completion, without clearing new action', () {
    final gate=AccountOperationGeneration();
    final old=gate.begin()!;
    gate.invalidate();
    final next=gate.begin()!;
    expect(gate.finish(old), isFalse);
    expect(gate.isCurrent(next), isTrue);
    expect(gate.finish(next), isTrue);
  });

  test('rejects stale, future and invalid operation tickets', () {
    final gate=AccountOperationGeneration();
    expect(gate.isCurrent(0), isFalse);
    final ticket=gate.begin()!;
    expect(gate.isCurrent(ticket+1), isFalse);
    expect(gate.finish(ticket+1), isFalse);
    expect(gate.isCurrent(ticket), isTrue);
  });
}
