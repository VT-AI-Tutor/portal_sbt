import mascot from "@/core/assets/mascot-bee.png";
import { Card } from "@/core/ui/card";
import { ArrowLeft, Sparkles } from "lucide-react";
import { TYPE_LABELS } from "@/core/interactions/QuestionRenderer";
import { Link } from "react-router-dom";

type GroupKey = "basic" | "spatial" | "advanced" | "gamification" | "ai";

interface QTypeInfo {
  key: keyof typeof TYPE_LABELS;
  group: GroupKey;
  desc: string;
  preview: React.ReactNode;
}

const GROUPS: Record<
  GroupKey,
  { label: string; color: string; emoji: string }
> = {
  basic: {
    label: "NhÃ³m cÆ¡ báº£n",
    color: "from-primary/15 to-primary/5 border-primary/40",
    emoji: "ðŸ“",
  },
  spatial: {
    label: "NhÃ³m tÆ°Æ¡ng tÃ¡c khÃ´ng gian",
    color: "from-info/15 to-info/5 border-info/40",
    emoji: "ðŸ§©",
  },
  advanced: {
    label: "NhÃ³m nÃ¢ng cao há»c táº­p",
    color: "from-success/15 to-success/5 border-success/40",
    emoji: "ðŸŽ¯",
  },
  gamification: {
    label: "NhÃ³m Gamification",
    color: "from-fun/15 to-fun/5 border-fun/40",
    emoji: "ðŸŽ®",
  },
  ai: {
    label: "NhÃ³m AI nÃ¢ng cao",
    color: "from-warning/20 to-warning/5 border-warning/50",
    emoji: "ðŸ¤–",
  },
};

