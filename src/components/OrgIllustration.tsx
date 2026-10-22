// Hình động trang đăng nhập: tháp kính trụ sở + sơ đồ tổ chức (các nút người nối) toả ra phía trên.
const NODES = [
  { x: 70, y: 70 },
  { x: 170, y: 40 },
  { x: 270, y: 70 },
  { x: 40, y: 140 },
  { x: 300, y: 140 },
];

type Win = { x: number; y: number; w: number; h: number };

function grid(x0: number, y0: number, cols: number, rows: number, w: number, h: number, gx: number, gy: number): Win[] {
  return Array.from({ length: cols * rows }, (_, k) => ({
    x: x0 + (k % cols) * (w + gx),
    y: y0 + Math.floor(k / cols) * (h + gy),
    w,
    h,
  }));
}

function Windows({ items, cls = 'buildingIllus-win' }: { items: Win[]; cls?: string }) {
  return (
    <>
      {items.map((w, k) => (
        <rect
          key={k}
          className={cls}
          x={w.x}
          y={w.y}
          width={w.w}
          height={w.h}
          rx="1.5"
          style={{ animationDelay: `${((k * 5) % 11) * 0.5}s` }}
        />
      ))}
    </>
  );
}

function Trees({ left = 74, right = 266 }: { left?: number; right?: number }) {
  return (
    <g className="orgIllus-tree">
      <rect x={left} y="252" width="3" height="16" />
      <circle cx={left + 1.5} cy="246" r="11" />
      <rect x={right} y="252" width="3" height="16" />
      <circle cx={right + 1.5} cy="246" r="11" />
    </g>
  );
}

function Shadow() {
  return <ellipse className="orgIllus-shadow" cx="170" cy="270" rx="92" ry="5" />;
}

// Tháp kính cao, mái vát, hai khối phụ hai bên.
function GlassTower() {
  const mullions = [1, 2, 3].map((i) => 138 + i * 16);
  return (
    <>
      <Shadow />
      <rect className="buildingIllus-body" x="98" y="198" width="44" height="70" rx="3" />
      <rect className="orgIllus-shade" x="130" y="198" width="12" height="70" rx="3" />
      <rect className="buildingIllus-body" x="198" y="224" width="44" height="44" rx="3" />
      <rect className="orgIllus-shade" x="230" y="224" width="12" height="44" rx="3" />
      <Windows items={[...grid(106, 208, 2, 4, 10, 10, 8, 6), ...grid(206, 232, 2, 2, 10, 10, 8, 6)]} />
      <path className="buildingIllus-body" d="M138 124 L202 100 V268 H138 Z" />
      <path className="orgIllus-shade" d="M184 106.8 L202 100 V268 H184 Z" />
      <path className="orgIllus-shine" d="M146 268 L146 150 L168 142 L168 268 Z" />
      <Windows items={grid(146, 136, 4, 8, 10, 10, 4, 6).filter((w) => w.y > 124 - (w.x - 138) * 0.375 + 6)} cls="buildingIllus-win buildingIllus-glasswin" />
      {mullions.map((x) => (
        <line key={x} className="orgIllus-mullion" x1={x} y1={124 - (x - 138) * 0.375} x2={x} y2="268" opacity="0.25" />
      ))}
      <rect className="orgIllus-door" x="157" y="244" width="26" height="24" rx="2" />
      <line className="orgIllus-mullion" x1="170" y1="244" x2="170" y2="268" />
      <circle className="buildingIllus-beacon" cx="202" cy="97" r="3.5" />
      <Trees left={80} right={254} />
    </>
  );
}

// Điểm bắt đầu đường nối trên toà nhà, theo thứ tự NODES.
const ANCHORS = [
  { x: 144, y: 122 },
  { x: 170, y: 112 },
  { x: 198, y: 102 },
  { x: 138, y: 150 },
  { x: 202, y: 150 },
];

export function OrgIllustration() {
  return (
    <svg className="buildingIllus" viewBox="0 0 340 290" role="img" aria-label="Sơ đồ tổ chức doanh nghiệp">
      {NODES.map((n, i) => (
        <line
          key={`l${i}`}
          className="orgIllus-link"
          x1={ANCHORS[i].x}
          y1={ANCHORS[i].y}
          x2={n.x}
          y2={n.y}
          style={{ animationDelay: `${i * 0.35}s` }}
        />
      ))}
      {NODES.map((n, i) => (
        <g key={`n${i}`} className="orgIllus-node" style={{ animationDelay: `${i * 0.35}s` }}>
          <circle className="orgIllus-ring" cx={n.x} cy={n.y} r="17" />
          <circle className="buildingIllus-body" cx={n.x} cy={n.y - 4} r="5.5" />
          <path className="buildingIllus-body" d={`M${n.x - 10} ${n.y + 10} a10 8 0 0 1 20 0 z`} />
        </g>
      ))}
      <GlassTower />
      <rect className="buildingIllus-ground" x="0" y="268" width="340" height="4" rx="2" />
    </svg>
  );
}
