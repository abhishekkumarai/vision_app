// Traceability: KAN-61, KAN-62, KAN-71, KAN-77, KAN-78
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../state/vision_provider.dart';

class ObjectCard extends StatelessWidget {
  const ObjectCard({super.key});

  @override
  Widget build(BuildContext context) {
    return Consumer<VisionProvider>(
      builder: (context, provider, _) {
        if (provider.isIdentifying) {
          return const Center(
            child: Padding(
              padding: EdgeInsets.all(32.0),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  CircularProgressIndicator(color: Color(0xFF10B981)),
                  SizedBox(height: 16),
                  Text(
                    'Analyzing object intelligence with LLM...',
                    style: TextStyle(color: Colors.white70, fontSize: 13),
                  ),
                ],
              ),
            ),
          );
        }

        final data = provider.activeIdentification;
        if (data == null) {
          return Center(
            child: Padding(
              padding: const EdgeInsets.all(24.0),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(Icons.touch_app_outlined, size: 48, color: Colors.white.withOpacity(0.3)),
                  const SizedBox(height: 12),
                  const Text(
                    'No Object Selected',
                    style: TextStyle(
                      color: Colors.white,
                      fontSize: 16,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  const SizedBox(height: 6),
                  const Text(
                    'Tap any detected bounding box in the camera feed or list below to inspect encyclopedic intelligence.',
                    textAlign: TextAlign.center,
                    style: TextStyle(color: Colors.white54, fontSize: 13),
                  ),
                  const SizedBox(height: 16),
                  // Detections quick chips
                  if (provider.currentDetections.isNotEmpty) ...[
                    const Text(
                      'Detected in current frame:',
                      style: TextStyle(color: Colors.white70, fontSize: 12),
                    ),
                    const SizedBox(height: 8),
                    Wrap(
                      spacing: 8,
                      runSpacing: 8,
                      alignment: WrapAlignment.center,
                      children: provider.currentDetections.map((d) {
                        return ActionChip(
                          avatar: const Icon(Icons.crop_free, size: 16, color: Color(0xFF06B6D4)),
                          label: Text('${d.label} (${(d.confidence * 100).toInt()}%)'),
                          backgroundColor: const Color(0xFF1E293B),
                          labelStyle: const TextStyle(color: Colors.white, fontSize: 12),
                          onPressed: () => provider.selectObject(d),
                        );
                      }).toList(),
                    ),
                  ],
                ],
              ),
            ),
          );
        }

        final snapshot = provider.selectedSnapshot;
        return SingleChildScrollView(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Header Row
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  if (snapshot != null)
                    ClipRRect(
                      borderRadius: BorderRadius.circular(10),
                      child: Image.memory(snapshot, width: 56, height: 56, fit: BoxFit.cover, gaplessPlayback: true),
                    )
                  else
                    Container(
                      padding: const EdgeInsets.all(10),
                      decoration: BoxDecoration(
                        color: const Color(0xFF10B981).withOpacity(0.15),
                        borderRadius: BorderRadius.circular(10),
                        border: Border.all(color: const Color(0xFF10B981), width: 1.5),
                      ),
                      child: const Icon(Icons.auto_awesome, color: Color(0xFF10B981), size: 24),
                    ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          data.name,
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 18,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                        const SizedBox(height: 4),
                        Wrap(
                          spacing: 8,
                          runSpacing: 4,
                          crossAxisAlignment: WrapCrossAlignment.center,
                          children: [
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                              decoration: BoxDecoration(
                                color: const Color(0xFF06B6D4).withOpacity(0.2),
                                borderRadius: BorderRadius.circular(4),
                              ),
                              child: Text(
                                data.category,
                                style: const TextStyle(
                                  color: Color(0xFF06B6D4),
                                  fontSize: 11,
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                            ),
                            Text(
                              '${data.label} • ${(data.confidence * 100).toInt()}% detection',
                              style: const TextStyle(color: Colors.white54, fontSize: 11),
                            ),
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                              decoration: BoxDecoration(
                                color: Colors.white12,
                                borderRadius: BorderRadius.circular(4),
                              ),
                              child: Text(
                                data.modelUsed,
                                style: const TextStyle(color: Colors.white70, fontSize: 10),
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 14),

              // Summary
              Text(
                data.summary,
                style: const TextStyle(color: Colors.white70, fontSize: 13, height: 1.4),
              ),
              const Divider(color: Colors.white12, height: 24),

              ..._buildBulletSection(Icons.handyman_outlined, 'Primary Uses', '▸ ', data.primaryUses),
              ..._buildBulletSection(Icons.tune, 'Materials & Specifications', '▸ ', data.materialsAndSpecs),
              ..._buildBulletSection(Icons.health_and_safety_outlined, 'Safety & Maintenance', '🔧 ', data.safetyAndMaintenance),
              ..._buildBulletSection(Icons.lightbulb_outline, 'Fun Facts', '💡 ', data.funFacts),

              // Suggested questions -> chat
              if (data.suggestedQuestions.isNotEmpty) ...[
                _buildSectionTitle(Icons.forum_outlined, 'Ask the Assistant'),
                const SizedBox(height: 8),
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: data.suggestedQuestions.map((q) {
                    return ActionChip(
                      avatar: const Icon(Icons.chat_bubble_outline, size: 14, color: Color(0xFF06B6D4)),
                      label: Text(q),
                      backgroundColor: const Color(0xFF1E293B),
                      side: const BorderSide(color: Colors.white12),
                      labelStyle: const TextStyle(color: Colors.white, fontSize: 12),
                      onPressed: provider.isChatSending
                          ? null
                          : () {
                              provider.sendUserChatMessage(q);
                              ScaffoldMessenger.maybeOf(context)?.showSnackBar(
                                const SnackBar(
                                  content: Text('Question sent — see the Assistant Chat for the answer.'),
                                  duration: Duration(seconds: 2),
                                ),
                              );
                            },
                    );
                  }).toList(),
                ),
              ],
            ],
          ),
        );
      },
    );
  }

  List<Widget> _buildBulletSection(IconData icon, String title, String bullet, List<String> items) {
    if (items.isEmpty) return const [];
    return [
      _buildSectionTitle(icon, title),
      const SizedBox(height: 8),
      ...items.map((item) => Padding(
            padding: const EdgeInsets.only(bottom: 6),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(bullet, style: const TextStyle(color: Color(0xFF06B6D4), fontSize: 12)),
                Expanded(
                  child: Text(
                    item,
                    style: const TextStyle(color: Colors.white70, fontSize: 12, height: 1.3),
                  ),
                ),
              ],
            ),
          )),
      const SizedBox(height: 16),
    ];
  }

  Widget _buildSectionTitle(IconData icon, String title) {
    return Row(
      children: [
        Icon(icon, size: 16, color: const Color(0xFF06B6D4)),
        const SizedBox(width: 6),
        Text(
          title,
          style: const TextStyle(
            color: Colors.white,
            fontSize: 13,
            fontWeight: FontWeight.bold,
            letterSpacing: 0.3,
          ),
        ),
      ],
    );
  }
}
