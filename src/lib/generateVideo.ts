/**
 * Generates an H.264 MP4 video of the gift card for WhatsApp sharing.
 *
 * Uses WebCodecs VideoEncoder + mp4-muxer for true MP4 output that works
 * on all phones (iOS/Android) and WhatsApp.
 *
 * Falls back to MediaRecorder (WebM) only if WebCodecs is unavailable.
 *
 * Animation: Orange envelope appears → flap opens → card slides out → envelope fades.
 */

import { Muxer, ArrayBufferTarget } from "mp4-muxer";

/* ─── helpers ─── */

function easeOutCubic(t: number) {
  return 1 - Math.pow(1 - t, 3);
}

function easeInOutQuad(t: number) {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

function easeOutBack(t: number) {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

/* ─── envelope drawing ─── */

function drawEnvelope(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  flapAngle: number,
  orange: string,
) {
  const bodyH = h * 0.72;
  const bodyY = y + h - bodyH;
  const flapH = h * 0.38;
  const radius = 20;

  ctx.save();
  ctx.fillStyle = orange;
  ctx.beginPath();
  ctx.moveTo(x, bodyY);
  ctx.lineTo(x + w, bodyY);
  ctx.lineTo(x + w, y + h - radius);
  ctx.arcTo(x + w, y + h, x + w - radius, y + h, radius);
  ctx.lineTo(x + radius, y + h);
  ctx.arcTo(x, y + h, x, y + h - radius, radius);
  ctx.closePath();
  ctx.fill();

  const innerGrad = ctx.createLinearGradient(x, bodyY, x, y + h);
  innerGrad.addColorStop(0, "rgba(0,0,0,0.12)");
  innerGrad.addColorStop(0.15, "rgba(0,0,0,0)");
  ctx.fillStyle = innerGrad;
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.strokeStyle = "rgba(0,0,0,0.08)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x, bodyY);
  ctx.lineTo(x + w / 2, bodyY + bodyH * 0.65);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x + w, bodyY);
  ctx.lineTo(x + w / 2, bodyY + bodyH * 0.65);
  ctx.stroke();
  ctx.restore();

  ctx.save();
  const flapCenterX = x + w / 2;
  const flapBaseY = bodyY;
  const scaleY = Math.cos(flapAngle * Math.PI);
  ctx.translate(flapCenterX, flapBaseY);
  ctx.scale(1, scaleY);

  const flapColor =
    flapAngle > 0.5 ? darkenColor(orange, 0.15) : lightenColor(orange, 0.08);
  ctx.fillStyle = flapColor;

  ctx.beginPath();
  ctx.moveTo(-w / 2, 0);
  ctx.lineTo(0, flapH);
  ctx.lineTo(w / 2, 0);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = "rgba(0,0,0,0.1)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-w / 2, 0);
  ctx.lineTo(w / 2, 0);
  ctx.stroke();
  ctx.restore();
}

function lightenColor(hex: string, amount: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgb(${Math.min(255, r + 255 * amount)}, ${Math.min(255, g + 255 * amount)}, ${Math.min(255, b + 255 * amount)})`;
}

function darkenColor(hex: string, amount: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgb(${Math.max(0, r - 255 * amount)}, ${Math.max(0, g - 255 * amount)}, ${Math.max(0, b - 255 * amount)})`;
}

/* ─── main ─── */

export interface VideoOptions {
  cardImage: HTMLImageElement;
  recipientName: string;
  onProgress?: (pct: number) => void;
}

/**
 * Render one animation frame on the canvas.
 * Extracted so both encoders can use it.
 */
function renderFrame(
  ctx: CanvasRenderingContext2D,
  time: number,
  W: number,
  H: number,
  cardImage: HTMLImageElement,
  cardDisplayW: number,
  cardDisplayH: number,
  cardFinalY: number,
  envW: number,
  envH: number,
  envX: number,
  envY: number,
  recipientName: string,
) {
  const BG = "#f8f4ef";
  const ORANGE = "#ea7014";

  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, W, H);

  // ── Phase 1: Intro text (0 – 2s) ──
  if (time < 2.0) {
    const textIn = time < 0.6 ? easeOutCubic(time / 0.6) : 1;
    const textOut = time > 1.3 ? 1 - easeInOutQuad((time - 1.3) / 0.7) : 1;
    const alpha = Math.max(0, textIn * textOut);

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = ORANGE;
    ctx.font = "bold 52px system-ui, -apple-system, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("Un regalo especial", W / 2, H / 2 - 50);

    ctx.font = "900 68px system-ui, -apple-system, sans-serif";
    ctx.fillText(`para ${recipientName}`, W / 2, H / 2 + 40);

    ctx.globalAlpha = alpha * 0.35;
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.arc(W / 2 - 30 + i * 30, H / 2 + 110, 5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // Envelope slide-in: 1.4 – 2.2s
  const envSlideT = Math.max(0, Math.min(1, (time - 1.4) / 0.8));
  const envSlideEased = easeOutBack(envSlideT);
  const envOffsetY = lerp(H + 50, 0, envSlideEased);
  const envVisible = time > 1.4;

  // Flap open: 2.8 – 3.5s
  const flapT = Math.max(0, Math.min(1, (time - 2.8) / 0.7));
  const flapAngle = easeInOutQuad(flapT);

  // Envelope fade-out: 4.8 – 5.5s
  const envFadeT = Math.max(0, Math.min(1, (time - 4.8) / 0.7));
  const envAlpha = 1 - easeInOutQuad(envFadeT);
  const envExitY = envFadeT > 0 ? lerp(0, 180, easeInOutQuad(envFadeT)) : 0;

  // Card slide-out: 3.3 – 5.0s
  const cardSlideT = Math.max(0, Math.min(1, (time - 3.3) / 1.7));
  const cardSlideEased = easeOutCubic(cardSlideT);
  const cardInsideY = envY + envH * 0.25 + envOffsetY;
  const cardCurrentY =
    time < 3.3 ? cardInsideY : lerp(cardInsideY, cardFinalY, cardSlideEased);
  const cardAlpha = time < 3.3 ? 0 : Math.min(1, cardSlideT * 3);

  const actualEnvBodyTop = envY + envH * 0.28 + envOffsetY + envExitY;
  const envelopeStillVisible = envVisible && envAlpha > 0;

  // ── Draw card (clipped behind envelope) ──
  if (cardAlpha > 0) {
    ctx.save();
    ctx.globalAlpha = cardAlpha;

    if (envelopeStillVisible) {
      ctx.beginPath();
      ctx.rect(0, 0, W, actualEnvBodyTop);
      ctx.clip();
    }

    ctx.shadowColor = "rgba(0,0,0,0.13)";
    ctx.shadowBlur = 30 * cardSlideEased;
    ctx.shadowOffsetY = 8 * cardSlideEased;

    const cx = (W - cardDisplayW) / 2;
    const radius = 20;
    ctx.beginPath();
    ctx.roundRect(cx, cardCurrentY, cardDisplayW, cardDisplayH, radius);
    ctx.closePath();
    ctx.clip();

    ctx.drawImage(cardImage, cx, cardCurrentY, cardDisplayW, cardDisplayH);
    ctx.restore();
  }

  // ── Draw envelope on top ──
  if (envelopeStillVisible) {
    ctx.save();
    ctx.globalAlpha = envAlpha;
    ctx.shadowColor = "rgba(0,0,0,0.18)";
    ctx.shadowBlur = 35;
    ctx.shadowOffsetY = 12;

    drawEnvelope(
      ctx,
      envX,
      envY + envOffsetY + envExitY,
      envW,
      envH,
      flapAngle,
      ORANGE,
    );
    ctx.restore();
  }

  // ── Shine sweep (5.0 – 5.8s) ──
  if (time > 5.0 && time < 5.8) {
    const shineT = (time - 5.0) / 0.8;
    const shineX = -200 + (W + 400) * easeInOutQuad(shineT);

    ctx.save();
    ctx.globalAlpha = 0.2;
    const gradient = ctx.createLinearGradient(shineX - 120, 0, shineX + 120, 0);
    gradient.addColorStop(0, "transparent");
    gradient.addColorStop(0.5, "white");
    gradient.addColorStop(1, "transparent");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, cardFinalY, W, cardDisplayH);
    ctx.restore();
  }

  // ── Watermark (5.8+) ──
  if (time > 5.8) {
    const wmT = Math.min(1, (time - 5.8) / 0.8);
    ctx.save();
    ctx.globalAlpha = wmT * 0.4;
    ctx.fillStyle = ORANGE;
    ctx.font = "bold 32px system-ui, -apple-system, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Carestino · Gift Card", W / 2, H - 120);
    ctx.restore();
  }
}

