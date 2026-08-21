/* ============================================================
   Veyro charts — minimal canvas line graphs.
   Dark bg, subtle grid, green line, small labels, animated.
   ============================================================ */
console.log('[charts.js] loading...');
Veyro.Charts = (() => {
  'use strict';

  function setup(canvas) {
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { ctx, w: rect.width, h: rect.height };
  }

  function grid(ctx, w, h, rows, cols, color) {
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.55;
    for (let i = 1; i < rows; i++) {
      const y = (h / rows) * i;
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
    }
    for (let i = 1; i < cols; i++) {
      const x = (w / cols) * i;
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  function fmtTime(t, nowMs) {
    const d = new Date(t);
    return d.toTimeString().slice(0, 5);
  }

  function truncate(v, max) {
    return Math.round(v * 10) / 10;
  }

  /* Draw a single series. data: [{t, v}] */
  function line(canvas, data, opts = {}) {
    const s = setup(canvas);
    if (!s) return;
    const { ctx, w, h } = s;
    const color = opts.color || 'var(--accent)';

    ctx.clearRect(0, 0, w, h);
    const pad = { l: 8, r: 8, t: 12, b: 18 };
    const pw = w - pad.l - pad.r;
    const ph = h - pad.t - pad.b;

    grid(ctx, w, h, 4, 6, 'rgba(57,255,136,0.06)');

    if (!data || data.length < 2) return;

    let min = Infinity, max = -Infinity;
    data.forEach(d => { if (d.v < min) min = d.v; if (d.v > max) max = d.v; });
    if (max - min < 1) max = min + 5;

    const t0 = data[0].t, t1 = data[data.length - 1].t;

    const X = (t) => pad.l + ((t - t0) / (t1 - t0 || 1)) * pw;
    const Y = (v) => pad.t + (1 - (v - min) / (max - min)) * ph;

    /* area fill */
    ctx.beginPath();
    ctx.moveTo(X(t0), pad.t + ph);
    data.forEach(d => ctx.lineTo(X(d.t), Y(d.v)));
    ctx.lineTo(X(t1), pad.t + ph);
    ctx.closePath();
    const grad = ctx.createLinearGradient(0, pad.t, 0, pad.t + ph);
    grad.addColorStop(0, 'rgba(57,255,136,0.18)');
    grad.addColorStop(1, 'rgba(57,255,136,0)');
    ctx.fillStyle = grad;
    ctx.fill();

    /* line */
    ctx.beginPath();
    data.forEach((d, i) => i === 0 ? ctx.moveTo(X(d.t), Y(d.v)) : ctx.lineTo(X(d.t), Y(d.v)));
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.6;
    ctx.stroke();

    /* end dot */
    const last = data[data.length - 1];
    ctx.beginPath();
    ctx.arc(X(last.t), Y(last.v), 2.5, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();

    /* labels */
    ctx.fillStyle = 'rgba(137,149,142,0.8)';
    ctx.font = '10px "JetBrains Mono", monospace';
    ctx.textAlign = 'left';
    ctx.fillText(fmtTime(t0, t1), pad.l, h - 4);
    ctx.textAlign = 'right';
    ctx.fillText(fmtTime(t1, t1), w - pad.r, h - 4);
    ctx.textAlign = 'left';
    ctx.fillText(truncate(max, 0), pad.l + 2, pad.t - 2);
    ctx.fillText(truncate(min, 0), pad.l + 2, h - pad.b + 2);
    ctx.fillStyle = 'rgba(57,255,136,0.85)';
    ctx.font = '11px "JetBrains Mono", monospace';
    ctx.fillText(opts.unit ? String(Math.round(last.v)) + opts.unit : String(truncate(last.v, 0)), w - pad.r - 4, pad.t + 2);
  }

  return { line };
})();