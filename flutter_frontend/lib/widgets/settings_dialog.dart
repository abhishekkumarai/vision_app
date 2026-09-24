// Traceability: KAN-61, KAN-62
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../state/vision_provider.dart';

class SettingsDialog extends StatefulWidget {
  const SettingsDialog({super.key});

  @override
  State<SettingsDialog> createState() => _SettingsDialogState();
}

class _SettingsDialogState extends State<SettingsDialog> {
  late TextEditingController _urlController;
  late double _threshold;
  late int _intervalMs;
  late String _provider;
  late bool _sendEvents;

  @override
  void initState() {
    super.initState();
    final p = Provider.of<VisionProvider>(context, listen: false);
    _urlController = TextEditingController(text: p.settings.backendUrl);
    _threshold = p.settings.confidenceThreshold;
    _intervalMs = p.settings.detectIntervalMs;
    _provider = p.settings.selectedProvider;
    _sendEvents = p.settings.sendEvents;
  }

  @override
  void dispose() {
    _urlController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Consumer<VisionProvider>(
      builder: (context, provider, _) {
        return AlertDialog(
          backgroundColor: const Color(0xFF1E293B),
          title: const Row(
            children: [
              Icon(Icons.tune, color: Color(0xFF06B6D4), size: 22),
              SizedBox(width: 8),
              Text('Settings', style: TextStyle(color: Colors.white, fontSize: 18)),
            ],
          ),
          content: SingleChildScrollView(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                // Backend URL
                const Text('Backend API URL', style: TextStyle(color: Colors.white70, fontSize: 12, fontWeight: FontWeight.bold)),
                const SizedBox(height: 6),
                TextField(
                  controller: _urlController,
                  style: const TextStyle(color: Colors.white, fontSize: 13),
                  decoration: InputDecoration(
                    hintText: 'e.g. http://localhost:8000',
                    hintStyle: const TextStyle(color: Colors.white38),
                    filled: true,
                    fillColor: const Color(0xFF0F172A),
                    contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(8),
                      borderSide: const BorderSide(color: Colors.white12),
                    ),
                  ),
                ),
                const SizedBox(height: 16),

                // LLM Provider Picker
                const Text('LLM Intelligence Provider', style: TextStyle(color: Colors.white70, fontSize: 12, fontWeight: FontWeight.bold)),
                const SizedBox(height: 6),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12),
                  decoration: BoxDecoration(
                    color: const Color(0xFF0F172A),
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: Colors.white12),
                  ),
                  child: DropdownButtonHideUnderline(
                    child: DropdownButton<String>(
                      value: _provider,
                      dropdownColor: const Color(0xFF0F172A),
                      isExpanded: true,
                      style: const TextStyle(color: Colors.white, fontSize: 13),
                      items: const [
                        DropdownMenuItem(value: 'ollama', child: Text('Ollama (Local LLM - Gemma 2)')),
                        DropdownMenuItem(value: 'gemini', child: Text('Google Gemini (Cloud AI)')),
                        DropdownMenuItem(value: 'offline', child: Text('Curated Offline Knowledge')),
                      ],
                      onChanged: (val) {
                        if (val != null) setState(() => _provider = val);
                      },
                    ),
                  ),
                ),
                const SizedBox(height: 16),

                // Confidence Threshold Slider
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Text('Confidence Threshold', style: TextStyle(color: Colors.white70, fontSize: 12, fontWeight: FontWeight.bold)),
                    Text('${(_threshold * 100).toInt()}%', style: const TextStyle(color: Color(0xFF10B981), fontSize: 12, fontWeight: FontWeight.bold)),
                  ],
                ),
                Slider(
                  value: _threshold,
                  min: 0.1,
                  max: 0.9,
                  divisions: 16,
                  activeColor: const Color(0xFF10B981),
                  inactiveColor: Colors.white12,
                  onChanged: (val) => setState(() => _threshold = val),
                ),
                const SizedBox(height: 12),

                // Detection Interval Slider
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Text('Detection Interval', style: TextStyle(color: Colors.white70, fontSize: 12, fontWeight: FontWeight.bold)),
                    Text('${_intervalMs}ms', style: const TextStyle(color: Color(0xFF06B6D4), fontSize: 12, fontWeight: FontWeight.bold)),
                  ],
                ),
                Slider(
                  value: _intervalMs.toDouble(),
                  min: 150,
                  max: 1000,
                  divisions: 17,
                  activeColor: const Color(0xFF06B6D4),
                  inactiveColor: Colors.white12,
                  onChanged: (val) => setState(() => _intervalMs = val.toInt()),
                ),
                const SizedBox(height: 4),
                SwitchListTile(
                  contentPadding: EdgeInsets.zero,
                  value: _sendEvents,
                  activeThumbColor: const Color(0xFF10B981),
                  onChanged: (v) => setState(() => _sendEvents = v),
                  title: const Text('Send workflow events',
                      style: TextStyle(color: Colors.white70, fontSize: 12, fontWeight: FontWeight.bold)),
                  subtitle: const Text(
                    'When a new object stays in view, send it to the server to run workflows. One event per object every 30 s.',
                    style: TextStyle(color: Colors.white38, fontSize: 11),
                  ),
                ),
                const SizedBox(height: 8),
                Text('Detection engine: ${provider.detectionEngine}',
                    style: const TextStyle(color: Colors.white54, fontSize: 11)),
              ],
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(context).pop(),
              child: const Text('Cancel', style: TextStyle(color: Colors.white54)),
            ),
            ElevatedButton(
              style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF2563EB)),
              onPressed: () {
                final newSettings = provider.settings.copyWith(
                  backendUrl: _urlController.text.trim(),
                  confidenceThreshold: _threshold,
                  detectIntervalMs: _intervalMs,
                  selectedProvider: _provider,
                  sendEvents: _sendEvents,
                );
                provider.updateSettings(newSettings);
                Navigator.of(context).pop();
              },
              child: const Text('Save Changes', style: TextStyle(color: Colors.white)),
            ),
          ],
        );
      },
    );
  }
}
