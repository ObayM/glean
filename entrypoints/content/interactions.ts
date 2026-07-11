import type { Action } from 'svelte/action';

export const draggable: Action<HTMLElement, HTMLElement> = (node, host) => {
  let hostEl = host;
  let startX = 0;
  let startY = 0;
  let hostLeft = 0;
  let hostTop = 0;

  node.style.cursor = 'move';
  node.style.userSelect = 'none';

  function onMouseMove(e: MouseEvent) {
    hostEl.style.left = `${hostLeft + (e.clientX - startX)}px`;
    hostEl.style.top = `${hostTop + (e.clientY - startY)}px`;
  }

  function onMouseUp() {
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
  }

  function onMouseDown(e: MouseEvent) {
    const rect = hostEl.getBoundingClientRect();
    startX = e.clientX;
    startY = e.clientY;
    hostLeft = rect.left;
    hostTop = rect.top;
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    e.preventDefault();
  }

  node.addEventListener('mousedown', onMouseDown);

  return {
    update(next) {
      hostEl = next;
    },
    destroy() {
      node.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    },
  };
};
