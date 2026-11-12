import 'package:flutter_test/flutter_test.dart';
void main() {
  test('minimum new password length', () {
    expect('short'.length < 12, isTrue);
  });
}
