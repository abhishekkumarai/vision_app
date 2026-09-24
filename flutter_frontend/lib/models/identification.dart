// Traceability: KAN-61, KAN-71

/// Mirrors the backend `ObjectInsights` schema (`backend/schemas.py`) returned
/// by `/api/identify`, plus the detection [label]/[confidence] that triggered it
/// (the backend does not echo those back).
class IdentifyResponse {
  final String label;
  final double confidence;
  final String name;
  final String category;
  final String summary;
  final List<String> primaryUses;
  final List<String> materialsAndSpecs;
  final List<String> safetyAndMaintenance;
  final List<String> funFacts;
  final List<String> suggestedQuestions;
  final String modelUsed;

  IdentifyResponse({
    required this.label,
    required this.confidence,
    required this.name,
    required this.category,
    required this.summary,
    this.primaryUses = const [],
    this.materialsAndSpecs = const [],
    this.safetyAndMaintenance = const [],
    this.funFacts = const [],
    this.suggestedQuestions = const [],
    this.modelUsed = 'unknown',
  });

  factory IdentifyResponse.fromJson(
    Map<String, dynamic> json, {
    required String label,
    required double confidence,
  }) {
    List<String> strings(String key) =>
        (json[key] as List<dynamic>?)?.map((e) => e.toString()).toList() ?? const [];
    return IdentifyResponse(
      label: label,
      confidence: confidence,
      name: json['name'] as String? ?? label,
      category: json['category'] as String? ?? 'General',
      summary: json['summary'] as String? ?? 'No description available.',
      primaryUses: strings('primary_uses'),
      materialsAndSpecs: strings('materials_and_specs'),
      safetyAndMaintenance: strings('safety_and_maintenance'),
      funFacts: strings('fun_facts'),
      suggestedQuestions: strings('suggested_questions'),
      modelUsed: json['model_used'] as String? ?? 'unknown',
    );
  }

  /// Backend `ObjectInsights` shape — sent back as `object_context` on `/api/chat`.
  Map<String, dynamic> toJson() => {
        'name': name,
        'category': category,
        'summary': summary,
        'primary_uses': primaryUses,
        'materials_and_specs': materialsAndSpecs,
        'safety_and_maintenance': safetyAndMaintenance,
        'fun_facts': funFacts,
        'suggested_questions': suggestedQuestions,
        'model_used': modelUsed,
      };
}
