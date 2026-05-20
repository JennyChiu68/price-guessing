/**
 * Home — 黄金收盘价竞猜 V4「量化战情室」
 *
 * 设计哲学：彭博终端 × TradingView 深色主题 × 量化对冲基金战情室
 * 目标用户：20-50岁男性交易者，专业感优先，趣味感其次
 *
 * 核心视觉元素：
 * - 横向价格热力分布轴（猜测密度热力图）
 * - 多空力量仪表盘（弧形进度条，非卡通）
 * - 实时数据流粒子（向中央价格线汇聚）
 * - 扫描线动效（雷达/战情室感）
 * - 所有数字等宽字体，精确到个位
 * - 配色：深海军蓝底 + 金色价格 + 红涨绿跌
 */
import { useRef, useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { nanoid } from "nanoid";
import { toast } from "sonner";
import VictoryModal from "@/components/VictoryModal";

// ── 常量 ──
const OPEN_PRICE = 4068;
// 价格区间：开盘价 ±5%，覆盖黄金正常日内波动范围
const PRICE_RANGE_PCT = 0.10; // ±10%，覆盖黄金极端日内波动
const PRICE_MIN = Math.floor(OPEN_PRICE * (1 - PRICE_RANGE_PCT) / 10) * 10; // ~3660
const PRICE_MAX = Math.ceil(OPEN_PRICE * (1 + PRICE_RANGE_PCT) / 10) * 10;  // ~4480
const INIT_PRICE = 4082;
// 红涨绿跌（A股）
const COLOR_BULL = "#F03E3E";   // 涨方红
const COLOR_BEAR = "#26A65B";   // 跌方绿
const COLOR_GOLD = "#D4A017";   // 黄金色
const COLOR_ACCENT = "#4FC3F7"; // 科技蓝（辅助）

// 生成 3000 人的模拟竞猜数据（正态分布，以开盘价为中心，标准差 25 点）
function generateDemoGuesses(count: number): { id: string; price: number; side: "bull" | "bear"; uid: string }[] {
  const result: { id: string; price: number; side: "bull" | "bear"; uid: string }[] = [];
  for (let i = 0; i < count; i++) {
    // Box-Muller 正态分布
    const u1 = Math.random();
    const u2 = Math.random();
    const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    // 均值偏向看涨（+5），标准差 25
    const price = Math.round(OPEN_PRICE + 5 + z * 25);
    const clampedPrice = Math.max(PRICE_MIN, Math.min(PRICE_MAX, price));
    const side = clampedPrice >= OPEN_PRICE ? "bull" as const : "bear" as const;
    result.push({
      id: `d${i}`,
      price: clampedPrice,
      side,
      uid: `用户${10000 + i}`,
    });
  }
  return result;
}
const DEMO_GUESSES = generateDemoGuesses(3000);

interface Guess { id: string; price: number; side: "bull" | "bear"; uid: string; }

// 数据流粒子
interface DataParticle {
  id: string;
  x: number; y: number;
  targetX: number; targetY: number;
  vx: number; vy: number;
  alpha: number;
  size: number;
  color: string;
  trail: { x: number; y: number }[];
}

// 新猜测入场动画
interface IncomingGuess {
  id: string;
  guess: Guess;
  progress: number; // 0→1 入场动画进度
}

function getClosingTime() {
  const d = new Date();
  d.setHours(23, 0, 0, 0);
  if (d <= new Date()) d.setDate(d.getDate() + 1);
  return d;
}

export default function Home() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const userId = useRef(`用户${Math.floor(Math.random() * 90000) + 10000}`);

  const gameRef = useRef({
    guesses: [...DEMO_GUESSES] as Guess[],
    particles: [] as DataParticle[],
    incoming: [] as IncomingGuess[],
    stars: [] as { x: number; y: number; r: number; a: number; tw: number }[],
    scanLine: 0,
    time: 0,
    W: 0, H: 0,
    currentPrice: INIT_PRICE,
    userSubmitted: false,
    userGuessId: null as string | null,
    simulatedClosing: null as number | null,
    spawnQueue: [] as Guess[],
    lastSpawn: 0,
    selectedPrice: null as number | null,
    lerpViewMin: OPEN_PRICE - 200 as number,
    lerpViewMax: OPEN_PRICE + 200 as number,
    hoverX: null as number | null,
    hoverY: null as number | null,
  });

  const animRef = useRef<number>(0);
  const isSubmittingRef = useRef(false);
  const [, forceUpdate] = useState(0);
  const rerender = useCallback(() => forceUpdate(n => n + 1), []);

  const [currentPrice, setCurrentPrice] = useState(INIT_PRICE);
  const [userSubmitted, setUserSubmitted] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [selectedPrice, setSelectedPrice] = useState<number | null>(null);
  const [timeLeft, setTimeLeft] = useState("00:00:00");
  const [bullCount, setBullCount] = useState(DEMO_GUESSES.filter(g => g.side === "bull").length);
  const [bearCount, setBearCount] = useState(DEMO_GUESSES.filter(g => g.side === "bear").length);
  const [showVictory, setShowVictory] = useState(false);
  const [victoryPrice, setVictoryPrice] = useState(0);
  const [victoryNickname, setVictoryNickname] = useState("");
  const [showAdmin, setShowAdmin] = useState(false);
  const [adminInput, setAdminInput] = useState("");
  const [recentEntry, setRecentEntry] = useState<{ uid: string; price: number; side: "bull" | "bear" } | null>(null);
  const closingTime = getClosingTime();

  // 倒计时
  useEffect(() => {
    const tick = () => {
      const diff = closingTime.getTime() - Date.now();
      if (diff <= 0) { setTimeLeft("已收盘"); return; }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setTimeLeft(`${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  // 实时价格
  useEffect(() => {
    const id = setInterval(() => {
      const next = Math.round(gameRef.current.currentPrice + (Math.random() - 0.5) * 5);
      gameRef.current.currentPrice = Math.max(PRICE_MIN + 10, Math.min(PRICE_MAX - 10, next));
      setCurrentPrice(gameRef.current.currentPrice);
    }, 2000);
    return () => clearInterval(id);
  }, []);

  // ── Canvas 主循环 ──
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const cssW = canvas.offsetWidth;
      const cssH = canvas.offsetHeight;
      canvas.width = cssW * dpr;
      canvas.height = cssH * dpr;
      canvas.style.width = cssW + "px";
      canvas.style.height = cssH + "px";
      ctx.scale(dpr, dpr);
      const g = gameRef.current;
      g.W = cssW; g.H = cssH;
      g.stars = Array.from({ length: 120 }, () => ({
        x: Math.random() * cssW, y: Math.random() * cssH,
        r: 0.3 + Math.random() * 1.0, a: 0.15 + Math.random() * 0.35,
        tw: Math.random() * Math.PI * 2,
      }));
    };
    resize();
    window.addEventListener("resize", resize);

    // 初始化：把 demo 猜测加入生成队列
    // 3000 人数据直接加载，不走入场动画队列
    setTimeout(() => {}, 100);

    const loop = () => {
      const g = gameRef.current;
      g.time += 0.016;
      const { W, H } = g;
      if (!W || !H) { animRef.current = requestAnimationFrame(loop); return; }

      ctx.clearRect(0, 0, W, H);

      // ── 背景 ──
      drawQuantBackground(ctx, W, H, g.time, g.stars);

      // ── 扫描线 ──
      g.scanLine = (g.scanLine + 0.8) % H;
      drawScanLine(ctx, W, g.scanLine);

      // ── 热力分布轴（核心） ──
      const axisY = H * 0.50;
      const axisLeft = W * 0.05;
      const axisRight = W * 0.95;
      // 计算当前自适应视口（与 drawHeatAxis 内部逻辑保持一致）
      let _viewMin: number, _viewMax: number;
      if (g.guesses.length > 0) {
        const _prices = g.guesses.map((x: any) => x.price);
        const _dataMin = Math.min(..._prices, OPEN_PRICE, g.currentPrice);
        const _dataMax = Math.max(..._prices, OPEN_PRICE, g.currentPrice);
        _viewMin = Math.max(PRICE_MIN, Math.floor((_dataMin - 60) / 10) * 10);
        _viewMax = Math.min(PRICE_MAX, Math.ceil((_dataMax + 60) / 10) * 10);
        if (_viewMax - _viewMin < 100) {
          const _mid = (_viewMin + _viewMax) / 2;
          _viewMin = Math.max(PRICE_MIN, Math.floor(_mid - 60));
          _viewMax = Math.min(PRICE_MAX, Math.ceil(_mid + 60));
        }
      } else {
        _viewMin = Math.max(PRICE_MIN, OPEN_PRICE - 200);
        _viewMax = Math.min(PRICE_MAX, OPEN_PRICE + 200);
      }
      drawHeatAxis(ctx, axisLeft, axisRight, axisY, W, H, g, _viewMin, _viewMax);
      // ── 数据流粒子 ──
      spawnParticles(g, axisLeft, axisRight, axisY, W, H, _viewMin, _viewMax);
      updateAndDrawParticles(ctx, g);

      // ── 入场动画 ──
      g.incoming = g.incoming.filter(inc => {
        inc.progress += 0.04;
        return inc.progress < 1.2;
      });

      // ── 处理生成队列 ──
      if (g.spawnQueue.length > 0 && g.time - g.lastSpawn > 0.4) {
        const item = g.spawnQueue.shift()!;
        g.incoming.push({ id: nanoid(), guess: item, progress: 0 });
        g.lastSpawn = g.time;
      }

      // 多空比已在 HUD 进度条中展示，Canvas 不再重复绘制

      animRef.current = requestAnimationFrame(loop);
    };

    animRef.current = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(animRef.current);
      window.removeEventListener("resize", resize);
    };
  }, []);

  // ── 输入处理 ──
  const handleInputChange = useCallback((val: string) => {
    // 只允许纯数字输入
    const cleaned = val.replace(/[^0-9]/g, '');
    setInputValue(cleaned);
    const p = parseInt(cleaned, 10);
    if (!isNaN(p) && p >= PRICE_MIN && p <= PRICE_MAX) {
      gameRef.current.selectedPrice = p;
      setSelectedPrice(p);
    } else {
      gameRef.current.selectedPrice = null;
      setSelectedPrice(null);
    }
  }, []);

  // ── 提交 ──
  const handleSubmit = useCallback(() => {
    const g = gameRef.current;
    if (g.userSubmitted || isSubmittingRef.current) return;
    const price = g.selectedPrice;
    if (!price) {
      toast.error(`请输入 ${PRICE_MIN}–${PRICE_MAX} 之间的整数价格`, {
        style: { background: "#0D1117", border: "1px solid rgba(240,62,62,0.4)", color: "#e0e0e0" },
      });
      return;
    }
    // 验证是整数
    if (!Number.isInteger(price)) {
      toast.error("请输入整数价格，不含小数点", {
        style: { background: "#0D1117", border: "1px solid rgba(240,62,62,0.4)", color: "#e0e0e0" },
      });
      return;
    }
    isSubmittingRef.current = true;
    const side: "bull" | "bear" = price >= OPEN_PRICE ? "bull" : "bear";
    const uid = userId.current;
    const id = nanoid();
    const newGuess: Guess = { id, price, side, uid };

    g.guesses.push(newGuess);
    g.userSubmitted = true;
    g.userGuessId = id;
    g.spawnQueue.push(newGuess);

    setUserSubmitted(true);
    setBullCount(g.guesses.filter(x => x.side === "bull").length);
    setBearCount(g.guesses.filter(x => x.side === "bear").length);
    setRecentEntry({ uid, price, side });
    setTimeout(() => setRecentEntry(null), 4000);

    const diff = price - OPEN_PRICE;
    toast.success(
      `已锁定预测 ${price}（${diff >= 0 ? "+" : ""}${diff}）· 加入${side === "bull" ? "涨方" : "跌方"}`,
      {
        style: {
          background: "#0D1117",
          border: `1px solid ${side === "bull" ? "rgba(240,62,62,0.5)" : "rgba(38,166,91,0.5)"}`,
          color: "#e0e0e0",
        },
        duration: 3500,
      }
    );

    if (g.simulatedClosing !== null && price === g.simulatedClosing) {
      setTimeout(() => { setVictoryPrice(price); setVictoryNickname(uid); setShowVictory(true); }, 1200);
    }
    // 短暂延迟后解锁（防止快速双击）
    setTimeout(() => { isSubmittingRef.current = false; }, 800);
  }, []);

  const handleSimulateClosing = useCallback(() => {
    const price = parseInt(adminInput, 10);
    if (isNaN(price)) return;
    const g = gameRef.current;
    g.simulatedClosing = price;
    const winner = g.guesses.find(x => x.price === price);
    if (winner) {
      setTimeout(() => { setVictoryPrice(price); setVictoryNickname(winner.uid); setShowVictory(true); }, 500);
      toast.success(`收盘价 ${price} · ${winner.uid} 精准命中`, {
        style: { background: "#0D1117", border: "1px solid rgba(212,160,23,0.6)", color: "#e0e0e0" },
        duration: 5000,
      });
    } else {
      toast.info(`收盘价 ${price} · 本轮暂无人命中`, {
        style: { background: "#0D1117", border: "1px solid rgba(255,255,255,0.1)", color: "#e0e0e0" },
      });
    }
    rerender();
  }, [adminInput, rerender]);

  const priceChange = currentPrice - OPEN_PRICE;
  const isUp = priceChange >= 0;
  const previewSide = selectedPrice !== null ? (selectedPrice >= OPEN_PRICE ? "bull" : "bear") : null;
  const total = bullCount + bearCount;
  const bullPct = total > 0 ? Math.round((bullCount / total) * 100) : 50;
  const bearPct = 100 - bullPct;

  return (
    <div style={{
      height: "100dvh", display: "flex", flexDirection: "column",
      background: "#080C14", overflow: "hidden",
      fontFamily: "'Noto Sans SC', 'Space Grotesk', sans-serif",
    }}>
      {/* 背景图叠加 */}
      <div style={{
        position: "fixed", inset: 0, zIndex: 0,
        backgroundImage: `url(https://d2xsxph8kpxj0f.cloudfront.net/309938607060186295/midz7h2PLi8d7FasFPUnNi/quant-bg-eFeQcrwbXtizse5hyungX9.webp)`,
        backgroundSize: "cover", backgroundPosition: "center",
        opacity: 0.25,
      }} />

      {/* ── 顶部 HUD ── */}
      <header style={{ flexShrink: 0, padding: "8px 12px 6px", position: "relative", zIndex: 10 }}>
        <div style={{ maxWidth: "1000px", margin: "0 auto" }}>

          {/* 品牌行 */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <div style={{
                width: "6px", height: "6px", borderRadius: "50%",
                background: COLOR_GOLD,
                boxShadow: `0 0 8px ${COLOR_GOLD}`,
                animation: "pulse 2s ease-in-out infinite",
              }} />
              <span style={{ color: "rgba(212,160,23,0.95)", fontSize: "0.75rem", letterSpacing: "0.12em", fontFamily: "'Space Grotesk', sans-serif", textTransform: "uppercase" }}>
                Jin10 Data · 黄金特别企划
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <div style={{ width: "4px", height: "4px", borderRadius: "50%", background: "#26A65B", boxShadow: "0 0 6px #26A65B" }} />
              <span style={{ color: "rgba(255,255,255,0.65)", fontSize: "0.72rem", fontFamily: "'JetBrains Mono', monospace" }}>LIVE</span>
            </div>
          </div>

          {/* 主标题 */}
          <div style={{ marginBottom: "10px" }}>
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "baseline", gap: "6px" }}>
              <h1 style={{
                margin: 0,
                fontFamily: "'Space Grotesk', sans-serif",
                fontWeight: 700,
                fontSize: "clamp(1.3rem, 5vw, 1.9rem)",
                color: "#F0F0F0",
                letterSpacing: "-0.01em",
                lineHeight: 1.2,
                whiteSpace: "nowrap",
              }}>
                黄金收盘价竞猜
              </h1>
              <span style={{
                fontSize: "clamp(0.72rem, 3vw, 0.95rem)",
                fontWeight: 400,
                color: "rgba(255,255,255,0.70)",
                letterSpacing: "0.01em",
                whiteSpace: "nowrap",
              }}>
                精准命中赢取 <span style={{ color: COLOR_GOLD }}>💎 钻石VIP</span>
              </span>
            </div>
          </div>

          {/* 数据仪表行：移动端 2×2 网格 */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px" }}>
            {/* 开盘价 */}
            <DataCard label="今日开盘" value={OPEN_PRICE.toLocaleString()} unit="USD/oz" accent="rgba(255,255,255,0.5)" />

            {/* 实时价格 */}
            <DataCard
              label="实时价格"
              value={currentPrice.toLocaleString()}
              unit="USD/oz"
              accent={isUp ? COLOR_BULL : COLOR_BEAR}
              sub={`${isUp ? "▲" : "▼"} ${Math.abs(priceChange).toFixed(0)} (${isUp ? "+" : ""}${((priceChange / OPEN_PRICE) * 100).toFixed(2)}%)`}
              subColor={isUp ? COLOR_BULL : COLOR_BEAR}
              highlight
            />

            {/* 距收盘 */}
            <DataCard label="距收盘" value={timeLeft} accent={COLOR_ACCENT} mono />

            {/* 参与人数 */}
            <DataCard
              label="参与人数"
              value={String(total)}
              unit="人"
              accent={COLOR_GOLD}
              sub={`涨方 ${bullCount} 人 · 跌方 ${bearCount} 人`}
              subColor="rgba(255,255,255,0.55)"
            />

            {/* 多空比：跨两列 */}
            <div style={{
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: "8px",
              padding: "6px 12px",
              gridColumn: "1 / -1",
            }}>
              <div style={{ color: "rgba(255,255,255,0.75)", fontSize: "0.68rem", letterSpacing: "0.05em", marginBottom: "4px" }}>多空比</div>
              <div style={{ display: "flex", height: "6px", borderRadius: "3px", overflow: "hidden", gap: "1px" }}>
                <motion.div
                  style={{ background: COLOR_BULL, borderRadius: "3px 0 0 3px" }}
                  animate={{ width: `${bullPct}%` }}
                  transition={{ type: "spring", stiffness: 60, damping: 20 }}
                />
                <motion.div
                  style={{ background: COLOR_BEAR, borderRadius: "0 3px 3px 0" }}
                  animate={{ width: `${bearPct}%` }}
                  transition={{ type: "spring", stiffness: 60, damping: 20 }}
                />
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: "3px" }}>
                <span style={{ color: COLOR_BULL, fontSize: "0.72rem", fontFamily: "'JetBrains Mono', monospace" }}>{bullPct}%</span>
                <span style={{ color: COLOR_BEAR, fontSize: "0.72rem", fontFamily: "'JetBrains Mono', monospace" }}>{bearPct}%</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* ── 主战场 Canvas ── */}
      <div style={{ flex: 1, position: "relative", minHeight: 0, zIndex: 5 }}>
        <canvas
          ref={canvasRef}
          style={{ width: "100%", height: "100%", display: "block" }}
          onMouseMove={e => {
            const canvas = canvasRef.current;
            if (!canvas) return;
            const rect = canvas.getBoundingClientRect();
            gameRef.current.hoverX = e.clientX - rect.left;
            gameRef.current.hoverY = e.clientY - rect.top;
          }}
          onMouseLeave={() => {
            gameRef.current.hoverX = null;
            gameRef.current.hoverY = null;
          }}
        />

        {/* 入场动画：新猜测提示条 */}
        <AnimatePresence>
          {recentEntry && (
            <motion.div
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 40 }}
              style={{
                position: "absolute", right: "16px", top: "50%", transform: "translateY(-50%)",
                background: "rgba(13,17,23,0.92)",
                border: `1px solid ${recentEntry.side === "bull" ? "rgba(240,62,62,0.4)" : "rgba(38,166,91,0.4)"}`,
                borderRadius: "8px", padding: "10px 14px",
                backdropFilter: "blur(12px)",
                maxWidth: "180px",
              }}
            >
              <div style={{ color: "rgba(255,255,255,0.80)", fontSize: "0.72rem", marginBottom: "3px" }}>新预测入场</div>
              <div style={{ color: recentEntry.side === "bull" ? COLOR_BULL : COLOR_BEAR, fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, fontSize: "1.1rem" }}>
                {recentEntry.price.toLocaleString()}
              </div>
              <div style={{ color: "rgba(255,255,255,0.65)", fontSize: "0.72rem", marginTop: "2px" }}>
                {recentEntry.uid} · {recentEntry.side === "bull" ? "看涨" : "看跌"}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── 底部输入区 ── */}
      <div style={{ flexShrink: 0, padding: "8px 20px 12px", position: "relative", zIndex: 10 }}>
        <div style={{ maxWidth: "680px", margin: "0 auto" }}>
          <AnimatePresence mode="wait">
            {!userSubmitted ? (
              <motion.div
                key="input"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                style={{
                  background: "rgba(13,17,23,0.9)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: "12px",
                  padding: "14px 18px",
                  backdropFilter: "blur(20px)",
                }}
              >
                {/* 输入区域：移动端竖向布局 */}
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {/* 用户ID行 */}
                  <div style={{
                    display: "flex", alignItems: "center", gap: "6px",
                    padding: "6px 10px", borderRadius: "6px",
                    background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)",
                    alignSelf: "flex-start",
                  }}>
                    <span style={{ color: `${COLOR_GOLD}80`, fontSize: "0.68rem", fontFamily: "'Space Grotesk', sans-serif", letterSpacing: "0.05em" }}>ID</span>
                    <span style={{ color: "rgba(255,255,255,0.70)", fontSize: "0.82rem", fontFamily: "'JetBrains Mono', monospace", whiteSpace: "nowrap" }}>
                      {userId.current}
                    </span>
                  </div>
                  {/* 价格输入框 + 按鈕横排 */}
                  <div style={{ display: "flex", gap: "8px", alignItems: "stretch" }}>
                  <div style={{ flex: 1, position: "relative" }}>
                    <input
                      type="number"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={inputValue}
                      onChange={e => handleInputChange(e.target.value)}
                      onKeyDown={e => e.key === "Enter" && handleSubmit()}
                      placeholder={`输入收盘价，如 ${OPEN_PRICE}`}
                      min={PRICE_MIN} max={PRICE_MAX}
                      autoFocus
                      style={{
                        width: "100%", padding: "10px 14px",
                        borderRadius: "8px", outline: "none",
                        background: "rgba(255,255,255,0.05)",
                        border: selectedPrice
                          ? `1px solid ${previewSide === "bull" ? "rgba(240,62,62,0.5)" : "rgba(38,166,91,0.5)"}`
                          : "1px solid rgba(255,255,255,0.1)",
                        color: "#F0F0F0",
                        fontFamily: "'JetBrains Mono', monospace",
                        fontWeight: 600, fontSize: "1.25rem",
                        transition: "border-color 0.2s",
                        boxSizing: "border-box",
                        WebkitAppearance: "none",
                      }}
                    />
                    <AnimatePresence>
                      {selectedPrice && (
                        <motion.div
                          initial={{ opacity: 0, scale: 0.85 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.85 }}
                          style={{
                            position: "absolute", right: "10px", top: "50%", transform: "translateY(-50%)",
                            padding: "3px 9px", borderRadius: "4px",
                            fontSize: "0.68rem", fontWeight: 600,
                            background: previewSide === "bull" ? "rgba(240,62,62,0.15)" : "rgba(38,166,91,0.15)",
                            color: previewSide === "bull" ? COLOR_BULL : COLOR_BEAR,
                            border: `1px solid ${previewSide === "bull" ? "rgba(240,62,62,0.3)" : "rgba(38,166,91,0.3)"}`,
                            fontFamily: "'Space Grotesk', sans-serif",
                          }}
                        >
                          {previewSide === "bull" ? "▲ 看涨" : "▼ 看跌"}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* 提交按钮 */}
                  <motion.button
                    onClick={handleSubmit}
                    disabled={!selectedPrice}
                    whileHover={selectedPrice ? { scale: 1.03 } : {}}
                    whileTap={selectedPrice ? { scale: 0.97 } : {}}
                    style={{
                      flex: "0 0 auto", padding: "10px 20px", borderRadius: "8px", border: "none",
                      background: selectedPrice
                        ? (previewSide === "bull"
                          ? `linear-gradient(135deg, #B71C1C, ${COLOR_BULL})`
                          : `linear-gradient(135deg, #1B5E20, ${COLOR_BEAR})`)
                        : "rgba(255,255,255,0.06)",
                      color: selectedPrice ? "#fff" : "rgba(255,255,255,0.2)",
                      fontWeight: 700, fontSize: "1rem",
                      cursor: selectedPrice ? "pointer" : "not-allowed",
                      fontFamily: "'Space Grotesk', sans-serif",
                      letterSpacing: "0.03em",
                      minHeight: "48px",
                      boxShadow: selectedPrice
                        ? (previewSide === "bull" ? "0 0 20px rgba(240,62,62,0.3)" : "0 0 20px rgba(38,166,91,0.3)")
                        : "none",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {selectedPrice ? "锁定预测 →" : "请输入价格"}
                  </motion.button>
                  </div>
                </div>
                {/* 说明行 */}
                <div style={{ marginTop: "6px", display: "flex", flexDirection: "column", gap: "3px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ color: "rgba(255,255,255,0.55)", fontSize: "0.72rem" }}>
                      每人限猜一次 · 精准命中赢取 💎 钻石VIP
                    </span>
                  </div>
                  <div style={{ color: "rgba(255,255,255,0.40)", fontSize: "0.68rem" }}>
                    可猜范围 ±10%（{PRICE_MIN}–{PRICE_MAX}），仅限整数
                  </div>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="locked"
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                style={{
                  background: "rgba(13,17,23,0.9)",
                  border: `1px solid ${previewSide === "bull" ? "rgba(240,62,62,0.3)" : "rgba(38,166,91,0.3)"}`,
                  borderRadius: "12px", padding: "14px 18px",
                  backdropFilter: "blur(20px)",
                  display: "flex", alignItems: "center", gap: "16px",
                }}
              >
                <div style={{
                  width: "36px", height: "36px", borderRadius: "50%", flexShrink: 0,
                  background: previewSide === "bull" ? "rgba(240,62,62,0.12)" : "rgba(38,166,91,0.12)",
                  border: `1px solid ${previewSide === "bull" ? "rgba(240,62,62,0.4)" : "rgba(38,166,91,0.4)"}`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: "1rem",
                }}>
                  {previewSide === "bull" ? "▲" : "▼"}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ color: "#F0F0F0", fontWeight: 600, fontSize: "0.9rem" }}>
                    预测已锁定 ✓
                  </div>
                  <div style={{ color: "rgba(255,255,255,0.80)", fontSize: "0.75rem", marginTop: "2px" }}>
                    {userId.current} · 猜测
                    <span style={{
                      fontFamily: "'JetBrains Mono', monospace", fontWeight: 700,
                      color: previewSide === "bull" ? COLOR_BULL : COLOR_BEAR,
                      margin: "0 5px",
                    }}>
                      {selectedPrice?.toLocaleString()}
                    </span>
                    · {previewSide === "bull" ? "看涨" : "看跌"}
                  </div>
                </div>
                <div style={{ color: "rgba(255,255,255,0.48)", fontSize: "0.75rem", fontFamily: "'JetBrains Mono', monospace" }}>
                  LOCKED
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Demo 管理 */}
          <div style={{ textAlign: "center", marginTop: "8px" }}>
            <button
              onClick={() => setShowAdmin(!showAdmin)}
              style={{ color: "rgba(255,255,255,0.48)", fontSize: "0.72rem", background: "none", border: "none", cursor: "pointer", fontFamily: "'Space Grotesk', sans-serif" }}
            >
              {showAdmin ? "▲ 收起" : "▼ 模拟收盘（演示）"}
            </button>
            <AnimatePresence>
              {showAdmin && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  style={{ overflow: "hidden" }}
                >
                  <div style={{
                    marginTop: "8px", background: "rgba(13,17,23,0.85)",
                    border: "1px solid rgba(255,255,255,0.07)", borderRadius: "10px",
                    padding: "10px 14px", maxWidth: "340px", margin: "8px auto 0",
                    backdropFilter: "blur(12px)",
                  }}>
                    <div style={{ color: "rgba(255,255,255,0.60)", fontSize: "0.72rem", marginBottom: "7px" }}>
                      输入收盘价触发猜中动效（如 4075 / 4090 / 4060）
                    </div>
                    <div style={{ display: "flex", gap: "8px" }}>
                      <input
                        type="number"
                        value={adminInput}
                        onChange={e => setAdminInput(e.target.value)}
                        placeholder="收盘价"
                        style={{
                          flex: 1, padding: "7px 10px", borderRadius: "6px",
                          background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)",
                          color: "#e0e0e0", fontSize: "0.85rem", outline: "none",
                          fontFamily: "'JetBrains Mono', monospace",
                        }}
                      />
                      <button
                        onClick={handleSimulateClosing}
                        style={{
                          padding: "7px 14px", borderRadius: "6px",
                          background: `linear-gradient(135deg, #7B6000, ${COLOR_GOLD})`,
                          border: "none", color: "#000", fontWeight: 700,
                          fontSize: "0.78rem", cursor: "pointer",
                          fontFamily: "'Space Grotesk', sans-serif",
                        }}
                      >确认</button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div style={{ textAlign: "center", marginTop: "6px", color: "rgba(255,255,255,0.38)", fontSize: "0.68rem" }}>
            金十数据 · 数据仅供娱乐参考，不构成投资建议
          </div>
        </div>
      </div>

      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
        input[type=number]::-webkit-inner-spin-button,
        input[type=number]::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
        input[type=number] { -moz-appearance: textfield; }
        input::placeholder { color: rgba(255,255,255,0.35) !important; }
      `}</style>

      <VictoryModal isOpen={showVictory} onClose={() => setShowVictory(false)} price={victoryPrice} nickname={victoryNickname} />
    </div>
  );
}

// ── 数据卡片组件 ──
function DataCard({ label, value, unit, accent, sub, subColor, highlight, mono }: {
  label: string; value: string; unit?: string; accent: string;
  sub?: string; subColor?: string; highlight?: boolean; mono?: boolean;
}) {
  return (
    <div style={{
      background: highlight ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.03)",
      border: `1px solid ${highlight ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.07)"}`,
      borderRadius: "8px", padding: "6px 12px", minWidth: "88px",
    }}>
      <div style={{ color: "rgba(255,255,255,0.70)", fontSize: "0.68rem", letterSpacing: "0.05em", marginBottom: "2px" }}>{label}</div>
      <div style={{
        color: accent,
        fontFamily: mono ? "'JetBrains Mono', monospace" : "'JetBrains Mono', monospace",
        fontWeight: 700, fontSize: "1rem", lineHeight: 1.2,
      }}>
        {value}
        {unit && <span style={{ color: "rgba(255,255,255,0.60)", fontSize: "0.72rem", marginLeft: "3px", fontWeight: 400 }}>{unit}</span>}
      </div>
      {sub && <div style={{ color: subColor || "rgba(255,255,255,0.70)", fontSize: "0.72rem", marginTop: "1px", fontFamily: "'JetBrains Mono', monospace" }}>{sub}</div>}
    </div>
  );
}

