/**
 * GuessList — 猜测列表组件
 * 展示两侧阵营的猜测数字，新增时有飞入动效
 * 支持高亮显示猜中者
 */
import { motion, AnimatePresence } from "framer-motion";

export interface GuessEntry {
  id: string;
  price: number;
  side: "bull" | "bear";
  timestamp: number;
  nickname?: string;
}

interface GuessListProps {
  guesses: GuessEntry[];
  openPrice: number;
  closingPrice?: number | null;
  side: "bull" | "bear";
}

const DEMO_NAMES = [
  "金牛战士", "熔岩勇士", "黄金猎手", "火焰骑士", "太阳战神",
  "冰川守卫", "霜冻法师", "星空旅人", "深蓝幻影", "月光剑客",
  "宇宙探索者", "量子交易员", "暗物质猎人", "星云漫游者", "时空旅行者",
];

export default function GuessList({ guesses, openPrice, closingPrice, side }: GuessListProps) {
  const isBull = side === "bull";
  const filteredGuesses = guesses.filter((g) => g.side === side);
  const sortedGuesses = [...filteredGuesses].reverse();

  return (
    <div className="flex flex-col">
      {/* 列表标题 */}
      <div className="flex items-center gap-2 mb-2">
        <div className="w-1.5 h-4 rounded-full"
          style={{ background: isBull ? "linear-gradient(to bottom, #FF6B35, #FFD700)" : "linear-gradient(to bottom, #00BFFF, #7B68EE)" }} />
        <span className="font-display text-xs font-semibold"
          style={{ color: isBull ? "#FF8C42" : "#00BFFF" }}>
          {isBull ? "🔥 多方战士" : "❄️ 空方战士"}
        </span>
        <span className="text-gray-600 text-xs font-mono-price">{filteredGuesses.length}</span>
      </div>

      {/* 列表容器 */}
      <div
        className="flex flex-col gap-1.5 max-h-56 overflow-y-auto"
        style={{
          scrollbarWidth: "thin",
          scrollbarColor: isBull ? "rgba(255,107,53,0.2) transparent" : "rgba(0,191,255,0.2) transparent",
        }}
      >
        <AnimatePresence mode="popLayout" initial={false}>
          {sortedGuesses.map((guess, index) => {
            const diff = guess.price - openPrice;
            const isWinner = closingPrice !== null && closingPrice !== undefined && guess.price === closingPrice;
            const nickname = guess.nickname || DEMO_NAMES[guess.id.charCodeAt(0) % DEMO_NAMES.length];
            const isNewest = index === 0;

            return (
              <motion.div
                key={guess.id}
                layout
                initial={isBull
                  ? { x: -50, opacity: 0, scale: 0.85 }
                  : { x: 50, opacity: 0, scale: 0.85 }
                }
                animate={{ x: 0, opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8, transition: { duration: 0.2 } }}
                transition={{
                  type: "spring",
                  stiffness: 250,
                  damping: 22,
                }}
                className="relative flex items-center gap-2 px-3 py-2 rounded-xl overflow-hidden"
                style={{
                  background: isWinner
                    ? "rgba(255,215,0,0.12)"
                    : isNewest
                    ? (isBull ? "rgba(255,107,53,0.1)" : "rgba(0,191,255,0.08)")
                    : "rgba(255,255,255,0.03)",
                  border: isWinner
                    ? "1px solid rgba(255,215,0,0.5)"
                    : isNewest
                    ? (isBull ? "1px solid rgba(255,107,53,0.35)" : "1px solid rgba(0,191,255,0.3)")
                    : "1px solid rgba(255,255,255,0.06)",
                }}
              >
                {/* 猜中时的金色光效 */}
                {isWinner && (
                  <motion.div
                    className="absolute inset-0 pointer-events-none"
                    animate={{ opacity: [0.3, 0.7, 0.3] }}
                    transition={{ duration: 1.2, repeat: Infinity }}
                    style={{ background: "linear-gradient(90deg, transparent, rgba(255,215,0,0.15), transparent)" }}
                  />
                )}

                {/* 头像 */}
                <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 text-white"
                  style={{
                    background: isBull
                      ? "linear-gradient(135deg, #FF4500, #FFD700)"
                      : "linear-gradient(135deg, #00BFFF, #7B68EE)",
                    fontSize: "0.6rem",
                  }}>
                  {nickname.charAt(0)}
                </div>

                {/* 信息 */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1">
                    <span className="text-gray-400 text-xs truncate" style={{ maxWidth: "70px" }}>
                      {nickname}
                    </span>
                    {isWinner && (
                      <motion.span
                        animate={{ scale: [1, 1.3, 1] }}
                        transition={{ duration: 0.8, repeat: Infinity }}
                        className="text-xs"
                      >
                        🏆
                      </motion.span>
                    )}
                    {isNewest && !isWinner && (
                      <span className="text-xs px-1 rounded font-display"
                        style={{
                          background: isBull ? "rgba(255,107,53,0.2)" : "rgba(0,191,255,0.15)",
                          color: isBull ? "#FF8C42" : "#00BFFF",
                          fontSize: "0.55rem",
                        }}>
                        NEW
                      </span>
                    )}
                  </div>
                  <div className="font-mono-price font-bold text-sm"
                    style={{ color: isBull ? "#FFA07A" : "#87CEEB" }}>
                    {guess.price.toLocaleString()}
                    <span className={`text-xs ml-1 ${diff >= 0 ? "text-green-500" : "text-red-500"}`}>
                      {diff >= 0 ? "+" : ""}{diff}
                    </span>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>

        {/* 空状态 */}
        {filteredGuesses.length === 0 && (
          <div className="py-6 text-center rounded-xl"
            style={{
              border: `1px dashed ${isBull ? "rgba(255,107,53,0.2)" : "rgba(0,191,255,0.2)"}`,
            }}>
            <div className="text-2xl mb-1">{isBull ? "🔥" : "❄️"}</div>
            <div className="text-gray-600 text-xs font-display">
              {isBull ? "等待多方战士入场..." : "等待空方战士入场..."}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
