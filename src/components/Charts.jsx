import { useEffect, useRef, useState } from 'react';

// Small hand-rolled SVG charts. Colors come from --series-* tokens in
// styles.css (validated categorical palette, separate light/dark steps).

function useWidth() {
  const ref = useRef(null);
  const [w, setW] = useState(600);
  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(200, e.contentRect.width)));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  return [ref, w];
}

// Clean axis ticks: 0, 250, 500… covering [min, max].
export function niceTicks(min, max, count = 4) {
  if (max === min) max = min + 1;
  const raw = (max - min) / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw);
  const lo = Math.floor(min / step) * step;
  const hi = Math.ceil(max / step) * step;
  const ticks = [];
  for (let v = lo; v <= hi + step / 2; v += step) ticks.push(Math.round(v * 1e6) / 1e6);
  return ticks;
}

// Bar with a rounded data-end and a square baseline end.
function barPath(x, y0, w, y1, r = 4) {
  const up = y1 < y0;
  const h = Math.abs(y0 - y1);
  const rr = Math.min(r, w / 2, h);
  if (h < 0.5) return '';
  if (up) {
    return `M${x},${y0} V${y1 + rr} Q${x},${y1} ${x + rr},${y1} H${x + w - rr} Q${x + w},${y1} ${x + w},${y1 + rr} V${y0} Z`;
  }
  return `M${x},${y0} V${y1 - rr} Q${x},${y1} ${x + rr},${y1} H${x + w - rr} Q${x + w},${y1} ${x + w},${y1 - rr} V${y0} Z`;
}

function Tooltip({ tip }) {
  if (!tip) return null;
  return (
    <div className="chart-tip" style={{ left: tip.x, top: tip.y }}>
      {tip.title && <div className="chart-tip-title">{tip.title}</div>}
      {tip.rows.map((r, i) => (
        <div key={i} className="chart-tip-row">
          {r.color && <span className="chart-tip-key" style={{ background: r.color }} />}
          <strong>{r.value}</strong>
          <span className="muted">{r.label}</span>
        </div>
      ))}
    </div>
  );
}

export function Legend({ series, kind = 'rect' }) {
  return (
    <div className="chart-legend">
      {series.map((s) => (
        <span key={s.name} className="row gap-xs">
          <span className={kind === 'line' ? 'legend-line' : 'legend-rect'} style={{ background: s.color }} />
          {s.name}
        </span>
      ))}
    </div>
  );
}

/**
 * Grouped columns. data: [{ label, values: [n, n] }], series: [{ name, color }].
 * Negative values grow down from the zero line.
 */
export function ColumnChart({ data, series, format, height = 240 }) {
  const [ref, width] = useWidth();
  const [tip, setTip] = useState(null);
  const pad = { l: 64, r: 8, t: 12, b: 26 };
  const all = data.flatMap((d) => d.values);
  const ticks = niceTicks(Math.min(0, ...all), Math.max(0, ...all));
  const lo = ticks[0], hi = ticks[ticks.length - 1];
  const ih = height - pad.t - pad.b;
  const y = (v) => pad.t + ih - ((v - lo) / (hi - lo)) * ih;
  const band = (width - pad.l - pad.r) / Math.max(1, data.length);
  const n = series.length;
  const bw = Math.max(4, Math.min(24, (band * 0.7 - (n - 1) * 2) / n));
  const groupW = n * bw + (n - 1) * 2;
  const labelEvery = Math.ceil(data.length / Math.max(1, Math.floor((width - pad.l) / 56)));

  return (
    <div className="chart" ref={ref} onMouseLeave={() => setTip(null)}>
      <svg width={width} height={height} role="img">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.l} x2={width - pad.r} y1={y(t)} y2={y(t)} className={t === 0 ? 'chart-zero' : 'chart-grid'} />
            <text x={pad.l - 8} y={y(t)} dy="0.32em" textAnchor="end" className="chart-axis">{format(t, true)}</text>
          </g>
        ))}
        {data.map((d, i) => {
          const gx = pad.l + i * band + (band - groupW) / 2;
          return (
            <g key={d.label}>
              {d.values.map((v, k) => {
                const x = gx + k * (bw + 2);
                const active = tip?.key === `${i}-${k}`;
                return (
                  <g key={k}>
                    <path d={barPath(x, y(0), bw, y(v))} fill={series[k].color} opacity={tip && !active ? 0.55 : 1} />
                    {/* Hit area is the whole band slot, taller than the bar. */}
                    <rect
                      x={x - 1} y={pad.t} width={bw + 2} height={ih} fill="transparent"
                      tabIndex={0}
                      onMouseEnter={(e) => setTip({ key: `${i}-${k}`, x: x + bw / 2, y: Math.min(y(v), y(0)) - 8, title: d.label, rows: d.values.map((vv, kk) => ({ color: series[kk].color, value: format(vv), label: series[kk].name })) })}
                      onFocus={() => setTip({ key: `${i}-${k}`, x: x + bw / 2, y: Math.min(y(v), y(0)) - 8, title: d.label, rows: d.values.map((vv, kk) => ({ color: series[kk].color, value: format(vv), label: series[kk].name })) })}
                    />
                  </g>
                );
              })}
              {i % labelEvery === 0 && (
                <text x={pad.l + i * band + band / 2} y={height - 8} textAnchor="middle" className="chart-axis">{d.label}</text>
              )}
            </g>
          );
        })}
      </svg>
      <Tooltip tip={tip} />
    </div>
  );
}

