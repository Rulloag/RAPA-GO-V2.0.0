import Foundation
import Capacitor
import CoreLocation
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
    ]

    private let manager = CLLocationManager()
    private var rideId: String?
    private var accessToken: String?
    private var apiBaseUrl: String?
    private var sequenceNumber = 0
    private var lastSentAt: String?
    private var lastError: String?
    private var running = false

    public override func load() {
        manager.delegate = self
        manager.desiredAccuracy = kCLLocationAccuracyBestForNavigation
        manager.distanceFilter = 5
        manager.activityType = .automotiveNavigation
        manager.pausesLocationUpdatesAutomatically = false
        manager.showsBackgroundLocationIndicator = true
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
        running = true
        manager.allowsBackgroundLocationUpdates = true
        manager.startUpdatingLocation()
        call.resolve(state())
    }

    @objc func stopTracking(_ call: CAPPluginCall) {
        stopTrackingInternal()
        call.resolve(state())
    }

    @objc func getState(_ call: CAPPluginCall) {
        call.resolve(state())
    }

    private func stopTrackingInternal() {
        manager.stopUpdatingLocation()
        manager.allowsBackgroundLocationUpdates = false
        running = false
        rideId = nil
        accessToken = nil
        apiBaseUrl = nil
    }

    public func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
        notifyListeners("permissionChanged", data: permissionState())
    }

    public func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
        lastError = error.localizedDescription
        notifyListeners("trackingError", data: ["message": error.localizedDescription])
    }

    public func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        guard running, let location = locations.last else { return }
        sequenceNumber += 1
        postLocation(location, sequence: sequenceNumber)
    }

    private func postLocation(_ location: CLLocation, sequence: Int) {
        guard
            let rideId,
            let accessToken,
            let apiBaseUrl,
            let encodedRideId = rideId.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed),
            let url = URL(string: "\(apiBaseUrl)/api/rides/\(encodedRideId)/location")
        else { return }

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.timeoutInterval = 10
        request.setValue("Bearer \(accessToken)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")

        let formatter = ISO8601DateFormatter()
        let simulatedBySoftware: Bool
        if #available(iOS 15.0, *) {
            simulatedBySoftware = location.sourceInformation?.isSimulatedBySoftware ?? false
        } else {
            simulatedBySoftware = false
        }

        let body: [String: Any] = [
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

        do {
            request.httpBody = try JSONSerialization.data(withJSONObject: body)
        } catch {
            lastError = error.localizedDescription
            return
        }

        URLSession.shared.dataTask(with: request) { [weak self] _, response, error in
            guard let self else { return }
            if let error {
                self.lastError = error.localizedDescription
                return
            }

            let status = (response as? HTTPURLResponse)?.statusCode ?? 0
            if (200..<300).contains(status) {
                self.lastSentAt = formatter.string(from: Date())
                self.lastError = nil
            } else {
                self.lastError = "Location API returned HTTP \(status)"
                if status == 401 || status == 403 || status == 409 {
                    DispatchQueue.main.async { self.stopTrackingInternal() }
                }
            }
        }.resume()
    }
}
