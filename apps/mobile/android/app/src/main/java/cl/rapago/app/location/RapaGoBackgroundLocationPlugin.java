package cl.rapago.app.location;

import android.Manifest;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.location.LocationManager;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;

import androidx.core.content.ContextCompat;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;

@CapacitorPlugin(
    name = "RapaGoBackgroundLocation",
    permissions = {
        @Permission(
            alias = "foregroundLocation",
            strings = {
                Manifest.permission.ACCESS_COARSE_LOCATION,
                Manifest.permission.ACCESS_FINE_LOCATION
            }
        ),
        @Permission(
            alias = "backgroundLocation",
            strings = { Manifest.permission.ACCESS_BACKGROUND_LOCATION }
        ),
        @Permission(
            alias = "notifications",
            strings = { Manifest.permission.POST_NOTIFICATIONS }
        )
    }
)
public class RapaGoBackgroundLocationPlugin extends Plugin {
    private JSObject permissionState() {
        Context context = getContext();
        boolean fine = ContextCompat.checkSelfPermission(
            context,
            Manifest.permission.ACCESS_FINE_LOCATION
        ) == PackageManager.PERMISSION_GRANTED;
        boolean coarse = ContextCompat.checkSelfPermission(
            context,
            Manifest.permission.ACCESS_COARSE_LOCATION
        ) == PackageManager.PERMISSION_GRANTED;
        boolean background = Build.VERSION.SDK_INT < Build.VERSION_CODES.Q ||
            ContextCompat.checkSelfPermission(
                context,
                Manifest.permission.ACCESS_BACKGROUND_LOCATION
            ) == PackageManager.PERMISSION_GRANTED;
        boolean notifications = Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU ||
            ContextCompat.checkSelfPermission(
                context,
                Manifest.permission.POST_NOTIFICATIONS
            ) == PackageManager.PERMISSION_GRANTED;

        LocationManager manager = (LocationManager) context.getSystemService(Context.LOCATION_SERVICE);
        boolean servicesEnabled = manager != null &&
            (manager.isProviderEnabled(LocationManager.GPS_PROVIDER) ||
             manager.isProviderEnabled(LocationManager.NETWORK_PROVIDER));

        JSObject result = new JSObject();
        result.put("foreground", fine || coarse ? "granted" : "denied");
        result.put("background", background ? "granted" : "denied");
        result.put("notifications", notifications ? "granted" : "denied");
        result.put("locationServicesEnabled", servicesEnabled);
        return result;
    }

    @PluginMethod
    public void getPermissionState(PluginCall call) {
        call.resolve(permissionState());
    }

    @PluginMethod
    public void requestForegroundPermission(PluginCall call) {
        if (ContextCompat.checkSelfPermission(
            getContext(),
            Manifest.permission.ACCESS_FINE_LOCATION
        ) == PackageManager.PERMISSION_GRANTED) {
            call.resolve(permissionState());
            return;
        }
        requestPermissionForAlias("foregroundLocation", call, "foregroundPermissionResult");
    }

    @com.getcapacitor.annotation.PermissionCallback
    private void foregroundPermissionResult(PluginCall call) {
        call.resolve(permissionState());
    }

