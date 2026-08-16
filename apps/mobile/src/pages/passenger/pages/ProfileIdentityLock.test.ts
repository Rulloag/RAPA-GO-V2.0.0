import { describe, expect, it } from "vitest";
import applySource from "../../apply/index.tsx?raw";
import driverSource from "../../driver/index.tsx?raw";
import profileSource from "./ProfilePage.tsx?raw";

describe("profile identity lock regression", () => {
  it("locks the driver application identity fields and leaves birth date editable", () => {
    const accountSection = applySource.slice(
      applySource.indexOf("Datos de tu cuenta"),
      applySource.indexOf("Validación Rapa Nui"),
    );

    expect(accountSection).toContain("readonly");
    expect(accountSection).toContain("Fecha de nacimiento *");
    expect(accountSection).toContain("setBirthDate");
    expect(accountSection).not.toContain("setFirstName(String");
    expect(accountSection).not.toContain("setLastName(String");
    expect(accountSection).not.toContain("setEmail(String");
    expect(accountSection).not.toContain("setRut(formatRut");
  });

  it("locks passenger name, phone, email and RUT in the profile", () => {
    expect(profileSource).toContain("Solicitar corrección de identidad");
    expect(profileSource).toContain('value={profile.rut ?? "No informado"}');
    expect(profileSource).not.toContain(
      "onIonInput={(e) => setNameInput(sanitizeProfileText",
    );
    expect(profileSource).not.toContain(
      "onIonInput={(e) => setPhoneInput(sanitizeProfilePhone",
    );
  });

  it("locks driver phone and license fields", () => {
    /* El teléfono y la licencia estaban repartidos en dos tarjetas con
       <IonInput readonly>, y este test comprobaba que apareciera "readonly".
       Tras el rediseño visual del perfil ambos viven juntos en la tarjeta de
       credencial y ya no son campos: son texto. El invariante que protegía
       este test —que el conductor no pueda editarlos desde el perfil— se
       mantiene, y de forma más fuerte, así que se comprueba sobre la nueva
       estructura: en esa sección no debe haber NINGÚN campo de entrada. */
    const credentialSection = driverSource.slice(
      driverSource.indexOf("Lo que ve el pasajero"),
      driverSource.indexOf("── Reputación"),
    );

    expect(credentialSection).toContain("Licencia de conducir");
    expect(credentialSection).toContain("Teléfono");
    expect(credentialSection).toContain("Solicitar corrección a soporte");
    expect(credentialSection).not.toContain("IonInput");
    expect(credentialSection).not.toContain("setLicenseNumber(String");
    expect(credentialSection).not.toContain("setLicenseExpiry(String");
    expect(credentialSection).not.toContain("setPhone(String");
  });
});
