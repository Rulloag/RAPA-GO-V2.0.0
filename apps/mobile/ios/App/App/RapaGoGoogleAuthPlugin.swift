import Foundation
import Capacitor
import GoogleSignIn

/**
 * Puente nativo de Capacitor para Google Sign-In en iPhone/iPad.
 *
 * El perfil se usa solamente para completar la interfaz. RAPA GO autentica
 * exclusivamente con el ID token validado por el backend.
 */
@objc(RapaGoGoogleAuthPlugin)
public class RapaGoGoogleAuthPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "RapaGoGoogleAuthPlugin"
    public let jsName = "RapaGoGoogleAuth"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "signIn", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "signOut", returnType: CAPPluginReturnPromise),
    ]

    @objc public func signIn(_ call: CAPPluginCall) {
        guard let presentingController = bridge?.viewController else {
            call.reject(
                "Google Sign-In requires an active iOS screen.",
                "GOOGLE_ACTIVITY_UNAVAILABLE"
            )
            return
        }

        DispatchQueue.main.async {
            GIDSignIn.sharedInstance.signIn(
                withPresenting: presentingController
            ) { result, error in
                if let error = error as NSError? {
                    if error.domain == kGIDSignInErrorDomain,
                       error.code == GIDSignInError.canceled.rawValue {
                        call.reject(
                            "El usuario canceló el ingreso con Google.",
                            "GOOGLE_SIGN_IN_CANCELLED"
                        )
                        return
                    }

                    call.reject(
                        "No se pudo completar el ingreso con Google.",
                        "GOOGLE_SIGN_IN_FAILED",
                        error
                    )
                    return
                }

                guard
                    let user = result?.user,
                    let idToken = user.idToken?.tokenString,
                    !idToken.isEmpty
                else {
                    call.reject(
                        "Google no entregó un ID token válido.",
                        "GOOGLE_TOKEN_MISSING"
                    )
                    return
                }

                var response: [String: Any] = [
                    "idToken": idToken,
                ]
                let profile = user.profile

                if let email = profile?.email, !email.isEmpty {
                    response["email"] = email
                }
                if let name = profile?.name, !name.isEmpty {
                    response["displayName"] = name
                }
                if let givenName = profile?.givenName, !givenName.isEmpty {
                    response["givenName"] = givenName
                }
                if let familyName = profile?.familyName, !familyName.isEmpty {
                    response["familyName"] = familyName
                }
                if let imageURL = profile?.imageURL(withDimension: 256) {
                    response["imageUrl"] = imageURL.absoluteString
                }

                call.resolve(response)
            }
        }
    }

    @objc public func signOut(_ call: CAPPluginCall) {
        GIDSignIn.sharedInstance.signOut()
        call.resolve()
    }
}
