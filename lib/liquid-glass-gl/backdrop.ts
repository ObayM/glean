let canvas: HTMLCanvasElement | null = null;
let width = 0;
let height = 0;
let version = 0;
let resizeBound = false;
let resizeTimer = 0;

function paint(c: HTMLCanvasElement, w: number, h: number): void {
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  if (!ctx) return;

  ctx.fillStyle = '#F4F5F6';
  ctx.fillRect(0, 0, w, h);

  ctx.strokeStyle = 'rgba(0, 0, 0, 0.035)';
  ctx.lineWidth = 1;
  const step = 48;
  for (let x = 0; x <= w; x += step) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h);
    ctx.stroke();
  }
  for (let y = 0; y <= h; y += step) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }
}

function attach(c: HTMLCanvasElement): void {
  if (c.isConnected) return;
  Object.assign(c.style, {
    position: 'fixed',
    inset: '0',
    width: '100vw',
    height: '100vh',
    zIndex: '-1',
    pointerEvents: 'none',
    display: 'block',
  });
  document.body.prepend(c);
}

function ensureResizeListener(): void {
  if (resizeBound) return;
  resizeBound = true;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(() => {
      if (!canvas) return;
      width = window.innerWidth;
      height = window.innerHeight;
      paint(canvas, width, height);
      version++;
    }, 150);
  });
}

export interface GlassBackdrop {
  canvas: HTMLCanvasElement;
  version: number;
}

export function getGlassBackdrop(): GlassBackdrop {
  const w = Math.max(1, window.innerWidth);
  const h = Math.max(1, window.innerHeight);
  if (!canvas) {
    canvas = document.createElement('canvas');
    width = w;
    height = h;
    paint(canvas, w, h);
    attach(canvas);
    ensureResizeListener();
  } else if (width !== w || height !== h) {
    width = w;
    height = h;
    paint(canvas, w, h);
    version++;
  }
  return { canvas, version };
}
