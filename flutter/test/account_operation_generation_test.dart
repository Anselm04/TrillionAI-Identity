import 'dart:async';

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

  test('export completion is invalid after account transition at either await', () async {
    final gate = AccountOperationGeneration();

    // First await: account data arrives after sign-out. The clipboard must not
    // be written and the UI must not be updated by the old operation.
    final response = Completer<String>();
    final first = gate.begin()!;
    var clipboardWrites = 0;
    var messages = 0;
    final pending = () async {
      final value = await response.future;
      if (!gate.isCurrent(first)) return;
      clipboardWrites++;
      await Future<void>.value();
      if (!gate.isCurrent(first)) return;
      messages += value.length;
    }();
    gate.invalidate();
    response.complete('private export');
    await pending;
    expect(clipboardWrites, 0);
    expect(messages, 0);

    // Second await: copy started while valid; sign-out happens before
    // the platform clipboard write returns. The UI must stay unchanged.
    final clipboard = Completer<void>();
    final second = gate.begin()!;
    final pendingCopy = () async {
      if (!gate.isCurrent(second)) return;
      clipboardWrites++;
      await clipboard.future;
      if (!gate.isCurrent(second)) return;
      messages++;
    }();
    expect(clipboardWrites, 1);
    gate.invalidate();
    clipboard.complete();
    await pendingCopy;
    expect(messages, 0);
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
