package cl.rapago.app.location;

import android.Manifest;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.content.pm.ServiceInfo;
import android.location.Location;
import android.location.LocationListener;
import android.location.LocationManager;
import android.net.ConnectivityManager;
import android.net.Network;
import android.net.NetworkCapabilities;
import android.net.NetworkRequest;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.core.app.NotificationCompat;
import androidx.core.content.ContextCompat;

import com.getcapacitor.JSObject;

import org.json.JSONArray;
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
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicInteger;

import cl.rapago.app.MainActivity;
import cl.rapago.app.R;

public class RapaGoLocationService extends Service implements LocationListener {
    public static final String ACTION_START = "cl.rapago.app.location.START";
    public static final String ACTION_STOP = "cl.rapago.app.location.STOP";
    /** Empuja un token nuevo sin reiniciar el GPS ni la notificación. */
    public static final String ACTION_UPDATE_TOKEN = "cl.rapago.app.location.UPDATE_TOKEN";
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
    /**
     * Token vencido (401 AUTH_TOKEN_EXPIRED): el GPS sigue capturando y
     * encolando, solo dejó de poder entregar hasta que llegue un token nuevo.
     * Distinto de `running: false`, que significa que el servicio se detuvo.
     */
    private static volatile boolean authPaused = false;

    /** Tope por lote; debe coincidir con MAX_LOCATION_BATCH_POINTS del backend. */
    private static final int MAX_POINTS_PER_BATCH = 200;
    private static final long[] BACKOFF_MS = { 5000, 10000, 30000, 60000 };

    private static final String CONFIG_PREFS = "rapago_location_config";
    private static final String CFG_RIDE_ID = "rideId";
    private static final String CFG_API_BASE_URL = "apiBaseUrl";
    private static final String CFG_INTERVAL_MS = "intervalMs";
    private static final String CFG_MIN_DISTANCE = "minDistanceMeters";
    private static final String CFG_STARTED_AT = "startedAt";

    /**
     * Un servicio revivido por START_STICKY con una configuración vieja seguiría
     * capturando GPS indefinidamente si el usuario no vuelve a abrir la app.
     * Ningún viaje dura tanto, así que pasado este plazo el reinicio se aborta.
     */
    private static final long MAX_RESTART_AGE_MS = 6 * 60 * 60 * 1000L;

    /**
     * Filtro de precisión. `requestUpdates()` escucha GPS_PROVIDER y
     * NETWORK_PROVIDER a la vez sin fusionarlos: un fix de red de 2 km justo
     * después de uno de satélite de 5 m hace saltar el marcador en el mapa del
     * pasajero. Se descarta el impreciso si el anterior aceptado era bueno y
     * todavía es reciente.
     */
    private static final float POOR_ACCURACY_METERS = 100f;
    private static final float GOOD_ACCURACY_METERS = 50f;
    private static final long GOOD_FIX_FRESH_MS = 20000;

    private final ExecutorService networkExecutor = Executors.newSingleThreadExecutor();
    private final AtomicInteger sequence = new AtomicInteger(0);
    /**
     * Un solo envío en vuelo a la vez.
     *
     * Antes cada punto encolaba una tarea en un executor de cola ilimitada; sin
     * señal, con cada intento tardando hasta 20 s, media hora de corte apilaba
     * cientos de tareas pendientes que luego se ejecutaban en cascada. Ahora un
     * punto nuevo solo encola dato, y el envío lo hace un único flush.
     */
    private final AtomicBoolean sending = new AtomicBoolean(false);

    private RapaGoLocationQueue queue;
    private Handler retryHandler;
    private ConnectivityManager connectivityManager;
    private ConnectivityManager.NetworkCallback networkCallback;
    /** Lo tocan el hilo de red, el principal y el callback de conectividad. */
    private volatile int backoffStep = 0;

    /** Marca temporal y precisión del último punto ACEPTADO, para el filtro. */
    private long lastAcceptedFixAt = 0;
    private float lastAcceptedAccuracy = Float.MAX_VALUE;

    private LocationManager locationManager;
    private String rideId;
    /** Leído desde el hilo de red al construir cada request, escrito desde el
     *  hilo principal por ACTION_UPDATE_TOKEN: necesita visibilidad entre hilos. */
    private volatile String accessToken;
    private String apiBaseUrl;
    private long intervalMs = 4000;
    private float minDistanceMeters = 5f;

