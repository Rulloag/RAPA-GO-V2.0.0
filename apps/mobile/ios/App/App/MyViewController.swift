import Capacitor

/**
 * Controlador del WebView de RAPA GO.
 *
 * Capacitor 8 exige registrar explícitamente los plugins nativos que viven
 * dentro del target App. Sin este registro, JavaScript vería Google como
 * "plugin is not implemented on ios" aunque el archivo Swift compile.
 */
class MyViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(RapaGoGoogleAuthPlugin())
    }
}
