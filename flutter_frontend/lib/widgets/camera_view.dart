// Traceability: KAN-60, KAN-62, KAN-65
import 'package:flutter/material.dart';
import 'package:camera/camera.dart';
import 'package:provider/provider.dart';
import '../state/vision_provider.dart';
import 'bounding_box_painter.dart';

class CameraView extends StatelessWidget {
  final BoxFit fit;
  final bool showControls;

  const CameraView({
    super.key,
    this.fit = BoxFit.contain,
    this.showControls = true,
  });

  @override
  Widget build(BuildContext context) {
    return Consumer<VisionProvider>(
      builder: (context, provider, _) {
        // 1. Error state (hardware locked, headless browser, permission denied)
        if (provider.cameraError != null) {
          return Center(
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(24.0),
              child: Container(
                constraints: const BoxConstraints(maxWidth: 500),
                padding: const EdgeInsets.all(20),
                decoration: BoxDecoration(
                  color: const Color(0xFF1E293B),
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: Colors.amber.withOpacity(0.3)),
                ),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Icon(Icons.videocam_off_rounded, size: 48, color: Colors.amber),
                    const SizedBox(height: 12),
                    const Text(
                      'Camera Hardware Inaccessible',
                      style: TextStyle(
                        color: Colors.white,
                        fontSize: 16,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    const SizedBox(height: 10),
                    Text(
                      provider.friendlyCameraError,
                      textAlign: TextAlign.center,
                      style: const TextStyle(color: Colors.white70, fontSize: 13, height: 1.4),
                    ),
                    const SizedBox(height: 20),
                    Wrap(
                      spacing: 12,
                      runSpacing: 12,
                      alignment: WrapAlignment.center,
                      children: [
                        OutlinedButton.icon(
                          onPressed: () => provider.initializeCameras(),
                          style: OutlinedButton.styleFrom(
                            foregroundColor: Colors.white70,
                            side: const BorderSide(color: Colors.white24),
                          ),
                          icon: const Icon(Icons.refresh, size: 18),
                          label: const Text('Retry Camera'),
                        ),
                        ElevatedButton.icon(
                          onPressed: () => provider.startDemoMode(),
                          style: ElevatedButton.styleFrom(
                            backgroundColor: const Color(0xFF10B981),
                            foregroundColor: Colors.white,
                          ),
                          icon: const Icon(Icons.smart_toy_outlined, size: 18),
                          label: const Text('Start Virtual Demo Feed'),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ),
          );
        }

        // 2. Virtual Demo Camera Mode
        if (provider.isDemoMode) {
          const videoAspectRatio = 16 / 9;
          return LayoutBuilder(
            builder: (context, constraints) {
              final containerSize = Size(constraints.maxWidth, constraints.maxHeight);

              return Stack(
                fit: StackFit.expand,
                children: [
                  // Simulated Camera Canvas Background
                  Center(
                    child: AspectRatio(
                      aspectRatio: videoAspectRatio,
                      child: Container(
                        decoration: BoxDecoration(
                          gradient: RadialGradient(
                            center: Alignment.center,
                            radius: 1.2,
                            colors: [
                              const Color(0xFF1E293B),
                              const Color(0xFF0F172A),
                              Colors.black.withOpacity(0.9),
                            ],
                          ),
                          border: Border.all(color: const Color(0xFF06B6D4).withOpacity(0.3), width: 1.5),
                        ),
                        child: Stack(
                          children: [
                            // Viewfinder grid & crosshairs
                            Positioned.fill(
                              child: CustomPaint(
                                painter: _ViewfinderGridPainter(),
                              ),
                            ),

                            // Watermark / Mode indicator
                            Positioned(
                              top: 12,
                              left: 12,
                              child: Container(
                                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                                decoration: BoxDecoration(
                                  color: const Color(0xFF06B6D4).withOpacity(0.18),
                                  borderRadius: BorderRadius.circular(6),
                                  border: Border.all(color: const Color(0xFF06B6D4), width: 1),
                                ),
                                child: const Row(
                                  mainAxisSize: MainAxisSize.min,
                                  children: [
                                    CircleAvatar(radius: 3.5, backgroundColor: Color(0xFF06B6D4)),
                                    SizedBox(width: 6),
                                    Text(
                                      'VIRTUAL DEMO STREAM (DESK SCENE)',
                                      style: TextStyle(
                                        color: Color(0xFF06B6D4),
                                        fontSize: 10,
                                        fontWeight: FontWeight.bold,
                                        letterSpacing: 0.5,
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),

                  // Interactive Bounding Box Overlay & Tap Detector
                  GestureDetector(
                    behavior: HitTestBehavior.opaque,
                    onTapDown: (details) {
                      final tapped = BoundingBoxPainter.findTappedObject(
                        tapOffset: details.localPosition,
                        containerSize: containerSize,
                        detections: provider.currentDetections,
                        videoAspectRatio: videoAspectRatio,
                        fit: fit,
                      );
                      if (tapped != null) {
                        provider.selectObject(tapped);
                      }
                    },
                    child: CustomPaint(
                      size: containerSize,
                      painter: BoundingBoxPainter(
                        detections: provider.currentDetections,
                        selectedObject: provider.selectedObject,
                        videoAspectRatio: videoAspectRatio,
                        fit: fit,
                      ),
                    ),
                  ),

                  // Floating HUD Quick Action Controls
                  if (showControls)
                    Positioned(
                      bottom: 16,
                      left: 16,
                      right: 16,
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          FloatingActionButton.extended(
                            heroTag: 'demo_toggle',
                            onPressed: () => provider.stopDemoMode(),
                            backgroundColor: Colors.redAccent,
                            icon: const Icon(Icons.stop, color: Colors.white),
                            label: const Text(
                              'Stop Demo',
                              style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold),
                            ),
                          ),
                          ElevatedButton.icon(
                            onPressed: () => provider.initializeCameras(),
                            style: ElevatedButton.styleFrom(
                              backgroundColor: const Color(0xFF1E293B),
                              foregroundColor: Colors.white70,
                              side: const BorderSide(color: Colors.white24),
                            ),
                            icon: const Icon(Icons.videocam, size: 16),
                            label: const Text('Use Physical Camera'),
                          ),
                        ],
                      ),
                    ),
                ],
              );
            },
          );
        }

        // 3. Idle / Not Started state
        if (!provider.isCameraInitialized || provider.cameraController == null) {
          return Center(
            child: Container(
              constraints: const BoxConstraints(maxWidth: 440),
              padding: const EdgeInsets.all(24),
              decoration: BoxDecoration(
                color: const Color(0xFF1E293B),
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: Colors.white12),
              ),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: const Color(0xFF06B6D4).withOpacity(0.12),
                      shape: BoxShape.circle,
                    ),
                    child: const Icon(Icons.camera_alt_outlined, size: 40, color: Color(0xFF06B6D4)),
                  ),
                  const SizedBox(height: 16),
                  const Text(
                    'Ready to Detect Objects',
                    style: TextStyle(
                      color: Colors.white,
                      fontSize: 18,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  const SizedBox(height: 8),
                  const Text(
                    'Click "Start Camera" to grant browser permissions and stream your webcam, or use the Virtual Demo stream.',
                    textAlign: TextAlign.center,
                    style: TextStyle(color: Colors.white60, fontSize: 13, height: 1.4),
                  ),
                  const SizedBox(height: 24),
                  Wrap(
                    spacing: 12,
                    runSpacing: 12,
                    alignment: WrapAlignment.center,
                    children: [
                      ElevatedButton.icon(
                        onPressed: () => provider.startStreaming(),
                        style: ElevatedButton.styleFrom(
                          backgroundColor: const Color(0xFF2563EB),
                          foregroundColor: Colors.white,
                          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                        ),
                        icon: const Icon(Icons.videocam, size: 18),
                        label: const Text('Start Camera', style: TextStyle(fontWeight: FontWeight.bold)),
                      ),
                      OutlinedButton.icon(
                        onPressed: () => provider.startDemoMode(),
                        style: OutlinedButton.styleFrom(
                          foregroundColor: const Color(0xFF10B981),
                          side: const BorderSide(color: Color(0xFF10B981)),
                          padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 12),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                        ),
                        icon: const Icon(Icons.smart_toy_outlined, size: 18),
                        label: const Text('Virtual Demo Stream'),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          );
        }

        // 4. Physical Camera Preview
        final controller = provider.cameraController!;
        final videoAspectRatio = controller.value.aspectRatio;

        return LayoutBuilder(
          builder: (context, constraints) {
            final containerSize = Size(constraints.maxWidth, constraints.maxHeight);

            return Stack(
              fit: StackFit.expand,
              children: [
                Center(
                  child: AspectRatio(
                    aspectRatio: videoAspectRatio,
                    child: CameraPreview(controller),
                  ),
                ),

                GestureDetector(
                  behavior: HitTestBehavior.opaque,
                  onTapDown: (details) {
                    final tapped = BoundingBoxPainter.findTappedObject(
                      tapOffset: details.localPosition,
                      containerSize: containerSize,
                      detections: provider.currentDetections,
                      videoAspectRatio: videoAspectRatio,
                      fit: fit,
                    );
                    if (tapped != null) {
                      provider.selectObject(tapped);
                    }
                  },
                  child: CustomPaint(
                    size: containerSize,
                    painter: BoundingBoxPainter(
                      detections: provider.currentDetections,
                      selectedObject: provider.selectedObject,
                      videoAspectRatio: videoAspectRatio,
                      fit: fit,
                    ),
                  ),
                ),

                if (showControls)
                  Positioned(
                    bottom: 16,
                    left: 16,
                    right: 16,
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        FloatingActionButton.extended(
                          heroTag: 'stream_toggle',
                          onPressed: () => provider.toggleStreaming(),
                          backgroundColor: provider.isCameraStreaming
                              ? Colors.redAccent
                              : const Color(0xFF10B981),
                          icon: Icon(
                            provider.isCameraStreaming ? Icons.stop : Icons.play_arrow,
                            color: Colors.white,
                          ),
                          label: Text(
                            provider.isCameraStreaming ? 'Stop Stream' : 'Start Stream',
                            style: const TextStyle(
                              color: Colors.white,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                        ),

                        if (provider.cameras.length > 1)
                          FloatingActionButton.small(
                            heroTag: 'switch_cam',
                            onPressed: () => provider.switchCamera(),
                            backgroundColor: const Color(0xFF1E293B),
                            child: const Icon(Icons.flip_camera_ios, color: Colors.white),
                          ),
                      ],
                    ),
                  ),
              ],
            );
          },
        );
      },
    );
  }
}

class _ViewfinderGridPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final gridPaint = Paint()
      ..color = Colors.white.withOpacity(0.04)
      ..strokeWidth = 1.0;

    const step = 40.0;
    for (double x = 0; x < size.width; x += step) {
      canvas.drawLine(Offset(x, 0), Offset(x, size.height), gridPaint);
    }
    for (double y = 0; y < size.height; y += step) {
      canvas.drawLine(Offset(0, y), Offset(size.width, y), gridPaint);
    }

    final centerPaint = Paint()
      ..color = const Color(0xFF06B6D4).withOpacity(0.4)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.5;

    final center = Offset(size.width / 2, size.height / 2);
    canvas.drawCircle(center, 24, centerPaint);
    canvas.drawLine(Offset(center.dx - 36, center.dy), Offset(center.dx + 36, center.dy), centerPaint);
    canvas.drawLine(Offset(center.dx, center.dy - 36), Offset(center.dx, center.dy + 36), centerPaint);
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}
