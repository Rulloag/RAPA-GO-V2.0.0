import Foundation

/// Cola de puntos GPS que todavía no llegaron al servidor.
///
/// Gemela de `RapaGoLocationQueue.java` en Android: mismas claves, mismo
/// formato y misma política de descarte, para que las dos implementaciones se
/// puedan revisar comparándolas.
///
/// Existe porque los puntos del segundo plano los produce este plugin nativo,
/// que no ve el localStorage del WebView. Una cola solo en JavaScript perdería
/// exactamente los puntos por los que existe el seguimiento en segundo plano.
///
/// La lista en memoria es la fuente de verdad y se vuelca a `UserDefaults` como
/// mucho cada `persistInterval`. Guardar en cada punto obligaría a reescribir
/// cientos de KB cada pocos segundos sin ganar nada: si el sistema mata el
/// proceso se pierden como mucho los últimos segundos.
final class RapaGoLocationQueue {
    private static let storageKey = "rapago_location_queue_points_v1"

    /// 1000 puntos a ~4 s por punto es algo más de una hora sin señal. Al
    /// llenarse se descartan los MÁS ANTIGUOS: para el pasajero vale más el
    /// tramo reciente que el del principio del corte.
    private static let maxPoints = 1000

    private static let persistInterval: TimeInterval = 15

    private let defaults: UserDefaults
    private let lock = NSLock()
    private var points: [[String: Any]] = []
    private var lastPersistedAt: Date = .distantPast
    private var dirty = false

    init(defaults: UserDefaults = .standard) {
        self.defaults = defaults
        restore()
    }

    private func restore() {
        guard let data = defaults.data(forKey: Self.storageKey) else { return }

        do {
            let parsed = try JSONSerialization.jsonObject(with: data)
            // Un registro corrupto no puede costar la cola entera.
            points = (parsed as? [[String: Any]]) ?? []
        } catch {
            points = []
        }
    }

    func enqueue(_ point: [String: Any]) {
        lock.lock()
        defer { lock.unlock() }

        points.append(point)
        if points.count > Self.maxPoints {
            points.removeFirst(points.count - Self.maxPoints)
        }

        dirty = true
        persistIfDue(force: false)
    }

    /// Los `max` puntos más antiguos, sin sacarlos de la cola.
    func peek(_ max: Int) -> [[String: Any]] {
        lock.lock()
        defer { lock.unlock() }

        return Array(points.prefix(max))
    }

    /// Descarta los `count` más antiguos: ya están en el servidor.
    func drop(_ count: Int) {
        lock.lock()
        defer { lock.unlock() }

        points.removeFirst(min(count, points.count))
        dirty = true
        // Al vaciarse se persiste ya: borrar la clave es barato y deja de haber
        // historial de ubicación en disco.
        persistIfDue(force: points.isEmpty)
    }

    var count: Int {
        lock.lock()
        defer { lock.unlock() }
        return points.count
    }

    var isEmpty: Bool {
        lock.lock()
        defer { lock.unlock() }
        return points.isEmpty
    }

    /// Borra la cola y su copia en disco. Se llama cuando el viaje ya no admite
    /// puntos o la sesión dejó de ser válida: es historial de ubicación precisa,
    /// no puede quedarse en el teléfono cuando ya no sirve para nada.
    func clear() {
        lock.lock()
        defer { lock.unlock() }

        points.removeAll()
        dirty = false
        lastPersistedAt = Date()
        defaults.removeObject(forKey: Self.storageKey)
    }

    /// Vuelca a disco pase lo que pase; para cuando el seguimiento se detiene.
    func persistNow() {
        lock.lock()
        defer { lock.unlock() }

        persistIfDue(force: true)
    }

    /// Debe llamarse con el lock tomado.
    private func persistIfDue(force: Bool) {
        guard dirty else { return }

        let now = Date()
        if !force && now.timeIntervalSince(lastPersistedAt) < Self.persistInterval {
            return
        }

        lastPersistedAt = now
        dirty = false

        if points.isEmpty {
            defaults.removeObject(forKey: Self.storageKey)
            return
        }

        do {
            let data = try JSONSerialization.data(withJSONObject: points)
            defaults.set(data, forKey: Self.storageKey)
        } catch {
            // Serializar no debería fallar; si falla, la cola sigue en memoria.
        }
    }
}
