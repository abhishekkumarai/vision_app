// Traceability: KAN-62
import 'package:flutter/material.dart';
import '../widgets/camera_view.dart';
import '../widgets/object_card.dart';
import '../widgets/chat_panel.dart';

class DesktopView extends StatefulWidget {
  const DesktopView({super.key});

  @override
  State<DesktopView> createState() => _DesktopViewState();
}

class _DesktopViewState extends State<DesktopView> with SingleTickerProviderStateMixin {
  late TabController _tabController;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        // Left Column: Camera View with Live Overlay (60% width)
        Expanded(
          flex: 6,
          child: Container(
            color: Colors.black,
            child: const CameraView(fit: BoxFit.contain),
          ),
        ),

        // Divider border
        Container(width: 1, color: Colors.white12),

        // Right Column: Intelligence & Chat Tabbed Panel (40% width)
        Expanded(
          flex: 4,
          child: Container(
            color: const Color(0xFF0F172A),
            child: Column(
              children: [
                // Tabs
                Container(
                  color: const Color(0xFF1E293B),
                  child: TabBar(
                    controller: _tabController,
                    indicatorColor: const Color(0xFF06B6D4),
                    labelColor: const Color(0xFF06B6D4),
                    unselectedLabelColor: Colors.white60,
                    indicatorWeight: 3,
                    tabs: const [
                      Tab(
                        icon: Icon(Icons.auto_awesome, size: 18),
                        text: 'Intelligence',
                      ),
                      Tab(
                        icon: Icon(Icons.chat_bubble_outline, size: 18),
                        text: 'Assistant Chat',
                      ),
                    ],
                  ),
                ),

                // Tab views
                Expanded(
                  child: TabBarView(
                    controller: _tabController,
                    children: const [
                      ObjectCard(),
                      ChatPanel(),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }
}
