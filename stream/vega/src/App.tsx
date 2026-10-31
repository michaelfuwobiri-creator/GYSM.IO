// GYSM Stream for Vega OS (Fire TV devices that don't run Fire OS).
//
// A full-screen WebView showing the same GYSM web app as the Fire OS version.
// scripts/build-web.mjs copies it into assets/web, which Vega packages at
// /pkg/assets/web. The page talks to this shell through
// window.ReactNativeWebView.postMessage (see stream/web/js/platform.js):
//   {"type":"exit"}                  Back on the home screen: close the app
//   {"type":"keepScreenOn","on":..}  playback started or stopped
//
// With allowSystemKeyEvents the Back button reaches the page as a key event
// (keyCode 27), so the page decides what Back does, as on Fire OS.

import React, { useCallback } from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView } from '@amazon-devices/webview';
import { useKeplerBackHandler } from '@amazon-devices/react-native-kepler';

// The bundled web app. If your SDK version expects a different form for
// packaged files, change only this line (see README: "Start page").
const START_URI = 'file:///pkg/assets/web/index.html';

export const App = () => {
  const backHandler = useKeplerBackHandler();

  const onMessage = useCallback(
    (event: { nativeEvent: { data: string } }) => {
      let message: { type?: string } = {};
      try {
        message = JSON.parse(event.nativeEvent.data);
      } catch {
        return;
      }
      if (message.type === 'exit') backHandler.exitApp();
    },
    [backHandler],
  );

  return (
    <View style={styles.screen}>
      <WebView
        source={{ uri: START_URI }}
        style={styles.screen}
        javaScriptEnabled
        domStorageEnabled
        allowFileAccess
        allowSystemKeyEvents
        mediaPlaybackRequiresUserAction={false}
        allowsDefaultMediaControl={false}
        onMessage={onMessage}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#0b0b0f' },
});

export default App;
