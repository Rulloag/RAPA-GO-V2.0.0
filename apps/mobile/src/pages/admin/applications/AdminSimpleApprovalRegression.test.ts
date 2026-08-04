import { describe, expect, it } from "vitest";

import applicationsSource from "./index.tsx?raw";

describe("admin driver simple approval", () => {
  it("removes the three-step approval controls", () => {
    expect(applicationsSource).not.toContain("Aprobar revisión documental");
    expect(applicationsSource).not.toContain("Marcar capacitación aprobada");
    expect(applicationsSource).not.toContain("Guardar checklist");
  });

  it("keeps one final approval button", () => {
    expect(applicationsSource).toContain("Aprobar conductor");
    expect(applicationsSource).toContain("Aprobación simple en un solo paso");
  });

  it("completes workflow fields in the same approval request", () => {
    expect(applicationsSource).toContain('documentReviewStatus: "approved"');
    expect(applicationsSource).toContain('trainingStatus: "approved"');
    expect(applicationsSource).toContain(
      "reviewChecklist: completedApprovalChecklist",
    );
  });

  it("requires only the accepted contract and six uploaded documents", () => {
    expect(applicationsSource).toContain("driverApprovalMissing.length === 0");
    expect(applicationsSource).toContain("uploadedDocuments < 6");
    expect(applicationsSource).toContain("item.driverContractAcceptedAt");
  });
});
