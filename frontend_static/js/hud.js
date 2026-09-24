/**
 * Futuristic / Cyberpunk Canvas HUD Renderer
 * Traceability: Epic KAN-49, Task KAN-53
 */

class HUDDrawer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.animationPhase = 0;
  }

  clear() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.animationPhase += 0.03;
  }

  drawGrid() {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;

    // Draw center crosshair
    const cx = w / 2;
    const cy = h / 2;
    const size = 16;

    ctx.save();
    ctx.strokeStyle = 'rgba(6, 182, 212, 0.25)';
    ctx.lineWidth = 1;

    // Center crosshair
    ctx.beginPath();
    ctx.moveTo(cx - size, cy);
    ctx.lineTo(cx + size, cy);
    ctx.moveTo(cx, cy - size);
    ctx.lineTo(cx, cy + size);
    ctx.stroke();

    // Center circular reticle
    ctx.beginPath();
    ctx.arc(cx, cy, 32, 0, Math.PI * 2);
    ctx.setLineDash([4, 6]);
    ctx.stroke();

    ctx.restore();
  }

  drawDetection(box, label, score, isLocked = false) {
    const ctx = this.ctx;
    const x = box.origin_x;
    const y = box.origin_y;
    const w = box.width;
    const h = box.height;

    const mainColor = isLocked ? '#10b981' : '#06b6d4'; // Emerald for locked, Cyan for tracking
    const mainAlpha = isLocked ? 'rgba(16, 185, 129, 0.2)' : 'rgba(6, 182, 212, 0.12)';
    const cornerLen = Math.min(24, Math.min(w, h) / 3);

    ctx.save();

    // Semi-transparent target fill
    ctx.fillStyle = mainAlpha;
    ctx.fillRect(x, y, w, h);

    // Glowing border corners (Cyberpunk brackets)
    ctx.strokeStyle = mainColor;
    ctx.lineWidth = 2.5;
    ctx.shadowColor = mainColor;
    ctx.shadowBlur = isLocked ? 14 : 8;

    // Top-Left Corner
    ctx.beginPath();
    ctx.moveTo(x, y + cornerLen);
    ctx.lineTo(x, y);
    ctx.lineTo(x + cornerLen, y);
    ctx.stroke();

    // Top-Right Corner
    ctx.beginPath();
    ctx.moveTo(x + w - cornerLen, y);
    ctx.lineTo(x + w, y);
    ctx.lineTo(x + w, y + cornerLen);
    ctx.stroke();

    // Bottom-Left Corner
    ctx.beginPath();
    ctx.moveTo(x, y + h - cornerLen);
    ctx.lineTo(x, y + h);
    ctx.lineTo(x + cornerLen, y + h);
    ctx.stroke();

    // Bottom-Right Corner
    ctx.beginPath();
    ctx.moveTo(x + w - cornerLen, y + h);
    ctx.lineTo(x + w, y + h);
    ctx.lineTo(x + w, y + h - cornerLen);
    ctx.stroke();

    // Locked target center crosshair and animated pulse ring
    if (isLocked) {
      const centerX = x + w / 2;
      const centerY = y + h / 2;
      const pulseRadius = 14 + Math.sin(this.animationPhase * 4) * 3;

      ctx.save();
      ctx.strokeStyle = '#10b981';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(centerX, centerY, pulseRadius, 0, Math.PI * 2);
      ctx.stroke();

      // Cross inside circle
      ctx.beginPath();
      ctx.moveTo(centerX - 8, centerY);
      ctx.lineTo(centerX + 8, centerY);
      ctx.moveTo(centerX, centerY - 8);
      ctx.lineTo(centerX, centerY + 8);
      ctx.stroke();
      ctx.restore();
    }

    // Label Badge Pill
    const tagText = `${label.toUpperCase()} [${Math.round(score * 100)}%]`;
    ctx.font = '600 12px "Courier New", monospace, sans-serif';
    const textMetrics = ctx.measureText(tagText);
    const badgeW = textMetrics.width + 16;
    const badgeH = 22;
    const badgeY = Math.max(4, y - badgeH - 4);

    // Badge background
    ctx.fillStyle = isLocked ? 'rgba(6, 78, 59, 0.9)' : 'rgba(8, 51, 68, 0.9)';
    ctx.strokeStyle = mainColor;
    ctx.lineWidth = 1;
    ctx.fillRect(x, badgeY, badgeW, badgeH);
    ctx.strokeRect(x, badgeY, badgeW, badgeH);

    // Badge text
    ctx.fillStyle = '#f8fafc';
    ctx.shadowBlur = 0;
    ctx.fillText(tagText, x + 8, badgeY + 15);

    ctx.restore();
  }
}

window.HUDDrawer = HUDDrawer;
