<script lang="ts"></script>

<svg width="0" height="0" style="position: absolute; pointer-events: none;" aria-hidden="true">
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
</svg>
