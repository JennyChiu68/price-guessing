/**
 * ParticleCanvas — 宇宙战场粒子背景
 * 设计：左侧熔岩粒子（橙红）+ 右侧冰川粒子（冰蓝）+ 中央碰撞区
 * 粒子随多空比例动态调整密度和流向
 */
import { useEffect, useRef } from "react";

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  opacity: number;
  life: number;
  maxLife: number;
  side: "bull" | "bear" | "neutral";
  color: string;
}

interface ParticleCanvasProps {
  bullRatio: number; // 0-1, 多方占比
  energyBurst?: "bull" | "bear" | null;
}

export default function ParticleCanvas({ bullRatio, energyBurst }: ParticleCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const animFrameRef = useRef<number>(0);
  const burstRef = useRef<{ side: "bull" | "bear"; intensity: number; x: number; y: number } | null>(null);

  useEffect(() => {
    if (energyBurst) {
      const canvas = canvasRef.current;
      if (!canvas) return;
      burstRef.current = {
        side: energyBurst,
        intensity: 1,
        x: energyBurst === "bull" ? canvas.width * 0.25 : canvas.width * 0.75,
        y: canvas.height * 0.5,
      };
    }
  }, [energyBurst]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;

    const resize = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    // 初始化粒子
    const initParticles = () => {
      particlesRef.current = [];
      const count = Math.min(120, Math.floor((canvas.width * canvas.height) / 8000));
      for (let i = 0; i < count; i++) {
        particlesRef.current.push(createParticle(canvas, Math.random() < bullRatio ? "bull" : "bear"));
      }
    };
    initParticles();

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // 绘制背景渐变
      const bgGrad = ctx.createLinearGradient(0, 0, canvas.width, 0);
      bgGrad.addColorStop(0, "rgba(20, 4, 2, 0.3)");
      bgGrad.addColorStop(0.45, "rgba(5, 2, 15, 0.1)");
      bgGrad.addColorStop(0.55, "rgba(5, 2, 15, 0.1)");
      bgGrad.addColorStop(1, "rgba(2, 4, 20, 0.3)");
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // 处理能量爆发
      if (burstRef.current) {
        const burst = burstRef.current;
        burst.intensity -= 0.015;
        if (burst.intensity <= 0) {
          burstRef.current = null;
        } else {
          // 爆发时生成额外粒子
          if (Math.random() < burst.intensity * 0.8) {
            for (let i = 0; i < 3; i++) {
              const p = createBurstParticle(canvas, burst.side, burst.x, burst.y);
              particlesRef.current.push(p);
            }
          }
          // 绘制爆发光圈
          const radius = (1 - burst.intensity) * 200;
          const alpha = burst.intensity * 0.4;
          const grd = ctx.createRadialGradient(burst.x, burst.y, 0, burst.x, burst.y, radius);
          if (burst.side === "bull") {
            grd.addColorStop(0, `rgba(255, 180, 0, ${alpha})`);
            grd.addColorStop(1, "rgba(255, 69, 0, 0)");
          } else {
            grd.addColorStop(0, `rgba(0, 200, 255, ${alpha})`);
            grd.addColorStop(1, "rgba(0, 100, 255, 0)");
          }
          ctx.fillStyle = grd;
          ctx.beginPath();
          ctx.arc(burst.x, burst.y, radius, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // 更新并绘制粒子
      particlesRef.current = particlesRef.current.filter((p) => {
        p.life++;
        if (p.life > p.maxLife) return false;

        // 向中央漂移
        const centerX = canvas.width / 2;
        const driftX = (centerX - p.x) * 0.0002;
        p.vx += driftX;

        // 边界反弹
        if (p.x < 0 || p.x > canvas.width) p.vx *= -0.8;
        if (p.y < 0 || p.y > canvas.height) p.vy *= -0.8;

        p.x += p.vx;
        p.y += p.vy;

        const lifeRatio = p.life / p.maxLife;
        const alpha = lifeRatio < 0.2
          ? (lifeRatio / 0.2) * p.opacity
          : lifeRatio > 0.8
          ? ((1 - lifeRatio) / 0.2) * p.opacity
          : p.opacity;

        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.fillStyle = p.color;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = p.size * 3;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        return true;
      });

      // 补充粒子
      if (particlesRef.current.length < 80) {
        const side = Math.random() < bullRatio ? "bull" : "bear";
        particlesRef.current.push(createParticle(canvas, side));
      }

      // 绘制中央碰撞线
      drawCollisionLine(ctx, canvas, bullRatio);

      animFrameRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.removeEventListener("resize", resize);
      cancelAnimationFrame(animFrameRef.current);
    };
  }, [bullRatio]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none"
      style={{ zIndex: 1 }}
    />
  );
}

function createParticle(canvas: HTMLCanvasElement, side: "bull" | "bear"): Particle {
  const isBull = side === "bull";
  const x = isBull
    ? Math.random() * canvas.width * 0.5
    : canvas.width * 0.5 + Math.random() * canvas.width * 0.5;
  const y = Math.random() * canvas.height;

  const bullColors = ["#FF6B35", "#FFD700", "#FF4500", "#FFA500", "#FF8C00"];
  const bearColors = ["#00BFFF", "#7B68EE", "#4169E1", "#00CED1", "#87CEEB"];
  const color = isBull
    ? bullColors[Math.floor(Math.random() * bullColors.length)]
    : bearColors[Math.floor(Math.random() * bearColors.length)];

  const speed = 0.3 + Math.random() * 0.8;
  const angle = isBull
    ? Math.random() * Math.PI * 0.5 + Math.PI * 0.25 // 向右飘
    : Math.random() * Math.PI * 0.5 + Math.PI * 1.25; // 向左飘

  return {
    x,
    y,
    vx: Math.cos(angle) * speed,
    vy: (Math.random() - 0.5) * speed * 0.5,
    size: 1 + Math.random() * 2.5,
    opacity: 0.4 + Math.random() * 0.5,
    life: 0,
    maxLife: 150 + Math.random() * 200,
    side,
    color,
  };
}

function createBurstParticle(
  canvas: HTMLCanvasElement,
  side: "bull" | "bear",
  cx: number,
  cy: number
): Particle {
  const bullColors = ["#FFD700", "#FF6B35", "#FFA500"];
  const bearColors = ["#00BFFF", "#87CEEB", "#7B68EE"];
  const colors = side === "bull" ? bullColors : bearColors;
  const color = colors[Math.floor(Math.random() * colors.length)];
  const angle = Math.random() * Math.PI * 2;
  const speed = 1 + Math.random() * 3;

  return {
    x: cx + (Math.random() - 0.5) * 40,
    y: cy + (Math.random() - 0.5) * 40,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    size: 1.5 + Math.random() * 3,
    opacity: 0.8,
    life: 0,
    maxLife: 60 + Math.random() * 60,
    side,
    color,
  };
}

function drawCollisionLine(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  bullRatio: number
) {
  const cx = canvas.width / 2;
  const time = Date.now() / 1000;
  const wobble = Math.sin(time * 2) * 3;

  // 中央发光竖线
  const lineGrad = ctx.createLinearGradient(0, 0, 0, canvas.height);
  lineGrad.addColorStop(0, "rgba(255, 255, 255, 0)");
  lineGrad.addColorStop(0.3, "rgba(255, 215, 0, 0.6)");
  lineGrad.addColorStop(0.5, "rgba(255, 255, 255, 0.9)");
  lineGrad.addColorStop(0.7, "rgba(255, 215, 0, 0.6)");
  lineGrad.addColorStop(1, "rgba(255, 255, 255, 0)");

  ctx.save();
  ctx.strokeStyle = lineGrad;
  ctx.lineWidth = 1.5;
  ctx.shadowColor = "#FFD700";
  ctx.shadowBlur = 8;
  ctx.beginPath();
  ctx.moveTo(cx + wobble, 0);
  ctx.lineTo(cx + wobble, canvas.height);
  ctx.stroke();
  ctx.restore();
}
