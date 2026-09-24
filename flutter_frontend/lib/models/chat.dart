// Traceability: KAN-61

enum ChatRole { user, assistant, system }

class ChatMessage {
  final ChatRole role;
  final String content;
  final DateTime timestamp;
  final String? provider;

  ChatMessage({
    required this.role,
    required this.content,
    DateTime? timestamp,
    this.provider,
  }) : timestamp = timestamp ?? DateTime.now();

  factory ChatMessage.fromJson(Map<String, dynamic> json) {
    final roleStr = json['role'] as String? ?? 'user';
    final role = roleStr == 'assistant'
        ? ChatRole.assistant
        : (roleStr == 'system' ? ChatRole.system : ChatRole.user);
    return ChatMessage(
      role: role,
      content: json['content'] as String? ?? '',
      provider: json['provider'] as String?,
    );
  }

  Map<String, dynamic> toJson() => {
        'role': role.name,
        'content': content,
      };
}
