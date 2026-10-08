// Must run before Excalidraw creates its font faces (imported first in main.tsx).

// 1. Hosts may forbid data: fonts through CSP (an empty `resourceDomains` gives no
//    font-src), which silently drops every inlined editor font. Excalidraw builds
//    FontFace objects from `url(data:…)` strings; decode those to ArrayBuffers so the
//    browser loads them without a request that CSP could block.
const NativeFontFace = window.FontFace;
const inlined = /url\((data:[^)\s]+)\)/;

function decode(url: string) {
  const binary = atob(url.slice(url.indexOf(',') + 1));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

class InlineFontFace extends NativeFontFace {
  constructor(family: string, source: string | BufferSource, descriptors?: FontFaceDescriptors) {
    const match = typeof source === 'string' ? inlined.exec(source) : null;
    super(family, match ? decode(match[1]) : source, descriptors);
  }
}
window.FontFace = InlineFontFace;

// 2. Excalidraw's canvas font strings end with "Segoe UI Emoji" and no generic family,
//    and only Excalifont gets a CJK fallback (Xiaolai, not shipped: 12 MiB). CJK text
//    therefore fell through to the browser default, usually a serif. Alias that last
//    fallback to installed Chinese fonts for CJK code points only, preferring a
//    handwriting-style face when the user has one. local() makes no request.
const CJK_RANGES = 'U+2E80-2FDF, U+3000-303F, U+3040-30FF, U+3100-312F, U+3190-31FF, U+3400-4DBF, U+4E00-9FFF, U+F900-FAFF, U+FE30-FE4F, U+FF00-FFEF, U+20000-2FA1F';
const CJK_FONTS = [
  'Xiaolai SC', 'LXGW WenKai', 'LXGW WenKai Screen', // handwriting style, if installed
  'PingFang SC', 'PingFangSC-Regular', 'Hiragino Sans GB', 'HiraginoSansGB-W3', // macOS
  'Microsoft YaHei', 'MicrosoftYaHei', // Windows
  'Noto Sans CJK SC', 'NotoSansCJKsc-Regular', 'Source Han Sans SC', 'WenQuanYi Zen Hei', 'WenQuanYi Micro Hei', // Linux
];
document.fonts.add(new NativeFontFace('Segoe UI Emoji', CJK_FONTS.map(name => `local("${name}")`).join(', '), { unicodeRange: CJK_RANGES }));
