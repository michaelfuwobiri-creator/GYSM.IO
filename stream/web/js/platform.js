// Bridge to the Fire TV (Fire OS) wrapper in ../android. In a normal browser
// the same calls fall back to web APIs, so the app also runs on the web.

const native = window.FireTVNative || null;

export const isFireTV = !!native;

export function isMetered() {
  if (native) {
    try { return native.isMetered(); } catch { /* fall through */ }
  }
  const c = navigator.connection;
  return !!(c && (c.type === 'cellular' || c.saveData));
}

export function keepScreenOn(on) {
  if (native) try { native.keepScreenOn(!!on); } catch { /* ignore */ }
}

// Back pressed on the home screen: Amazon requires the app to exit.
export function exitApp() {
  if (native) try { native.exit(); } catch { /* ignore */ }
}

// Remote-control keys. On Fire TV the wrapper sends Back, Menu and the media
// keys through GYSM.remote(); the D-pad and Select arrive as normal key
// events. Keyboard equivalents are mapped for testing in a desktop browser.
export function actionForKey(e) {
  switch (e.key) {
    case 'ArrowUp': return 'up';
    case 'ArrowDown': return 'down';
    case 'ArrowLeft': return 'left';
    case 'ArrowRight': return 'right';
    case 'Enter': case 'Select': return 'select';
    case 'Escape': case 'Backspace': case 'GoBack': case 'BrowserBack': return 'back';
    case 'MediaPlayPause': case ' ': return 'playpause';
    case 'MediaPlay': return 'play';
    case 'MediaPause': return 'pause';
    case 'MediaRewind': case ',': return 'rewind';
    case 'MediaFastForward': case '.': return 'forward';
    case 'ContextMenu': case 'm': return 'menu';
  }
  switch (e.keyCode) {
    case 23: case 13: return 'select';
    case 4: case 461: return 'back';
    case 179: return 'playpause';
    case 227: return 'rewind';
    case 228: return 'forward';
    case 82: case 93: return 'menu';
  }
  return null;
}
