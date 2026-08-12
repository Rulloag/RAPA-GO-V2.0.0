package cl.rapago.app;

import android.os.Bundle;
import android.webkit.WebView;

import com.getcapacitor.BridgeActivity;

import cl.rapago.app.auth.RapaGoGoogleAuthPlugin;
import cl.rapago.app.documents.RapaGoDocumentViewerPlugin;
import cl.rapago.app.location.RapaGoBackgroundLocationPlugin;

public class MainActivity extends BridgeActivity {
    /**
     * Tope del escalado de texto del sistema, en porcentaje.
     *
     * El WebView aplica al contenido web el ajuste de "Tamaño de fuente" de
     * Android. Esta interfaz está construida casi entera en píxeles fijos, así
     * que cuando el texto crece las cajas no crecen con él: el contenido
     * desborda y la app se ve "con zoom". Con la fuente del sistema en el
     * máximo, el WebView llega a escalar bastante más del 130% y el resultado
     * es inusable.
     *
     * No se fija en 100 a propósito: eso descartaría por completo una
     * preferencia de accesibilidad real. Hasta 115% la interfaz aguanta, así
     * que quien necesita texto más grande lo sigue notando; pasado ese punto se
     * acota para que el layout no se rompa.
     *
     * El arreglo de fondo es migrar el layout a unidades relativas para que
     * tolere cualquier escala. Mientras tanto, esto es el tope.
     */
    private static final int MAX_TEXT_ZOOM_PERCENT = 115;
    private static final int MIN_TEXT_ZOOM_PERCENT = 100;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(RapaGoBackgroundLocationPlugin.class);
        registerPlugin(RapaGoGoogleAuthPlugin.class);
        registerPlugin(RapaGoDocumentViewerPlugin.class);
        super.onCreate(savedInstanceState);
        clampWebViewTextZoom();
    }

    /** Debe correr después de super.onCreate(): antes no existe el WebView. */
    private void clampWebViewTextZoom() {
        if (getBridge() == null) return;

        WebView webView = getBridge().getWebView();
        if (webView == null) return;

        float fontScale = getResources().getConfiguration().fontScale;
        int requested = Math.round(fontScale * 100f);
        int clamped = Math.max(
            MIN_TEXT_ZOOM_PERCENT,
            Math.min(MAX_TEXT_ZOOM_PERCENT, requested)
        );

        webView.getSettings().setTextZoom(clamped);
    }
}