    @PluginMethod
    public void requestBackgroundPermission(PluginCall call) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q ||
            ContextCompat.checkSelfPermission(
                getContext(),
                Manifest.permission.ACCESS_BACKGROUND_LOCATION
            ) == PackageManager.PERMISSION_GRANTED) {
            call.resolve(permissionState());
            return;
        }

        // Android 11+ requires the user to enable "Allow all the time"
        // from the app settings after foreground permission was granted.
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            openSettingsInternal();
            call.resolve(permissionState());
            return;
        }

        requestPermissionForAlias("backgroundLocation", call, "backgroundPermissionResult");
    }

    @com.getcapacitor.annotation.PermissionCallback
    private void backgroundPermissionResult(PluginCall call) {
        call.resolve(permissionState());
    }

    @PluginMethod
    public void requestNotificationPermission(PluginCall call) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU ||
            ContextCompat.checkSelfPermission(
                getContext(),
                Manifest.permission.POST_NOTIFICATIONS
            ) == PackageManager.PERMISSION_GRANTED) {
            call.resolve(permissionState());
            return;
        }
        requestPermissionForAlias("notifications", call, "notificationPermissionResult");
    }

    @com.getcapacitor.annotation.PermissionCallback
    private void notificationPermissionResult(PluginCall call) {
        call.resolve(permissionState());
    }

    private void openSettingsInternal() {
        Intent intent = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
        intent.setData(Uri.parse("package:" + getContext().getPackageName()));
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        getContext().startActivity(intent);
    }

    @PluginMethod
    public void openAppSettings(PluginCall call) {
        openSettingsInternal();
        call.resolve();
    }

    @PluginMethod
    public void startTracking(PluginCall call) {
        String rideId = call.getString("rideId");
        String accessToken = call.getString("accessToken");
        String apiBaseUrl = call.getString("apiBaseUrl");
        Integer interval = call.getInt("minUpdateIntervalMs", 4000);
        Double distance = call.getDouble("minDistanceMeters", 5.0);

        if (rideId == null || rideId.trim().isEmpty() ||
            accessToken == null || accessToken.trim().isEmpty() ||
            apiBaseUrl == null || apiBaseUrl.trim().isEmpty()) {
            call.reject("rideId, accessToken and apiBaseUrl are required.");
            return;
        }

        if (ContextCompat.checkSelfPermission(
            getContext(),
            Manifest.permission.ACCESS_FINE_LOCATION
        ) != PackageManager.PERMISSION_GRANTED &&
            ContextCompat.checkSelfPermission(
                getContext(),
                Manifest.permission.ACCESS_COARSE_LOCATION
            ) != PackageManager.PERMISSION_GRANTED) {
            call.reject("Foreground location permission is required.", "LOCATION_PERMISSION_REQUIRED");
            return;
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q &&
            ContextCompat.checkSelfPermission(
                getContext(),
                Manifest.permission.ACCESS_BACKGROUND_LOCATION
            ) != PackageManager.PERMISSION_GRANTED) {
            call.reject("Background location permission is required.", "BACKGROUND_LOCATION_REQUIRED");
            return;
        }

        Intent intent = new Intent(getContext(), RapaGoLocationService.class);
        intent.setAction(RapaGoLocationService.ACTION_START);
        intent.putExtra(RapaGoLocationService.EXTRA_RIDE_ID, rideId.trim());
        intent.putExtra(RapaGoLocationService.EXTRA_ACCESS_TOKEN, accessToken.trim());
        intent.putExtra(RapaGoLocationService.EXTRA_API_BASE_URL, apiBaseUrl.trim());
        intent.putExtra(
            RapaGoLocationService.EXTRA_INTERVAL_MS,
            Math.max(2000, interval == null ? 4000 : interval)
        );
        intent.putExtra(
            RapaGoLocationService.EXTRA_MIN_DISTANCE_METERS,
            Math.max(1f, distance == null ? 5f : distance.floatValue())
        );

        ContextCompat.startForegroundService(getContext(), intent);
        call.resolve(RapaGoLocationService.stateObject());
    }

    /**
     * Empuja un token nuevo al servicio ya corriendo, sin reiniciar el GPS ni
     * la notificación.
     *
     * Si el servicio no está corriendo esto es intencionalmente un no-op: no
     * hay nada que enviar sin un viaje activo, así que no vale la pena
     * arriesgar el crash de `ForegroundServiceDidNotStartInTimeException` que
     * traería iniciar el servicio solo para esto.
     */
    @PluginMethod
    public void updateAccessToken(PluginCall call) {
        String accessToken = call.getString("accessToken");
        if (accessToken == null || accessToken.trim().isEmpty()) {
            call.reject("accessToken is required.");
            return;
        }

        Intent intent = new Intent(getContext(), RapaGoLocationService.class);
        intent.setAction(RapaGoLocationService.ACTION_UPDATE_TOKEN);
        intent.putExtra(RapaGoLocationService.EXTRA_ACCESS_TOKEN, accessToken.trim());
        ContextCompat.startForegroundService(getContext(), intent);
        call.resolve();
    }

    @PluginMethod
    public void stopTracking(PluginCall call) {
        Intent intent = new Intent(getContext(), RapaGoLocationService.class);
        getContext().stopService(intent);
        call.resolve(RapaGoLocationService.stateObject());
    }

    @PluginMethod
    public void getState(PluginCall call) {
        call.resolve(RapaGoLocationService.stateObject());
    }
}
