// Traceability: KAN-63
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:flutter_frontend/state/vision_provider.dart';
import 'package:flutter_frontend/widgets/status_bar.dart';
import 'package:flutter_frontend/widgets/object_card.dart';
import 'package:flutter_frontend/widgets/chat_panel.dart';

void main() {
  testWidgets('StatusBar displays title, badges and settings button', (WidgetTester tester) async {
    final provider = VisionProvider();

    await tester.pumpWidget(
      MaterialApp(
        home: ChangeNotifierProvider<VisionProvider>.value(
          value: provider,
          child: const Scaffold(
            appBar: StatusBar(),
          ),
        ),
      ),
    );

    expect(find.text('Vision AI'), findsOneWidget);
    expect(find.text('MediaPipe + LLM Intelligence'), findsOneWidget);
    expect(find.byIcon(Icons.settings_outlined), findsOneWidget);
  });

  testWidgets('ObjectCard displays prompt when no object is selected', (WidgetTester tester) async {
    final provider = VisionProvider();

    await tester.pumpWidget(
      MaterialApp(
        home: ChangeNotifierProvider<VisionProvider>.value(
          value: provider,
          child: const Scaffold(
            body: ObjectCard(),
          ),
        ),
      ),
    );

    expect(find.text('No Object Selected'), findsOneWidget);
  });

  testWidgets('ChatPanel renders welcome message and input field', (WidgetTester tester) async {
    final provider = VisionProvider();

    await tester.pumpWidget(
      MaterialApp(
        home: ChangeNotifierProvider<VisionProvider>.value(
          value: provider,
          child: const Scaffold(
            body: ChatPanel(),
          ),
        ),
      ),
    );

    expect(find.textContaining('Hello! I am your AI Vision Assistant'), findsOneWidget);
    expect(find.byType(TextField), findsOneWidget);
    expect(find.byIcon(Icons.send), findsOneWidget);
  });
}
