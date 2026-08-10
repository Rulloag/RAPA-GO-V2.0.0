package cl.rapago.app.documents;

import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.net.Uri;

import androidx.core.content.FileProvider;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.Locale;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

@CapacitorPlugin(name = "RapaGoDocumentViewer")
public class RapaGoDocumentViewerPlugin extends Plugin {
    private static final int CONNECT_TIMEOUT_MS = 20_000;
    private static final int READ_TIMEOUT_MS = 45_000;
    private static final long MAX_PDF_BYTES = 20L * 1024L * 1024L;
    private final ExecutorService executor = Executors.newSingleThreadExecutor();

    @PluginMethod
    public void openAuthenticatedPdf(PluginCall call) {
        String url = clean(call.getString("url"));
        String token = clean(call.getString("token"));
        String fileName = safePdfFileName(call.getString("fileName"));

        if (url.isEmpty() || token.isEmpty()) {
            call.reject(
                "Faltan datos para abrir el contrato.",
                "DOCUMENT_CONFIGURATION_ERROR"
            );
            return;
        }

        if (!url.toLowerCase(Locale.ROOT).startsWith("https://")) {
            call.reject(
                "El contrato solo puede descargarse mediante HTTPS.",
                "DOCUMENT_INSECURE_URL"
            );
            return;
        }

        if (getActivity() == null) {
            call.reject(
                "No hay una pantalla Android activa para abrir el contrato.",
                "DOCUMENT_ACTIVITY_UNAVAILABLE"
            );
            return;
        }

        executor.execute(() -> downloadAndOpen(call, url, token, fileName));
    }

    private void downloadAndOpen(
        PluginCall call,
        String url,
        String token,
        String fileName
    ) {
        HttpURLConnection connection = null;

        try {
            connection = (HttpURLConnection) new URL(url).openConnection();
            connection.setRequestMethod("GET");
            connection.setConnectTimeout(CONNECT_TIMEOUT_MS);
            connection.setReadTimeout(READ_TIMEOUT_MS);
            connection.setInstanceFollowRedirects(false);
            connection.setRequestProperty("Authorization", "Bearer " + token);
            connection.setRequestProperty("Accept", "application/pdf");

            int status = connection.getResponseCode();

            if (status < 200 || status >= 300) {
                rejectOnUiThread(
                    call,
                    "El servidor rechazo la descarga del contrato (HTTP " + status + ").",
                    "DOCUMENT_HTTP_ERROR",
                    null
                );
                return;
            }

            String contentType = clean(connection.getContentType()).toLowerCase(Locale.ROOT);
            if (!contentType.startsWith("application/pdf")) {
                rejectOnUiThread(
                    call,
                    "El servidor no devolvio un PDF valido.",
                    "DOCUMENT_INVALID_CONTENT_TYPE",
                    null
                );
                return;
            }

            long declaredLength = connection.getContentLengthLong();
            if (declaredLength > MAX_PDF_BYTES) {
                rejectOnUiThread(
                    call,
                    "El contrato supera el tamano maximo permitido.",
                    "DOCUMENT_TOO_LARGE",
                    null
                );
                return;
            }

            File contractsDir = new File(getContext().getCacheDir(), "contracts");
            if (!contractsDir.exists() && !contractsDir.mkdirs()) {
                rejectOnUiThread(
                    call,
                    "No se pudo preparar el almacenamiento temporal del contrato.",
                    "DOCUMENT_CACHE_ERROR",
                    null
                );
                return;
            }

            File target = new File(contractsDir, fileName);
            long written = 0L;

            try (
                InputStream input = connection.getInputStream();
                FileOutputStream output = new FileOutputStream(target, false)
            ) {
                byte[] buffer = new byte[16 * 1024];
                int count;

                while ((count = input.read(buffer)) != -1) {
                    written += count;

                    if (written > MAX_PDF_BYTES) {
                        throw new IllegalStateException(
                            "El contrato supera el tamano maximo permitido."
                        );
                    }

                    output.write(buffer, 0, count);
                }

                output.flush();
            }

            if (written <= 0L || !target.isFile()) {
                rejectOnUiThread(
                    call,
                    "El contrato descargado esta vacio.",
                    "DOCUMENT_EMPTY_FILE",
                    null
                );
                return;
            }

            Uri contentUri = FileProvider.getUriForFile(
                getContext(),
                getContext().getPackageName() + ".fileprovider",
                target
            );

            final long finalWritten = written;

            getActivity().runOnUiThread(() -> {
                try {
                    Intent viewIntent = new Intent(Intent.ACTION_VIEW);
                    viewIntent.setDataAndType(contentUri, "application/pdf");
                    viewIntent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                    viewIntent.addFlags(Intent.FLAG_ACTIVITY_NO_HISTORY);

                    Intent chooser = Intent.createChooser(
                        viewIntent,
                        "Abrir contrato RAPA GO"
                    );

                    getActivity().startActivity(chooser);

                    JSObject result = new JSObject();
                    result.put("fileName", fileName);
                    result.put("bytes", finalWritten);
                    call.resolve(result);
                } catch (ActivityNotFoundException error) {
                    call.reject(
                        "El contrato se descargo, pero no hay una aplicacion instalada para abrir archivos PDF.",
                        "DOCUMENT_VIEWER_UNAVAILABLE",
                        error
                    );
                } catch (Exception error) {
                    call.reject(
                        "No se pudo abrir el contrato descargado.",
                        "DOCUMENT_OPEN_ERROR",
                        error
                    );
                }
            });
        } catch (IllegalStateException error) {
            rejectOnUiThread(
                call,
                error.getMessage() == null
                    ? "El contrato supera el tamano maximo permitido."
                    : error.getMessage(),
                "DOCUMENT_TOO_LARGE",
                error
            );
        } catch (Exception error) {
            rejectOnUiThread(
                call,
                "No se pudo descargar el contrato en Android.",
                "DOCUMENT_DOWNLOAD_ERROR",
                error
            );
        } finally {
            if (connection != null) {
                connection.disconnect();
            }
        }
    }

    private void rejectOnUiThread(
        PluginCall call,
        String message,
        String code,
        Exception error
    ) {
        if (getActivity() == null) {
            if (error == null) {
                call.reject(message, code);
            } else {
                call.reject(message, code, error);
            }
            return;
        }

        getActivity().runOnUiThread(() -> {
            if (error == null) {
                call.reject(message, code);
            } else {
                call.reject(message, code, error);
            }
        });
    }

    private String clean(String value) {
        return value == null ? "" : value.trim();
    }

    private String safePdfFileName(String value) {
        String cleanName = clean(value)
            .replaceAll("[^A-Za-z0-9._-]", "-")
            .replaceAll("-{2,}", "-");

        if (cleanName.isEmpty()) {
            cleanName = "Contrato-Rapa-Go.pdf";
        }

        if (!cleanName.toLowerCase(Locale.ROOT).endsWith(".pdf")) {
            cleanName = cleanName + ".pdf";
        }

        return cleanName;
    }
}