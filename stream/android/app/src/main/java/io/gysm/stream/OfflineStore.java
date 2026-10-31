package io.gysm.stream;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Saves GYSM's own films to the app's private storage and serves them back to
 * the WebView with HTTP Range support, so saved films play and seek offline.
 *
 * Downloads run natively (not in the web page) so they are not limited by
 * CORS, continue while the page is busy, and resume from where they stopped:
 * a partial file keeps its bytes and the next attempt asks for the rest.
 * Plain Java with no Android imports, so it can be tested on any JVM.
 */
public final class OfflineStore {

    /** Receives progress; called on a background thread. */
    public interface Listener {
        void onUpdate(String id, String state, long done, long total, String error);
    }

    /** A byte range of a saved file, ready to hand to the WebView. */
    public static final class Slice {
        public final int status;
        public final String mime;
        public final long start;
        public final long end;
        public final long total;
        public final InputStream body;

        Slice(int status, String mime, long start, long end, long total, InputStream body) {
            this.status = status;
            this.mime = mime;
            this.start = start;
            this.end = end;
            this.total = total;
            this.body = body;
        }

        public long length() { return end - start + 1; }
    }

    private static final Pattern RANGE = Pattern.compile("bytes=(\\d*)-(\\d*)");
    private static final Pattern SAFE_ID = Pattern.compile("[a-z0-9][a-z0-9_-]{0,80}");
    private static final int MAX_ATTEMPTS = 5;
    // Tests run against a local plain-HTTP server; the app only ever uses HTTPS.
    private static final boolean ALLOW_HTTP = Boolean.getBoolean("gysm.test.allowHttp");

    private final File dir;
    private final Listener listener;
    private final ExecutorService worker = Executors.newSingleThreadExecutor();
    private final Map<String, Boolean> cancelled = new ConcurrentHashMap<>();
    private final Map<String, long[]> progress = new ConcurrentHashMap<>();

    public OfflineStore(File dir, Listener listener) {
        this.dir = dir;
        this.listener = listener;
        //noinspection ResultOfMethodCallIgnored
        dir.mkdirs();
    }

    public static boolean validId(String id) {
        return id != null && SAFE_ID.matcher(id).matches();
    }

    private File file(String id) { return new File(dir, id); }
    private File part(String id) { return new File(dir, id + ".part"); }
    private File mimeFile(String id) { return new File(dir, id + ".mime"); }

    public boolean has(String id) { return validId(id) && file(id).isFile(); }

    public long size(String id) { return has(id) ? file(id).length() : 0; }

    /** Queue a download. Saved files are kept; partial ones resume. */
    public void start(final String id, final String url, final String mime) {
        if (!validId(id) || url == null || !(url.startsWith("https://") || (ALLOW_HTTP && url.startsWith("http://")))) {
            notify(id, "error", 0, 0, "Invalid download");
            return;
        }
        if (has(id)) {
            notify(id, "done", size(id), size(id), null);
            return;
        }
        cancelled.remove(id);
        notify(id, "queued", part(id).length(), 0, null);
        worker.execute(() -> run(id, url, mime));
    }

    public void cancel(String id) {
        if (validId(id)) cancelled.put(id, Boolean.TRUE);
    }

    public void delete(String id) {
        if (!validId(id)) return;
        cancel(id);
        //noinspection ResultOfMethodCallIgnored
        file(id).delete();
        //noinspection ResultOfMethodCallIgnored
        part(id).delete();
        //noinspection ResultOfMethodCallIgnored
        mimeFile(id).delete();
        progress.remove(id);
    }

    /** Current state as JSON: {"state":..,"done":..,"total":..}. */
    public String status(String id) {
        if (!validId(id)) return "{\"state\":\"none\",\"done\":0,\"total\":0}";
        if (has(id)) return json("done", size(id), size(id));
        long[] p = progress.get(id);
        if (p != null) return json("downloading", p[0], p[1]);
        long partial = part(id).length();
        return json(partial > 0 ? "partial" : "none", partial, 0);
    }

    private static String json(String state, long done, long total) {
        return "{\"state\":\"" + state + "\",\"done\":" + done + ",\"total\":" + total + "}";
    }

    private void notify(String id, String state, long done, long total, String error) {
        if (listener != null) listener.onUpdate(id, state, done, total, error);
    }