/* ─── MP4 encoder (WebCodecs + mp4-muxer) ─── */

async function generateWithWebCodecs(
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  FPS: number,
  DURATION: number,
  TOTAL_FRAMES: number,
  cardImage: HTMLImageElement,
  cardDisplayW: number,
  cardDisplayH: number,
  cardFinalY: number,
  envW: number,
  envH: number,
  envX: number,
  envY: number,
  recipientName: string,
  onProgress?: (pct: number) => void,
): Promise<Blob> {
  const muxer = new Muxer({
    target: new ArrayBufferTarget(),
    video: {
      codec: "avc",
      width: W,
      height: H,
    },
    fastStart: "in-memory",
  });

  let frameCount = 0;

  const encoder = new VideoEncoder({
    output: (chunk, meta) => {
      muxer.addVideoChunk(chunk, meta ?? undefined);
    },
    error: (e) => {
      console.error("VideoEncoder error:", e);
    },
  });

  encoder.configure({
    codec: "avc1.640028", // H.264 High Profile Level 4.0
    width: W,
    height: H,
    bitrate: 4_000_000,
    framerate: FPS,
  });

  // Encode all frames
  for (let frame = 0; frame < TOTAL_FRAMES; frame++) {
    const time = (frame / TOTAL_FRAMES) * DURATION;

    renderFrame(
      ctx,
      time,
      W,
      H,
      cardImage,
      cardDisplayW,
      cardDisplayH,
      cardFinalY,
      envW,
      envH,
      envX,
      envY,
      recipientName,
    );

    const videoFrame = new VideoFrame(canvas, {
      timestamp: (frame * 1_000_000) / FPS, // microseconds
      duration: 1_000_000 / FPS,
    });

    const keyFrame = frame % (FPS * 2) === 0; // keyframe every 2 seconds
    encoder.encode(videoFrame, { keyFrame });
    videoFrame.close();

    frameCount++;
    onProgress?.(Math.round((frameCount / TOTAL_FRAMES) * 95)); // reserve 5% for finalize

    // Yield to keep UI responsive – flush every 10 frames
    if (frame % 10 === 0) {
      await new Promise((r) => setTimeout(r, 0));
    }

    // Back-pressure: wait if encoder queue is too large
    if (encoder.encodeQueueSize > 10) {
      await new Promise((r) => setTimeout(r, 1));
    }
  }

  // Hold last frame (15 extra frames ≈ 0.5s)
  for (let i = 0; i < 15; i++) {
    const videoFrame = new VideoFrame(canvas, {
      timestamp: ((TOTAL_FRAMES + i) * 1_000_000) / FPS,
      duration: 1_000_000 / FPS,
    });
    encoder.encode(videoFrame, { keyFrame: false });
    videoFrame.close();
  }

  await encoder.flush();
  encoder.close();
  muxer.finalize();

  onProgress?.(100);

  const { buffer } = muxer.target;
  return new Blob([buffer], { type: "video/mp4" });
}

