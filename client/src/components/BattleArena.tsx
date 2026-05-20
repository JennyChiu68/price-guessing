/**
 * BattleArena — 多空 PK 战场核心组件
 * 设计：「熔岩 vs 冰川」元素对决
 * - 顶部能量对撞条（动态比例）
 * - 左侧多方（熔岩牛）+ 右侧空方（冰川熊）
 * - 中央 VS 碰撞区（发光分割线）
 * - 实时爆发光效
 */
import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState } from "react";

interface BattleArenaProps {
  bullCount: number;
  bearCount: number;
  bullRatio: number;
  lastBurst?: "bull" | "bear" | null;
  openPrice: number;
  currentPrice: number;
}

export default function BattleArena({
  bullCount,
  bearCount,
  bullRatio,
  lastBurst,
}: BattleArenaProps) {
  const bearRatio = 1 - bullRatio;
  const bullPercent = Math.round(bullRatio * 100);
  const bearPercent = 100 - bullPercent;
  const totalCount = bullCount + bearCount;

  // 主导方
  const dominant = bullRatio > 0.5 ? "bull" : bullRatio < 0.5 ? "bear" : null;

  return (
    <div className="w-full space-y-3">

      {/* ── 能量对撞条 ── */}
      <div className="relative">
        {/* 标签行 */}
        <div className="flex justify-between items-center mb-1.5 px-1">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full" style={{ background: "#FF6B35", boxShadow: "0 0 6px #FF6B35" }} />
            <span className="font-display text-xs font-semibold" style={{ color: "#FF8C42" }}>看涨多方</span>
            <span className="font-mono-price text-xs text-gray-500">{bullCount}人</span>
          </div>
          <div className="text-xs text-gray-600 font-display">共 {totalCount} 人参战</div>
          <div className="flex items-center gap-1.5">
            <span className="font-mono-price text-xs text-gray-500">{bearCount}人</span>
            <span className="font-display text-xs font-semibold" style={{ color: "#00BFFF" }}>看跌空方</span>
            <div className="w-2 h-2 rounded-full" style={{ background: "#00BFFF", boxShadow: "0 0 6px #00BFFF" }} />
          </div>
        </div>

        {/* 能量条主体 */}
        <div className="relative h-10 rounded-full overflow-hidden"
          style={{
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.1)",
          }}>
          {/* 多方能量填充 */}
          <motion.div
            className="absolute left-0 top-0 h-full"
            style={{
              background: "linear-gradient(90deg, #CC3300, #FF4500, #FF6B35, #FFD700)",
              boxShadow: "inset 0 0 15px rgba(255,107,53,0.4)",
            }}
            animate={{ width: `${bullPercent}%` }}
            transition={{ type: "spring", stiffness: 60, damping: 18 }}
          />
          {/* 空方能量填充 */}
          <motion.div
            className="absolute right-0 top-0 h-full"
            style={{
              background: "linear-gradient(270deg, #4400CC, #4169E1, #00BFFF, #87CEEB)",
              boxShadow: "inset 0 0 15px rgba(0,191,255,0.4)",
            }}
            animate={{ width: `${bearPercent}%` }}
            transition={{ type: "spring", stiffness: 60, damping: 18 }}
          />

          {/* 碰撞中心点 */}
          <motion.div
            className="absolute top-0 h-full flex items-center justify-center"
            style={{ width: "3px", marginLeft: "-1.5px" }}
            animate={{ left: `${bullPercent}%` }}
            transition={{ type: "spring", stiffness: 60, damping: 18 }}
          >
            <div className="w-full h-full"
              style={{
                background: "rgba(255,255,255,0.95)",
                boxShadow: "0 0 10px rgba(255,255,255,0.9), 0 0 20px rgba(255,215,0,0.7)",
              }} />
          </motion.div>

          {/* 百分比文字 */}
          <div className="absolute inset-0 flex items-center justify-between px-4 pointer-events-none">
            <span className="font-mono-price font-bold text-white text-sm"
              style={{ textShadow: "0 0 8px rgba(0,0,0,0.8)" }}>
              {bullPercent}%
            </span>
            <span className="font-mono-price font-bold text-white text-sm"
              style={{ textShadow: "0 0 8px rgba(0,0,0,0.8)" }}>
              {bearPercent}%
            </span>
          </div>
        </div>

        {/* 主导方提示 */}
        <AnimatePresence>
          {dominant && (
            <motion.div
              className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-xs font-display"
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              style={{ color: dominant === "bull" ? "#FF8C42" : "#00BFFF" }}
            >
              {dominant === "bull" ? "🔥 多方领先" : "❄️ 空方领先"}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── 战场主体 ── */}
      <div className="relative flex items-stretch gap-3 mt-6">

        {/* 多方阵营 */}
        <motion.div
          className="flex-1 relative rounded-2xl overflow-hidden flex flex-col items-center justify-center py-6 px-4"
          style={{
            background: "rgba(255, 69, 0, 0.07)",
            border: "1px solid rgba(255, 107, 53, 0.25)",
            backdropFilter: "blur(8px)",
          }}
          animate={lastBurst === "bull" ? {
            borderColor: ["rgba(255,107,53,0.25)", "rgba(255,215,0,0.8)", "rgba(255,107,53,0.25)"],
            boxShadow: [
              "0 0 0px rgba(255,107,53,0)",
              "0 0 50px rgba(255,107,53,0.6), 0 0 100px rgba(255,107,53,0.3)",
              "0 0 0px rgba(255,107,53,0)",
            ],
          } : {}}
          transition={{ duration: 0.7 }}
        >
          {/* 背景光晕 */}
          <div className="absolute inset-0 pointer-events-none"
            style={{
              background: "radial-gradient(ellipse at 30% 40%, rgba(255,107,53,0.12) 0%, transparent 65%)",
            }} />

          {/* 爆发时的全屏光效 */}
          <AnimatePresence>
            {lastBurst === "bull" && (
              <motion.div
                className="absolute inset-0 pointer-events-none rounded-2xl"
                initial={{ opacity: 0 }}
                animate={{ opacity: [0, 0.4, 0] }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.7 }}
                style={{ background: "radial-gradient(ellipse at center, rgba(255,215,0,0.3) 0%, rgba(255,107,53,0.1) 50%, transparent 70%)" }}
              />
            )}
          </AnimatePresence>

          {/* 牛图标 */}
          <motion.div
            className="relative mb-3"
            animate={lastBurst === "bull" ? {
              scale: [1, 1.25, 1],
              rotate: [0, -8, 8, 0],
            } : { scale: 1 }}
            transition={{ duration: 0.6 }}
          >
            <img
              src="https://d2xsxph8kpxj0f.cloudfront.net/309938607060186295/midz7h2PLi8d7FasFPUnNi/bull-energy-gfnvczaXsKAkDhSHbuWXGo.webp"
              alt="多方"
              className="w-20 h-20 object-cover rounded-full animate-float"
              style={{
                boxShadow: "0 0 25px rgba(255,107,53,0.5), 0 0 50px rgba(255,107,53,0.2)",
                border: "2px solid rgba(255,107,53,0.5)",
              }}
            />
            {/* 能量环 */}
            <motion.div
              className="absolute inset-0 rounded-full"
              style={{ border: "2px solid rgba(255,215,0,0.4)" }}
              animate={{ scale: [1, 1.3, 1], opacity: [0.6, 0, 0.6] }}
              transition={{ duration: 2.5, repeat: Infinity }}
            />
          </motion.div>

          <div className="font-display font-bold text-base mb-1"
            style={{
              background: "linear-gradient(135deg, #FF6B35, #FFD700)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}>
            看涨多方
          </div>

          <motion.div
            className="font-mono-price font-bold text-white"
            style={{ fontSize: "2rem" }}
            key={bullCount}
            animate={{ scale: [1.2, 1] }}
            transition={{ type: "spring", stiffness: 300, damping: 15 }}
          >
            {bullCount}
            <span className="text-sm font-normal text-gray-400 ml-1">人</span>
          </motion.div>

          <div className="text-xs text-gray-500 mt-1 text-center">
            猜测收盘价 ≥ 开盘价
          </div>

          {/* 底部装饰线 */}
          <div className="absolute bottom-0 left-0 right-0 h-0.5"
            style={{ background: "linear-gradient(90deg, transparent, rgba(255,107,53,0.5), transparent)" }} />
        </motion.div>

        {/* 中央 VS */}
        <div className="flex flex-col items-center justify-center w-14 gap-1 relative z-10">
          <motion.div
            className="font-display font-black text-2xl"
            style={{
              background: "linear-gradient(135deg, #FF6B35, #FFD700, #00BFFF)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
              filter: "drop-shadow(0 0 8px rgba(255,215,0,0.5))",
            }}
            animate={{ scale: [1, 1.08, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            VS
          </motion.div>

          {/* 发光竖线 */}
          <motion.div
            className="w-px"
            style={{
              height: "60px",
              background: "linear-gradient(to bottom, transparent, rgba(255,215,0,0.5), transparent)",
            }}
            animate={{ opacity: [0.3, 1, 0.3] }}
            transition={{ duration: 1.5, repeat: Infinity }}
          />

          <div className="text-xs text-gray-600 font-mono-price">{totalCount}</div>
        </div>

        {/* 空方阵营 */}
        <motion.div
          className="flex-1 relative rounded-2xl overflow-hidden flex flex-col items-center justify-center py-6 px-4"
          style={{
            background: "rgba(0, 191, 255, 0.06)",
            border: "1px solid rgba(0, 191, 255, 0.22)",
            backdropFilter: "blur(8px)",
          }}
          animate={lastBurst === "bear" ? {
            borderColor: ["rgba(0,191,255,0.22)", "rgba(0,191,255,0.9)", "rgba(0,191,255,0.22)"],
            boxShadow: [
              "0 0 0px rgba(0,191,255,0)",
              "0 0 50px rgba(0,191,255,0.6), 0 0 100px rgba(0,191,255,0.3)",
              "0 0 0px rgba(0,191,255,0)",
            ],
          } : {}}
          transition={{ duration: 0.7 }}
        >
          <div className="absolute inset-0 pointer-events-none"
            style={{
              background: "radial-gradient(ellipse at 70% 40%, rgba(0,191,255,0.1) 0%, transparent 65%)",
            }} />

          <AnimatePresence>
            {lastBurst === "bear" && (
              <motion.div
                className="absolute inset-0 pointer-events-none rounded-2xl"
                initial={{ opacity: 0 }}
                animate={{ opacity: [0, 0.4, 0] }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.7 }}
                style={{ background: "radial-gradient(ellipse at center, rgba(0,191,255,0.3) 0%, rgba(123,104,238,0.1) 50%, transparent 70%)" }}
              />
            )}
          </AnimatePresence>

          {/* 熊图标 */}
          <motion.div
            className="relative mb-3"
            animate={lastBurst === "bear" ? {
              scale: [1, 1.25, 1],
              rotate: [0, 8, -8, 0],
            } : { scale: 1 }}
            transition={{ duration: 0.6 }}
          >
            <img
              src="https://d2xsxph8kpxj0f.cloudfront.net/309938607060186295/midz7h2PLi8d7FasFPUnNi/bear-energy-PBFNxaN7qaUqN4RczYqhqh.webp"
              alt="空方"
              className="w-20 h-20 object-cover rounded-full animate-float"
              style={{
                boxShadow: "0 0 25px rgba(0,191,255,0.5), 0 0 50px rgba(0,191,255,0.2)",
                border: "2px solid rgba(0,191,255,0.5)",
                animationDelay: "1.5s",
              }}
            />
            <motion.div
              className="absolute inset-0 rounded-full"
              style={{ border: "2px solid rgba(0,191,255,0.4)" }}
              animate={{ scale: [1, 1.3, 1], opacity: [0.6, 0, 0.6] }}
              transition={{ duration: 2.5, repeat: Infinity, delay: 1.2 }}
            />
          </motion.div>

          <div className="font-display font-bold text-base mb-1"
            style={{
              background: "linear-gradient(135deg, #00BFFF, #7B68EE)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}>
            看跌空方
          </div>

          <motion.div
            className="font-mono-price font-bold text-white"
            style={{ fontSize: "2rem" }}
            key={bearCount}
            animate={{ scale: [1.2, 1] }}
            transition={{ type: "spring", stiffness: 300, damping: 15 }}
          >
            {bearCount}
            <span className="text-sm font-normal text-gray-400 ml-1">人</span>
          </motion.div>

          <div className="text-xs text-gray-500 mt-1 text-center">
            猜测收盘价 &lt; 开盘价
          </div>

          <div className="absolute bottom-0 left-0 right-0 h-0.5"
            style={{ background: "linear-gradient(90deg, transparent, rgba(0,191,255,0.5), transparent)" }} />
        </motion.div>
      </div>
    </div>
  );
}
