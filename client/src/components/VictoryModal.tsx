/**
 * VictoryModal — 猜中奖励弹窗
 * 全屏庆典动效 + 钻石VIP领取提示
 */
import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useRef } from "react";

interface VictoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  price: number;
  nickname?: string;
}

export default function VictoryModal({ isOpen, onClose, price, nickname }: VictoryModalProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);

  useEffect(() => {
    if (!isOpen) {
      cancelAnimationFrame(animRef.current);
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    interface Confetti {
      x: number; y: number; vx: number; vy: number;
      size: number; color: string; rotation: number; rotSpeed: number;
      shape: "circle" | "rect" | "star";
    }

    const confetti: Confetti[] = [];
    const colors = ["#FFD700", "#FF6B35", "#00BFFF", "#7B68EE", "#FF4500", "#87CEEB", "#FFA500", "#FFFFFF"];

    for (let i = 0; i < 150; i++) {
      confetti.push({
        x: Math.random() * canvas.width,
        y: -20 - Math.random() * 200,
        vx: (Math.random() - 0.5) * 4,
        vy: 2 + Math.random() * 4,
        size: 4 + Math.random() * 8,
        color: colors[Math.floor(Math.random() * colors.length)],
        rotation: Math.random() * Math.PI * 2,
        rotSpeed: (Math.random() - 0.5) * 0.2,
        shape: ["circle", "rect", "star"][Math.floor(Math.random() * 3)] as Confetti["shape"],
      });
    }

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      confetti.forEach((c) => {
        c.x += c.vx;
        c.y += c.vy;
        c.rotation += c.rotSpeed;
        c.vy += 0.05; // gravity

        if (c.y > canvas.height + 20) {
          c.y = -20;
          c.x = Math.random() * canvas.width;
          c.vy = 2 + Math.random() * 4;
        }

        ctx.save();
        ctx.translate(c.x, c.y);
        ctx.rotate(c.rotation);
        ctx.fillStyle = c.color;
        ctx.shadowColor = c.color;
        ctx.shadowBlur = 4;

        if (c.shape === "circle") {
          ctx.beginPath();
          ctx.arc(0, 0, c.size / 2, 0, Math.PI * 2);
          ctx.fill();
        } else if (c.shape === "rect") {
          ctx.fillRect(-c.size / 2, -c.size / 4, c.size, c.size / 2);
        } else {
          // star
          ctx.beginPath();
          for (let j = 0; j < 5; j++) {
            const angle = (j * 4 * Math.PI) / 5 - Math.PI / 2;
            const r = j % 2 === 0 ? c.size / 2 : c.size / 4;
            if (j === 0) ctx.moveTo(Math.cos(angle) * r, Math.sin(angle) * r);
            else ctx.lineTo(Math.cos(angle) * r, Math.sin(angle) * r);
          }
          ctx.closePath();
          ctx.fill();
        }
        ctx.restore();
      });

      animRef.current = requestAnimationFrame(animate);
    };

    animate();
    return () => cancelAnimationFrame(animRef.current);
  }, [isOpen]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          {/* 彩纸背景 */}
          <canvas
            ref={canvasRef}
            className="absolute inset-0 pointer-events-none"
            style={{ zIndex: 0 }}
          />

          {/* 暗色遮罩 */}
          <motion.div
            className="absolute inset-0 bg-black/70"
            onClick={onClose}
          />

          {/* 弹窗内容 */}
          <motion.div
            className="relative z-10 max-w-md w-full mx-4"
            initial={{ scale: 0.5, y: 50, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.8, y: 20, opacity: 0 }}
            transition={{ type: "spring", stiffness: 200, damping: 20 }}
          >
            <div className="glass-panel rounded-3xl p-8 text-center relative overflow-hidden"
              style={{
                background: "linear-gradient(135deg, rgba(10,5,0,0.95), rgba(20,10,0,0.95))",
                border: "2px solid rgba(255,215,0,0.6)",
                boxShadow: "0 0 60px rgba(255,215,0,0.4), 0 0 120px rgba(255,107,53,0.2)",
              }}>

              {/* 背景光晕 */}
              <div className="absolute inset-0 opacity-20"
                style={{
                  background: "radial-gradient(ellipse at center, rgba(255,215,0,0.6) 0%, transparent 70%)",
                }} />

              {/* 钻石图标 */}
              <motion.div
                className="text-7xl mb-4 relative z-10"
                animate={{
                  scale: [1, 1.2, 1],
                  rotate: [0, 5, -5, 0],
                }}
                transition={{ duration: 1.5, repeat: Infinity }}
              >
                💎
              </motion.div>

              {/* 标题 */}
              <motion.div
                className="font-display font-bold text-3xl mb-2 relative z-10"
                style={{
                  background: "linear-gradient(135deg, #FFD700, #FFA500, #FFD700)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                  backgroundSize: "200% 100%",
                }}
                animate={{ backgroundPosition: ["0% center", "200% center", "0% center"] }}
                transition={{ duration: 3, repeat: Infinity }}
              >
                🎉 恭喜猜中！
              </motion.div>

              <div className="text-gray-300 text-sm mb-4 relative z-10">
                {nickname ? `「${nickname}」` : "你"}精准预测了今日黄金收盘价
              </div>

              {/* 价格展示 */}
              <div className="glass-panel rounded-2xl p-4 mb-6 relative z-10"
                style={{ border: "1px solid rgba(255,215,0,0.4)" }}>
                <div className="text-gray-400 text-xs mb-1">今日黄金收盘价</div>
                <div className="font-mono-price font-bold text-4xl gold-text">
                  ${price.toLocaleString()}
                </div>
                <div className="text-yellow-400 text-xs mt-1">与你的猜测完全一致 ✓</div>
              </div>

              {/* 奖励说明 */}
              <div className="glass-panel rounded-2xl p-4 mb-6 relative z-10"
                style={{ border: "1px solid rgba(123,104,238,0.4)" }}>
                <div className="flex items-center gap-3">
                  <div className="text-3xl">💎</div>
                  <div className="text-left">
                    <div className="text-white font-semibold text-sm">金十数据 · 钻石VIP体验</div>
                    <div className="text-gray-400 text-xs mt-0.5">一日钻石会员 · 全功能解锁</div>
                  </div>
                </div>
              </div>

              {/* 领取按钮 */}
              <motion.button
                className="w-full py-4 rounded-2xl font-display font-bold text-lg text-black relative z-10 overflow-hidden"
                style={{
                  background: "linear-gradient(135deg, #FFD700, #FFA500, #FF6B35)",
                  boxShadow: "0 0 30px rgba(255,215,0,0.5)",
                }}
                whileHover={{ scale: 1.03, boxShadow: "0 0 40px rgba(255,215,0,0.7)" }}
                whileTap={{ scale: 0.97 }}
                onClick={onClose}
              >
                <motion.div
                  className="absolute inset-0"
                  style={{
                    background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent)",
                    backgroundSize: "200% 100%",
                  }}
                  animate={{ backgroundPosition: ["-200% center", "200% center"] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                />
                🎁 立即领取钻石VIP
              </motion.button>

              <div className="text-gray-500 text-xs mt-3 relative z-10">
                前往金十数据APP领取奖励
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
