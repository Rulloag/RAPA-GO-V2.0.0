# Generación segura del AAB Android

## Variables de sesión de PowerShell

Configurar estas variables solo en el equipo seguro que custodia el keystore:

```powershell
$env:RAPAGO_ANDROID_KEYSTORE_PATH="C:\ruta-segura\rapago-release.jks"
$env:RAPAGO_ANDROID_KEYSTORE_PASSWORD="NO_COMPARTIR"
$env:RAPAGO_ANDROID_KEY_ALIAS="rapago"
$env:RAPAGO_ANDROID_KEY_PASSWORD="NO_COMPARTIR"
$env:RAPAGO_VERSION_NAME="2.0.0"
$env:RAPAGO_VERSION_CODE="20000"
```

Luego ejecutar desde la raíz:

```powershell
npm run build:android:aab
```

El resultado y su SHA-256 quedan en `release-output/`, carpeta que no debe versionarse.

Cada carga posterior en Google Play debe usar un `RAPAGO_VERSION_CODE` mayor al anterior.
