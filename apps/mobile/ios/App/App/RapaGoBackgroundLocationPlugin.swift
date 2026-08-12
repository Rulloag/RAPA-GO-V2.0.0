import Foundation
import Capacitor
import CoreLocation
import Network
import UIKit

@objc(RapaGoBackgroundLocationPlugin)
public class RapaGoBackgroundLocationPlugin: CAPPlugin, CAPBridgedPlugin, CLLocationManagerDelegate {
    public let identifier = "RapaGoBackgroundLocationPlugin"
    public let jsName = "RapaGoBackgroundLocation"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "getPermissionState", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "requestForegroundPermission", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "requestBackgroundPermission", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "requestNotificationPermission", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "openAppSettings", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "startTracking", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "stopTracking", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getState", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "updateAccessToken", returnType: CAPPluginReturnPromise),
    ]

    /// Tope por lote; debe coincidir con MAX_LOCATION_BATCH_POINTS del backend.
    private static let maxPointsPerBatch = 200
    private static let backoffSeconds: [TimeInterval] = [5, 10, 30, 60]

    private let manager = CLLocationManager()
    private let queue = RapaGoLocationQueue()

    /// Sesión propia en vez de `URLSession.shared`.
    ///
    /// `waitsForConnectivity = false` es explícito a propósito: con la red
    /// caída interesa que la petición falle rápido para que el punto quede en
    /// la cola y el backoff decida cuándo reintentar. Si la petición esperara
    /// a que vuelva la conectividad, el flag `sending` quedaría bloqueado y no
    /// se drenaría nada durante todo ese tiempo.
    private lazy var session: URLSession = {
        let configuration = URLSessionConfiguration.default
        configuration.waitsForConnectivity = false
        configuration.timeoutIntervalForRequest = 20
        configuration.timeoutIntervalForResource = 60
        return URLSession(configuration: configuration)
    }()

    /// Marca temporal del último punto aceptado, para descartar fixes viejos.
    private var lastAcceptedFixAt: Date?

    /// Un solo envío en vuelo a la vez, igual que el `AtomicBoolean` de Android.
    private let sendingLock = NSLock()
    private var sending = false
    private var backoffStep = 0

    private var pathMonitor: NWPathMonitor?
    private let monitorQueue = DispatchQueue(label: "cl.rapago.location.monitor")

    private var rideId: String?
    private var accessToken: String?
    private var apiBaseUrl: String?
    private var sequenceNumber = 0
    private var lastSentAt: String?
    private var lastError: String?
    private var running = false
    /// Token vencido (401 AUTH_TOKEN_EXPIRED): el GPS sigue capturando y
    /// encolando, solo dejó de poder entregar hasta que llegue un token nuevo.
    /// Distinto de `running = false`, que significa que el tracking se detuvo.
    private var authPaused = false

    public override func load() {
        manager.delegate = self
        manager.desiredAccuracy = kCLLocationAccuracyBestForNavigation
        manager.distanceFilter = 5
        manager.activityType = .automotiveNavigation
        manager.pausesLocationUpdatesAutomatically = false
        manager.showsBackgroundLocationIndicator = true
        startPathMonitor()
    }

    /// Reintenta en cuanto el sistema avisa de que hay red otra vez.
    ///
    /// Sin esto la cola se quedaría esperando al siguiente punto GPS, que con el
    /// conductor parado puede tardar mucho en llegar.
    private func startPathMonitor() {
        let monitor = NWPathMonitor()
        monitor.pathUpdateHandler = { [weak self] path in
            guard let self, path.status == .satisfied else { return }
            self.backoffStep = 0
            self.scheduleFlush(after: 0)
        }
        monitor.start(queue: monitorQueue)
        pathMonitor = monitor
    }

    private func permissionState() -> JSObject {
        let status = manager.authorizationStatus
        let foreground: String
        let background: String

        switch status {
        case .authorizedAlways:
            foreground = "granted"
            background = "granted"
        case .authorizedWhenInUse:
            foreground = "granted"
            background = "denied"
        case .denied, .restricted:
            foreground = "denied"
            background = "denied"
        case .notDetermined:
            foreground = "prompt"
            background = "unknown"
        @unknown default:
            foreground = "denied"
            background = "unknown"
        }

        return [
            "foreground": foreground,
            "background": background,
            "notifications": "granted",
            "locationServicesEnabled": CLLocationManager.locationServicesEnabled(),
        ]
    }

    private func state() -> JSObject {
        return [
            "running": running,
            "rideId": rideId as Any,
            "lastSentAt": lastSentAt as Any,
            "lastError": lastError as Any,
            "authPaused": authPaused,
        ]
    }

    @objc func getPermissionState(_ call: CAPPluginCall) {
        call.resolve(permissionState())
    }

    @objc func requestForegroundPermission(_ call: CAPPluginCall) {
        manager.requestWhenInUseAuthorization()
        call.resolve(permissionState())
    }

    @objc func requestBackgroundPermission(_ call: CAPPluginCall) {
        manager.requestAlwaysAuthorization()
        call.resolve(permissionState())
    }

    @objc func requestNotificationPermission(_ call: CAPPluginCall) {
        call.resolve(permissionState())
    }

    @objc func openAppSettings(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            if let url = URL(string: UIApplication.openSettingsURLString) {
                UIApplication.shared.open(url)
            }
        }
        call.resolve()
    }

    @objc func startTracking(_ call: CAPPluginCall) {
        guard
            let nextRideId = call.getString("rideId"), !nextRideId.isEmpty,
            let token = call.getString("accessToken"), !token.isEmpty,
            let baseUrl = call.getString("apiBaseUrl"), !baseUrl.isEmpty
        else {
            call.reject("rideId, accessToken and apiBaseUrl are required.")
            return
        }

        guard manager.authorizationStatus == .authorizedAlways else {
            call.reject("Always location permission is required.", "BACKGROUND_LOCATION_REQUIRED")
            return
        }

        rideId = nextRideId
        accessToken = token
        apiBaseUrl = baseUrl.trimmingCharacters(in: CharacterSet(charactersIn: "/"))
        sequenceNumber = 0
        lastError = nil
        authPaused = false
        running = true
        backoffStep = 0
        // Un viaje nuevo no puede heredar el filtro temporal del anterior.
        lastAcceptedFixAt = nil
        manager.allowsBackgroundLocationUpdates = true
        manager.startUpdatingLocation()
        // Puede haber quedado cola de una ejecución anterior que murió sin red.
        scheduleFlush(after: 0)
        call.resolve(state())
    }

    @objc func stopTracking(_ call: CAPPluginCall) {
        stopTrackingInternal()
        call.resolve(state())
    }

    @objc func getState(_ call: CAPPluginCall) {
        call.resolve(state())
    }

    /// Empuja un token nuevo al tracking ya corriendo, sin reiniciar el GPS.
    ///
    /// A diferencia de Android, iOS no tiene la restricción de "llamar a
    /// startForeground en los primeros segundos" — así que aquí, si no hay
    /// tracking corriendo, esto es simplemente un no-op seguro.
    @objc func updateAccessToken(_ call: CAPPluginCall) {
        guard let token = call.getString("accessToken"), !token.isEmpty else {
            call.reject("accessToken is required.")
            return
        }

        guard running else {
            call.resolve(state())
            return
        }

        accessToken = token
        authPaused = false
        backoffStep = 0
        // Puede haber puntos esperando desde que el token expiró.
        scheduleFlush(after: 0)
        call.resolve(state())
    }

    private func stopTrackingInternal() {
        manager.stopUpdatingLocation()
        manager.allowsBackgroundLocationUpdates = false
        // Lo que no se pudo entregar se guarda: al arrancar el próximo viaje se
        // reintenta, y el backend acepta histórico de viajes ya cerrados.
        queue.persistNow()
        running = false
        authPaused = false
        lastAcceptedFixAt = nil
        rideId = nil
        accessToken = nil
        apiBaseUrl = nil
    }

    /// Detecta que el usuario rebajó el permiso desde Ajustes durante el viaje.
    ///
    /// Sin esto, bajar de "Siempre" a "Mientras se usa" dejaba el seguimiento
    /// muerto en silencio: iOS deja de entregar posiciones en segundo plano y
    /// nadie se enteraba. Ahora se detiene de forma limpia y se avisa, para que
    /// el coordinador pueda pasar a publicar desde la capa JS y la tarjeta de
    /// permisos vuelva a aparecer.
    public func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
        notifyListeners("permissionChanged", data: permissionState())

        guard running else { return }

        switch manager.authorizationStatus {
        case .authorizedAlways:
            break
        case .authorizedWhenInUse:
            lastError = "Background location permission was downgraded."
            notifyListeners("trackingError", data: ["message": lastError as Any])
            stopTrackingInternal()
        case .denied, .restricted, .notDetermined:
            lastError = "Location permission was revoked."
            notifyListeners("trackingError", data: ["message": lastError as Any])
            stopTrackingInternal()
        @unknown default:
            break
        }
    }

    public func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
        lastError = error.localizedDescription
        notifyListeners("trackingError", data: ["message": error.localizedDescription])

        // `kCLErrorDenied` es terminal: iOS no volverá a entregar posiciones en
        // esta sesión. Seguir con el servicio arriba solo gastaría batería y
        // mantendría el indicador azul encendido sin capturar nada.
        if let clError = error as? CLError, clError.code == .denied {
            stopTrackingInternal()
        }
    }

    /// Un punto nuevo SIEMPRE se encola primero y solo después se intenta enviar.
    ///
    /// Ese orden es el cambio de fondo de esta fase: antes se enviaba directo y,
    /// si fallaba, el punto se perdía. Ahora la pérdida de señal solo retrasa la
    /// entrega.
    public func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        guard running, let location = locations.last else { return }

        // CoreLocation entrega a menudo un fix cacheado como primera posición,
        // y puede repetirlo. Un punto anterior al último aceptado rompería el
        // orden del recorrido que el backend usa para su cursor antispam.
        if let lastAt = lastAcceptedFixAt, location.timestamp <= lastAt { return }
        lastAcceptedFixAt = location.timestamp

        sequenceNumber += 1
        queue.enqueue(buildPoint(location, sequence: sequenceNumber))
        scheduleFlush(after: 0)
    }

    private func buildPoint(_ location: CLLocation, sequence: Int) -> [String: Any] {
        let formatter = ISO8601DateFormatter()
        let simulatedBySoftware: Bool
        if #available(iOS 15.0, *) {
            simulatedBySoftware = location.sourceInformation?.isSimulatedBySoftware ?? false
        } else {
            simulatedBySoftware = false
        }

        return [
            "lat": location.coordinate.latitude,
            "lng": location.coordinate.longitude,
            "accuracyMeters": location.horizontalAccuracy >= 0 ? location.horizontalAccuracy : NSNull(),
            "headingDegrees": location.course >= 0 ? location.course : NSNull(),
            "speedMetersPerSecond": location.speed >= 0 ? location.speed : NSNull(),
            "altitudeMeters": location.verticalAccuracy >= 0 ? location.altitude : NSNull(),
            "capturedAt": formatter.string(from: location.timestamp),
            "source": "background_native",
            "appState": "background",
            "sequenceNumber": sequence,
            "isMocked": simulatedBySoftware,
        ]
    }

    private func scheduleFlush(after delay: TimeInterval) {
        DispatchQueue.main.asyncAfter(deadline: .now() + delay) { [weak self] in
            self?.flush()
        }
    }

    private func nextBackoffDelay() -> TimeInterval {
        let step = min(backoffStep, Self.backoffSeconds.count - 1)
        backoffStep = min(backoffStep + 1, Self.backoffSeconds.count - 1)
        return Self.backoffSeconds[step]
    }

    private func finishSending(nextDelay: TimeInterval?) {
        sendingLock.lock()
        sending = false
        sendingLock.unlock()

        // Se agenda con `sending` ya liberado: al revés, el flush encadenado
        // vería el envío todavía en curso y el drenado se quedaría a medias.
        if let nextDelay {
            scheduleFlush(after: nextDelay)
        }
    }

    /// Envía los puntos más antiguos de la cola.
    ///
    /// En el caso feliz el lote lleva un solo punto y la latencia es la de antes.
    /// Con la red caída la cola crece y luego se drena de 200 en 200.
    private func flush() {
        guard
            let rideId,
            let accessToken,
            let apiBaseUrl,
            !queue.isEmpty,
            let encodedRideId = rideId.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed),
            let url = URL(string: "\(apiBaseUrl)/api/rides/\(encodedRideId)/location/batch")
        else { return }

        sendingLock.lock()
        if sending {
            sendingLock.unlock()
            return
        }
        sending = true
        sendingLock.unlock()

        let batch = queue.peek(Self.maxPointsPerBatch)
        if batch.isEmpty {
            finishSending(nextDelay: nil)
            return
        }

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.timeoutInterval = 20
        request.setValue("Bearer \(accessToken)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")

        do {
            request.httpBody = try JSONSerialization.data(withJSONObject: ["points": batch])
        } catch {
            lastError = error.localizedDescription
            finishSending(nextDelay: nil)
            return
        }

        session.dataTask(with: request) { [weak self] data, response, error in
            guard let self else { return }

            if let error {
                self.lastError = error.localizedDescription
                self.finishSending(nextDelay: self.nextBackoffDelay())
                return
            }

            let status = (response as? HTTPURLResponse)?.statusCode ?? 0

            if (200..<300).contains(status) {
                self.queue.drop(batch.count)
                self.lastSentAt = ISO8601DateFormatter().string(from: Date())
                self.lastError = nil
                self.authPaused = false
                self.backoffStep = 0
                // Quedan más: se sigue drenando sin esperar al próximo GPS.
                self.finishSending(nextDelay: self.queue.isEmpty ? nil : 0)
                return
            }

            // El envelope de error es plano: { ok:false, code, message,
            // statusCode }. Si el cuerpo no es JSON válido (proxy caído, 502
            // sin body propio), `code` queda nil y se decide solo por el
            // status HTTP más abajo.
            var code: String?
            if let data,
               let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] {
                code = json["code"] as? String
            }

            self.lastError = "Location API returned HTTP \(status)"
                + (code != nil ? " (\(code!))" : "")

            if status == 401 {
                if code == "AUTH_TOKEN_EXPIRED" {
                    // Recuperable: se sigue capturando y encolando, solo se
                    // pausa la ENTREGA hasta que llegue un token nuevo por
                    // updateAccessToken() o, como red de seguridad, hasta el
                    // próximo reintento con backoff (tope 60 s).
                    self.authPaused = true
                    self.finishSending(nextDelay: self.nextBackoffDelay())
                    return
                }

                // AUTH_SESSION_REVOKED, AUTH_ACCOUNT_DELETED o cualquier otro
                // 401 sin ese código: la sesión ya no es válida, renovar el
                // token no va a arreglarlo.
                self.queue.clear()
                self.finishSending(nextDelay: nil)
                DispatchQueue.main.async { self.stopTrackingInternal() }
                return
            }

            if status == 400 || status == 404 {
                // Irrecuperable: conservarlo bloquearía la cabeza de la cola
                // para siempre, así que se descarta y se sigue.
                self.queue.drop(batch.count)
                self.finishSending(nextDelay: 0)
                return
            }

            if status == 403 || status == 409 {
                // El viaje ya no admite puntos o no es de este conductor: no hay
                // nada que reintentar y la cola deja de tener sentido.
                self.queue.clear()
                self.finishSending(nextDelay: nil)
                DispatchQueue.main.async { self.stopTrackingInternal() }
                return
            }

            // 429, 5xx y cualquier otra: reintentar sí puede servir, así que
            // los puntos se conservan.
            self.finishSending(nextDelay: self.nextBackoffDelay())
        }.resume()
    }
}
