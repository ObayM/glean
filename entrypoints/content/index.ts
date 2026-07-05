import { mount, unmount } from 'svelte';
import { onContentMessage } from '../../lib/messaging';
import { extractSentence } from '../../lib/sentence';
import Card from './Card.svelte';
import { overlayStyles } from './overlay-styles';

const HOST_ID = 'glean-overlay-host';
const BLOCK_TAGS = ['P', 'DIV', 'LI', 'TD', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'ARTICLE', 'SECTION', 'SPAN'];

const FILTER_SVG = `
  <svg width="0" height="0" style="position:absolute;pointer-events:none;">
    <defs>
      <filter id="liquid-refraction" x="-10%" y="-10%" width="120%" height="120%">
        <feTurbulence type="fractalNoise" baseFrequency="0.005" numOctaves="2" result="noise"></feTurbulence>
        <feDisplacementMap in="SourceGraphic" in2="noise" scale="15" xChannelSelector="R" yChannelSelector="G" result="displaced"></feDisplacementMap>
        <feSpecularLighting in="noise" specularExponent="30" specularConstant="1.0" lighting-color="#ffffff" result="light">
          <feDistantLight azimuth="225" elevation="55"></feDistantLight>
        </feSpecularLighting>
        <feBlend in="light" in2="displaced" mode="screen"></feBlend>
      </filter>
    </defs>
  </svg>`;

