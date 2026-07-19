package cl.rapago.app;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

import cl.rapago.app.location.RapaGoBackgroundLocationPlugin;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(RapaGoBackgroundLocationPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
