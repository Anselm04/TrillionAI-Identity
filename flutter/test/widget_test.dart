import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:trillionai_identity/main.dart';

void main() {
  testWidgets('welcome and authentication entry are visible', (tester) async {
    await tester.pumpWidget(const IdentityApp());
    expect(find.text('One secure identity foundation'), findsOneWidget);
    expect(find.byType(FilledButton), findsOneWidget);
  });
}
