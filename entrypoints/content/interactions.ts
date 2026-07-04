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
    startX = e.clientX;
    startY = e.clientY;
    hostLeft = parseFloat(hostEl.style.left) || hostEl.offsetLeft;
    hostTop = parseFloat(hostEl.style.top) || hostEl.offsetTop;
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

export const resizable: Action<HTMLElement> = (node) => {
  let cardEl: HTMLElement | null = null;
  let startWidth = 0;
  let startHeight = 0;
  let startX = 0;
  let startY = 0;

  function onMouseMove(e: MouseEvent) {
    if (!cardEl) return;
    const scaleFactor = 0.8;
    const dx = (e.clientX - startX) / scaleFactor;
    const dy = (e.clientY - startY) / scaleFactor;

    const newWidth = Math.max(240, startWidth + dx);
    const newHeight = Math.max(160, startHeight + dy);

    cardEl.style.width = `${newWidth}px`;
    cardEl.style.height = `${newHeight}px`;

    const header = cardEl.querySelector<HTMLElement>('.card-header');
    const footer = cardEl.querySelector<HTMLElement>('.card-footer');
    const cardBody = cardEl.querySelector<HTMLElement>('.card-body');
    if (cardBody) {
      const headerHeight = header ? header.offsetHeight : 30;
      const footerHeight = footer ? footer.offsetHeight : 45;
      const newBodyHeight = newHeight - headerHeight - footerHeight - 32;
      cardBody.style.height = `${Math.max(60, newBodyHeight)}px`;
    }
  }

  function onMouseUp() {
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
  }

  function onMouseDown(e: MouseEvent) {
    cardEl = node.closest<HTMLElement>('.glean-card');
    if (!cardEl) return;
    startX = e.clientX;
    startY = e.clientY;
    const rect = cardEl.getBoundingClientRect();
    startWidth = rect.width;
    startHeight = rect.height;
    cardEl.style.height = `${startHeight}px`;

    const cardBody = cardEl.querySelector<HTMLElement>('.card-body');
    if (cardBody) {
      cardBody.style.maxHeight = 'none';
      cardBody.style.overflowY = 'auto';
    }

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    e.preventDefault();
    e.stopPropagation();
  }

  node.addEventListener('mousedown', onMouseDown);

  return {
    destroy() {
      node.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    },
  };
};