// Mini preview components â€” dáº¡ng "áº£nh chá»¥p" giáº£ láº­p tá»«ng loáº¡i
const QTYPES: QTypeInfo[] = [
  {
    key: "single_choice",
    group: "basic",
    desc: "Há»c sinh chá»n 1 Ä‘Ã¡p Ã¡n Ä‘Ãºng duy nháº¥t tá»« danh sÃ¡ch. PhÃ¹ há»£p kiá»ƒm tra nhanh khÃ¡i niá»‡m, Ä‘á»‹nh nghÄ©a.",
    preview: (
      <PreviewChoices
        items={[
          { t: "TrÃ¡i Äáº¥t", ok: true },
          { t: "Sao Há»a" },
          { t: "Máº·t TrÄƒng" },
        ]}
      />
    ),
  },
  {
    key: "multiple_choice",
    group: "basic",
    desc: "Há»c sinh chá»n nhiá»u Ä‘Ã¡p Ã¡n Ä‘Ãºng cÃ¹ng lÃºc. ÄÃ¡nh giÃ¡ hiá»ƒu biáº¿t toÃ n diá»‡n vá» má»™t chá»§ Ä‘á».",
    preview: (
      <PreviewChoices
        multi
        items={[
          { t: "NÆ°á»›c", ok: true },
          { t: "Lá»­a" },
          { t: "KhÃ´ng khÃ­", ok: true },
          { t: "Äáº¥t", ok: true },
        ]}
      />
    ),
  },
  {
    key: "true_false",
    group: "basic",
    desc: "CÃ¢u há»i nhanh dáº¡ng Ä‘Ãºng/sai. ThÃ­ch há»£p Ä‘á»ƒ má»Ÿ Ä‘áº§u bÃ i hoáº·c kiá»ƒm tra pháº£n xáº¡.",
    preview: (
      <div className="flex gap-2">
        <div className="flex-1 rounded-lg border-2 border-success bg-success/15 px-3 py-2 text-sm font-bold text-success text-center">
          âœ“ ÄÃºng
        </div>
        <div className="flex-1 rounded-lg border-2 border-border bg-card px-3 py-2 text-sm font-bold text-muted-foreground text-center">
          âœ— Sai
        </div>
      </div>
    ),
  },
  {
    key: "fill_blank",
    group: "basic",
    desc: "Äiá»n tá»«/sá»‘ vÃ o chá»— trá»‘ng trong cÃ¢u. RÃ¨n luyá»‡n ngá»¯ phÃ¡p, cÃ´ng thá»©c, Ä‘á»‹nh nghÄ©a.",
    preview: (
      <div className="text-sm leading-relaxed">
        NÆ°á»›c sÃ´i á»Ÿ{" "}
        <span className="inline-block min-w-[3rem] border-b-2 border-primary text-primary font-bold text-center">
          100
        </span>
        Â°C á»Ÿ Ã¡p suáº¥t{" "}
        <span className="inline-block min-w-[5rem] border-b-2 border-dashed border-muted-foreground" />
        .
      </div>
    ),
  },
  {
    key: "short_answer",
    group: "basic",
    desc: "Tráº£ lá»i ngáº¯n 1â€“2 cÃ¢u. So khá»›p linh hoáº¡t vá»›i tá»« khÃ³a vÃ  Ä‘á»“ng nghÄ©a.",
    preview: (
      <div className="rounded-lg border-2 border-border bg-card p-2 text-sm text-muted-foreground italic">
        "VÃ¬ hÆ¡i nÆ°á»›c bay lÃªn gáº·p láº¡nh ngÆ°ng tá»¥ thÃ nh mÃ¢y..."
      </div>
    ),
  },
  {
    key: "essay",
    group: "ai",
    desc: "Tá»± luáº­n dÃ i, Ä‘Æ°á»£c AI cháº¥m theo thang Ä‘iá»ƒm tiÃªu chÃ­. Tráº£ vá» nháº­n xÃ©t chi tiáº¿t, gá»£i Ã½ cáº£i thiá»‡n.",
    preview: (
      <div className="space-y-1.5">
        <div className="rounded-lg border-2 border-border bg-card p-2 text-xs text-muted-foreground italic">
          BÃ i lÃ m cá»§a em...
        </div>
        <div className="flex items-center gap-1.5 text-xs">
          <span className="px-2 py-0.5 rounded-full bg-warning/20 text-warning font-bold">
            ðŸ¤– AI: 8.5/10
          </span>
          <span className="text-muted-foreground">Â· Ã tÆ°á»Ÿng tá»‘t</span>
        </div>
      </div>
    ),
  },
  {
    key: "math_input",
    group: "basic",
    desc: "Nháº­p káº¿t quáº£ sá»‘ há»c. Há»— trá»£ phÃ¢n sá»‘, Ä‘Æ¡n vá»‹ Ä‘o, dung sai sai sá»‘ nhá».",
    preview: (
      <div className="flex items-center gap-2 text-sm">
        <span>3 Ã— 12 + 5 =</span>
        <div className="rounded-lg border-2 border-primary bg-primary/10 px-3 py-1 font-bold text-primary font-mono">
          41
        </div>
      </div>
    ),
  },
  {
    key: "code_input",
    group: "basic",
    desc: "Nháº­p Ä‘oáº¡n code (Scratch, Python). Tá»± Ä‘á»™ng cháº¥m theo test case.",
    preview: (
      <pre className="rounded-lg bg-foreground text-background p-2 text-xs font-mono leading-tight">
        {`for i in range(5):
  print(i * 2)`}
      </pre>
    ),
  },
  {
    key: "drag_drop",
    group: "spatial",
    desc: "KÃ©o tháº£ cÃ¡c tháº» vÃ o Ä‘Ãºng vÃ¹ng/danh má»¥c. Trá»±c quan cho phÃ¢n loáº¡i, sáº¯p xáº¿p.",
    preview: (
      <div className="grid grid-cols-2 gap-1.5">
        <div className="rounded-md border-2 border-dashed border-primary bg-primary/10 p-1.5 text-[10px] font-bold text-primary text-center">
          Äá»™ng váº­t
        </div>
        <div className="rounded-md border-2 border-dashed border-success bg-success/10 p-1.5 text-[10px] font-bold text-success text-center">
          Thá»±c váº­t
        </div>
        <div className="rounded-md bg-card border-2 px-1.5 py-1 text-[10px] font-bold text-center">
          ðŸ± MÃ¨o
        </div>
        <div className="rounded-md bg-card border-2 px-1.5 py-1 text-[10px] font-bold text-center">
          ðŸŒ³ CÃ¢y
        </div>
      </div>
    ),
  },
  {
    key: "matching",
    group: "spatial",
    desc: "Ná»‘i cáº·p giá»¯a hai cá»™t tÆ°Æ¡ng á»©ng. PhÃ¹ há»£p tá»« vá»±ng, Ä‘á»‹nh nghÄ©a, hÃ¬nhâ€“tÃªn.",
    preview: (
      <div className="text-xs space-y-1">
        {[
          ["CÃ¡", "ðŸŸ"],
          ["Chim", "ðŸ¦"],
          ["Voi", "ðŸ˜"],
        ].map(([a, b]) => (
          <div key={a} className="flex items-center gap-2">
            <span className="flex-1 rounded border-2 px-2 py-0.5 bg-card font-bold">
              {a}
            </span>
            <span className="text-primary">â”â”</span>
            <span className="flex-1 rounded border-2 px-2 py-0.5 bg-primary/10 font-bold text-center">
              {b}
            </span>
          </div>
        ))}
      </div>
    ),
  },
  {
    key: "ordering",
    group: "spatial",
    desc: "Sáº¯p xáº¿p cÃ¡c bÆ°á»›c/sá»± kiá»‡n theo Ä‘Ãºng thá»© tá»±. Tá»‘t cho quy trÃ¬nh, lá»‹ch sá»­.",
    preview: (
      <div className="space-y-1 text-xs">
        {["1. Bay hÆ¡i", "2. NgÆ°ng tá»¥", "3. MÆ°a rÆ¡i", "4. Cháº£y vá» biá»ƒn"].map(
          (s, i) => (
            <div
              key={s}
              className="flex items-center gap-2 rounded border-2 px-2 py-1 bg-card"
            >
              <span className="size-5 rounded bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center">
                {i + 1}
              </span>
              <span className="font-bold">{s.slice(3)}</span>
            </div>
          ),
        )}
      </div>
    ),
  },
  {
    key: "image_hotspot",
    group: "spatial",
    desc: "Chá»n vÃ¹ng/bá»™ pháº­n chÃ­nh xÃ¡c trÃªn hÃ¬nh áº£nh. PhÃ¹ há»£p giáº£i pháº«u, báº£n Ä‘á»“, sÆ¡ Ä‘á»“.",
    preview: (
      <div className="relative aspect-[4/3] rounded-lg bg-gradient-to-br from-info/30 to-success/20 border-2">
        <div className="absolute top-3 left-4 size-6 rounded-full bg-success border-2 border-card animate-pulse flex items-center justify-center text-[10px] font-bold text-success-foreground">
          âœ“
        </div>
        <div className="absolute bottom-4 right-6 size-5 rounded-full bg-primary/60 border-2 border-card" />
        <div className="absolute inset-x-0 bottom-1 text-center text-[10px] text-muted-foreground font-bold">
          Báº¥m vÃ¹ng Ä‘Ãºng
        </div>
      </div>
    ),
  },
  {
    key: "kahoot",
    group: "gamification",
    desc: "Quiz nhá»‹p Ä‘á»™ nhanh phong cÃ¡ch Kahoot, 4 phÆ°Æ¡ng Ã¡n mÃ u, tÃ­nh Ä‘iá»ƒm theo tá»‘c Ä‘á»™.",
    preview: (
      <div className="grid grid-cols-2 gap-1.5">
        {[
          ["bg-destructive", "â–²"],
          ["bg-info", "â—†"],
          ["bg-warning", "â—"],
          ["bg-success", "â– "],
        ].map(([c, s]) => (
          <div
            key={c}
            className={`${c} text-white rounded-md p-2 text-center font-bold text-sm`}
          >
            {s}
          </div>
        ))}
      </div>
    ),
  },
  {
    key: "speed",
    group: "gamification",
    desc: "Ai nhanh hÆ¡n â€” Ä‘áº¿m ngÆ°á»£c, cÃ ng tráº£ lá»i nhanh cÃ ng nhiá»u Ä‘iá»ƒm thÆ°á»Ÿng.",
    preview: (
      <div className="text-center">
        <div className="font-display text-3xl font-bold text-destructive">
          â± 03
        </div>
        <div className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">
          giÃ¢y cÃ²n láº¡i
        </div>
        <div className="mt-1 inline-block px-2 py-0.5 rounded-full bg-warning/30 text-[10px] font-bold">
          +50 XP nhanh!
        </div>
      </div>
    ),
  },
  {
    key: "flashcard",
    group: "gamification",
    desc: "Láº­t tháº» ghi nhá»› â€” máº·t trÆ°á»›c cÃ¢u há»i, máº·t sau Ä‘Ã¡p Ã¡n. Há»c tá»« vá»±ng, cÃ´ng thá»©c.",
    preview: (
      <div className="rounded-xl bg-gradient-to-br from-primary to-fun text-primary-foreground p-4 text-center shadow-card">
        <div className="text-[10px] uppercase tracking-wider opacity-80">
          Photosynthesis
        </div>
        <div className="font-display text-lg font-bold mt-1">Quang há»£p</div>
        <div className="text-[10px] mt-1 opacity-70">â†» cháº¡m Ä‘á»ƒ láº­t</div>
      </div>
    ),
  },
  {
    key: "leaderboard",
    group: "gamification",
    desc: "Äua top â€” báº£ng xáº¿p háº¡ng thá»i gian thá»±c vá»›i báº¡n cÃ¹ng lá»›p.",
    preview: (
      <div className="space-y-1 text-xs">
        {[
          ["ðŸ¥‡", "Minh", "1.250"],
          ["ðŸ¥ˆ", "Em", "1.180"],
          ["ðŸ¥‰", "Lan", "1.050"],
        ].map(([m, n, p]) => (
          <div
            key={n}
            className="flex items-center gap-2 rounded border-2 bg-card px-2 py-1"
          >
            <span>{m}</span>
            <span className="font-bold flex-1">{n}</span>
            <span className="text-primary font-bold">{p}</span>
          </div>
        ))}
      </div>
    ),
  },
  {
    key: "level",
    group: "gamification",
    desc: "VÆ°á»£t mÃ n â€” chinh phá»¥c tá»«ng level theo Ä‘á»™ khÃ³ tÄƒng dáº§n, má»Ÿ khÃ³a thÆ°á»Ÿng.",
    preview: (
      <div className="flex items-center gap-1.5">
        {[1, 2, 3, 4, 5].map((l) => (
          <div
            key={l}
            className={`size-8 rounded-lg flex items-center justify-center font-bold text-sm ${l <= 3 ? "bg-success text-success-foreground" : l === 4 ? "bg-warning text-warning animate-pulse" : "bg-muted text-muted-foreground"}`}
          >
            {l <= 3 ? "âœ“" : l}
          </div>
        ))}
      </div>
    ),
  },
  {
    key: "puzzle",
    group: "gamification",
    desc: "GhÃ©p hÃ¬nh â€” hoÃ n thÃ nh cÃ¡c máº£nh Ä‘á»ƒ khÃ¡m phÃ¡ hÃ¬nh áº£nh kiáº¿n thá»©c.",
    preview: (
      <div className="grid grid-cols-3 gap-0.5 aspect-square w-32 mx-auto">
        {Array.from({ length: 9 }).map((_, i) => (
          <div
            key={i}
            className={`rounded-sm ${i === 4 ? "bg-muted" : `bg-gradient-to-br ${["from-primary to-fun", "from-success to-info", "from-warning to-destructive"][i % 3]}`}`}
          />
        ))}
      </div>
    ),
  },
  {
    key: "story",
    group: "gamification",
    desc: "Story-based â€” há»c theo cá»‘t truyá»‡n, má»—i cÃ¢u tráº£ lá»i áº£nh hÆ°á»Ÿng diá»…n biáº¿n.",
    preview: (
      <div className="rounded-lg border-2 bg-gradient-to-br from-fun/20 to-warning/20 p-2.5 text-xs">
        <div className="font-bold">ðŸ Ong ChÄƒm Chá»‰:</div>
        <div className="text-muted-foreground italic mt-0.5">
          "Em hÃ£y giÃºp tÃ´i tÃ¬m Ä‘Æ°á»ng vá» tá»• qua khu rá»«ng kiáº¿n thá»©c..."
        </div>
      </div>
    ),
  },
  {
    key: "step_hint",
    group: "advanced",
    desc: "Gá»£i Ã½ tá»«ng bÆ°á»›c khi há»c sinh gáº·p khÃ³ â€” bÃ³c tÃ¡ch bÃ i toÃ¡n, khÃ´ng lá»™ Ä‘Ã¡p Ã¡n.",
    preview: (
      <div className="space-y-1 text-xs">
        <div className="rounded border-2 border-info bg-info/10 p-1.5">
          ðŸ’¡ BÆ°á»›c 1: XÃ¡c Ä‘á»‹nh dá»¯ liá»‡u Ä‘Ã£ cho
        </div>
        <div className="rounded border-2 border-dashed border-muted-foreground p-1.5 text-muted-foreground">
          ðŸ’¡ BÆ°á»›c 2: ...
        </div>
      </div>
    ),
  },
  {
    key: "explanation",
    group: "advanced",
    desc: "Hiá»ƒn thá»‹ lá»i giáº£i chi tiáº¿t sau khi há»c sinh ná»™p bÃ i, kÃ¨m hÃ¬nh minh há»a.",
    preview: (
      <div className="rounded-lg border-2 border-success bg-success/10 p-2 text-xs">
        <div className="font-bold text-success mb-1">âœ“ Giáº£i thÃ­ch:</div>
        <div className="text-foreground/80">
          NÆ°á»›c trong tá»± nhiÃªn tá»“n táº¡i á»Ÿ 3 thá»ƒ: ráº¯n, lá»ng, khÃ­. Khi nhiá»‡t Ä‘á»™ thay
          Ä‘á»•i...
        </div>
      </div>
    ),
  },
  {
    key: "peer_compare",
    group: "advanced",
    desc: "So sÃ¡nh Ä‘Ã¡p Ã¡n vá»›i báº¡n cÃ¹ng lá»›p (áº©n danh) Ä‘á»ƒ há»c tá»« cÃ¡ch giáº£i khÃ¡c.",
    preview: (
      <div className="text-xs space-y-1">
        <div className="rounded border-2 border-primary bg-primary/10 px-2 py-1">
          <b>Em:</b> VÃ¬ hÆ¡i nÆ°á»›c ngÆ°ng tá»¥
        </div>
        <div className="rounded border-2 px-2 py-1 bg-card">
          <b className="text-muted-foreground">Báº¡n A:</b> Do gáº·p láº¡nh táº¡o mÃ¢y
        </div>
      </div>
    ),
  },
  {
    key: "adaptive",
    group: "ai",
    desc: "Adaptive AI â€” cÃ¢u há»i tiáº¿p theo tá»± Ä‘á»™ng Ä‘iá»u chá»‰nh theo nÄƒng lá»±c hiá»‡n táº¡i cá»§a há»c sinh.",
    preview: (
      <div className="space-y-1.5">
        <div className="flex items-center gap-2 text-xs">
          <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
            <div className="h-full w-3/5 bg-gradient-to-r from-success to-warning" />
          </div>
          <span className="font-bold text-warning">Trung bÃ¬nh</span>
        </div>
        <div className="text-[10px] text-muted-foreground">
          ðŸ¤– AI Ä‘ang tÄƒng Ä‘á»™ khÃ³ cho em...
        </div>
      </div>
    ),
  },
];

