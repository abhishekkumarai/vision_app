// Traceability: KAN-60, KAN-62
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../state/vision_provider.dart';
import 'settings_dialog.dart';

class StatusBar extends StatelessWidget implements PreferredSizeWidget {
  const StatusBar({super.key});

  @override
  Size get preferredSize => const Size.fromHeight(56);

  @override
  Widget build(BuildContext context) {
    return Consumer<VisionProvider>(
      builder: (context, provider, _) {
        final isHealthy = provider.isBackendHealthy;
        final detectionsCount = provider.currentDetections.length;
        final fps = provider.currentFps.toStringAsFixed(1);
        final inferenceMs = provider.inferenceTimeMs.toStringAsFixed(1);

        return AppBar(
          backgroundColor: const Color(0xFF0F172A),
          elevation: 0,
          titleSpacing: 16,
          title: Row(
            children: [
              Container(
                padding: const EdgeInsets.all(6),
                decoration: BoxDecoration(
                  gradient: const LinearGradient(
                    colors: [Color(0xFF06B6D4), Color(0xFF2563EB)],
                  ),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: const Icon(Icons.remove_red_eye_outlined, color: Colors.white, size: 20),
              ),
              const SizedBox(width: 10),
              const Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    'Vision AI',
                    style: TextStyle(
                      color: Colors.white,
                      fontSize: 16,
                      fontWeight: FontWeight.bold,
                      letterSpacing: 0.5,
                    ),
                  ),
                  Text(
                    'MediaPipe + LLM Intelligence',
                    style: TextStyle(color: Colors.white54, fontSize: 10),
                  ),
                ],
              ),
            ],
          ),
          actions: [
            // FPS badge
            if (provider.isCameraStreaming)
              Container(
                margin: const EdgeInsets.symmetric(vertical: 14, horizontal: 4),
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                decoration: BoxDecoration(
                  color: const Color(0xFF1E293B),
                  borderRadius: BorderRadius.circular(6),
                  border: Border.all(color: Colors.white12),
                ),
                child: Text(
                  '$fps FPS ($inferenceMs ms)',
                  style: const TextStyle(color: Color(0xFF10B981), fontSize: 11, fontWeight: FontWeight.bold),
                ),
              ),

            // Objects detected badge
            Container(
              margin: const EdgeInsets.symmetric(vertical: 14, horizontal: 4),
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
              decoration: BoxDecoration(
                color: const Color(0xFF1E293B),
                borderRadius: BorderRadius.circular(6),
                border: Border.all(color: Colors.white12),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(
                    Icons.layers_outlined,
                    size: 13,
                    color: detectionsCount > 0 ? const Color(0xFF06B6D4) : Colors.white38,
                  ),
                  const SizedBox(width: 4),
                  Text(
                    '$detectionsCount',
                    style: TextStyle(
                      color: detectionsCount > 0 ? Colors.white : Colors.white54,
                      fontSize: 11,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ],
              ),
            ),

            // Backend Status Indicator
            Container(
              margin: const EdgeInsets.symmetric(vertical: 14, horizontal: 4),
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
              decoration: BoxDecoration(
                color: (isHealthy ? Colors.green : Colors.red).withOpacity(0.15),
                borderRadius: BorderRadius.circular(6),
                border: Border.all(color: isHealthy ? Colors.green : Colors.red, width: 1),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  CircleAvatar(
                    radius: 3.5,
                    backgroundColor: isHealthy ? Colors.greenAccent : Colors.redAccent,
                  ),
                  const SizedBox(width: 5),
                  Text(
                    isHealthy ? 'Connected' : 'Offline',
                    style: TextStyle(
                      color: isHealthy ? Colors.greenAccent : Colors.redAccent,
                      fontSize: 11,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ],
              ),
            ),

            // Settings button
            IconButton(
              icon: const Icon(Icons.settings_outlined, color: Colors.white70),
              onPressed: () {
                showDialog(
                  context: context,
                  builder: (ctx) => const SettingsDialog(),
                );
              },
            ),
            const SizedBox(width: 8),
          ],
        );
      },
    );
  }
}