/** Horizontal bars, one series. rows: [{ label, value, sub? }] — value label at the tip. */
export function BarList({ rows, format, color = 'var(--series-1)' }) {
  const max = Math.max(1, ...rows.map((r) => Math.abs(r.value)));
  return (
    <div className="barlist">
      {rows.map((r) => (
        <div key={r.label} className="barlist-row" title={`${r.label}: ${format(r.value)}`}>
          <span className="barlist-label ellipsis">{r.label}</span>
          <span className="barlist-track">
            <span className="barlist-bar" style={{ width: `${(Math.abs(r.value) / max) * 100}%`, background: color }} />
            <span className="barlist-value">{format(r.value)}</span>
          </span>
        </div>
      ))}
    </div>
  );
}

/** Line over time, one series. points: [{ date: 'YYYY-MM-DD', value }]. Crosshair + tooltip. */
export function LineChart({ points, format, fmtX, height = 220, color = 'var(--series-1)', name = 'Waarde' }) {
  const [ref, width] = useWidth();
  const [hover, setHover] = useState(null);
  const pad = { l: 64, r: 16, t: 14, b: 26 };
  if (!points.length) return <div ref={ref} className="chart-empty muted small">Nog geen gegevens om te tonen.</div>;
  const t = (p) => new Date(p.date + 'T00:00:00').getTime();
  const t0 = t(points[0]);
  const t1 = Math.max(t(points[points.length - 1]), t0 + 86400000);
  const vals = points.map((p) => p.value);
  const ticks = niceTicks(Math.min(0, ...vals), Math.max(...vals));
  const lo = ticks[0], hi = ticks[ticks.length - 1];
  const iw = width - pad.l - pad.r, ih = height - pad.t - pad.b;
  const x = (p) => pad.l + ((t(p) - t0) / (t1 - t0)) * iw;
  const y = (v) => pad.t + ih - ((v - lo) / (hi - lo)) * ih;
  // Step line: a value holds until the next entry.
  let d = '';
  points.forEach((p, i) => {
    d += i === 0 ? `M${x(p)},${y(p.value)}` : ` H${x(p)} V${y(p.value)}`;
  });
  const last = points[points.length - 1];
  const area = `${d} H${pad.l + iw} V${y(lo)} H${x(points[0])} Z`;

  const onMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    let best = points[0];
    for (const p of points) if (x(p) <= mx + 1) best = p;
    setHover(best);
  };

  return (
    <div className="chart" ref={ref}>
      <svg width={width} height={height} role="img" onMouseMove={onMove} onMouseLeave={() => setHover(null)}>
        {ticks.map((v) => (
          <g key={v}>
            <line x1={pad.l} x2={width - pad.r} y1={y(v)} y2={y(v)} className={v === 0 ? 'chart-zero' : 'chart-grid'} />
            <text x={pad.l - 8} y={y(v)} dy="0.32em" textAnchor="end" className="chart-axis">{format(v, true)}</text>
          </g>
        ))}
        <path d={`${area}`} fill={color} opacity={0.1} />
        <path d={`${d} H${pad.l + iw}`} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        <circle cx={x(last)} cy={y(last.value)} r={4} fill={color} stroke="var(--panel)" strokeWidth={2} />
        <text x={pad.l} y={height - 8} className="chart-axis">{fmtX(points[0].date)}</text>
        <text x={width - pad.r} y={height - 8} textAnchor="end" className="chart-axis">{fmtX(last.date)}</text>
        {hover && (
          <>
            <line x1={x(hover)} x2={x(hover)} y1={pad.t} y2={pad.t + ih} className="chart-cross" />
            <circle cx={x(hover)} cy={y(hover.value)} r={4} fill={color} stroke="var(--panel)" strokeWidth={2} />
          </>
        )}
      </svg>
      {hover && <Tooltip tip={{ x: x(hover), y: y(hover.value) - 10, title: fmtX(hover.date), rows: [{ color, value: format(hover.value), label: name }] }} />}
    </div>
  );
}
