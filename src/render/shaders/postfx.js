// Shader de post-proceso: escala nearest, outline por profundidad,
// cuantización a paleta y dithering Bayer 4x4.

export const MAX_PALETTE_SIZE = 32;

export const postfxVertexShader = /* glsl */ `
  void main() {
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

export const postfxFragmentShader = /* glsl */ `
  #include <packing>

  #define MAX_PALETTE_SIZE ${MAX_PALETTE_SIZE}

  uniform sampler2D tColor;
  uniform sampler2D tDepth;
  uniform vec2 uResolution;   // tamaño del render interno (px)
  uniform float uScale;       // píxeles de pantalla por píxel interno
  uniform float uCameraNear;
  uniform float uCameraFar;

  uniform bool uOutline;
  uniform float uOutlineThreshold;
  uniform float uOutlineStrength;

  uniform bool uPaletteQuantize;
  uniform vec3 uPalette[MAX_PALETTE_SIZE];
  uniform int uPaletteSize;

  uniform bool uDithering;
  uniform float uDitherStrength;
  uniform float uColorLevels;

  const float bayer4[16] = float[16](
     0.0,  8.0,  2.0, 10.0,
    12.0,  4.0, 14.0,  6.0,
     3.0, 11.0,  1.0,  9.0,
    15.0,  7.0, 13.0,  5.0
  );

  float linearDepth(vec2 uv) {
    float d = texture2D(tDepth, uv).x;
    return -perspectiveDepthToViewZ(d, uCameraNear, uCameraFar);
  }

  float outlineFactor(vec2 uv) {
    vec2 texel = 1.0 / uResolution;
    float center = linearDepth(uv);
    float maxDiff = 0.0;
    maxDiff = max(maxDiff, linearDepth(uv + vec2( texel.x, 0.0)) - center);
    maxDiff = max(maxDiff, linearDepth(uv + vec2(-texel.x, 0.0)) - center);
    maxDiff = max(maxDiff, linearDepth(uv + vec2(0.0,  texel.y)) - center);
    maxDiff = max(maxDiff, linearDepth(uv + vec2(0.0, -texel.y)) - center);
    // Solo se marca el borde del objeto más cercano (el vecino está mucho más lejos).
    return maxDiff > uOutlineThreshold * center ? 1.0 - uOutlineStrength : 1.0;
  }

  vec3 nearestPaletteColor(vec3 color) {
    vec3 best = uPalette[0];
    float bestDist = 1e9;
    for (int i = 0; i < MAX_PALETTE_SIZE; i++) {
      if (i >= uPaletteSize) break;
      vec3 diff = color - uPalette[i];
      float dist = dot(diff, diff);
      if (dist < bestDist) {
        bestDist = dist;
        best = uPalette[i];
      }
    }
    return best;
  }

  void main() {
    vec2 pixel = floor(gl_FragCoord.xy / uScale);
    vec2 uv = (pixel + 0.5) / uResolution;

    vec3 color = texture2D(tColor, uv).rgb;

    if (uOutline) {
      color *= outlineFactor(uv);
    }

    // El render interno está en espacio lineal; la cuantización se hace en sRGB.
    color = sRGBTransferOETF(vec4(clamp(color, 0.0, 1.0), 1.0)).rgb;

    if (uDithering) {
      ivec2 p = ivec2(mod(pixel, 4.0));
      float threshold = (bayer4[p.y * 4 + p.x] + 0.5) / 16.0 - 0.5;
      color += threshold * uDitherStrength;
    }

    if (uPaletteQuantize) {
      color = nearestPaletteColor(color);
    } else if (uDithering) {
      color = floor(color * (uColorLevels - 1.0) + 0.5) / (uColorLevels - 1.0);
    }

    gl_FragColor = vec4(clamp(color, 0.0, 1.0), 1.0);
  }
`;
