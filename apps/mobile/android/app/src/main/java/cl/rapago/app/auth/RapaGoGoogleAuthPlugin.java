package cl.rapago.app.auth;

import android.net.Uri;
import android.os.CancellationSignal;

import androidx.annotation.NonNull;
import androidx.core.content.ContextCompat;
import androidx.credentials.ClearCredentialStateRequest;
import androidx.credentials.Credential;
import androidx.credentials.CredentialManager;
import androidx.credentials.CredentialManagerCallback;
import androidx.credentials.CustomCredential;
import androidx.credentials.GetCredentialRequest;
import androidx.credentials.GetCredentialResponse;
import androidx.credentials.exceptions.ClearCredentialException;
import androidx.credentials.exceptions.GetCredentialCancellationException;
import androidx.credentials.exceptions.GetCredentialException;
import androidx.credentials.exceptions.NoCredentialException;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.android.libraries.identity.googleid.GetSignInWithGoogleOption;
import com.google.android.libraries.identity.googleid.GoogleIdTokenCredential;

/**
 * Puente nativo de Capacitor para el botón explícito "Continuar con Google".
 *
 * La identidad nunca se confía en Android: el único dato usado para autenticar
 * es el ID token, que se envía al backend de RAPA GO para validación completa.
 */
@CapacitorPlugin(name = "RapaGoGoogleAuth")
public class RapaGoGoogleAuthPlugin extends Plugin {
    private CredentialManager credentialManager;

    @Override
    public void load() {
        credentialManager = CredentialManager.create(getContext());
    }

    @PluginMethod
    public void signIn(PluginCall call) {
        String serverClientId = call.getString("serverClientId");

        if (serverClientId == null || serverClientId.trim().isEmpty()) {
            call.reject(
                "Google serverClientId is required.",
                "GOOGLE_CONFIGURATION_ERROR"
            );
            return;
        }

        if (getActivity() == null) {
            call.reject(
                "Google Sign-In requires an active Android screen.",
                "GOOGLE_ACTIVITY_UNAVAILABLE"
            );
            return;
        }

        GetSignInWithGoogleOption googleOption =
            new GetSignInWithGoogleOption.Builder(serverClientId.trim()).build();
        GetCredentialRequest request = new GetCredentialRequest.Builder()
            .addCredentialOption(googleOption)
            .build();
        CancellationSignal cancellationSignal = new CancellationSignal();

        credentialManager.getCredentialAsync(
            getActivity(),
            request,
            cancellationSignal,
            ContextCompat.getMainExecutor(getContext()),
            new CredentialManagerCallback<GetCredentialResponse, GetCredentialException>() {
                @Override
                public void onResult(GetCredentialResponse result) {
                    resolveCredential(call, result.getCredential());
                }

                @Override
                public void onError(@NonNull GetCredentialException error) {
                    if (error instanceof GetCredentialCancellationException) {
                        call.reject(
                            "El usuario canceló el ingreso con Google.",
                            "GOOGLE_SIGN_IN_CANCELLED"
                        );
                        return;
                    }

                    if (error instanceof NoCredentialException) {
                        call.reject(
                            "No hay una cuenta de Google disponible en el dispositivo.",
                            "GOOGLE_NO_CREDENTIAL"
                        );
                        return;
                    }

                    call.reject(
                        "No se pudo abrir el ingreso con Google.",
                        "GOOGLE_SIGN_IN_FAILED",
                        error
                    );
                }
            }
        );
    }

    private void resolveCredential(PluginCall call, Credential credential) {
        if (!(credential instanceof CustomCredential)) {
            call.reject(
                "Google devolvió un tipo de credencial no compatible.",
                "GOOGLE_CREDENTIAL_UNSUPPORTED"
            );
            return;
        }

        CustomCredential customCredential = (CustomCredential) credential;
        if (!GoogleIdTokenCredential.TYPE_GOOGLE_ID_TOKEN_CREDENTIAL.equals(
            customCredential.getType()
        )) {
            call.reject(
                "Google devolvió un tipo de credencial inesperado.",
                "GOOGLE_CREDENTIAL_UNSUPPORTED"
            );
            return;
        }

        try {
            GoogleIdTokenCredential googleCredential =
                GoogleIdTokenCredential.createFrom(customCredential.getData());
            JSObject result = new JSObject();
            result.put("idToken", googleCredential.getIdToken());

            putIfPresent(result, "email", googleCredential.getId());
            putIfPresent(result, "displayName", googleCredential.getDisplayName());
            putIfPresent(result, "givenName", googleCredential.getGivenName());
            putIfPresent(result, "familyName", googleCredential.getFamilyName());

            Uri picture = googleCredential.getProfilePictureUri();
            if (picture != null) {
                result.put("imageUrl", picture.toString());
            }

            call.resolve(result);
        } catch (Exception error) {
            call.reject(
                "Google devolvió un ID token inválido.",
                "GOOGLE_TOKEN_PARSE_ERROR",
                error
            );
        }
    }

    private void putIfPresent(JSObject target, String key, String value) {
        if (value != null && !value.trim().isEmpty()) {
            target.put(key, value.trim());
        }
    }

    @PluginMethod
    public void signOut(PluginCall call) {
        ClearCredentialStateRequest request = new ClearCredentialStateRequest();

        credentialManager.clearCredentialStateAsync(
            request,
            null,
            ContextCompat.getMainExecutor(getContext()),
            new CredentialManagerCallback<Void, ClearCredentialException>() {
                @Override
                public void onResult(Void ignored) {
                    call.resolve();
                }

                @Override
                public void onError(@NonNull ClearCredentialException error) {
                    call.reject(
                        "No se pudo limpiar el estado de Google.",
                        "GOOGLE_SIGN_OUT_FAILED",
                        error
                    );
                }
            }
        );
    }
}