    private void run(String id, String url, String mime) {
        String lastError = null;
        for (int attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
            if (cancelled.containsKey(id)) break;
            try {
                if (fetch(id, url)) {
                    if (mime != null) Files.write(mimeFile(id).toPath(), mime.getBytes(StandardCharsets.UTF_8));
                    if (!part(id).renameTo(file(id))) throw new IOException("Could not save file");
                    progress.remove(id);
                    notify(id, "done", size(id), size(id), null);
                    return;
                }
                break; // cancelled mid-way
            } catch (IOException e) {
                lastError = e.getMessage();
                try {
                    Thread.sleep(2000L * attempt);
                } catch (InterruptedException ie) {
                    Thread.currentThread().interrupt();
                    break;
                }
            }
        }
        progress.remove(id);
        if (cancelled.remove(id) != null) notify(id, "cancelled", part(id).length(), 0, null);
        else notify(id, "error", part(id).length(), 0, lastError == null ? "Download failed" : lastError);
    }

    /** One attempt. Returns true when complete, false when cancelled. */
    private boolean fetch(String id, String url) throws IOException {
        File part = part(id);
        long have = part.length();
        HttpURLConnection c = (HttpURLConnection) new URL(url).openConnection();
        c.setInstanceFollowRedirects(true);
        c.setConnectTimeout(20000);
        c.setReadTimeout(30000);
        c.setRequestProperty("User-Agent", "GYSMStream/1.0 (Fire TV)");
        if (have > 0) c.setRequestProperty("Range", "bytes=" + have + "-");
        try {
            int code = c.getResponseCode();
            boolean append;
            long total;
            if (code == 206 && have > 0) {
                append = true;
                total = have + c.getContentLengthLong();
            } else if (code == 200) {
                append = false;
                have = 0;
                total = c.getContentLengthLong();
            } else if (code == 416 && have > 0) {
                return true; // already have every byte
            } else {
                throw new IOException("HTTP " + code);
            }
            long[] p = new long[] {have, total};
            progress.put(id, p);
            byte[] buf = new byte[64 * 1024];
            long lastReport = 0;
            try (InputStream in = c.getInputStream(); OutputStream out = new FileOutputStream(part, append)) {
                int n;
                while ((n = in.read(buf)) > 0) {
                    if (cancelled.containsKey(id)) return false;
                    out.write(buf, 0, n);
                    p[0] += n;
                    long now = System.currentTimeMillis();
                    if (now - lastReport > 500) {
                        lastReport = now;
                        notify(id, "downloading", p[0], p[1], null);
                    }
                }
            }
            if (total > 0 && p[0] < total) throw new IOException("Connection ended early");
            return true;
        } finally {
            c.disconnect();
        }
    }

    /**
     * Opens a saved file for the WebView. With a Range header the reply is a
     * 206 slice; without one, the whole file. Returns null if not saved, or
     * a 416 slice for a range outside the file.
     */
    public Slice open(String id, String rangeHeader) throws IOException {
        if (!has(id)) return null;
        File f = file(id);
        long total = f.length();
        String mime = mimeFile(id).isFile()
                ? new String(Files.readAllBytes(mimeFile(id).toPath()), StandardCharsets.UTF_8).trim()
                : "video/mp4";
        long start = 0;
        long end = total - 1;
        int status = 200;
        if (rangeHeader != null) {
            Matcher m = RANGE.matcher(rangeHeader.trim());
            if (m.matches() && !(m.group(1).isEmpty() && m.group(2).isEmpty())) {
                if (m.group(1).isEmpty()) {
                    long suffix = Long.parseLong(m.group(2));
                    start = Math.max(0, total - suffix);
                } else {
                    start = Long.parseLong(m.group(1));
                    if (!m.group(2).isEmpty()) end = Math.min(end, Long.parseLong(m.group(2)));
                }
                if (start > end || start >= total) {
                    return new Slice(416, mime, 0, -1, total, new java.io.ByteArrayInputStream(new byte[0]));
                }
                status = 206;
            }
        }
        FileInputStream in = new FileInputStream(f);
        long skipped = 0;
        while (skipped < start) {
            long s = in.skip(start - skipped);
            if (s <= 0) break;
            skipped += s;
        }
        return new Slice(status, mime, start, end, total, new LimitedStream(in, end - start + 1));
    }

    /** Stops reading after `left` bytes. */
    private static final class LimitedStream extends InputStream {
        private final InputStream in;
        private long left;

        LimitedStream(InputStream in, long left) {
            this.in = in;
            this.left = left;
        }

        @Override public int read() throws IOException {
            if (left <= 0) return -1;
            int b = in.read();
            if (b >= 0) left--;
            return b;
        }

        @Override public int read(byte[] b, int off, int len) throws IOException {
            if (left <= 0) return -1;
            int n = in.read(b, off, (int) Math.min(len, left));
            if (n > 0) left -= n;
            return n;
        }

        @Override public void close() throws IOException { in.close(); }
    }
}
