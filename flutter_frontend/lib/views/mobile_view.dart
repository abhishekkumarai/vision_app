// Traceability: KAN-62
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../state/vision_provider.dart';
import '../widgets/camera_view.dart';
import '../widgets/object_card.dart';
import '../widgets/chat_panel.dart';

class MobileView extends StatefulWidget {
  const MobileView({super.key});

  @override
  State<MobileView> createState() => _MobileViewState();
}

class _MobileViewState extends State<MobileView> {
  int _currentIndex = 0;

  @override
  Widget build(BuildContext context) {
    return Consumer<VisionProvider>(
      builder: (context, provider, _) {
        final hasObjectSelected = provider.selectedObject != null;

        return Scaffold(
          backgroundColor: const Color(0xFF0F172A),
          body: IndexedStack(
            index: _currentIndex,
            children: [
              // Screen 0: Camera Feed with Live Overlay
              Stack(
                children: [
                  const Positioned.fill(
                    child: CameraView(
                      fit: BoxFit.contain,
                      showControls: true,
                    ),
                  ),

                  // Floating Notification Banner when an object is selected
                  if (hasObjectSelected && provider.activeIdentification != null)
                    Positioned(
                      top: 16,
                      left: 16,
                      right: 16,
                      child: GestureDetector(
                        onTap: () => setState(() => _currentIndex = 1),
                        child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                          decoration: BoxDecoration(
                            color: const Color(0xFF0F172A).withOpacity(0.92),
                            borderRadius: BorderRadius.circular(12),
                            border: Border.all(color: const Color(0xFF10B981), width: 1.5),
                            boxShadow: [
                              BoxShadow(
                                color: Colors.black.withOpacity(0.4),
                                blurRadius: 10,
                                offset: const Offset(0, 4),
                              ),
                            ],
                          ),
                          child: Row(
                            children: [
                              const Icon(Icons.auto_awesome, color: Color(0xFF10B981), size: 20),
                              const SizedBox(width: 10),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  mainAxisSize: MainAxisSize.min,
                                  children: [
                                    Text(
                                      provider.activeIdentification!.name,
                                      style: const TextStyle(
                                        color: Colors.white,
                                        fontWeight: FontWeight.bold,
                                        fontSize: 13,
                                      ),
                                    ),
                                    Text(
                                      '${(provider.activeIdentification!.confidence * 100).toInt()}% • Tap to view uses, specs & safety',
                                      style: const TextStyle(color: Colors.white60, fontSize: 11),
                                    ),
                                  ],
                                ),
                              ),
                              const Icon(Icons.arrow_forward_ios, color: Color(0xFF10B981), size: 14),
                            ],
                          ),
                        ),
                      ),
                    ),
                ],
              ),

              // Screen 1: Object Intelligence Specs
              const ObjectCard(),

              // Screen 2: Interactive AI Chat
              const ChatPanel(),
            ],
          ),
          bottomNavigationBar: Container(
            decoration: const BoxDecoration(
              color: Color(0xFF1E293B),
              border: Border(top: BorderSide(color: Colors.white12)),
            ),
            child: BottomNavigationBar(
              currentIndex: _currentIndex,
              onTap: (index) => setState(() => _currentIndex = index),
              backgroundColor: const Color(0xFF1E293B),
              selectedItemColor: const Color(0xFF06B6D4),
              unselectedItemColor: Colors.white54,
              selectedFontSize: 12,
              unselectedFontSize: 11,
              type: BottomNavigationBarType.fixed,
              elevation: 0,
              items: [
                const BottomNavigationBarItem(
                  icon: Icon(Icons.camera_alt_outlined),
                  activeIcon: Icon(Icons.camera_alt),
                  label: 'Camera',
                ),
                BottomNavigationBarItem(
                  icon: Stack(
                    children: [
                      const Icon(Icons.auto_awesome_outlined),
                      if (hasObjectSelected)
                        Positioned(
                          right: 0,
                          top: 0,
                          child: Container(
                            width: 8,
                            height: 8,
                            decoration: const BoxDecoration(
                              color: Color(0xFF10B981),
                              shape: BoxShape.circle,
                            ),
                          ),
                        ),
                    ],
                  ),
                  activeIcon: const Icon(Icons.auto_awesome),
                  label: 'Intelligence',
                ),
                const BottomNavigationBarItem(
                  icon: Icon(Icons.chat_bubble_outline),
                  activeIcon: Icon(Icons.chat_bubble),
                  label: 'AI Chat',
                ),
              ],
            ),
          ),
        );
      },
    );
  }
}