/* ─── Fallback: MediaRecorder (WebM) ─── */

async function generateWithMediaRecorder(
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  FPS: number,
  DURATION: number,
  TOTAL_FRAMES: number,
  cardImage: HTMLImageElement,
  cardDisplayW: number,
  cardDisplayH: number,
  cardFinalY: number,
  envW: number,
  envH: number,
  envX: number,
  envY: number,
  recipientName: string,
  onProgress?: (pct: number) => void,
): Promise<Blob> {
  const stream = canvas.captureStream(FPS);

  const mimeType = MediaRecorder.isTypeSupported("video/webm; codecs=vp9")
    ? "video/webm; codecs=vp9"
    : "video/webm";

  const recorder = new MediaRecorder(stream, {
    mimeType,
    videoBitsPerSecond: 4_000_000,
  });

  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };

  const recordingDone = new Promise<Blob>((resolve) => {
    recorder.onstop = () => {
      resolve(new Blob(chunks, { type: "video/webm" }));
    };
  });

  recorder.start();

  for (let frame = 0; frame < TOTAL_FRAMES; frame++) {
    const time = (frame / TOTAL_FRAMES) * DURATION;

    renderFrame(
      ctx,
      time,
      W,
      H,
      cardImage,
      cardDisplayW,
      cardDisplayH,
      cardFinalY,
      envW,
      envH,
      envX,
      envY,
      recipientName,
    );

    onProgress?.(Math.round((frame / TOTAL_FRAMES) * 100));
    await new Promise((r) => setTimeout(r, 1000 / FPS));
  }

  await new Promise((r) => setTimeout(r, 500));
  recorder.stop();
  return recordingDone;
}

