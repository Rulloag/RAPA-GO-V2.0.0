package cl.rapago.app;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

import cl.rapago.app.auth.RapaGoGoogleAuthPlugin;
import cl.rapago.app.documents.RapaGoDocumentViewerPlugin;
import cl.rapago.app.location.RapaGoBackgroundLocationPlugin;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(RapaGoBackgroundLocationPlugin.class);
        registerPlugin(RapaGoGoogleAuthPlugin.class);
        registerPlugin(RapaGoDocumentViewerPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
