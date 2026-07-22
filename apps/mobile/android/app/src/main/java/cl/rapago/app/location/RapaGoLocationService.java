package cl.rapago.app.location;

import android.Manifest;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.content.pm.ServiceInfo;
import android.location.Location;
import android.location.LocationListener;
import android.location.LocationManager;
import android.os.Build;
import android.os.Bundle;
import android.os.IBinder;
import android.os.Looper;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.core.app.NotificationCompat;
import androidx.core.content.ContextCompat;

import com.getcapacitor.JSObject;

import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;
import java.util.TimeZone;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicInteger;

import cl.rapago.app.MainActivity;
import cl.rapago.app.R;

public class RapaGoLocationService extends Service implements LocationListener {
    public static final String ACTION_START = "cl.rapago.app.location.START";
    public static final String ACTION_STOP = "cl.rapago.app.location.STOP";
    public static final String EXTRA_RIDE_ID = "rideId";
    public static final String EXTRA_ACCESS_TOKEN = "accessToken";
    public static final String EXTRA_API_BASE_URL = "apiBaseUrl";
    public static final String EXTRA_INTERVAL_MS = "intervalMs";
    public static final String EXTRA_MIN_DISTANCE_METERS = "minDistanceMeters";

    private static final String CHANNEL_ID = "rapago_active_ride_location";
    private static final int NOTIFICATION_ID = 9030;
    private static volatile boolean running = false;
    private static volatile String currentRideId = null;
    private static volatile String lastSentAt = null;
    private static volatile String lastError = null;

    private final ExecutorService networkExecutor = Executors.newSingleThreadExecutor();
    private final AtomicInteger sequence = new AtomicInteger(0);
    private LocationManager locationManager;
    private String rideId;
    private String accessToken;
    private String apiBaseUrl;
    private long intervalMs = 4000;
    private float minDistanceMeters = 5f;

    public static JSObject stateObject() {
        JSObject state = new JSObject();
        state.put("running", running);
        state.put("rideId", currentRideId);
        state.put("lastSentAt", lastSentAt);
        state.put("lastError", lastError);
        return state;
    }

    @Override
    public void onCreate() {
        super.onCreate();
        locationManager = (LocationManager) getSystemService(LOCATION_SERVICE);
        createNotificationChannel();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent == null) return START_NOT_STICKY;
        if (ACTION_STOP.equals(intent.getAction())) {
            stopTracking();
            return START_NOT_STICKY;
        }
        if (!ACTION_START.equals(intent.getAction())) return START_NOT_STICKY;

        rideId = intent.getStringExtra(EXTRA_RIDE_ID);
        accessToken = intent.getStringExtra(EXTRA_ACCESS_TOKEN);
        apiBaseUrl = intent.getStringExtra(EXTRA_API_BASE_URL);
        intervalMs = Math.max(2000, intent.getIntExtra(EXTRA_INTERVAL_MS, 4000));
        minDistanceMeters = Math.max(1f, intent.getFloatExtra(EXTRA_MIN_DISTANCE_METERS, 5f));

        if (rideId == null || accessToken == null || apiBaseUrl == null) {
            lastError = "Missing tracking configuration.";
            stopSelf();
            return START_NOT_STICKY;
        }

