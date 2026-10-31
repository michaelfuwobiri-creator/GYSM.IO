package io.gysm.stream

import android.annotation.SuppressLint
import android.app.Activity
import android.graphics.Bitmap
import android.graphics.Color
import android.net.ConnectivityManager
import android.net.Uri
import android.os.Bundle
import android.view.KeyEvent
import android.view.WindowManager
import android.webkit.JavascriptInterface
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebView
import androidx.webkit.WebViewAssetLoader
import androidx.webkit.WebViewClientCompat
import java.io.File
import org.json.JSONObject

/**
 * Fire TV shell for the web app in stream/web.
 *
 * The app is served from the APK's assets over https://appassets.androidplatform.net,
 * a secure origin. Films saved for offline viewing are downloaded natively by
 * OfflineStore into the app's private storage and served back to the page at
 * /offline/<id> with Range support, so they play and seek without a connection.
 * Back, Menu and the media keys are passed to the page through GYSM.remote();
 * the D-pad and Select reach the page as normal key events.
 */
class MainActivity : Activity() {

    private lateinit var webView: WebView
    private lateinit var offline: OfflineStore

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        WebView.setWebContentsDebuggingEnabled(BuildConfig.DEBUG)

        offline = OfflineStore(File(filesDir, "offline")) { id, state, done, total, error ->
            val event = JSONObject()
                .put("id", id).put("state", state).put("done", done).put("total", total)
                .put("error", error ?: JSONObject.NULL)
            runOnUiThread {
                if (::webView.isInitialized) webView.evaluateJavascript("window.GYSM && GYSM.nativeDownload($event)", null)
            }
        }

        val assetLoader = WebViewAssetLoader.Builder()
            .addPathHandler("/assets/", WebViewAssetLoader.AssetsPathHandler(this))
            .build()

        webView = WebView(this).apply {
            setBackgroundColor(Color.BLACK)
            isFocusable = true
            isFocusableInTouchMode = true
            settings.javaScriptEnabled = true
            settings.domStorageEnabled = true
            settings.mediaPlaybackRequiresUserGesture = false
            settings.allowFileAccess = false
            settings.allowContentAccess = false
            webViewClient = object : WebViewClientCompat() {
                override fun shouldInterceptRequest(view: WebView, request: WebResourceRequest): WebResourceResponse? {
                    val url = request.url
                    if (url.host == APP_HOST && url.path?.startsWith("/offline/") == true) {
                        return serveOffline(url.lastPathSegment, request.requestHeaders)
                    }
                    return assetLoader.shouldInterceptRequest(url)
                }

                // Stay inside the app: never open other pages in the WebView.
                override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean =
                    request.url.host != APP_HOST
            }
            webChromeClient = object : WebChromeClient() {
                // Hides the grey play icon WebView draws before a video starts.
                override fun getDefaultVideoPoster(): Bitmap =
                    Bitmap.createBitmap(1, 1, Bitmap.Config.ARGB_8888)
            }
            addJavascriptInterface(Bridge(), "FireTVNative")
        }

        setContentView(webView)
        webView.loadUrl(START_URL)
        webView.requestFocus()
    }

    // A saved film, or the requested byte range of it (the player seeks this way).
    private fun serveOffline(id: String?, headers: Map<String, String>): WebResourceResponse {
        val range = headers.entries.firstOrNull { it.key.equals("Range", ignoreCase = true) }?.value
        val slice = try {
            if (id != null) offline.open(id, range) else null
        } catch (e: Exception) {
            null
        }
        if (slice == null) {
            return WebResourceResponse("text/plain", "utf-8", 404, "Not Found", emptyMap(), null)
        }
        val out = mutableMapOf("Accept-Ranges" to "bytes", "Cache-Control" to "no-store")
        val reason = when (slice.status) {
            206 -> "Partial Content"
            416 -> "Range Not Satisfiable"
            else -> "OK"
        }
        if (slice.status == 206) out["Content-Range"] = "bytes ${slice.start}-${slice.end}/${slice.total}"
        if (slice.status == 416) out["Content-Range"] = "bytes */${slice.total}"
        if (slice.status != 416) out["Content-Length"] = slice.length().toString()
        return WebResourceResponse(slice.mime, null, slice.status, reason, out, slice.body)
    }

    override fun dispatchKeyEvent(event: KeyEvent): Boolean {
        val action = remoteAction(event.keyCode) ?: return super.dispatchKeyEvent(event)
        if (event.action == KeyEvent.ACTION_DOWN && event.repeatCount == 0) {
            webView.evaluateJavascript("window.GYSM ? GYSM.remote('$action') : false") { handled ->
                // Back on the home screen returns to the Fire TV launcher.
                if (action == "back" && handled != "true") finish()
            }
        }
        return true
    }

    private fun remoteAction(keyCode: Int): String? = when (keyCode) {
        KeyEvent.KEYCODE_BACK, KeyEvent.KEYCODE_ESCAPE -> "back"
        KeyEvent.KEYCODE_MENU -> "menu"
        KeyEvent.KEYCODE_MEDIA_PLAY_PAUSE -> "playpause"
        KeyEvent.KEYCODE_MEDIA_PLAY -> "play"
        KeyEvent.KEYCODE_MEDIA_PAUSE -> "pause"
        KeyEvent.KEYCODE_MEDIA_REWIND -> "rewind"
        KeyEvent.KEYCODE_MEDIA_FAST_FORWARD -> "forward"
        else -> null
    }

    // Home or another app on top: playback must pause. Downloads carry on
    // while the process is alive and resume on the next start if it is not.
    override fun onPause() {
        webView.evaluateJavascript("window.GYSM && GYSM.onPause()", null)
        window.clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        super.onPause()
    }

    override fun onDestroy() {
        webView.destroy()
        super.onDestroy()
    }

    /** Called from JavaScript as window.FireTVNative (see web/js/platform.js). */
    inner class Bridge {
        @JavascriptInterface
        fun isMetered(): Boolean {
            val cm = getSystemService(CONNECTIVITY_SERVICE) as ConnectivityManager
            return cm.isActiveNetworkMetered
        }

        @JavascriptInterface
        fun keepScreenOn(on: Boolean) = runOnUiThread {
            if (on) window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
            else window.clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        }

        @JavascriptInterface
        fun exit() = runOnUiThread { finish() }

        // Native offline downloads (see OfflineStore). Progress arrives in the
        // page through GYSM.nativeDownload({id, state, done, total, error}).
        @JavascriptInterface
        fun offlineStart(id: String, url: String, mime: String) = offline.start(id, url, mime)

        @JavascriptInterface
        fun offlineCancel(id: String) = offline.cancel(id)

        @JavascriptInterface
        fun offlineDelete(id: String) = offline.delete(id)

        @JavascriptInterface
        fun offlineStatus(id: String): String = offline.status(id)
    }

    private companion object {
        const val APP_HOST = "appassets.androidplatform.net"
        val START_URL: String = Uri.Builder()
            .scheme("https").authority(APP_HOST).path("/assets/index.html").build().toString()
    }
}
