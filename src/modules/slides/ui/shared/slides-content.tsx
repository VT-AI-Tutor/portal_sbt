import type { ReactNode } from "react";
import mascot from "@/core/assets/mascot-bee.png";
import {
  Sparkles,
  BookOpen,
  Brain,
  Trophy,
  Users,
  Send,
  Database,
  LineChart,
  Landmark,
  MapPin,
  School,
  Home,
  Rocket,
  Heart,
  GraduationCap,
  Zap,
  Target,
  BarChart3,
  FileText,
  Bot,
  TrendingUp,
  CheckCircle2,
  Lightbulb,
  ClipboardCheck,
  Award,
} from "lucide-react";

/* Reusable shell: 1920x1080 friendly cream/dark slide canvas */
function Canvas({
  children,
  tone = "light",
  pad = 96,
}: {
  children: ReactNode;
  tone?: "light" | "dark" | "primary" | "fun";
  pad?: number;
}) {
  const bg =
    tone === "dark"
      ? "bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-amber-50"
      : tone === "primary"
        ? "bg-gradient-to-br from-amber-50 via-orange-50 to-rose-50 text-slate-900"
        : tone === "fun"
          ? "bg-gradient-to-br from-violet-100 via-fuchsia-50 to-amber-50 text-slate-900"
          : "bg-gradient-to-br from-amber-50 via-white to-sky-50 text-slate-900";
  return (
    <div
      className={`relative w-[1920px] h-[1080px] overflow-hidden ${bg}`}
      style={{ padding: pad }}
    >
      {/* subtle decorative blobs */}
      <div className="absolute -top-40 -right-40 size-[500px] rounded-full bg-amber-300/20 blur-3xl" />
      <div className="absolute -bottom-40 -left-40 size-[500px] rounded-full bg-sky-300/20 blur-3xl" />
      <div className="relative h-full">{children}</div>
    </div>
  );
}

function Footer({ n, total = 16 }: { n: number; total?: number }) {
  return (
    <div className="absolute bottom-0 left-0 right-0 flex items-center justify-between text-base opacity-60">
      <div className="flex items-center gap-2">
        <img src={mascot} alt="" className="size-7" /> SBT số NXBGDVN
      </div>
      <div>
        {n} / {total}
      </div>
    </div>
  );
}