/* ─── Public API ─── */

export async function generateGiftCardVideo({
  cardImage,
  recipientName,
  onProgress,
}: VideoOptions): Promise<Blob> {
  const W = 1080;
  const H = 1920;
  const FPS = 30;
  const DURATION = 7;
  const TOTAL_FRAMES = FPS * DURATION;

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;

  const cardDisplayW = W * 0.78;
  const cardDisplayH = (cardImage.height / cardImage.width) * cardDisplayW;
  const cardFinalY = (H - cardDisplayH) / 2 - 20;

  const envW = cardDisplayW * 1.08;
  const envH = envW * 0.7;
  const envX = (W - envW) / 2;
  const envCenterY = H / 2 + 60;
  const envY = envCenterY - envH / 2;

  // Try WebCodecs (produces real H.264 MP4 — works on all phones and WhatsApp)
  const supportsWebCodecs =
    typeof VideoEncoder !== "undefined" && typeof VideoFrame !== "undefined";

  if (supportsWebCodecs) {
    try {
      const support = await VideoEncoder.isConfigSupported({
        codec: "avc1.640028",
        width: W,
        height: H,
        bitrate: 4_000_000,
        framerate: FPS,
      });

      if (support.supported) {
        console.log("[video] Using WebCodecs + mp4-muxer (H.264 MP4)");
        return await generateWithWebCodecs(
          canvas,
          ctx,
          W,
          H,
          FPS,
          DURATION,
          TOTAL_FRAMES,
          cardImage,
          cardDisplayW,
          cardDisplayH,
          cardFinalY,
          envW,
          envH,
          envX,
          envY,
          recipientName,
          onProgress,
        );
      }
    } catch (err) {
      console.warn("[video] WebCodecs check failed, falling back:", err);
    }
  }

  // Fallback to MediaRecorder (WebM - may not work on all phones)
  console.log("[video] Falling back to MediaRecorder (WebM)");
  return await generateWithMediaRecorder(
    canvas,
    ctx,
    W,
    H,
    FPS,
    DURATION,
    TOTAL_FRAMES,
    cardImage,
    cardDisplayW,
    cardDisplayH,
    cardFinalY,
    envW,
    envH,
    envX,
    envY,
    recipientName,
    onProgress,
  );
}
