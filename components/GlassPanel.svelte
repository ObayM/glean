<script lang="ts">
  import { onDestroy } from 'svelte';
  import type { Snippet } from 'svelte';
  import { getGlassBackdrop } from '../lib/liquid-glass-gl/backdrop';
  import { LiquidGlassRenderer } from '../lib/liquid-glass-gl/renderer';

  interface Props {
    class?: string;
    radius?: number;
    children?: Snippet;
  }

  let { class: className = '', radius = 16, children }: Props = $props();

  const MARGIN = 32;

  let panelEl = $state<HTMLElement>();
  let canvasEl = $state<HTMLCanvasElement>();
  let active = $state(false);

  let renderer: LiquidGlassRenderer | null = null;
  let raf = 0;
  let lastSig = '';
  let lastBackdropVersion = -1;

  function layout() {
    raf = requestAnimationFrame(layout);
    if (!renderer || !panelEl || !canvasEl) return;

    const backdrop = getGlassBackdrop();
    if (backdrop.version !== lastBackdropVersion) {
      lastBackdropVersion = backdrop.version;
      renderer.setBackdrop(backdrop.canvas);
      lastSig = '';
    }

    const w = panelEl.offsetWidth;
    const h = panelEl.offsetHeight;
    if (w === 0 || h === 0) return;

    const boxW = w + MARGIN * 2;
    const boxH = h + MARGIN * 2;
    canvasEl.style.left = `${-MARGIN}px`;
    canvasEl.style.top = `${-MARGIN}px`;
    canvasEl.style.width = `${boxW}px`;
    canvasEl.style.height = `${boxH}px`;

    const rect = canvasEl.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const bw = backdrop.canvas.width;
    const bh = backdrop.canvas.height;
    const sig = `${rect.left}|${rect.top}|${rect.width}|${rect.height}|${dpr}`;
    if (sig === lastSig) return;
    lastSig = sig;

    renderer.setLayout({
      canvasCssWidth: boxW,
      canvasCssHeight: boxH,
      shapeCssWidth: w,
      shapeCssHeight: h,
      radiusCss: radius,
      dpr,
      bgOffset: [rect.left / bw, 1 - (rect.top + rect.height) / bh],
      bgScale: [rect.width / bw, rect.height / bh],
    });
    renderer.render();
  }

  $effect(() => {
    if (!canvasEl || renderer) return;
    try {
      renderer = new LiquidGlassRenderer(canvasEl);
    } catch {
      renderer = null;
      return;
    }
    active = true;
    raf = requestAnimationFrame(layout);
  });

  onDestroy(() => {
    if (raf) cancelAnimationFrame(raf);
    renderer?.dispose();
    renderer = null;
  });
</script>

<div class="glass-panel-gl {className}" class:gl-active={active} bind:this={panelEl}>
  <canvas class="glass-gl-canvas" bind:this={canvasEl}></canvas>
  {@render children?.()}
</div>