function Tag({
  children,
  color = "amber",
}: {
  children: ReactNode;
  color?: "amber" | "sky" | "violet" | "emerald" | "rose";
}) {
  const map = {
    amber: "bg-amber-200 text-amber-900",
    sky: "bg-sky-200 text-sky-900",
    violet: "bg-violet-200 text-violet-900",
    emerald: "bg-emerald-200 text-emerald-900",
    rose: "bg-rose-200 text-rose-900",
  } as const;
  return (
    <span
      className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-lg font-bold ${map[color]}`}
    >
      {children}
    </span>
  );
}

function Bullet({
  icon: Icon,
  title,
  desc,
  color = "amber",
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  desc: string;
  color?: "amber" | "sky" | "violet" | "emerald" | "rose" | "indigo";
}) {
  const map = {
    amber: "bg-amber-100 text-amber-700 ring-amber-300",
    sky: "bg-sky-100 text-sky-700 ring-sky-300",
    violet: "bg-violet-100 text-violet-700 ring-violet-300",
    emerald: "bg-emerald-100 text-emerald-700 ring-emerald-300",
    rose: "bg-rose-100 text-rose-700 ring-rose-300",
    indigo: "bg-indigo-100 text-indigo-700 ring-indigo-300",
  } as const;
  return (
    <div className="flex gap-5">
      <div
        className={`size-16 rounded-2xl ring-2 ${map[color]} flex items-center justify-center shrink-0`}
      >
        <Icon className="size-8" />
      </div>
      <div>
        <div className="font-display font-bold text-2xl mb-1">{title}</div>
        <div className="text-xl opacity-80 leading-snug">{desc}</div>
      </div>
    </div>
  );
}

function Stat({
  value,
  label,
  color = "amber",
}: {
  value: string;
  label: string;
  color?: string;
}) {
  return (
    <div
      className={`p-8 rounded-3xl bg-white/80 ring-2 ring-${color}-300 backdrop-blur`}
    >
      <div className={`font-display text-7xl font-extrabold text-${color}-600`}>
        {value}
      </div>
      <div className="text-xl mt-2 font-medium">{label}</div>
    </div>
  );
}

/* ============== SLIDES ============== */

// 1. Cover
const S01 = () => (
  <Canvas tone="dark">
    <div className="h-full grid grid-cols-2 items-center gap-12">
      <div>
        <Tag color="amber">
          <Sparkles className="size-5" /> NỀN TẢNG HỌC LIỆU SỐ
        </Tag>
        <h1 className="font-display text-8xl font-extrabold mt-6 leading-tight">
          Vở bài tập số{" "}
          <span className="text-amber-300 block whitespace-nowrap">
            Nhà xuất bản
          </span>
          <span className="text-amber-300 block whitespace-nowrap">
            Giáo dục Việt Nam
          </span>
        </h1>
        <p className="text-3xl mt-6 opacity-90 leading-relaxed">
          Vở bài tập tương tác — đồng hành cùng học sinh, giáo viên và nhà
          quản lì trong kỉ nguyên số.
        </p>
        <div className="mt-10 flex items-center gap-4 text-xl opacity-80">
          <GraduationCap className="size-7 text-amber-300" />
          Nhà xuất bản Giáo dục Việt Nam, 2026
        </div>
      </div>
      <div className="relative flex items-center justify-center">
        <div className="absolute size-[480px] rounded-full bg-amber-300/30 blur-3xl" />
        <img
          src={mascot}
          alt="Ong Chăm Chỉ"
          className="size-[480px] relative drop-shadow-2xl"
        />
      </div>
    </div>
    <Footer n={1} />
  </Canvas>
);

// 2. Mục tiêu hệ thống
const S02 = () => (
  <Canvas>
    <Tag color="rose">
      <Target className="size-5" /> MỤC TIÊU HỆ THỐNG
    </Tag>
    <h2 className="font-display text-6xl font-extrabold mt-4">
      SBT số NXBGDVN hướng tới điều gì?
    </h2>
    <p className="text-2xl opacity-80 mt-3">
      4 mục tiêu cốt lõi xuyên suốt mọi tính năng.
    </p>
    <div className="grid grid-cols-2 gap-6 mt-10">
      {[
        {
          icon: Brain,
          t: "Hỗ trợ học sinh học theo năng lực",
          d: "Lộ trình cá nhân hoá, phản hồi tức thời, củng cố đúng phần còn yếu.",
          c: "amber" as const,
        },
        {
          icon: Users,
          t: "Giảm tải cho giáo viên",
          d: "Tự động chấm, gợi ý đề, theo dõi lớp realtime — dành thời gian cho dạy thật.",
          c: "sky" as const,
        },
        {
          icon: BarChart3,
          t: "Quản lí bằng dữ liệu — thống kê 4 cấp",
          d: "Báo cáo Bộ → Tỉnh → Xã → Trường, bỏ Excel thủ công.",
          c: "emerald" as const,
        },
        {
          icon: Bot,
          t: "AI đồng hành an toàn cho giáo dục Việt",
          d: "Ong Chăm Chỉ trợ giảng, dịch, chấm văn — bám SGK, an toàn cho trẻ.",
          c: "violet" as const,
        },
      ].map((x) => (
        <div
          key={x.t}
          className="p-8 rounded-3xl bg-white/80 ring-2 ring-slate-200"
        >
          <Bullet icon={x.icon} title={x.t} desc={x.d} color={x.c} />
        </div>
      ))}
    </div>
    <div className="mt-10 p-7 rounded-3xl bg-amber-100/80 ring-2 ring-amber-300 flex items-center gap-6">
      <Lightbulb className="size-12 text-amber-600 shrink-0" />
      <div className="text-2xl leading-snug">
        Một nền tảng — phục vụ đồng thời <strong>học sinh, giáo viên</strong> và{" "}
        <strong>nhà quản lí</strong>, dữ liệu liên thông xuyên suốt.
      </div>
    </div>
    <Footer n={3} />
  </Canvas>
);

// 3. Tổng quan hệ thống — 3 vai trò + AI
const S03 = () => (
  <Canvas tone="primary">
    <Tag color="violet">
      <Rocket className="size-5" /> TỔNG QUAN HỆ THỐNG
    </Tag>
    <h2 className="font-display text-6xl font-extrabold mt-4">
      3 vai trò — 1 hệ sinh thái
    </h2>
    <p className="text-2xl opacity-80 mt-3">
      Mỗi vai trò có không gian riêng, dữ liệu liên thông xuyên suốt.
    </p>
    <div className="grid grid-cols-3 gap-8 mt-12">
      {[
        {
          emoji: "🎓",
          role: "Học sinh",
          desc: "Học bằng game, làm bài tương tác, thi đấu cùng bạn.",
          color: "from-amber-200 to-orange-200 ring-amber-400",
        },
        {
          emoji: "👨‍🏫",
          role: "Giáo viên",
          desc: "Ngân hàng câu hỏi, AI tạo đề, theo dõi lớp realtime.",
          color: "from-sky-200 to-indigo-200 ring-sky-400",
        },
        {
          emoji: "🏛️",
          role: "Quản lí",
          desc: "Dashboard 4 cấp: Bộ → Tỉnh → Xã → Trường.",
          color: "from-emerald-200 to-teal-200 ring-emerald-400",
        },
      ].map((r) => (
        <div
          key={r.role}
          className={`p-10 rounded-[2rem] bg-gradient-to-br ${r.color} ring-2 shadow-xl`}
        >
          <div className="text-9xl">{r.emoji}</div>
          <div className="font-display text-4xl font-extrabold mt-4">
            {r.role}
          </div>
          <div className="text-2xl mt-3 opacity-80 leading-snug">{r.desc}</div>
        </div>
      ))}
    </div>
    {/* AI Ong Chăm Chỉ — biểu tượng linh vật */}
    <div className="absolute bottom-20 right-16 flex items-center gap-5 bg-white/85 ring-2 ring-violet-300 rounded-3xl pl-6 pr-8 py-4 shadow-xl">
      <img src={mascot} alt="Ong Chăm Chỉ" className="size-28 drop-shadow-lg" />
      <div className="text-left">
        <div className="flex items-center gap-2 text-violet-700 font-bold text-lg">
          <Bot className="size-5" /> TRỢ LÍ AI
        </div>
        <div className="font-display text-2xl font-extrabold">Ong Chăm Chỉ</div>
        <div className="text-lg opacity-70">đồng hành cả 3 vai trò</div>
      </div>
    </div>
    <Footer n={4} />
  </Canvas>
);

// 4. Học sinh — Tính năng
const S04 = () => (
  <Canvas>
    <div className="flex items-center gap-4">
      <Tag color="amber">🎓 ROLE HỌC SINH</Tag>
      <span className="text-xl opacity-60">Phần 1/2 — Tính năng</span>
    </div>
    <h2 className="font-display text-6xl font-extrabold mt-4">
      Học mà chơi — chơi mà học
    </h2>
    <div className="grid grid-cols-2 gap-x-12 gap-y-8 mt-10">
      <Bullet
        icon={BookOpen}
        color="amber"
        title="Phiếu bài tập / Giáo viên giao thêm / Bài kiểm tra"
        desc="3 luồng nhiệm vụ rõ ràng, lọc theo môn, hạn nộp trực quan."
      />
      <Bullet
        icon={Brain}
        color="violet"
        title="Năng lực của tôi"
        desc="Sơ đồ năng lực theo từng chủ đề: thành thạo / cần luyện thêm."
      />
      <Bullet
        icon={Zap}
        color="sky"
        title="Luyện tập theo SBT & năng lực"
        desc="Chọn theo sách giáo khoa hoặc theo điểm yếu AI gợi ý."
      />
      <Bullet
        icon={Trophy}
        color="rose"
        title="Thi đấu — Battle"
        desc="Đấu 1-1 hoặc theo phòng, học sinh hứng thú, thi đua tích cực."
      />
      <Bullet
        icon={Award}
        color="emerald"
        title="Thành tích, huy hiệu, chuỗi học"
        desc="Hệ thống XP, streak, bảng xếp hạng lớp tạo động lực mỗi ngày."
      />
      <Bullet
        icon={Bot}
        color="indigo"
        title="Ong Chăm Chỉ — Trợ lí AI"
        desc="Flashcard tự sinh và Giáo viên AI chấm văn — phản hồi tức thời 24/7."
      />
    </div>
    <Footer n={6} />
  </Canvas>
);

// 5. Học sinh — Lợi ích & hướng dẫn
const S05 = () => (
  <Canvas tone="primary">
    <div className="flex items-center gap-4">
      <Tag color="amber">🎓 ROLE HỌC SINH</Tag>
      <span className="text-xl opacity-60">
        Phần 2/2 — Lợi ích & hướng dẫn dùng
      </span>
    </div>
    <h2 className="font-display text-6xl font-extrabold mt-4">
      Lợi ích cho học sinh & cách bắt đầu
    </h2>
    <div className="grid grid-cols-2 gap-10 mt-10 h-[760px]">
      <div className="p-10 rounded-3xl bg-white/80 ring-2 ring-amber-300">
        <div className="font-display text-3xl font-bold text-amber-700 flex items-center gap-3">
          <Heart className="size-8" /> Lợi ích
        </div>
        <ul className="mt-6 space-y-5 text-2xl leading-relaxed">
          <li className="flex gap-3">
            <CheckCircle2 className="size-7 text-amber-600 shrink-0 mt-1" /> Tự
            học mọi lúc, mọi nơi — không cần chờ giáo viên chấm.
          </li>
          <li className="flex gap-3">
            <CheckCircle2 className="size-7 text-amber-600 shrink-0 mt-1" />{" "}
            Phản hồi tức thời, biết đúng/sai và khắc phục.
          </li>
          <li className="flex gap-3">
            <CheckCircle2 className="size-7 text-amber-600 shrink-0 mt-1" /> Lộ
            trình cá nhân hoá theo điểm mạnh / yếu.
          </li>
          <li className="flex gap-3">
            <CheckCircle2 className="size-7 text-amber-600 shrink-0 mt-1" />{" "}
            Hứng thú học nhờ game hoá, huy hiệu, đấu trường.
          </li>
          <li className="flex gap-3">
            <CheckCircle2 className="size-7 text-amber-600 shrink-0 mt-1" /> Phụ
            huynh xem được tiến độ rõ ràng.
          </li>
        </ul>
      </div>
      <div className="p-10 rounded-3xl bg-white/80 ring-2 ring-sky-300">
        <div className="font-display text-3xl font-bold text-sky-700 flex items-center gap-3">
          <ClipboardCheck className="size-8" /> 4 bước bắt đầu
        </div>
        <ol className="mt-6 space-y-5 text-2xl">
          {[
            "Đăng nhập bằng tài khoản nhà trường cấp.",
            "Vào “Bài tập của tôi” → chọn phiếu cô giao.",
            "Làm bài — nhận giải thích & gợi ý từ Ong Chăm Chỉ.",
            "Vào “Năng lực” để biết phần cần luyện thêm.",
          ].map((s, i) => (
            <li key={i} className="flex gap-4">
              <span className="size-10 rounded-full bg-sky-600 text-white font-bold flex items-center justify-center shrink-0">
                {i + 1}
              </span>
              <span className="leading-snug">{s}</span>
            </li>
          ))}
        </ol>
      </div>
    </div>
    <Footer n={7} />
  </Canvas>
);

// 6. Giáo viên — Tính năng
const S06 = () => (
  <Canvas>
    <div className="flex items-center gap-4">
      <Tag color="sky">👨‍🏫 ROLE GIÁO VIÊN</Tag>
      <span className="text-xl opacity-60">Phần 1/2 — Tính năng</span>
    </div>
    <h2 className="font-display text-6xl font-extrabold mt-4">
      Trợ lí dạy học toàn diện
    </h2>
    <div className="grid grid-cols-2 gap-x-12 gap-y-8 mt-10">
      <Bullet
        icon={Database}
        color="sky"
        title="Ngân hàng câu hỏi đa dạng"
        desc="Trắc nghiệm, tự luận, kéo-thả, ghép cặp, điền chỗ trống... bám SGK."
      />
      <Bullet
        icon={FileText}
        color="indigo"
        title="Ngân hàng đề / phiếu — 3 luồng tạo"
        desc="Tạo thủ công, theo SBT (chọn lớp/môn/sách → chương) hoặc AI gợi ý."
      />
      <Bullet
        icon={Send}
        color="amber"
        title="Giao bài tập linh hoạt"
        desc="Theo lớp, theo nhóm năng lực, theo cá nhân — đặt hạn tự động."
      />
      <Bullet
        icon={ClipboardCheck}
        color="rose"
        title="Thi & kiểm tra trực tuyến"
        desc="Trộn đề, chống gian lận, tự chấm — kết quả ngay khi nộp."
      />
      <Bullet
        icon={LineChart}
        color="emerald"
        title="Theo dõi tiến độ realtime"
        desc="Biểu đồ tỉ lệ hoàn thành, danh sách HS yếu, cảnh báo vắng học."
      />
      <Bullet
        icon={Bot}
        color="violet"
        title="AI - Trợ lý giảng dạy cho giáo viên"
        desc="Dịch đề, biên soạn câu hỏi từ ngữ liệu, gợi ý phụ đạo theo nhóm."
      />
    </div>
    <Footer n={8} />
  </Canvas>
);

// 7. Giáo viên — Lợi ích & hướng dẫn
const S07 = () => (
  <Canvas tone="primary">
    <div className="flex items-center gap-4">
      <Tag color="sky">👨‍🏫 ROLE GIÁO VIÊN</Tag>
      <span className="text-xl opacity-60">
        Phần 2/2 — Lợi ích & hướng dẫn dùng
      </span>
    </div>
    <h2 className="font-display text-6xl font-extrabold mt-4">
      Tiết kiệm thời gian — Dạy hiệu quả hơn
    </h2>
    <div className="grid grid-cols-3 gap-6 mt-10">
      <Stat value="-70%" label="Thời gian soạn đề & chấm bài" color="sky" />
      <Stat
        value="x3"
        label="Lượng phản hồi cá nhân hoá tới HS"
        color="amber"
      />
      <Stat
        value="100%"
        label="Dữ liệu lớp số hoá, sẵn sàng báo cáo"
        color="emerald"
      />
    </div>
    <div className="grid grid-cols-2 gap-10 mt-10">
      <div className="p-8 rounded-3xl bg-white/80 ring-2 ring-sky-300">
        <div className="font-display text-2xl font-bold text-sky-700 mb-4 flex items-center gap-3">
          <Heart className="size-7" /> Lợi ích
        </div>
        <ul className="space-y-3 text-xl">
          <li>✅ Không còn ôm chồng vở chấm cuối tuần.</li>
          <li>✅ Phát hiện HS yếu sớm → can thiệp kịp thời.</li>
          <li>✅ Phụ huynh nhận báo cáo tự động — yên tâm phối hợp.</li>
          <li>✅ Dạy phân hoá theo năng lực thật sự khả thi.</li>
        </ul>
      </div>
      <div className="p-8 rounded-3xl bg-white/80 ring-2 ring-amber-300">
        <div className="font-display text-2xl font-bold text-amber-700 mb-4 flex items-center gap-3">
          <ClipboardCheck className="size-7" /> Quy trình 1 tuần điển hình
        </div>
        <ol className="space-y-3 text-xl">
          <li>
            <strong>Thứ 2:</strong> Tạo phiếu bài tập theo SBT → giao cho lớp.
          </li>
          <li>
            <strong>Thứ 3-5:</strong> Theo dõi dashboard, AI gợi ý nhóm cần phụ
            đạo.
          </li>
          <li>
            <strong>Thứ 6:</strong> Tổ chức thi 15’ trực tuyến — chấm tự động.
          </li>
          <li>
            <strong>Cuối tuần:</strong> Xuất báo cáo gửi phụ huynh chỉ với 1 cú
            nhấp.
          </li>
        </ol>
      </div>
    </div>
    <Footer n={9} />
  </Canvas>
);

// 8. Quản lí — Tính năng
const S08 = () => (
  <Canvas>
    <div className="flex items-center gap-4">
      <Tag color="emerald">🏛️ ROLE QUẢN LÍ</Tag>
      <span className="text-xl opacity-60">Phần 1/2 — Tính năng</span>
    </div>
    <h2 className="font-display text-6xl font-extrabold mt-4">
      Báo cáo điều hành 4 cấp
    </h2>
    <p className="text-2xl opacity-80 mt-3">
      Theo cơ cấu hành chính mới: Bộ → Tỉnh → Xã/Phường → Trường.
    </p>
    <div className="grid grid-cols-2 gap-x-12 gap-y-8 mt-10">
      <Bullet
        icon={Landmark}
        color="indigo"
        title="Báo cáo cấp Bộ"
        desc="KPI quốc gia, so sánh vùng KT-XH, tiến độ Nghị quyết 29."
      />
      <Bullet
        icon={MapPin}
        color="sky"
        title="Báo cáo cấp Tỉnh"
        desc="Xếp hạng xã/phường (sau sáp nhập 2025), top trường nổi bật."
      />
      <Bullet
        icon={Home}
        color="amber"
        title="Báo cáo cấp Xã"
        desc="Giám sát trường địa phương, học bổng, gắn kết phụ huynh."
      />
      <Bullet
        icon={School}
        color="emerald"
        title="Báo cáo cấp Trường"
        desc="Phổ điểm theo khối, chuẩn nghề GV, danh sách HS có nguy cơ."
      />
      <Bullet
        icon={Trophy}
        color="rose"
        title="Bảng xếp hạng quốc gia"
        desc="63 Sở GD&ĐT, cập nhật theo điểm TB và tỉ lệ HSG."
      />
      <Bullet
        icon={TrendingUp}
        color="violet"
        title="Dashboard điều hành"
        desc="Học sinh active tuần, điểm TB, tỉ lệ HSG — tất cả realtime."
      />
    </div>
    <Footer n={10} />
  </Canvas>
);

// 9. Quản lí — Lợi ích & hướng dẫn
const S09 = () => (
  <Canvas tone="primary">
    <div className="flex items-center gap-4">
      <Tag color="emerald">🏛️ ROLE QUẢN LÍ</Tag>
      <span className="text-xl opacity-60">
        Phần 2/2 — Lợi ích & hướng dẫn dùng
      </span>
    </div>
    <h2 className="font-display text-6xl font-extrabold mt-4">
      Ra quyết định bằng dữ liệu
    </h2>
    <div className="grid grid-cols-2 gap-10 mt-10 h-[760px]">
      <div className="p-10 rounded-3xl bg-white/80 ring-2 ring-emerald-300">
        <div className="font-display text-3xl font-bold text-emerald-700 flex items-center gap-3">
          <Heart className="size-8" /> Lợi ích
        </div>
        <ul className="mt-6 space-y-5 text-2xl leading-relaxed">
          <li className="flex gap-3">
            <CheckCircle2 className="size-7 text-emerald-600 shrink-0 mt-1" />{" "}
            Bỏ báo cáo Excel thủ công — số liệu tự động, đáng tin cậy.
          </li>
          <li className="flex gap-3">
            <CheckCircle2 className="size-7 text-emerald-600 shrink-0 mt-1" />{" "}
            Phân tích các trường/xã để ưu tiên hỗ trợ đúng đối tượng, đúng nội
            dung.
          </li>
          <li className="flex gap-3">
            <CheckCircle2 className="size-7 text-emerald-600 shrink-0 mt-1" />{" "}
            So sánh giữa các đơn vị, học hỏi mô hình tốt.
          </li>
          <li className="flex gap-3">
            <CheckCircle2 className="size-7 text-emerald-600 shrink-0 mt-1" />{" "}
            Minh bạch chất lượng giáo dục với xã hội.
          </li>
        </ul>
      </div>
      <div className="p-10 rounded-3xl bg-white/80 ring-2 ring-violet-300">
        <div className="font-display text-3xl font-bold text-violet-700 flex items-center gap-3">
          <ClipboardCheck className="size-8" /> Cách dùng theo cấp
        </div>
        <ul className="mt-6 space-y-5 text-2xl">
          <li>
            <strong>Lãnh đạo Bộ:</strong> mở Dashboard → Báo cáo cấp Bộ để xem
            số liệu toàn quốc.
          </li>
          <li>
            <strong>Lãnh đạo Sở/Tỉnh:</strong> theo dõi xếp hạng xã/phường, top
            trường tỉnh nhà.
          </li>
          <li>
            <strong>Phòng/Xã:</strong> giám sát trường địa phương, theo dõi học
            bổng, vắng học.
          </li>
          <li>
            <strong>Hiệu trưởng:</strong> xem phổ điểm theo khối, danh sách HS
            cần hỗ trợ.
          </li>
        </ul>
      </div>
    </div>
    <Footer n={11} />
  </Canvas>
);

// 10. AI xuyên suốt
const S10 = () => (
  <Canvas tone="dark">
    <div className="grid grid-cols-2 gap-12 h-full items-center">
      <div>
        <Tag color="violet">
          <Sparkles className="size-5" /> AI XUYÊN SUỐT
        </Tag>
        <h2 className="font-display text-6xl font-extrabold mt-4 leading-tight">
          Ong Chăm Chỉ — Trợ lí AI dành riêng cho giáo dục Việt
        </h2>
        <p className="text-2xl mt-6 opacity-90 leading-relaxed">
          Được tinh chỉnh theo Chương trình GDPT 2018, sử dụng ngữ liệu chính
          thống của NXBGDVN, an toàn cho lứa tuổi tiểu học.
        </p>
        <div className="mt-8 grid grid-cols-2 gap-4 text-xl">
          <div className="p-5 rounded-2xl bg-white/10 ring-1 ring-amber-300/40">
            <strong className="text-amber-300">Học sinh:</strong> flashcard tự
            sinh, Giáo viên AI chấm văn.
          </div>
          <div className="p-5 rounded-2xl bg-white/10 ring-1 ring-sky-300/40">
            <strong className="text-sky-300">Giáo viên:</strong> tạo đề, dịch,
            gợi ý phụ đạo.
          </div>
          <div className="p-5 rounded-2xl bg-white/10 ring-1 ring-emerald-300/40">
            <strong className="text-emerald-300">Quản lí:</strong> tóm tắt báo
            cáo, phát hiện bất thường.
          </div>
          <div className="p-5 rounded-2xl bg-white/10 ring-1 ring-rose-300/40">
            <strong className="text-rose-300">An toàn:</strong> kiểm duyệt nội
            dung, không thu thập thông tin cá nhân.
          </div>
        </div>
      </div>
      <div className="relative flex items-center justify-center">
        <div className="absolute size-[420px] rounded-full bg-violet-400/30 blur-3xl" />
        <img
          src={mascot}
          alt="Ong Chăm Chỉ"
          className="size-[420px] relative drop-shadow-2xl"
        />
      </div>
    </div>
    <Footer n={12} />
  </Canvas>
);

// 11. Học liệu — bám SBT NXBGDVN
const S11 = () => (
  <Canvas>
    <Tag color="amber">
      <BookOpen className="size-5" /> HỌC LIỆU
    </Tag>
    <h2 className="font-display text-6xl font-extrabold mt-4">
      Đồng bộ với SBT bản cứng — đầy đủ các môn
    </h2>
    <p className="text-2xl opacity-80 mt-3">
      Mỗi câu hỏi có thể truy ngược về đúng trang sách giấy.
    </p>
    <div className="grid grid-cols-6 gap-6 mt-10">
      {[
        "Toán 4",
        "Tiếng Việt 4",
        "Tiếng Anh 4",
        "Khoa học 4",
        "Lịch sử & Địa lí 4",
        "Tin học 4",
      ].map((name) => (
        <div
          key={name}
          className="rounded-2xl overflow-hidden ring-2 ring-slate-300 bg-white shadow-lg flex flex-col"
        >
          <div className="w-full h-80 bg-slate-50 flex items-center justify-center p-6">
            <BookOpen className="size-24 text-amber-500/60" />
          </div>
          <div className="p-3 text-center font-bold text-lg">{name}</div>
        </div>
      ))}
    </div>
    <div className="grid grid-cols-3 gap-6 mt-10">
      <Stat value="5" label="khối/lớp đã số hoá" color="amber" />
      <Stat value="30.000+" label="câu hỏi tương tác" color="sky" />
      <Stat
        value="23"
        label="kiểu tương tác (kéo-thả, ghép cặp…)"
        color="emerald"
      />
    </div>
    <Footer n={5} />
  </Canvas>
);

// 12. So sánh trước/sau
const S18 = () => (
  <Canvas tone="fun">
    <Tag color="rose">
      <BarChart3 className="size-5" /> TRƯỚC & SAU
    </Tag>
    <h2 className="font-display text-6xl font-extrabold mt-4">
      Một lớp học 4A — trước và sau khi dùng SBT số
    </h2>
    <div className="grid grid-cols-2 gap-10 mt-10">
      <div className="p-10 rounded-3xl bg-white/85 ring-2 ring-rose-300">
        <div className="font-display text-3xl font-bold text-rose-700">
          ❌ Trước
        </div>
        <ul className="mt-5 space-y-4 text-2xl">
          <li>• Giáo viên chấm 32 cuốn vở mỗi tuần — 6 giờ.</li>
          <li>
            • Giáo viên mất nhiều thời gian để theo dõi học lực từng học sinh.
          </li>
          <li>• Phụ huynh chỉ biết điểm qua sổ liên lạc tháng/lần.</li>
          <li>• Tổng hợp báo cáo nội bộ, báo cáo theo quy định: gõ Excel.</li>
        </ul>
      </div>
      <div className="p-10 rounded-3xl bg-white/85 ring-2 ring-emerald-300">
        <div className="font-display text-3xl font-bold text-emerald-700">
          ✅ Sau
        </div>
        <ul className="mt-5 space-y-4 text-2xl">
          <li>
            • AI chấm tự động — giáo viên dành thời gian cho phụ đạo cá nhân.
          </li>
          <li>
            • Giáo viên có nhiều thông tin sớm về học lực của từng học sinh.
          </li>
          <li>• Phụ huynh nhận báo cáo ngay trên điện thoại.</li>
          <li>• Xem dashboard tức thời — quyết định nhanh hơn.</li>
        </ul>
      </div>
    </div>
    <Footer n={14} />
  </Canvas>
);

// 19. Tổng kết — vì sao chọn ngay
const S19 = () => (
  <Canvas tone="dark">
    <Tag color="amber">
      <Sparkles className="size-5" /> TỔNG KẾT
    </Tag>
    <h2 className="font-display text-7xl font-extrabold mt-4">
      5 lí do chọn SBT số NXBGDVN
    </h2>
    <div className="grid grid-cols-5 gap-6 mt-12">
      {[
        { n: "01", t: "Bám SGK chính thống", d: "Chuẩn Bộ GD&ĐT" },
        { n: "02", t: "AI thiết kế cho VN", d: "Ngôn ngữ & văn hoá" },
        { n: "03", t: "Đầy đủ 3 vai trò", d: "HS – GV – Quản lí" },
        { n: "04", t: "Dữ liệu lưu tại VN", d: "Tuân thủ ND 13" },
        { n: "05", t: "Triển khai tận nơi", d: "Đào tạo & hỗ trợ" },
      ].map((x) => (
        <div
          key={x.n}
          className="p-6 rounded-2xl bg-white/10 ring-1 ring-amber-300/40 backdrop-blur"
        >
          <div className="font-display text-5xl font-extrabold text-amber-300">
            {x.n}
          </div>
          <div className="font-display text-2xl font-bold mt-3">{x.t}</div>
          <div className="text-lg opacity-80 mt-1">{x.d}</div>
        </div>
      ))}
    </div>
    <div className="mt-16 p-10 rounded-3xl bg-amber-300/20 ring-2 ring-amber-300/60 text-3xl text-center">
      “Mỗi học sinh Việt Nam — một trợ lí học tập riêng.{" "}
      <strong className="text-amber-300">Bắt đầu từ SBT số NXBGDVN.</strong>”
    </div>
    <Footer n={15} />
  </Canvas>
);

// 20. Cảm ơn / CTA
const S20 = () => (
  <Canvas tone="dark">
    <div className="h-full grid grid-cols-2 gap-12 items-center">
      <div>
        <Tag color="amber">CẢM ƠN</Tag>
        <h2 className="font-display text-8xl font-extrabold mt-6 leading-tight">
          Cùng kiến tạo lớp học số{" "}
          <span className="text-amber-300">cho mọi học sinh Việt Nam</span>
        </h2>
        <p className="text-3xl mt-8 opacity-90">
          Sẵn sàng demo trực tiếp với đội ngũ của Quý vị.
        </p>
        <div className="mt-10 grid grid-cols-2 gap-6 text-2xl">
          <div className="p-6 rounded-2xl bg-white/10 ring-1 ring-white/20">
            <div className="opacity-60 text-lg">Website</div>
            <div className="font-bold mt-1">sbt.smartlms.edu.vn</div>
          </div>
          <div className="p-6 rounded-2xl bg-white/10 ring-1 ring-white/20">
            <div className="opacity-60 text-lg">Liên hệ NXBGDVN</div>
            <div className="font-bold mt-1">contact@nxbgd.vn</div>
          </div>
        </div>
      </div>
      <div className="relative flex items-center justify-center">
        <div className="absolute size-[500px] rounded-full bg-amber-300/30 blur-3xl" />
        <img
          src={mascot}
          alt=""
          className="size-[500px] relative drop-shadow-2xl animate-pulse"
        />
      </div>
    </div>
    <Footer n={16} />
  </Canvas>
);

// AGENDA — Nội dung chính của slide
const SAgenda = () => (
  <Canvas tone="primary">
    <Tag color="violet">
      <ClipboardCheck className="size-5" /> NỘI DUNG TRÌNH BÀY
    </Tag>
    <h2 className="font-display text-7xl font-extrabold mt-4">
      Vở bài tập số NXBGDVN
    </h2>
    <div className="grid grid-cols-2 gap-x-10 gap-y-6 mt-10">
      {[
        {
          n: "01",
          icon: Target,
          t: "Mục tiêu xây dựng",
          d: "Vì sao NXBGDVN làm SBT số — định hướng & cam kết.",
          c: "rose" as const,
        },
        {
          n: "02",
          icon: GraduationCap,
          t: "Hỗ trợ học sinh",
          d: "Học mà chơi, cá nhân hoá theo năng lực từng em.",
          c: "amber" as const,
        },
        {
          n: "03",
          icon: Users,
          t: "Hỗ trợ giáo viên",
          d: "Ngân hàng câu hỏi, AI tạo đề, theo dõi realtime.",
          c: "sky" as const,
        },
        {
          n: "04",
          icon: Bot,
          t: "Ong Chăm Chỉ — AI Giáo dục Việt Nam",
          d: "Trợ lí AI an toàn, bám Chương trình GDPT 2018.",
          c: "violet" as const,
        },
        {
          n: "05",
          icon: Award,
          t: "Tổng kết",
          d: "Điểm khác biệt",
          c: "indigo" as const,
        },
      ].map((x) => (
        <div
          key={x.n}
          className="flex gap-5 p-6 rounded-2xl bg-white/80 ring-2 ring-slate-200"
        >
          <div className="font-display text-4xl font-extrabold text-violet-600 w-14 shrink-0">
            {x.n}
          </div>
          <Bullet icon={x.icon} title={x.t} desc={x.d} color={x.c} />
        </div>
      ))}
    </div>
    <Footer n={2} />
  </Canvas>
);

// DIFF — Điểm khác biệt của sản phẩm
const SDiff = () => (
  <Canvas tone="fun">
    <Tag color="violet">
      <Sparkles className="size-5" /> ĐIỂM KHÁC BIỆT
    </Tag>
    <h2 className="font-display text-6xl font-extrabold mt-4">
      Vì sao SBT số NXBGDVN khác biệt?
    </h2>
    <p className="text-2xl opacity-80 mt-3">
      Không chỉ là một app luyện tập — là hệ sinh thái học liệu số chính thống
      của Việt Nam.
    </p>

    <div className="grid grid-cols-3 gap-6 mt-10">
      {[
        {
          icon: BookOpen,
          t: "Bám sát SBT chính thống",
          d: "Mỗi câu hỏi truy ngược về đúng trang SBT giấy của NXBGDVN — chuẩn Bộ GD&ĐT, không phải nội dung tự phát.",
          c: "amber" as const,
        },
        {
          icon: Bot,
          t: "AI thiết kế cho giáo dục Việt",
          d: "Ong Chăm Chỉ tinh chỉnh theo CT GDPT 2018, ngôn ngữ & văn hoá Việt, an toàn cho lứa tuổi tiểu học.",
          c: "violet" as const,
        },
        {
          icon: Users,
          t: "Phục vụ đồng thời 3 vai trò",
          d: "Học sinh — Giáo viên — Quản lí trên 1 nền tảng, dữ liệu liên thông, không rời rạc nhiều phần mềm.",
          c: "sky" as const,
        },
        {
          icon: BarChart3,
          t: "Báo cáo điều hành 4 cấp",
          d: "Theo cơ cấu hành chính mới Bộ → Tỉnh → Xã → Trường — duy nhất trên thị trường EdTech Việt Nam.",
          c: "emerald" as const,
        },
        {
          icon: Zap,
          t: "23 kiểu tương tác phong phú",
          d: "Kéo–thả, ghép cặp, điền chỗ trống, vẽ, sắp xếp… vượt xa trắc nghiệm 4 đáp án thông thường.",
          c: "rose" as const,
        },
        {
          icon: Landmark,
          t: "Dữ liệu lưu tại Việt Nam",
          d: "Tuân thủ Nghị định 13/2023, không thu thập thông tin cá nhân trẻ em ra nước ngoài.",
          c: "indigo" as const,
        },
      ].map((x) => (
        <div
          key={x.t}
          className="p-7 rounded-3xl bg-white/85 ring-2 ring-slate-200 shadow-sm"
        >
          <Bullet icon={x.icon} title={x.t} desc={x.d} color={x.c} />
        </div>
      ))}
    </div>

    <div className="mt-8 p-6 rounded-3xl bg-violet-100/80 ring-2 ring-violet-300 flex items-center gap-5">
      <Award className="size-12 text-violet-700 shrink-0" />
      <div className="text-2xl leading-snug">
        <strong>Khác biệt cốt lõi:</strong> SBT số NXBGDVN là{" "}
        <em>sự tiếp nối số hoá</em> của bộ SBT giấy mà giáo viên & học sinh Việt
        Nam đã tin dùng — không phải sản phẩm thay thế xa lạ.
      </div>
    </div>
    <Footer n={13} />
  </Canvas>
);

export const SLIDES: Array<() => ReactNode> = [
  S01,
  SAgenda,
  S02,
  S03,
  S11,
  S04,
  S05,
  S06,
  S07,
  S08,
  S09,
  S10,
  SDiff,
  S18,
  S19,
  S20,
];
