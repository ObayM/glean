export function initLiquidGlass(root: ParentNode = document): void {
  const displacementMap = root.querySelector<SVGFEDisplacementMapElement>(
    '#liquid-refraction feDisplacementMap'
  );
  const specularLighting = root.querySelector<SVGFESpecularLightingElement>(
    '#liquid-refraction feSpecularLighting'
  );

  if (!displacementMap || !specularLighting) return;

  let currentScale = 15;
  let targetScale = 15;
  let currentSpecular = 1.0;
  let targetSpecular = 1.0;
  let animating = false;

  function animateFilter() {
    currentScale += (targetScale - currentScale) * 0.15;
    currentSpecular += (targetSpecular - currentSpecular) * 0.15;

    displacementMap!.setAttribute('scale', currentScale.toFixed(2));
    specularLighting!.setAttribute('specularConstant', currentSpecular.toFixed(2));

    if (Math.abs(currentScale - targetScale) > 0.05 || Math.abs(currentSpecular - targetSpecular) > 0.01) {
      requestAnimationFrame(animateFilter);
    } else {
      animating = false;
    }
  }

  function triggerAnimation() {
    if (!animating) {
      animating = true;
      requestAnimationFrame(animateFilter);
    }
  }

  function bind(el: Element) {
    el.addEventListener('mouseenter', () => {
      targetScale = 25;
      targetSpecular = 1.4;
      triggerAnimation();
    });
    el.addEventListener('mouseleave', () => {
      targetScale = 15;
      targetSpecular = 1.0;
      triggerAnimation();
    });
    el.addEventListener('mousedown', () => {
      targetScale = 10;
      targetSpecular = 0.8;
      triggerAnimation();
    });
    el.addEventListener('mouseup', () => {
      targetScale = 25;
      targetSpecular = 1.4;
      triggerAnimation();
    });
  }

  root.querySelectorAll('.glass-panel').forEach(bind);
}
