import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { formatRut, normalizeRut, validateRut } from "@rapa-go/shared";
import registerSource from "../RegisterPage.tsx?raw";
import socialSource from "../PassengerSocialSetupForm.tsx?raw";

function RutField(): JSX.Element {
  const [rut, setRut] = useState("");
  const [error, setError] = useState("");

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (!validateRut(rut)) {
          setError("RUT inválido");
          return;
        }
        setError("");
      }}
    >
      <label htmlFor="rut">RUT</label>
      <input
        id="rut"
        inputMode="text"
        value={rut}
        onChange={(event) => setRut(formatRut(event.target.value))}
      />
      {error ? <p>{error}</p> : null}
      <button type="submit">Crear cuenta</button>
    </form>
  );
}

describe("passenger register RUT interactions", () => {
  it("does not use numeric inputMode that blocks K on iOS", () => {
    const rutBlock = registerSource.slice(
      registerSource.indexOf("RUT *"),
      registerSource.indexOf("Pasaporte *"),
    );
    expect(rutBlock).toContain('inputmode="text"');
    expect(rutBlock).not.toContain('inputmode="numeric"');
    expect(rutBlock).not.toContain('pattern="[0-9]*"');
    expect(registerSource).toContain("from \"@rapa-go/shared\"");
    expect(registerSource).toContain("formatRut");
    expect(registerSource).toContain("validateRut");
  });

  it("allows typing and pasting K, dots and lowercase k", () => {
    render(<RutField />);
    const input = screen.getByLabelText("RUT") as HTMLInputElement;

    fireEvent.change(input, { target: { value: "12000008k" } });
    expect(input.value).toBe("12.000.008-K");

    fireEvent.change(input, { target: { value: "12.345.678-5" } });
    expect(input.value).toBe("12.345.678-5");
    expect(normalizeRut(input.value)).toBe("12345678-5");
  });

  it("blocks submit when the DV is wrong", () => {
    render(<RutField />);
    const input = screen.getByLabelText("RUT");
    fireEvent.change(input, { target: { value: "12345678-9" } });
    fireEvent.click(screen.getByText("Crear cuenta"));
    expect(screen.getByText("RUT inválido")).toBeTruthy();
  });
});

describe("social setup uses canonical RUT", () => {
  it("re-exports shared helpers and keeps Apple/Google text input", () => {
    expect(socialSource).toContain('from "@rapa-go/shared"');
    expect(socialSource).toContain("isRutValid as isValidRut");
    expect(socialSource).toContain('inputmode="text"');
    expect(socialSource).not.toContain("value.replace(/\\./g, \"\").replace(/-/g, \"\")");
  });
});
