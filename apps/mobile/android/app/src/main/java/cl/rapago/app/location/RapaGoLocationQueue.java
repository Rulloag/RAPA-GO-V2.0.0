package cl.rapago.app.location;

import android.content.Context;
import android.content.SharedPreferences;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.List;

/**
 * Cola de puntos GPS que todavía no llegaron al servidor.
 *
 * Existe porque los puntos del segundo plano los produce este servicio nativo,
 * que no ve el localStorage del WebView. Una cola solo en JavaScript perdería
 * exactamente los puntos por los que existe el seguimiento en segundo plano.
 *
 * La lista en memoria es la fuente de verdad y se vuelca a SharedPreferences
 * como mucho cada {@link #PERSIST_INTERVAL_MS}. Guardar en cada punto obligaría
 * a reescribir el fichero entero —cientos de KB con la cola llena— cada pocos
 * segundos, lo que castiga la batería y la memoria flash sin ganar nada: si el
 * sistema mata el proceso se pierden como mucho los últimos segundos.
 */
final class RapaGoLocationQueue {
    private static final String PREFS_NAME = "rapago_location_queue";
    private static final String KEY_POINTS = "points_v1";

    /**
     * Tope de la cola. 1000 puntos a ~4 s por punto es algo más de una hora sin
     * señal. Al llenarse se descartan los MÁS ANTIGUOS: para el pasajero vale
     * más el tramo reciente que el del principio del corte.
     */
    private static final int MAX_POINTS = 1000;

    private static final long PERSIST_INTERVAL_MS = 15000;

    private final SharedPreferences preferences;
    private final List<JSONObject> points = new ArrayList<>();
    private long lastPersistedAt = 0;
    private boolean dirty = false;

    RapaGoLocationQueue(Context context) {
        preferences = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        restore();
    }

    private void restore() {
        String raw = preferences.getString(KEY_POINTS, null);
        if (raw == null) return;

        try {
            JSONArray array = new JSONArray(raw);
            for (int i = 0; i < array.length(); i++) {
                JSONObject item = array.optJSONObject(i);
                // Un registro corrupto no puede costar la cola entera.
                if (item != null) points.add(item);
            }
        } catch (Exception ignored) {
            points.clear();
        }
    }

    synchronized void enqueue(JSONObject point) {
        if (point == null) return;

        points.add(point);
        while (points.size() > MAX_POINTS) {
            points.remove(0);
        }

        dirty = true;
        persistIfDue(false);
    }

    /** Los {@code max} puntos más antiguos, sin sacarlos de la cola. */
    synchronized JSONArray peek(int max) {
        JSONArray batch = new JSONArray();
        int limit = Math.min(max, points.size());
        for (int i = 0; i < limit; i++) {
            batch.put(points.get(i));
        }
        return batch;
    }

    /** Descarta los {@code count} más antiguos: ya están en el servidor. */
    synchronized void drop(int count) {
        for (int i = 0; i < count && !points.isEmpty(); i++) {
            points.remove(0);
        }

        dirty = true;
        // Al vaciarse se persiste ya: borrar la clave es barato y deja de haber
        // historial de ubicación en disco.
        persistIfDue(points.isEmpty());
    }

    synchronized int size() {
        return points.size();
    }

    synchronized boolean isEmpty() {
        return points.isEmpty();
    }

    /**
     * Borra la cola y su copia en disco. Se llama cuando el viaje ya no admite
     * puntos o la sesión dejó de ser válida: es historial de ubicación precisa,
     * no puede quedarse en el teléfono cuando ya no sirve para nada.
     */
    synchronized void clear() {
        points.clear();
        dirty = false;
        lastPersistedAt = System.currentTimeMillis();
        preferences.edit().remove(KEY_POINTS).apply();
    }

    /** Vuelca a disco pase lo que pase; para cuando el servicio se está yendo. */
    synchronized void persistNow() {
        persistIfDue(true);
    }

    private void persistIfDue(boolean force) {
        if (!dirty) return;

        long now = System.currentTimeMillis();
        if (!force && now - lastPersistedAt < PERSIST_INTERVAL_MS) return;

        lastPersistedAt = now;
        dirty = false;

        if (points.isEmpty()) {
            preferences.edit().remove(KEY_POINTS).apply();
            return;
        }

        JSONArray array = new JSONArray();
        for (JSONObject point : points) {
            array.put(point);
        }

        preferences.edit().putString(KEY_POINTS, array.toString()).apply();
    }
}