export default defineContentScript({
  matches: ['<all_urls>'],
  cssInjectionMode: 'manual',
  main() {
    if (document.getElementById(HOST_ID)) return;

    let activeHost: HTMLElement | null = null;
    let activeComponent: Record<string, unknown> | null = null;
    let lastRightClickTarget: EventTarget | null = null;
    let lastRightClickRange: Range | null = null;

    document.addEventListener('contextmenu', (event) => {
      lastRightClickTarget = event.composedPath()[0] ?? event.target;
      lastRightClickRange = caretRangeFromPoint(event.clientX, event.clientY);
    });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') dismiss();
    });

    function dismiss() {
      if (!activeHost) return;
      const host = activeHost;
      const component = activeComponent;
      activeHost = null;
      activeComponent = null;

      const card = host.shadowRoot?.querySelector<HTMLElement>('.glean-card');
      if (card) {
        card.style.opacity = '0';
        card.style.transform = 'translateY(-20px) scale(0.85)';
        card.style.transition =
          'opacity 0.25s cubic-bezier(0.25,1,0.5,1), transform 0.25s cubic-bezier(0.25,1,0.5,1)';
      }
      setTimeout(() => {
        if (component) unmount(component);
        host.remove();
      }, 250);
    }

    function blockElementFor(node: Node | null): HTMLElement {
      let el: HTMLElement | null =
        node && node.nodeType === Node.TEXT_NODE ? node.parentElement : (node as HTMLElement | null);
      while (el && !BLOCK_TAGS.includes(el.tagName)) {
        el = el.parentElement;
      }
      return el ?? document.body;
    }

    function caretRangeFromPoint(x: number, y: number): Range | null {
      if (typeof document.caretRangeFromPoint === 'function') {
        return document.caretRangeFromPoint(x, y);
      }
      const legacyDoc = document as Document & {
        caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null;
      };
      if (typeof legacyDoc.caretPositionFromPoint === 'function') {
        const pos = legacyDoc.caretPositionFromPoint(x, y);
        if (!pos) return null;
        const range = document.createRange();
        range.setStart(pos.offsetNode, pos.offset);
        range.collapse(true);
        return range;
      }
      return null;
    }

    function textOffsetInBlock(block: HTMLElement, node: Node, offset: number): number {
      const preRange = document.createRange();
      preRange.selectNodeContents(block);
      try {
        preRange.setEnd(node, offset);
      } catch {
        return -1;
      }
      return preRange.toString().length;
    }

    function selectionContext(): { word: string; sentence: string; rects: DOMRect | null } | null {
      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0) return null;
      const selectedText = selection.toString().trim();
      if (!selectedText) return null;

      const rawWord = selectedText.split(/\s+/)[0] ?? '';
      const word = rawWord.replace(/[^a-zA-Z0-9'-]/g, '');
      if (!word || word.length < 2) return null;

      const range = selection.getRangeAt(0);
      const block = blockElementFor(range.startContainer);
      const textContent = block.textContent ?? '';
      const wordOffset = textOffsetInBlock(block, range.startContainer, range.startOffset);
      const sentence = extractSentence(textContent, wordOffset >= 0 ? wordOffset : 0, word);
      const rects = range.getBoundingClientRect();
      return { word, sentence, rects };
    }

    function triggerContext(word: string) {
      let sentence = '';
      let rects: DOMRect | null = null;

      if (lastRightClickRange) {
        const block = blockElementFor(lastRightClickRange.startContainer);
        const textContent = block.textContent ?? '';
        const wordOffset = textOffsetInBlock(block, lastRightClickRange.startContainer, lastRightClickRange.startOffset);
        if (wordOffset >= 0) sentence = extractSentence(textContent, wordOffset, word);
        rects = lastRightClickRange.getBoundingClientRect();
      }

      if (!sentence && lastRightClickTarget instanceof Node) {
        const block = blockElementFor(lastRightClickTarget);
        const textContent = block.textContent ?? '';
        const wordOffset = textContent.toLowerCase().indexOf(word.toLowerCase());
        if (wordOffset >= 0) sentence = extractSentence(textContent, wordOffset, word);
      }
      if (!rects && lastRightClickTarget instanceof Element) {
        rects = lastRightClickTarget.getBoundingClientRect();
      }

      if (!sentence) {
        const ctx = selectionContext();
        if (ctx) {
          sentence = ctx.sentence;
          if (!rects) rects = ctx.rects;
        }
      }
      if (!sentence) sentence = `Context word: ${word}`;

      showOverlay({ word, sentence, rects, centered: false });
    }

    function positionHost(host: HTMLElement, rects: DOMRect | null, centered: boolean) {
      if (centered || !rects) {
        host.style.position = 'fixed';
        host.style.left = '50%';
        host.style.top = '50%';
        host.style.transform = 'translate(-50%, -50%) scale(0.8)';
        return;
      }
      const x = window.scrollX + rects.left + rects.width / 2;
      const y = window.scrollY + rects.top - 8;
      host.style.position = 'absolute';
      host.style.left = `${x}px`;
      host.style.top = `${y}px`;
      host.style.transform = 'translate(-50%, -100%) scale(0.8)';
    }

    function bindRefraction(shadow: ShadowRoot) {
      const map = shadow.querySelector<SVGFEDisplacementMapElement>('#liquid-refraction feDisplacementMap');
      const light = shadow.querySelector<SVGFESpecularLightingElement>('#liquid-refraction feSpecularLighting');
      if (!map || !light) return;

      let scale = 15;
      let targetScale = 15;
      let specular = 1;
      let targetSpecular = 1;
      let animating = false;

      const step = () => {
        scale += (targetScale - scale) * 0.15;
        specular += (targetSpecular - specular) * 0.15;
        map.setAttribute('scale', scale.toFixed(2));
        light.setAttribute('specularConstant', specular.toFixed(2));
        if (Math.abs(targetScale - scale) > 0.05 || Math.abs(targetSpecular - specular) > 0.01) {
          requestAnimationFrame(step);
        } else {
          animating = false;
        }
      };
      const go = () => {
        if (!animating) {
          animating = true;
          requestAnimationFrame(step);
        }
      };
      const set = (s: number, sp: number) => {
        targetScale = s;
        targetSpecular = sp;
        go();
      };

      shadow.addEventListener('mouseover', () => set(25, 1.4));
      shadow.addEventListener('mouseout', () => set(15, 1.0));
      shadow.addEventListener('mousedown', () => set(10, 0.8));
      shadow.addEventListener('mouseup', () => set(25, 1.4));
    }

    interface OverlayArgs {
      word: string;
      sentence: string;
      rects: DOMRect | null;
      centered: boolean;
      mode?: 'lookup' | 'prompt';
    }

    function showOverlay({ word, sentence, rects, centered, mode = 'lookup' }: OverlayArgs) {
      dismiss();

      const host = document.createElement('div');
      host.id = HOST_ID;
      Object.assign(host.style, {
        position: 'fixed',
        top: '0',
        left: '0',
        width: '0',
        height: '0',
        overflow: 'visible',
        zIndex: '2147483647',
        pointerEvents: 'auto',
        fontSize: '16px',
        lineHeight: '1.5',
      });
      document.body.appendChild(host);
      activeHost = host;

      positionHost(host, rects, centered);

      const shadow = host.attachShadow({ mode: 'open' });
      const style = document.createElement('style');
      style.textContent = overlayStyles;
      shadow.appendChild(style);
      const filterWrap = document.createElement('div');
      filterWrap.innerHTML = FILTER_SVG;
      shadow.appendChild(filterWrap);
      bindRefraction(shadow);

      activeComponent = mount(Card, {
        target: shadow,
        props: { word, sentence, pageUrl: window.location.href, mode, host, ondismiss: dismiss },
      });

      if (rects) {
        setTimeout(() => {
          const card = shadow.querySelector<HTMLElement>('.glean-card');
          if (!card) return;
          const r = card.getBoundingClientRect();
          if (r.right > window.innerWidth) host.style.left = `${window.innerWidth - r.width / 2 - 16}px`;
          if (r.left < 0) host.style.left = `${r.width / 2 + 16}px`;
          if (r.top < 16) {
            host.style.top = `${window.scrollY + rects.bottom + 8}px`;
            host.style.transform = 'translate(-50%, 0) scale(0.8)';
          }
        }, 10);
      }
    }

    onContentMessage((message) => {
      if (message.kind === 'TRIGGER') {
        triggerContext(message.word);
      } else if (message.kind === 'PROMPT') {
        showOverlay({ word: '', sentence: '', rects: null, centered: true, mode: 'prompt' });
      }
    });
  },
});
