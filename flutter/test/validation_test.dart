import 'package:flutter_test/flutter_test.dart';
import 'package:trillionai_identity/validation.dart';
void main() {
  group('registration validation', () {
    test('requires valid email', () => expect(registrationValidation('bad','longpassword123','longpassword123'),isNotNull));
    test('requires minimum length', () => expect(registrationValidation('a@example.com','short','short'),isNotNull));
    test('requires matching confirmation', () => expect(registrationValidation('a@example.com','longpassword123','wrongpassword123'),isNotNull));
    test('accepts a valid account', () => expect(registrationValidation('a@example.com','longpassword123','longpassword123'),isNull));
  });
}