        Notification notification = buildNotification();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(
                NOTIFICATION_ID,
                notification,
                ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION
            );
        } else {
            startForeground(NOTIFICATION_ID, notification);
        }

        running = true;
        currentRideId = rideId;
        lastError = null;
        requestUpdates();
        return START_NOT_STICKY;
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationChannel channel = new NotificationChannel(
            CHANNEL_ID,
            getString(R.string.location_channel_name),
            NotificationManager.IMPORTANCE_LOW
        );
        channel.setDescription(getString(R.string.location_channel_description));
        channel.setShowBadge(false);
        NotificationManager manager = getSystemService(NotificationManager.class);
        if (manager != null) manager.createNotificationChannel(channel);
    }

    private Notification buildNotification() {
        Intent openIntent = new Intent(this, MainActivity.class);
        PendingIntent pendingIntent = PendingIntent.getActivity(
            this,
            0,
            openIntent,
            PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT
        );

        return new NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle(getString(R.string.location_notification_title))
            .setContentText(getString(R.string.location_notification_body))
            .setContentIntent(pendingIntent)
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setCategory(NotificationCompat.CATEGORY_SERVICE)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .build();
    }

    private void requestUpdates() {
        if (locationManager == null) {
            lastError = "Location service unavailable.";
            stopTracking();
            return;
        }

        boolean fine = ContextCompat.checkSelfPermission(
            this,
            Manifest.permission.ACCESS_FINE_LOCATION
        ) == PackageManager.PERMISSION_GRANTED;
        boolean coarse = ContextCompat.checkSelfPermission(
            this,
            Manifest.permission.ACCESS_COARSE_LOCATION
        ) == PackageManager.PERMISSION_GRANTED;

        if (!fine && !coarse) {
            lastError = "Location permission not granted.";
            stopTracking();
            return;
        }

        try {
            if (fine && locationManager.isProviderEnabled(LocationManager.GPS_PROVIDER)) {
                locationManager.requestLocationUpdates(
                    LocationManager.GPS_PROVIDER,
                    intervalMs,
                    minDistanceMeters,
                    this,
                    Looper.getMainLooper()
                );
            }
            if (locationManager.isProviderEnabled(LocationManager.NETWORK_PROVIDER)) {
                locationManager.requestLocationUpdates(
                    LocationManager.NETWORK_PROVIDER,
                    intervalMs,
                    minDistanceMeters,
                    this,
                    Looper.getMainLooper()
                );
            }
        } catch (SecurityException error) {
            lastError = error.getMessage();
            stopTracking();
        }
    }

    @Override
    public void onLocationChanged(@NonNull Location location) {
        final int currentSequence = sequence.incrementAndGet();
        networkExecutor.execute(() -> postLocation(location, currentSequence));
    }

    private void postLocation(Location location, int currentSequence) {
        HttpURLConnection connection = null;
        try {
            String base = apiBaseUrl.endsWith("/")
                ? apiBaseUrl.substring(0, apiBaseUrl.length() - 1)
                : apiBaseUrl;
            URL url = new URL(
                base + "/api/rides/" + UriEncoder.encodePathSegment(rideId) + "/location"
            );
            connection = (HttpURLConnection) url.openConnection();
            connection.setRequestMethod("POST");
            connection.setConnectTimeout(10000);
            connection.setReadTimeout(10000);
            connection.setDoOutput(true);
            connection.setRequestProperty("Authorization", "Bearer " + accessToken);
            connection.setRequestProperty("Content-Type", "application/json; charset=utf-8");

            JSONObject body = new JSONObject();
            body.put("lat", location.getLatitude());
            body.put("lng", location.getLongitude());
            body.put("accuracyMeters", location.hasAccuracy() ? location.getAccuracy() : JSONObject.NULL);
            body.put("headingDegrees", location.hasBearing() ? location.getBearing() : JSONObject.NULL);
            body.put("speedMetersPerSecond", location.hasSpeed() ? location.getSpeed() : JSONObject.NULL);
            body.put("altitudeMeters", location.hasAltitude() ? location.getAltitude() : JSONObject.NULL);
            body.put("capturedAt", isoTime(location.getTime()));
            body.put("source", "background_native");
            body.put("appState", "background");
            body.put("sequenceNumber", currentSequence);
            body.put("isMocked", Build.VERSION.SDK_INT >= Build.VERSION_CODES.S
                ? location.isMock()
                : location.isFromMockProvider());

            byte[] bytes = body.toString().getBytes(StandardCharsets.UTF_8);
            connection.setFixedLengthStreamingMode(bytes.length);
            try (OutputStream output = connection.getOutputStream()) {
                output.write(bytes);
            }

            int status = connection.getResponseCode();
            InputStream stream = status >= 200 && status < 300
                ? connection.getInputStream()
                : connection.getErrorStream();
            if (stream != null) {
                try (BufferedReader reader = new BufferedReader(
                    new InputStreamReader(stream, StandardCharsets.UTF_8)
                )) {
                    while (reader.readLine() != null) {
                        // Consume response so the connection can be reused/closed cleanly.
                    }
                }
            }

            if (status >= 200 && status < 300) {
                lastSentAt = isoTime(System.currentTimeMillis());
                lastError = null;
            } else {
                lastError = "Location API returned HTTP " + status;
                if (status == 401 || status == 403 || status == 409) {
                    stopTracking();
                }
            }
        } catch (Exception error) {
            lastError = error.getMessage() == null ? error.getClass().getSimpleName() : error.getMessage();
        } finally {
            if (connection != null) connection.disconnect();
        }
    }

    private void stopTracking() {
        if (locationManager != null) {
            try {
                locationManager.removeUpdates(this);
            } catch (SecurityException ignored) {
                // Service is already stopping.
            }
        }
        running = false;
        currentRideId = null;
        rideId = null;
        accessToken = null;
        apiBaseUrl = null;
        stopForeground(STOP_FOREGROUND_REMOVE);
        stopSelf();
    }

    @Override
    public void onProviderDisabled(@NonNull String provider) {
        lastError = "Location provider disabled: " + provider;
    }

    @Override
    public void onProviderEnabled(@NonNull String provider) {
        lastError = null;
    }

    @Override
    @SuppressWarnings("deprecation")
    public void onStatusChanged(String provider, int status, Bundle extras) {
        // Required for compatibility with older Android versions.
    }

    @Nullable
    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    @Override
    public void onDestroy() {
        if (locationManager != null) {
            try {
                locationManager.removeUpdates(this);
            } catch (SecurityException ignored) {
                // Ignore during shutdown.
            }
        }
        running = false;
        currentRideId = null;
        networkExecutor.shutdownNow();
        super.onDestroy();
    }


    private static String isoTime(long epochMillis) {
        SimpleDateFormat format = new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US);
        format.setTimeZone(TimeZone.getTimeZone("UTC"));
        return format.format(new Date(epochMillis));
    }

    private static final class UriEncoder {
        private UriEncoder() {}

        static String encodePathSegment(String value) {
            return android.net.Uri.encode(value == null ? "" : value);
        }
    }
}
