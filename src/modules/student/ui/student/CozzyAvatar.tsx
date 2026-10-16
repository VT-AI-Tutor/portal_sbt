/**
 * Rồng Cozzy dạng inline SVG (thay `<img mascot-cozzy.svg>`) để xếp lớp vật phẩm
 * ĐANG MẶC lên đúng điểm neo (đầu/cổ/ngực/viền). Base copy từ mascot-cozzy.svg
 * (viewBox 200x200); overlay vẽ theo item_code nên độc lập với slot.
 */

export interface CozzyEquipped {
  cosmetic?: string;
  accessory?: string;
  frame?: string;
}

/** Viền khung (frame slot) → màu stroke quanh khung. */
const FRAME_STROKE: Record<string, string> = {
  "frame-gold": "#FACC15",
  "frame-leaf": "#22C55E",
};

function HatOverlay() {
  // Mũ chóp sinh nhật đặt giữa đỉnh đầu (đầu tại y≈26), giữa 2 sừng.
  return (
    <g>
      <path
        d="M100 6 L84 44 L116 44 Z"
        fill="#EF4444"
        stroke="#991B1B"
        strokeWidth="3"
        strokeLinejoin="round"
      />
      <path d="M84 44 L116 44" stroke="#991B1B" strokeWidth="3" />
      <rect x="82" y="42" width="36" height="6" rx="3" fill="#FDE68A" />
      <circle cx="100" cy="6" r="5" fill="#FDE68A" stroke="#991B1B" strokeWidth="2" />
    </g>
  );
}

function ScarfOverlay() {
  // Khăn quàng ở cổ (giao đầu–thân, y≈100–120).
  return (
    <g>
      <path
        d="M64 104 Q100 120 136 104 Q100 132 64 104 Z"
        fill="#3B82F6"
        stroke="#1E3A8A"
        strokeWidth="3"
        strokeLinejoin="round"
      />
      <path
        d="M118 112 L128 140 L116 138 L112 114 Z"
        fill="#2563EB"
        stroke="#1E3A8A"
        strokeWidth="3"
        strokeLinejoin="round"
      />
    </g>
  );
}

function StarOverlay() {
  // Phụ kiện sao gắn góc trên phải.
  return (
    <path
      d="M158 32 l4 9 10 1 -7.5 6.5 2.3 9.8 -8.8 -5.2 -8.8 5.2 2.3 -9.8 -7.5 -6.5 10 -1 z"
      fill="#FACC15"
      stroke="#CA8A04"
      strokeWidth="2"
      strokeLinejoin="round"
    />
  );
}

const HAT_CODES = new Set(["cozzy-hat"]);
const SCARF_CODES = new Set(["cozzy-scarf"]);
const STAR_CODES = new Set(["badge-star"]);

export function CozzyAvatar({
  equipped,
  className,
  title = "Rồng Cozzy",
}: {
  equipped?: CozzyEquipped;
  className?: string;
  title?: string;
}) {
  const codes = [equipped?.cosmetic, equipped?.accessory].filter(
    Boolean,
  ) as string[];
  const showHat = codes.some((c) => HAT_CODES.has(c));
  const showScarf = codes.some((c) => SCARF_CODES.has(c));
  const showStar = codes.some((c) => STAR_CODES.has(c));
  const frameStroke = equipped?.frame ? FRAME_STROKE[equipped.frame] : undefined;

  return (
    <svg
      viewBox="0 0 200 200"
      className={className}
      role="img"
      aria-label={title}
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* mini wings */}
      <path d="M52 100 C28 88 16 100 14 118 C30 116 44 116 58 122 Z" fill="#FDBA74" stroke="#C2410C" strokeWidth="4" strokeLinejoin="round" />
      <path d="M148 100 C172 88 184 100 186 118 C170 116 156 116 142 122 Z" fill="#FDBA74" stroke="#C2410C" strokeWidth="4" strokeLinejoin="round" />
      {/* tail */}
      <path d="M136 150 C158 152 170 140 168 124 C160 132 148 136 138 134 Z" fill="#F97316" stroke="#C2410C" strokeWidth="4" strokeLinejoin="round" />
      {/* legs */}
      <ellipse cx="76" cy="168" rx="14" ry="10" fill="#F97316" stroke="#C2410C" strokeWidth="4" />
      <ellipse cx="128" cy="168" rx="14" ry="10" fill="#F97316" stroke="#C2410C" strokeWidth="4" />
      {/* body */}
      <circle cx="100" cy="110" r="62" fill="#F97316" stroke="#C2410C" strokeWidth="5" />
      {/* belly */}
      <ellipse cx="100" cy="126" rx="38" ry="34" fill="#FEF9C3" />
      {/* scarf (trên thân, dưới đầu) */}
      {showScarf && <ScarfOverlay />}
      {/* horns */}
      <path d="M78 58 C74 44 78 34 86 28 C84 40 86 50 90 58 Z" fill="#FDE68A" stroke="#C2410C" strokeWidth="4" strokeLinejoin="round" />
      <path d="M122 58 C126 44 122 34 114 28 C116 40 114 50 110 58 Z" fill="#FDE68A" stroke="#C2410C" strokeWidth="4" strokeLinejoin="round" />
      {/* head */}
      <circle cx="100" cy="72" r="46" fill="#FB923C" stroke="#C2410C" strokeWidth="5" />
      {/* cheeks */}
      <circle cx="70" cy="82" r="8" fill="#FDA4AF" opacity="0.7" />
      <circle cx="130" cy="82" r="8" fill="#FDA4AF" opacity="0.7" />
      {/* eyes */}
      <circle cx="82" cy="68" r="12" fill="#3B2A1A" />
      <circle cx="118" cy="68" r="12" fill="#3B2A1A" />
      <circle cx="86" cy="64" r="4" fill="#FFFFFF" />
      <circle cx="122" cy="64" r="4" fill="#FFFFFF" />
      {/* smile */}
      <path d="M78 88 C88 100 112 100 122 88" fill="none" stroke="#C2410C" strokeWidth="5" strokeLinecap="round" />
      {/* snout */}
      <circle cx="93" cy="92" r="2.5" fill="#C2410C" />
      <circle cx="107" cy="92" r="2.5" fill="#C2410C" />
      {/* hat (trên cùng đầu) + star */}
      {showHat && <HatOverlay />}
      {showStar && <StarOverlay />}
      {/* frame ring */}
      {frameStroke && (
        <rect
          x="4"
          y="4"
          width="192"
          height="192"
          rx="24"
          fill="none"
          stroke={frameStroke}
          strokeWidth="7"
        />
      )}
    </svg>
  );
}