export function AboutPage() {
  const grouped = (Object.keys(GROUPS) as GroupKey[]).map((g) => ({
    group: g,
    items: QTYPES.filter((q) => q.group === g),
  }));

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary/5 via-background to-fun/5">
      {/* Header */}
      <header className="border-b-2 bg-card/80 backdrop-blur sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center gap-3">
          <Link to="/" className="flex items-center gap-2.5">
            <img
              src={mascot}
              alt="NXBGDVN logo"
              className="size-10"
              width={40}
              height={40}
            />
            <div>
              <div className="font-display font-bold text-lg leading-tight">
                NXBGDVN
              </div>
              <div className="text-xs text-muted-foreground leading-tight">
                Vá»Ÿ bÃ i táº­p (AI)
              </div>
            </div>
          </Link>
          <div className="flex-1" />
          <Link
            to="/"
            className="inline-flex items-center gap-2 rounded-xl border-2 border-border bg-card px-4 py-2 text-sm font-bold hover:border-primary"
          >
            <ArrowLeft className="size-4" /> Vá» trang chá»§
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-7xl mx-auto px-4 pt-12 pb-8 text-center">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-warning/20 text-warning font-bold text-xs mb-4">
          <Sparkles className="size-4" /> 11 loáº¡i cÃ¢u há»i Â· 5 nhÃ³m tÆ°Æ¡ng tÃ¡c
        </div>
        <h1 className="font-display text-4xl md:text-5xl font-bold tracking-tight">
          Giá»›i thiá»‡u cÃ¡c <span className="text-primary">kiá»ƒu cÃ¢u há»i</span>{" "}
          tÆ°Æ¡ng tÃ¡c
        </h1>
        <p className="mt-4 text-lg text-muted-foreground max-w-3xl mx-auto">
          Há»‡ thá»‘ng NXBGDVN - Vá»Ÿ bÃ i táº­p (AI) há»— trá»£ <b>11 loáº¡i cÃ¢u há»i</b>{" "}
          Ä‘Æ°á»£c phÃ¢n thÃ nh 5 nhÃ³m, giÃºp giÃ¡o viÃªn thiáº¿t káº¿ bÃ i táº­p phong phÃº vÃ 
          há»c sinh há»c vui hÆ¡n, hiá»‡u quáº£ hÆ¡n.
        </p>
      </section>

      {/* Groups */}
      <section className="max-w-7xl mx-auto px-4 pb-16 space-y-12">
        {grouped.map(({ group, items }) => {
          const meta = GROUPS[group];
          return (
            <div key={group}>
              <div className="flex items-center gap-3 mb-5">
                <span className="text-3xl">{meta.emoji}</span>
                <div>
                  <div className="text-xs font-bold uppercase tracking-wider text-primary">
                    {items.length} kiá»ƒu
                  </div>
                  <h2 className="font-display text-2xl md:text-3xl font-bold leading-tight">
                    {meta.label}
                  </h2>
                </div>
              </div>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {items.map((q) => (
                  <Card
                    key={q.key}
                    className={`p-0 border-2 overflow-hidden hover:-translate-y-1 hover:shadow-card transition-all bg-gradient-to-br ${meta.color}`}
                  >
                    <div className="bg-card/60 backdrop-blur-sm p-4 min-h-[160px] flex items-center justify-center border-b-2 border-border/50">
                      <div className="w-full max-w-[240px]">{q.preview}</div>
                    </div>
                    <div className="p-4 bg-card">
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">
                        {meta.label}
                      </div>
                      <div className="font-bold text-base leading-tight mt-0.5">
                        {TYPE_LABELS[q.key]}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
                        {q.desc}
                      </p>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          );
        })}
      </section>

      {/* CTA */}
      <section className="max-w-7xl mx-auto px-4 pb-16 text-center">
        <Card className="p-8 border-2 bg-gradient-to-br from-primary/10 via-fun/10 to-warning/10">
          <h3 className="font-display text-2xl md:text-3xl font-bold">
            Sáºµn sÃ ng tráº£i nghiá»‡m?
          </h3>
          <p className="text-muted-foreground mt-2">
            KhÃ¡m phÃ¡ vá»Ÿ bÃ i táº­p vÃ  lÃ m thá»­ cÃ¡c kiá»ƒu cÃ¢u há»i trÃªn.
          </p>
          <div className="mt-5 flex flex-wrap gap-3 justify-center">
            <Link
              to="/"
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-bold text-primary-foreground shadow-soft hover:opacity-90"
            >
              KhÃ¡m phÃ¡ vá»Ÿ bÃ i táº­p
            </Link>
            <Link
              to="/"
              className="inline-flex items-center gap-2 rounded-xl border-2 border-border bg-card px-5 py-3 text-sm font-bold hover:border-primary"
            >
              <ArrowLeft className="size-4" /> Vá» trang chá»§
            </Link>
          </div>
        </Card>
      </section>

      <footer className="border-t-2 bg-card">
        <div className="max-w-7xl mx-auto px-4 py-6 text-center text-xs text-muted-foreground">
          Â© NXBGDVN Â· Há»‡ thá»‘ng sÃ¡ch giÃ¡o khoa bÃ i táº­p (TÃ­ch há»£p AI há»— trá»£ phÃ¡t
          triá»ƒn nÄƒng lá»±c sá»‘) Â· v{__APP_VERSION__}
        </div>
      </footer>
    </div>
  );
}

function PreviewChoices({
  items,
  multi,
}: {
  items: { t: string; ok?: boolean }[];
  multi?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      {items.map((it) => (
        <div
          key={it.t}
          className={`flex items-center gap-2 rounded-lg border-2 px-2.5 py-1.5 text-xs ${it.ok ? "border-success bg-success/10" : "border-border bg-card"}`}
        >
          <div
            className={`size-4 ${multi ? "rounded" : "rounded-full"} border-2 ${it.ok ? "bg-success border-success" : "border-muted-foreground"} flex items-center justify-center`}
          >
            {it.ok && (
              <span className="text-success-foreground text-[10px] font-bold">
                âœ“
              </span>
            )}
          </div>
          <span className="font-bold">{it.t}</span>
        </div>
      ))}
    </div>
  );
}