// ── Canvas 绘制函数 ──

function drawQuantBackground(ctx: CanvasRenderingContext2D, W: number, H: number, t: number, stars: any[]) {
  // 深色背景
  ctx.fillStyle = "rgba(8,12,20,0.92)";
  ctx.fillRect(0, 0, W, H);

  // 极细网格线
  ctx.save();
  ctx.strokeStyle = "rgba(255,255,255,0.025)";
  ctx.lineWidth = 0.5;
  const gridSize = 60;
  for (let x = 0; x < W; x += gridSize) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
  }
  for (let y = 0; y < H; y += gridSize) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
  }
  ctx.restore();

  // 微弱星点
  stars.forEach(s => {
    s.tw += 0.012;
    const a = s.a * (0.5 + 0.5 * Math.sin(s.tw));
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(180,200,255,${a})`;
    ctx.fill();
  });
}

function drawScanLine(ctx: CanvasRenderingContext2D, W: number, y: number) {
  ctx.save();
  const grad = ctx.createLinearGradient(0, y - 20, 0, y + 20);
  grad.addColorStop(0, "rgba(79,195,247,0)");
  grad.addColorStop(0.5, "rgba(79,195,247,0.04)");
  grad.addColorStop(1, "rgba(79,195,247,0)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, y - 20, W, 40);
  ctx.restore();
}

// viewMin/viewMax: 当前轴的可视范围（自适应视口）
function priceToX(price: number, left: number, right: number, viewMin: number, viewMax: number): number {
  return left + ((price - viewMin) / (viewMax - viewMin)) * (right - left);
}

function drawHeatAxis(
  ctx: CanvasRenderingContext2D,
  axisLeft: number, axisRight: number, axisY: number,
  W: number, H: number,
  g: any,
  viewMin: number,
  viewMax: number
) {
  const axisLen = axisRight - axisLeft;

  // ── 热力密度计算 ──
  const buckets = 36;
  const bucketW = axisLen / buckets;
  const bullDensity = new Array(buckets).fill(0);
  const bearDensity = new Array(buckets).fill(0);

  g.guesses.forEach((guess: Guess) => {
    const idx = Math.floor(((guess.price - viewMin) / (viewMax - viewMin)) * buckets);
    const safeIdx = Math.max(0, Math.min(buckets - 1, idx));
    if (guess.side === "bull") bullDensity[safeIdx]++;
    else bearDensity[safeIdx]++;
  });

  const maxDensity = Math.max(1, ...bullDensity, ...bearDensity);

  // ── 热力柱（上方涨方，下方跌方）──
  // maxBarH 固定为 H*0.16，确保 Zone B~G 各有足够空间
  const maxBarH = H * 0.16;
  for (let i = 0; i < buckets; i++) {
    const bx = axisLeft + i * bucketW;
    const bw = bucketW - 1;

    // 涨方（上方，红色）
    if (bullDensity[i] > 0) {
      const barH = (bullDensity[i] / maxDensity) * maxBarH;
      const grad = ctx.createLinearGradient(0, axisY - barH, 0, axisY);
      grad.addColorStop(0, `rgba(240,62,62,${0.15 + (bullDensity[i] / maxDensity) * 0.55})`);
      grad.addColorStop(1, "rgba(240,62,62,0.05)");
      ctx.fillStyle = grad;
      ctx.fillRect(bx, axisY - barH, bw, barH);

      // 顶部发光线
      ctx.fillStyle = `rgba(240,62,62,${0.5 + (bullDensity[i] / maxDensity) * 0.5})`;
      ctx.fillRect(bx, axisY - barH, bw, 1.5);
    }

    // 跌方（下方，绿色）
    if (bearDensity[i] > 0) {
      const barH = (bearDensity[i] / maxDensity) * maxBarH;
      const grad = ctx.createLinearGradient(0, axisY, 0, axisY + barH);
      grad.addColorStop(0, "rgba(38,166,91,0.05)");
      grad.addColorStop(1, `rgba(38,166,91,${0.15 + (bearDensity[i] / maxDensity) * 0.55})`);
      ctx.fillStyle = grad;
      ctx.fillRect(bx, axisY, bw, barH);

      // 底部发光线
      ctx.fillStyle = `rgba(38,166,91,${0.5 + (bearDensity[i] / maxDensity) * 0.5})`;
      ctx.fillRect(bx, axisY + barH - 1.5, bw, 1.5);
    }
  }

  // ── 主轴线 ──
  ctx.save();
  const lineGrad = ctx.createLinearGradient(axisLeft, 0, axisRight, 0);
  lineGrad.addColorStop(0, "rgba(255,255,255,0.05)");
  lineGrad.addColorStop(0.2, "rgba(255,255,255,0.2)");
  lineGrad.addColorStop(0.5, "rgba(255,255,255,0.75)");
  lineGrad.addColorStop(0.8, "rgba(255,255,255,0.2)");
  lineGrad.addColorStop(1, "rgba(255,255,255,0.05)");
  ctx.strokeStyle = lineGrad;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(axisLeft, axisY);
  ctx.lineTo(axisRight, axisY);
  ctx.stroke();
  ctx.restore();

  // ── 动态刻度：基于当前视口范围，每20点一个标签 ──
  const viewRange = viewMax - viewMin;
  const axisLen2 = axisRight - axisLeft;
  // 根据视口范围自动选步长，保证标签不重叠（每标签至少50px）
  const niceSteps = [5, 10, 20, 25, 50, 100, 200];
  const rawStep2 = viewRange / Math.floor(axisLen2 / 50);
  const tickStep = niceSteps.find(s => s >= rawStep2) || 200;
  const tickStart = Math.ceil(viewMin / tickStep) * tickStep;
  const tickEnd = Math.floor(viewMax / tickStep) * tickStep;

  for (let p = tickStart; p <= tickEnd; p += tickStep) {
    const x = priceToX(p, axisLeft, axisRight, viewMin, viewMax);
    if (x < axisLeft + 20 || x > axisRight - 20) continue;
    ctx.save();
    ctx.strokeStyle = "rgba(255,255,255,0.20)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, axisY - 5);
    ctx.lineTo(x, axisY + 5);
    ctx.stroke();
    // 刻度数字：放在轴线下方 Zone G（避免与开盘价标签冲突）
    ctx.font = "bold 11px 'JetBrains Mono', monospace";
    ctx.textAlign = "center";
    ctx.fillStyle = "rgba(255,255,255,0.60)";
    ctx.fillText(String(p), x, axisY + maxBarH + 20);
    ctx.restore();
  }

  // ── 开盘价标记 ──
  const openX = priceToX(OPEN_PRICE, axisLeft, axisRight, viewMin, viewMax);
  ctx.save();
  ctx.strokeStyle = `rgba(212,160,23,0.7)`;
  ctx.lineWidth = 1.5;
  ctx.setLineDash([4, 3]);
  ctx.shadowColor = COLOR_GOLD;
  ctx.shadowBlur = 6;
  ctx.beginPath();
  ctx.moveTo(openX, axisY - maxBarH - 10);
  ctx.lineTo(openX, axisY + maxBarH + 10);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.shadowBlur = 0;

  // 开盘价标签：Zone B，轴上方 maxBarH+34 处，黄金色背景
  const openFontSize = W < 500 ? 10 : 11;
  ctx.font = `bold ${openFontSize}px 'JetBrains Mono', monospace`;
  ctx.textAlign = "center";
  const olabel = `开盘 ${OPEN_PRICE}`;
  const otw = ctx.measureText(olabel).width;
  const oLabelY = axisY - maxBarH - 36; // Zone B 顶部
  ctx.fillStyle = "rgba(212,160,23,0.92)";
  ctx.shadowColor = "rgba(212,160,23,0.5)";
  ctx.shadowBlur = 6;
  roundRect(ctx, openX - otw / 2 - 8, oLabelY, otw + 16, 22, 4);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = "#1a1200";
  ctx.fillText(olabel, openX, oLabelY + 15);
  ctx.restore();

  // 当前价格已在 HUD 卡片中展示，Canvas 不再绘制当前价格线



  // ── 猜测标记点：只显示用户自己的和猜中者的，其他用热力柱表达 ──
  g.guesses.forEach((guess: Guess) => {
    const isUser = guess.id === g.userGuessId;
    const isWinner = g.simulatedClosing !== null && guess.price === g.simulatedClosing;
    if (!isUser && !isWinner) return; // 只画特殊标记
    const x = priceToX(guess.price, axisLeft, axisRight, viewMin, viewMax);
    const color = isWinner ? COLOR_GOLD : (guess.side === "bull" ? COLOR_BULL : COLOR_BEAR);
    const r = isUser ? 6 : 6;
    ctx.save();
    ctx.beginPath();
    ctx.arc(x, axisY, r, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = 16;
    ctx.fill();
    ctx.shadowBlur = 0;
    if (isUser) {
      // 用户标记：外圈脉冲 + 文字标注
      ctx.beginPath();
      ctx.arc(x, axisY, r + 5 + 2 * Math.sin(g.time * 4), 0, Math.PI * 2);
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.globalAlpha = 0.6;
      ctx.stroke();
      ctx.globalAlpha = 1;
      // 标注"我的预测"
      ctx.font = "bold 10px 'Space Grotesk', sans-serif";
      ctx.textAlign = "center";
      ctx.fillStyle = "#fff";
      ctx.fillText("我的预测", x, axisY - r - 10);
      ctx.font = "bold 12px 'JetBrains Mono', monospace";
      ctx.fillStyle = color;
      ctx.fillText(String(guess.price), x, axisY - r - 22);
    }
    if (isWinner) {
      ctx.font = "bold 10px 'Space Grotesk', sans-serif";
      ctx.textAlign = "center";
      ctx.fillStyle = COLOR_GOLD;
      ctx.fillText("🏆 猜中", x, axisY - r - 10);
    }
    ctx.restore();
  });

  // ── 收盘价光柱 ──
  if (g.simulatedClosing !== null) {
    const cx = priceToX(g.simulatedClosing, axisLeft, axisRight, viewMin, viewMax);
    ctx.save();
    const beamGrad = ctx.createLinearGradient(0, 0, 0, H);
    beamGrad.addColorStop(0, "rgba(212,160,23,0)");
    beamGrad.addColorStop(0.3, `rgba(212,160,23,${0.25 + 0.1 * Math.sin(g.time * 5)})`);
    beamGrad.addColorStop(0.5, `rgba(212,160,23,${0.5 + 0.15 * Math.sin(g.time * 5)})`);
    beamGrad.addColorStop(0.7, `rgba(212,160,23,${0.25 + 0.1 * Math.sin(g.time * 5)})`);
    beamGrad.addColorStop(1, "rgba(212,160,23,0)");
    ctx.fillStyle = beamGrad;
    ctx.fillRect(cx - 2, 0, 4, H);

    ctx.font = "bold 11px 'JetBrains Mono', monospace";
    ctx.textAlign = "center";
    ctx.fillStyle = COLOR_GOLD;
    ctx.shadowColor = COLOR_GOLD;
    ctx.shadowBlur = 10;
    ctx.fillText(`收盘 ${g.simulatedClosing}`, cx, axisY - maxBarH - 62);
    ctx.shadowBlur = 0;
    ctx.restore();
  }


  // ── Hover Tooltip：鼠标悬停热力柱时显示详情 ──
  if (g.hoverX !== null && g.hoverY !== null) {
    const hx = g.hoverX;
    const hy = g.hoverY;
    if (hx >= axisLeft && hx <= axisRight && Math.abs(hy - axisY) < maxBarH + 10) {
      // 找到对应的价格
      const hoverPrice = viewMin + ((hx - axisLeft) / axisLen) * (viewMax - viewMin);
      // 找出该价格附近 ±(viewRange/buckets/2) 范围内的猜测
      const bucketRange = (viewMax - viewMin) / buckets;
      const nearGuesses = g.guesses.filter((guess: Guess) =>
        Math.abs(guess.price - hoverPrice) <= bucketRange
      );
      if (nearGuesses.length > 0) {
        const bullNear = nearGuesses.filter((x: Guess) => x.side === "bull");
        const bearNear = nearGuesses.filter((x: Guess) => x.side === "bear");
        const tipX = Math.min(hx + 12, W - 160);
        const tipY = Math.max(hy - 80, 10);
        const tipW = 150;
        const tipH = 16 + nearGuesses.length * 16 + 8;

        ctx.save();
        ctx.fillStyle = "rgba(10,14,26,0.92)";
        ctx.strokeStyle = "rgba(255,255,255,0.15)";
        ctx.lineWidth = 1;
        roundRect(ctx, tipX, tipY, tipW, tipH, 6);
        ctx.fill();
        ctx.stroke();

        ctx.font = "bold 10px 'JetBrains Mono', monospace";
        ctx.textAlign = "left";
        ctx.fillStyle = "rgba(255,255,255,0.8)";
        ctx.fillText(`附近 ${nearGuesses.length} 人`, tipX + 8, tipY + 14);

        nearGuesses.slice(0, 5).forEach((guess: Guess, i: number) => {
          const color = guess.side === "bull" ? COLOR_BULL : COLOR_BEAR;
          ctx.fillStyle = color;
          ctx.font = "9px 'JetBrains Mono', monospace";
          ctx.fillText(`${guess.side === "bull" ? "▲" : "▼"} ${guess.price}  ${guess.uid}`, tipX + 8, tipY + 28 + i * 15);
        });
        if (nearGuesses.length > 5) {
          ctx.fillStyle = "rgba(255,255,255,0.35)";
          ctx.fillText(`...还有 ${nearGuesses.length - 5} 人`, tipX + 8, tipY + 28 + 5 * 15);
        }
        ctx.restore();
      }
    }
  }
  // ── 区域标注 ──
  ctx.save();
  // 看涨/看跌区标注：仅在宽屏显示
  if (W >= 500) {
    ctx.font = "bold 13px 'Space Grotesk', sans-serif";
    ctx.textAlign = "center";
    ctx.fillStyle = "rgba(240,62,62,0.80)";
    ctx.shadowColor = "rgba(240,62,62,0.5)";
    ctx.shadowBlur = 8;
    ctx.fillText("▲ 看涨区", openX + (axisRight - openX) * 0.4, axisY - maxBarH - 52);
    ctx.shadowBlur = 0;
    ctx.fillStyle = "rgba(38,166,91,0.80)";
    ctx.shadowColor = "rgba(38,166,91,0.5)";
    ctx.shadowBlur = 8;
    ctx.fillText("▼ 看跌区", axisLeft + (openX - axisLeft) * 0.55, axisY - maxBarH - 52);
    ctx.shadowBlur = 0;
  }
  ctx.restore();

  // ── 轴两端省略号：提示用户轴外还有更大范围 ──
  const showLeftEllipsis = viewMin > PRICE_MIN;
  const showRightEllipsis = viewMax < PRICE_MAX;
  ctx.save();
  ctx.font = "9px 'JetBrains Mono', monospace";
  ctx.fillStyle = "rgba(255,255,255,0.30)";
  if (showLeftEllipsis) {
    ctx.textAlign = "left";
    ctx.fillText(`< ${viewMin}`, axisLeft + 2, axisY - 10);
  }
  if (showRightEllipsis) {
    ctx.textAlign = "right";
    ctx.fillText(`> ${viewMax}`, axisRight - 2, axisY - 10);
  }
  ctx.restore();
}

function spawnParticles(g: any, axisLeft: number, axisRight: number, axisY: number, W: number, H: number, viewMin: number, viewMax: number) {
  if (Math.random() > 0.08) return; // 降低粒子生成频率，提升移动端性能
  const side = Math.random() < (g.guesses.filter((x: Guess) => x.side === "bull").length / Math.max(1, g.guesses.length)) ? "bull" : "bear";
  const color = side === "bull" ? COLOR_BULL : COLOR_BEAR;
  const startX = side === "bull" ? W * 0.85 + Math.random() * W * 0.1 : Math.random() * W * 0.1;
  const startY = axisY + (Math.random() - 0.5) * H * 0.3;
  // 粒子目标落在当前可视范围内的随机位置
  const targetPrice = viewMin + Math.random() * (viewMax - viewMin);
  const targetX = priceToX(targetPrice, axisLeft, axisRight, viewMin, viewMax);

  g.particles.push({
    id: nanoid(),
    x: startX, y: startY,
    targetX, targetY: axisY,
    vx: (targetX - startX) * 0.012,
    vy: (axisY - startY) * 0.012,
    alpha: 0.6 + Math.random() * 0.4,
    size: 1.5 + Math.random() * 2,
    color,
    trail: [],
  });

  if (g.particles.length > 50) g.particles = g.particles.slice(g.particles.length - 50);
}

function updateAndDrawParticles(ctx: CanvasRenderingContext2D, g: any) {
  g.particles = g.particles.filter((p: DataParticle) => {
    p.trail.push({ x: p.x, y: p.y });
    if (p.trail.length > 8) p.trail.shift();

    p.x += p.vx;
    p.y += p.vy;
    p.alpha -= 0.012;

    const dist = Math.hypot(p.targetX - p.x, p.targetY - p.y);
    if (dist < 8) { p.alpha = 0; }

    if (p.alpha <= 0) return false;

    // 拖尾
    p.trail.forEach((pt, i) => {
      const a = (i / p.trail.length) * p.alpha * 0.4;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, p.size * (i / p.trail.length) * 0.6, 0, Math.PI * 2);
      ctx.fillStyle = p.color.replace(")", `,${a})`).replace("rgb", "rgba");
      ctx.fill();
    });

    // 主粒子
    ctx.save();
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fillStyle = p.color;
    ctx.globalAlpha = p.alpha;
    ctx.shadowColor = p.color;
    ctx.shadowBlur = 6;
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.restore();

    return true;
  });
}

function drawPowerGauge(ctx: CanvasRenderingContext2D, W: number, H: number, g: any) {
  const total = g.guesses.length;
  if (total === 0) return;
  const bullRatio = g.guesses.filter((x: Guess) => x.side === "bull").length / total;

  // 底部中央弧形仪表
  // 仪表盘：始终放在右下角，避免遮挡价格轴中央区域
  const cx = W < 600 ? W * 0.78 : W * 0.85;
  const cy = H * 0.82;
  const radius = W < 600 ? Math.min(W * 0.10, 45) : Math.min(W * 0.08, 55);
  const startAngle = Math.PI * 0.75;
  const endAngle = Math.PI * 2.25;
  const totalAngle = endAngle - startAngle;

  // 背景弧
  ctx.save();
  ctx.strokeStyle = "rgba(255,255,255,0.07)";
  ctx.lineWidth = 6;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.arc(cx, cy, radius, startAngle, endAngle);
  ctx.stroke();

  // 跌方弧（绿，左侧）
  const bearEnd = startAngle + totalAngle * (1 - bullRatio);
  ctx.strokeStyle = COLOR_BEAR;
  ctx.lineWidth = 6;
  ctx.shadowColor = COLOR_BEAR;
  ctx.shadowBlur = 8;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, startAngle, bearEnd);
  ctx.stroke();
  ctx.shadowBlur = 0;

  // 涨方弧（红，右侧）
  ctx.strokeStyle = COLOR_BULL;
  ctx.shadowColor = COLOR_BULL;
  ctx.shadowBlur = 8;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, bearEnd, endAngle);
  ctx.stroke();
  ctx.shadowBlur = 0;

  // 中央文字
  ctx.textAlign = "center";
  ctx.font = `bold 11px 'JetBrains Mono', monospace`;
  ctx.fillStyle = "rgba(255,255,255,0.5)";
  ctx.fillText(`${total}人`, cx, cy + 4);

  ctx.font = `9px 'Space Grotesk', sans-serif`;
  ctx.fillStyle = "rgba(255,255,255,0.60)";
  ctx.fillText("多空博弈", cx, cy + 16);

  ctx.restore();
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}
