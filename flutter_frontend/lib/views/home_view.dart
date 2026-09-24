// Traceability: KAN-62
import 'package:flutter/material.dart';
import '../widgets/status_bar.dart';
import 'desktop_view.dart';
import 'mobile_view.dart';

class HomeView extends StatelessWidget {
  const HomeView({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF0F172A),
      appBar: const StatusBar(),
      body: LayoutBuilder(
        builder: (context, constraints) {
          // If wide screen (Desktop / Web widescreen), use split view
          // If narrow screen (Mobile Web, Phone screen, or narrow window), use adaptive mobile view
          if (constraints.maxWidth >= 850) {
            return const DesktopView();
          } else {
            return const MobileView();
          }
        },
      ),
    );
  }
}