    public static JSObject stateObject() {
        JSObject state = new JSObject();
        state.put("running", running);
        state.put("rideId", currentRideId);
        state.put("lastSentAt", lastSentAt);
        state.put("lastError", lastError);
        state.put("authPaused", authPaused);
        return state;
    }

    @Override
    public void onCreate() {
        super.onCreate();
        locationManager = (LocationManager) getSystemService(LOCATION_SERVICE);
        queue = new RapaGoLocationQueue(this);
        retryHandler = new Handler(Looper.getMainLooper());
        createNotificationChannel();
        registerNetworkCallback();
    }

    /**
     * Reintenta en cuanto el sistema avisa de que hay red otra vez.
     *
     * Sin esto la cola se quedaría esperando al siguiente punto GPS, que en un
     * túnel o con el conductor parado puede tardar mucho en llegar.
     */
    private void registerNetworkCallback() {
        connectivityManager = (ConnectivityManager) getSystemService(Context.CONNECTIVITY_SERVICE);
        if (connectivityManager == null) return;

        networkCallback = new ConnectivityManager.NetworkCallback() {
            @Override
            public void onAvailable(@NonNull Network network) {
                backoffStep = 0;
                scheduleFlush(0);
            }
        };

        try {
            NetworkRequest request = new NetworkRequest.Builder()
                .addCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
                .build();
            connectivityManager.registerNetworkCallback(request, networkCallback);
        } catch (Exception error) {
            // Sin aviso de red, el propio ritmo del GPS sigue disparando envíos.
            networkCallback = null;
        }
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        // El sistema revivió el servicio tras matarlo: no hay Intent, solo la
        // configuración que se guardó al arrancar.
        if (intent == null) return restoreAfterProcessDeath();

        if (ACTION_STOP.equals(intent.getAction())) {
            stopTracking();
            return START_NOT_STICKY;
        }

        if (ACTION_UPDATE_TOKEN.equals(intent.getAction())) {
            handleUpdateToken(intent);
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

        // Se guarda ANTES de devolver START_STICKY: si el sistema mata el
        // proceso, el reinicio necesita esta configuración para poder llamar a
        // startForeground() a tiempo. Devolver START_STICKY sin haberla
        // guardado provocaría ForegroundServiceDidNotStartInTimeException.
        persistConfig();

        enterForeground();

        running = true;
        currentRideId = rideId;
        lastError = null;
        authPaused = false;
        backoffStep = 0;
        lastAcceptedFixAt = 0;
        lastAcceptedAccuracy = Float.MAX_VALUE;
        requestUpdates();
        // Puede haber quedado cola de una ejecución anterior que murió sin red.
        scheduleFlush(0);
        return START_STICKY;
    }

    private void enterForeground() {
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
    }

    /**
     * El token NO se guarda a propósito.
     *
     * Es una credencial, y al revivir minutos u horas después estaría vencida
     * de todos modos. El servicio arranca sin él, marcado como `authPaused`:
     * sigue capturando y encolando, y recibe uno fresco por
     * ACTION_UPDATE_TOKEN en cuanto el usuario vuelva a abrir la app. Así no
     * se pierde ningún punto y no queda ninguna credencial en disco.
     */
    private void persistConfig() {
        getSharedPreferences(CONFIG_PREFS, Context.MODE_PRIVATE)
            .edit()
            .putString(CFG_RIDE_ID, rideId)
            .putString(CFG_API_BASE_URL, apiBaseUrl)
            .putLong(CFG_INTERVAL_MS, intervalMs)
            .putFloat(CFG_MIN_DISTANCE, minDistanceMeters)
            .putLong(CFG_STARTED_AT, System.currentTimeMillis())
            .apply();
    }

    private void clearConfig() {
        getSharedPreferences(CONFIG_PREFS, Context.MODE_PRIVATE)
            .edit()
            .clear()
            .apply();
    }

    /**
     * Reinicio tras muerte por memoria. El orden importa: hay que llamar a
     * startForeground() antes que nada, o Android mata la app.
     */
    private int restoreAfterProcessDeath() {
        SharedPreferences config = getSharedPreferences(CONFIG_PREFS, Context.MODE_PRIVATE);
        String savedRideId = config.getString(CFG_RIDE_ID, null);
        String savedApiBaseUrl = config.getString(CFG_API_BASE_URL, null);
        long startedAt = config.getLong(CFG_STARTED_AT, 0);

        boolean stale = startedAt <= 0
            || System.currentTimeMillis() - startedAt > MAX_RESTART_AGE_MS;

        if (savedRideId == null || savedApiBaseUrl == null || stale) {
            // Sin configuración utilizable no hay nada que reanudar. Aun así se
            // entra en foreground un instante: el sistema ya nos arrancó como
            // foreground service y exige la notificación antes de parar.
            enterForeground();
            clearConfig();
            stopForeground(STOP_FOREGROUND_REMOVE);
            stopSelf();
            return START_NOT_STICKY;
        }

        rideId = savedRideId;
        apiBaseUrl = savedApiBaseUrl;
        intervalMs = Math.max(2000, config.getLong(CFG_INTERVAL_MS, 4000));
        minDistanceMeters = Math.max(1f, config.getFloat(CFG_MIN_DISTANCE, 5f));
        accessToken = null;

        enterForeground();

        running = true;
        currentRideId = rideId;
        lastError = "Restarted after process death; waiting for a fresh token.";
        // Sin token no se puede entregar, pero sí capturar y encolar. El
        // coordinador empuja uno nuevo al reabrirse la app y la cola se vacía.
        authPaused = true;
        backoffStep = 0;
        lastAcceptedFixAt = 0;
        lastAcceptedAccuracy = Float.MAX_VALUE;
        requestUpdates();
        return START_STICKY;
    }

    /**
     * Se sirve tanto si el tracking está corriendo como si no.
     *
     * Si NO está corriendo, esta llamada de todos modos llegó por
     * `startForegroundService()` (así lo llama el plugin), lo que obliga a
     * llamar a `startForeground()` cuanto antes o el sistema mata la app con
     * `ForegroundServiceDidNotStartInTimeException`. En ese caso se cumple el
     * trámite y se cierra de inmediato: no hay tracking activo al que
     * empujarle un token.
     */
    private void handleUpdateToken(Intent intent) {
        if (!running) {
            enterForeground();
            stopForeground(STOP_FOREGROUND_REMOVE);
            stopSelf();
            return;
        }

        String newToken = intent.getStringExtra(EXTRA_ACCESS_TOKEN);
        if (newToken == null || newToken.isEmpty()) return;

        accessToken = newToken;
        authPaused = false;
        backoffStep = 0;
        // Puede haber puntos esperando desde que el token expiró.
        scheduleFlush(0);
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

    /**
     * Un punto nuevo SIEMPRE se encola primero y solo después se intenta enviar.
     *
     * Ese orden es el cambio de fondo de esta fase: antes se enviaba directo y,
     * si fallaba, el punto se perdía. Ahora la pérdida de señal solo retrasa la
     * entrega.
     */
    @Override
    public void onLocationChanged(@NonNull Location location) {
        if (!shouldAccept(location)) return;

        JSONObject point = buildPoint(location);
        if (point == null) return;

        lastAcceptedFixAt = location.getTime();
        lastAcceptedAccuracy = location.hasAccuracy()
            ? location.getAccuracy()
            : Float.MAX_VALUE;

        queue.enqueue(point);
        scheduleFlush(0);
    }

    /**
     * Descarta fixes que empeorarían el recorrido.
     *
     * Se escuchan GPS_PROVIDER y NETWORK_PROVIDER en paralelo y Android no los
     * fusiona: llegan intercalados y con precisiones muy distintas. Sin este
     * filtro, un fix de red de 2 km justo después de uno de satélite de 5 m
     * teletransporta el marcador del pasajero y de vuelta.
     */
    private boolean shouldAccept(Location location) {
        // Fix más antiguo que el último aceptado: los proveedores pueden
        // entregar desordenado, y un punto viejo rompe el orden del recorrido.
        if (lastAcceptedFixAt > 0 && location.getTime() <= lastAcceptedFixAt) {
            return false;
        }

        if (!location.hasAccuracy()) return true;

        float accuracy = location.getAccuracy();
        if (accuracy <= POOR_ACCURACY_METERS) return true;

        // Es impreciso: solo se acepta si no hay nada mejor y reciente.
        boolean previousWasGood = lastAcceptedAccuracy < GOOD_ACCURACY_METERS;
        boolean previousIsFresh =
            location.getTime() - lastAcceptedFixAt < GOOD_FIX_FRESH_MS;

        return !(previousWasGood && previousIsFresh);
    }

    private JSONObject buildPoint(Location location) {
        try {
            JSONObject point = new JSONObject();
            point.put("lat", location.getLatitude());
            point.put("lng", location.getLongitude());
            point.put("accuracyMeters", location.hasAccuracy() ? location.getAccuracy() : JSONObject.NULL);
            point.put("headingDegrees", location.hasBearing() ? location.getBearing() : JSONObject.NULL);
            point.put("speedMetersPerSecond", location.hasSpeed() ? location.getSpeed() : JSONObject.NULL);
            point.put("altitudeMeters", location.hasAltitude() ? location.getAltitude() : JSONObject.NULL);
            point.put("capturedAt", isoTime(location.getTime()));
            point.put("source", "background_native");
            point.put("appState", "background");
            point.put("sequenceNumber", sequence.incrementAndGet());
            point.put("isMocked", Build.VERSION.SDK_INT >= Build.VERSION_CODES.S
                ? location.isMock()
                : location.isFromMockProvider());
            return point;
        } catch (Exception error) {
            lastError = "Could not build location point.";
            return null;
        }
    }

    private void scheduleFlush(long delayMs) {
        if (retryHandler == null) return;
        retryHandler.removeCallbacks(flushRunnable);
        retryHandler.postDelayed(flushRunnable, delayMs);
    }

    private final Runnable flushRunnable = this::flush;

    /**
     * Envía los puntos más antiguos de la cola.
     *
     * En el caso feliz el lote lleva un solo punto y la latencia es la de antes.
     * Con la red caída la cola crece y luego se drena de 200 en 200.
     */
    private void flush() {
        if (rideId == null || accessToken == null || apiBaseUrl == null) return;
        if (queue.isEmpty()) return;
        if (!sending.compareAndSet(false, true)) return;

        networkExecutor.execute(() -> {
            // Se decide aquí y se agenda en el `finally`, ya con `sending`
            // liberado: agendar antes dejaría al flush encadenado viendo el
            // envío todavía en curso, y el drenado se quedaría a medias.
            long nextDelayMs = -1;

            try {
                JSONArray batch = queue.peek(MAX_POINTS_PER_BATCH);
                if (batch.length() == 0) return;

                BatchResult result = postBatch(batch);
                int status = result.status;

                if (status >= 200 && status < 300) {
                    queue.drop(batch.length());
                    lastSentAt = isoTime(System.currentTimeMillis());
                    lastError = null;
                    authPaused = false;
                    backoffStep = 0;
                    // Quedan más: se sigue drenando sin esperar al próximo GPS.
                    if (!queue.isEmpty()) nextDelayMs = 0;
                    return;
                }

                lastError = "Location API returned HTTP " + status
                    + (result.code != null ? " (" + result.code + ")" : "");

                if (status == 401) {
                    if ("AUTH_TOKEN_EXPIRED".equals(result.code)) {
                        // Recuperable: se sigue capturando y encolando, solo se
                        // pausa la ENTREGA hasta que llegue un token nuevo por
                        // updateAccessToken() o, como red de seguridad, hasta
                        // el próximo reintento con backoff (tope 60 s).
                        authPaused = true;
                        nextDelayMs = nextBackoffDelay();
                        return;
                    }

                    // AUTH_SESSION_REVOKED, AUTH_ACCOUNT_DELETED o cualquier otro
                    // 401 sin ese código: la sesión ya no es válida, renovar el
                    // token no va a arreglarlo.
                    queue.clear();
                    scheduleStop();
                    return;
                }

                if (status == 400 || status == 404) {
                    // Irrecuperable: conservarlo bloquearía la cabeza de la cola
                    // para siempre, así que se descarta y se sigue.
                    queue.drop(batch.length());
                    nextDelayMs = 0;
                    return;
                }

                if (status == 403 || status == 409) {
                    // El viaje ya no admite puntos o no es de este conductor: no
                    // hay nada que reintentar y la cola deja de tener sentido.
                    queue.clear();
                    scheduleStop();
                    return;
                }

                // 429, 5xx y cualquier otra: reintentar sí puede servir, así que
                // los puntos se conservan.
                nextDelayMs = nextBackoffDelay();
            } catch (Exception error) {
                lastError = error.getMessage() == null
                    ? error.getClass().getSimpleName()
                    : error.getMessage();
                nextDelayMs = nextBackoffDelay();
            } finally {
                sending.set(false);
                if (nextDelayMs >= 0) scheduleFlush(nextDelayMs);
            }
        });
    }

    private long nextBackoffDelay() {
        int step = Math.min(backoffStep, BACKOFF_MS.length - 1);
        backoffStep = Math.min(backoffStep + 1, BACKOFF_MS.length - 1);
        return BACKOFF_MS[step];
    }

    /** stopTracking toca el LocationManager, que quiere el hilo principal. */
    private void scheduleStop() {
        if (retryHandler == null) return;
        retryHandler.post(this::stopTracking);
    }

    /** Resultado de un POST de lote: status HTTP y, si vino, el código del envelope de error. */
    private static final class BatchResult {
        final int status;
        final String code;

        BatchResult(int status, String code) {
            this.status = status;
            this.code = code;
        }
    }

    private BatchResult postBatch(JSONArray points) throws Exception {
        HttpURLConnection connection = null;
        try {
            String base = apiBaseUrl.endsWith("/")
                ? apiBaseUrl.substring(0, apiBaseUrl.length() - 1)
                : apiBaseUrl;
            URL url = new URL(
                base + "/api/rides/" + UriEncoder.encodePathSegment(rideId) + "/location/batch"
            );
            connection = (HttpURLConnection) url.openConnection();
            connection.setRequestMethod("POST");
            connection.setConnectTimeout(10000);
            connection.setReadTimeout(20000);
            connection.setDoOutput(true);
            connection.setRequestProperty("Authorization", "Bearer " + accessToken);
            connection.setRequestProperty("Content-Type", "application/json; charset=utf-8");

            JSONObject body = new JSONObject();
            body.put("points", points);

            byte[] bytes = body.toString().getBytes(StandardCharsets.UTF_8);
            connection.setFixedLengthStreamingMode(bytes.length);
            try (OutputStream output = connection.getOutputStream()) {
                output.write(bytes);
            }

            int status = connection.getResponseCode();
            InputStream stream = status >= 200 && status < 300
                ? connection.getInputStream()
                : connection.getErrorStream();

            StringBuilder responseBody = new StringBuilder();
            if (stream != null) {
                try (BufferedReader reader = new BufferedReader(
                    new InputStreamReader(stream, StandardCharsets.UTF_8)
                )) {
                    String line;
                    while ((line = reader.readLine()) != null) {
                        responseBody.append(line);
                    }
                }
            }

            String code = null;
            if (status < 200 || status >= 300) {
                // El envelope de error es plano: { ok:false, code, message,
                // statusCode }. Si el cuerpo no es JSON válido (proxy caído,
                // 502 sin body propio), `code` queda null y el estado se
                // decide solo por el status HTTP más abajo.
                try {
                    code = new JSONObject(responseBody.toString()).optString("code", null);
                } catch (Exception ignored) {
                    code = null;
                }
            }

            return new BatchResult(status, code);
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

        if (retryHandler != null) retryHandler.removeCallbacks(flushRunnable);
        // Lo que no se pudo entregar se guarda: al arrancar el próximo viaje se
        // reintenta, y el backend acepta histórico de viajes ya cerrados.
        if (queue != null) queue.persistNow();

        // Esta es una parada deliberada, no una muerte: sin configuración
        // guardada, nada puede revivir el servicio para un viaje ya cerrado.
        clearConfig();

        running = false;
        currentRideId = null;
        authPaused = false;
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

        if (retryHandler != null) retryHandler.removeCallbacks(flushRunnable);

        if (connectivityManager != null && networkCallback != null) {
            try {
                connectivityManager.unregisterNetworkCallback(networkCallback);
            } catch (Exception ignored) {
                // Ya estaba dado de baja.
            }
            networkCallback = null;
        }

        // Última oportunidad de no perder lo capturado sin señal.
        if (queue != null) queue.persistNow();

        running = false;
        currentRideId = null;
        authPaused = false;
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
