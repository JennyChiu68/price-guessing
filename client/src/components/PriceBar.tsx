/**
 * PriceBar — 价格信息栏
 * 展示开盘价、当前价（实时波动）、倒计时
 * 设计：玻璃态卡片 + 发光边框
 */
import { motion } from "framer-motion";
import { useEffect, useState } from "react";

interface PriceBarProps {
  openPrice: number;
  currentPrice: number;
  closingTime: Date;
}

export default function PriceBar({ openPrice, currentPrice, closingTime }: PriceBarProps) {
  const [timeLeft, setTimeLeft] = useState({ h: 0, m: 0, s: 0, str: "00:00:00" });
  const [prevPrice, setPrevPrice] = useState(currentPrice);
  const [priceFlash, setPriceFlash] = useState<"up" | "down" | null>(null);

  const priceChange = currentPrice - openPrice;
  const priceChangePercent = ((priceChange / openPrice) * 100).toFixed(2);
  const isUp = priceChange >= 0;

  // 价格变化闪烁
  useEffect(() => {
    if (currentPrice !== prevPrice) {
      setPriceFlash(currentPrice > prevPrice ? "up" : "down");
      setPrevPrice(currentPrice);
      const t = setTimeout(() => setPriceFlash(null), 600);
      return () => clearTimeout(t);
    }
  }, [currentPrice, prevPrice]);

  useEffect(() => {
    const updateTimer = () => {
      const now = new Date();
      const diff = closingTime.getTime() - now.getTime();
      if (diff <= 0) {
        setTimeLeft({ h: 0, m: 0, s: 0, str: "已收盘" });
        return;
      }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setTimeLeft({
        h, m, s,
        str: `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`,
      });
    };
    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [closingTime]);

  return (
    <div className="flex flex-wrap items-center justify-center gap-3">

      {/* 开盘价 */}
      <div className="rounded-2xl px-4 py-3 text-center"
        style={{
          background: "rgba(255,255,255,0.04)",
          border: "1px solid rgba(255,255,255,0.1)",
          backdropFilter: "blur(12px)",
          minWidth: "110px",
        }}>
        <div className="text-gray-500 text-xs mb-0.5 font-display tracking-wide">今日开盘</div>
        <div className="font-mono-price font-bold text-xl text-white">
          {openPrice.toLocaleString()}
        </div>
        <div className="text-gray-600 text-xs">美元/盎司</div>
      </div>

      {/* 当前价格（核心展示） */}
      <motion.div
        className="rounded-2xl px-5 py-3 text-center relative overflow-hidden"
        style={{
          background: isUp ? "rgba(255,107,53,0.08)" : "rgba(0,191,255,0.07)",
          border: `1px solid ${isUp ? "rgba(255,107,53,0.35)" : "rgba(0,191,255,0.35)"}`,
          backdropFilter: "blur(12px)",
          minWidth: "145px",
          boxShadow: isUp ? "0 0 20px rgba(255,107,53,0.15)" : "0 0 20px rgba(0,191,255,0.12)",
        }}
        animate={priceFlash ? {
          boxShadow: priceFlash === "up"
            ? ["0 0 20px rgba(255,107,53,0.15)", "0 0 40px rgba(255,215,0,0.6)", "0 0 20px rgba(255,107,53,0.15)"]
            : ["0 0 20px rgba(0,191,255,0.12)", "0 0 40px rgba(0,191,255,0.6)", "0 0 20px rgba(0,191,255,0.12)"],
        } : {}}
        transition={{ duration: 0.5 }}
      >
        <div className="text-gray-500 text-xs mb-0.5 font-display tracking-wide">实时价格</div>
        <motion.div
          className="font-mono-price font-bold"
          style={{
            fontSize: "1.75rem",
            color: isUp ? "#FFD700" : "#00BFFF",
            textShadow: isUp ? "0 0 15px rgba(255,215,0,0.5)" : "0 0 15px rgba(0,191,255,0.5)",
          }}
          key={currentPrice}
          animate={{ scale: [1.08, 1] }}
          transition={{ type: "spring", stiffness: 400, damping: 20 }}
        >
          {currentPrice.toLocaleString()}
        </motion.div>
        <div className={`text-xs font-mono-price font-semibold ${isUp ? "text-green-400" : "text-red-400"}`}>
          {isUp ? "▲" : "▼"} {Math.abs(priceChange)} ({isUp ? "+" : ""}{priceChangePercent}%)
        </div>

        {/* 底部装饰线 */}
        <div className="absolute bottom-0 left-0 right-0 h-0.5"
          style={{
            background: isUp
              ? "linear-gradient(90deg, transparent, rgba(255,215,0,0.6), transparent)"
              : "linear-gradient(90deg, transparent, rgba(0,191,255,0.6), transparent)",
          }} />
      </motion.div>

      {/* 倒计时 */}
      <div className="rounded-2xl px-4 py-3 text-center"
        style={{
          background: "rgba(123,104,238,0.08)",
          border: "1px solid rgba(123,104,238,0.25)",
          backdropFilter: "blur(12px)",
          minWidth: "110px",
        }}>
        <div className="text-gray-500 text-xs mb-0.5 font-display tracking-wide">距收盘</div>
        <motion.div
          className="font-mono-price font-bold text-xl"
          style={{ color: "#9B8EE8" }}
          key={timeLeft.s}
          animate={{ opacity: [0.7, 1] }}
          transition={{ duration: 0.3 }}
        >
          {timeLeft.str}
        </motion.div>
        <div className="text-gray-600 text-xs">纽约时间</div>
      </div>
    </div>
  );
}
