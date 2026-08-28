"use client";

import { Canvas } from "@react-three/fiber";
import { useEffect, useMemo, useState } from "react";
import {
  BUILDING_OPTIONS,
  getBuildingOption,
  normalizeDomain,
  validateBuildingSubmission,
  type BuildingFormData,
  type BuildingOption,
  type BuildingType,
} from "@/lib/buildings";
import { OfficeBuilding } from "./OfficeBuilding";
import { SignalTower } from "./SignalTower";
import { SmallOfficeBuilding } from "./SmallOfficeBuilding";
import { WebsiteBillboard } from "./WebsiteBillboard";

type Step = "choose" | "details";

type WebsiteFormState = {
  companyName: string;
  domain: string;
  logoUrl: string;
};

type WebsiteFormErrors = Partial<Record<keyof WebsiteFormState, string>>;

export type BuildingPreviewData = BuildingFormData;

function MiniBuildingPreview({ type }: { type: BuildingType }) {
  return (
    <div className="building-model-preview" aria-hidden="true">
      <Canvas
        camera={{ fov: 35, near: 0.1, far: 80, position: [9, 7, 9] }}
        gl={{ antialias: true, alpha: true }}
      >
        <ambientLight intensity={1.8} />
        <directionalLight intensity={2.2} position={[-6, 8, 6]} />
        <group rotation={[0, -0.45, 0]}>
          {type === "billboard" && (
            <WebsiteBillboard
              plotId="B1"
              name="Billboard"
              domain="preview.com"
              price="$1"
              position={[0, -1.4, 0]}
              width={3.2}
              height={1.35}
              poleHeight={2.2}
              clickable={false}
            />
          )}
          {type === "small-office" && (
            <SmallOfficeBuilding
              plotId="A1"
              name="Small"
              domain="preview.com"
              price="$2"
              position={[0, -1.5, 0]}
              width={3.4}
              height={2.7}
              depth={2.4}
              primaryColor="#f3f0e7"
              clickable={false}
            />
          )}
          {type === "office-building" && (
            <group scale={0.36} position={[0, -2.2, 0]}>
              <OfficeBuilding
                plotId="A2"
                name="Office"
                domain="preview.com"
                price="$3"
                position={[0, 0, 0]}
                width={6.6}
                height={10.2}
                depth={4.2}
                showLabels={false}
                clickable={false}
              />
            </group>
          )}
          {type === "tower" && (
            <group scale={0.32} position={[0, -2.1, 0]}>
              <SignalTower
                plotId="A4"
                name="Tower"
                domain="preview.com"
                price="$4"
                position={[0, 0, 0]}
                height={13.4}
                baseWidth={7}
                depth={5.5}
                clickable={false}
              />
            </group>
          )}
        </group>
      </Canvas>
    </div>
  );
}

function BuildingTypeCard({
  option,
  selected,
  onSelect,
}: {
  option: BuildingOption;
  selected: boolean;
  onSelect: (option: BuildingOption) => void;
}) {
  return (
    <article className={`building-type-card${selected ? " is-selected" : ""}`}>
      <MiniBuildingPreview type={option.id} />
      <div className="building-type-card-copy">
        <div>
          <h3>{option.name}</h3>
          <p>{option.description}</p>
        </div>
        <strong>${option.price}</strong>
      </div>
      <button
        className="building-type-select"
        type="button"
        aria-pressed={selected}
        onClick={() => onSelect(option)}
      >
        {selected ? "Selected" : "Select"}
      </button>
    </article>
  );
}

function BuildingOrderSummary({
  selectedOption,
  companyName,
  domain,
}: {
  selectedOption: BuildingOption;
  companyName: string;
  domain: string;
}) {
  return (
    <section className="building-order-summary" aria-label="Building summary">
      <div>
        <span>Selected building</span>
        <strong>{selectedOption.name}</strong>
      </div>
      <div>
        <span>Price</span>
        <strong>${selectedOption.price}</strong>
      </div>
      <div>
        <span>Company name</span>
        <strong>{companyName || "Acme"}</strong>
      </div>
      <div>
        <span>Domain</span>
        <strong>{domain || "acme.com"}</strong>
      </div>
    </section>
  );
}

function WebsiteDetailsForm({
  form,
  errors,
  selectedOption,
  onChange,
  onBack,
  onSubmit,
  saving,
}: {
  form: WebsiteFormState;
  errors: WebsiteFormErrors;
  selectedOption: NonNullable<ReturnType<typeof getBuildingOption>>;
  onChange: (field: keyof WebsiteFormState, value: string) => void;
  onBack: () => void;
  onSubmit: () => void;
  saving: boolean;
}) {
  return (
    <div className="building-panel-view">
      <div className="building-panel-copy">
        <h2>Add your website</h2>
      </div>

      <div className="building-form-fields">
        <label>
          <span>Company or product name</span>
          <input
            type="text"
            autoComplete="organization"
            placeholder="Acme"
            value={form.companyName}
            onChange={(event) => onChange("companyName", event.target.value)}
          />
          {errors.companyName && <small>{errors.companyName}</small>}
        </label>

        <label>
          <span>Website domain</span>
          <input
            type="text"
            inputMode="url"
            autoComplete="url"
            placeholder="acme.com"
            value={form.domain}
            onBlur={(event) => onChange("domain", normalizeDomain(event.target.value))}
            onChange={(event) => onChange("domain", event.target.value)}
          />
          {errors.domain && <small>{errors.domain}</small>}
        </label>

        <label>
          <span>Logo URL</span>
          <input
            type="url"
            inputMode="url"
            autoComplete="url"
            placeholder="https://acme.com/logo.png"
            value={form.logoUrl}
            onChange={(event) => onChange("logoUrl", event.target.value)}
          />
          {errors.logoUrl && <small>{errors.logoUrl}</small>}
        </label>
      </div>

      <BuildingOrderSummary
        selectedOption={selectedOption}
        companyName={form.companyName}
        domain={normalizeDomain(form.domain)}
      />

      <div className="building-panel-actions">
        <button
          className="building-secondary-action"
          type="button"
          onClick={onBack}
          disabled={saving}
        >
          Back
        </button>
        <button
          className="building-primary-action"
          type="button"
          onClick={onSubmit}
          disabled={saving}
          aria-busy={saving}
        >
          {saving ? "Adding..." : "Add building"}
        </button>
      </div>
    </div>
  );
}

export function AddBuildingPanel({
  onAddBuilding,
}: {
  onAddBuilding: (data: BuildingPreviewData) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>("choose");
  const [selectedBuilding, setSelectedBuilding] = useState<BuildingType | null>(null);
  const [form, setForm] = useState<WebsiteFormState>({
    companyName: "",
    domain: "",
    logoUrl: "",
  });
  const [errors, setErrors] = useState<WebsiteFormErrors>({});
  const [successMessage, setSuccessMessage] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [saving, setSaving] = useState(false);
  const selectedOption = useMemo(() => getBuildingOption(selectedBuilding), [selectedBuilding]);

  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  useEffect(() => {
    if (!successMessage) return;

    const timeoutId = window.setTimeout(() => setSuccessMessage(""), 2600);
    return () => window.clearTimeout(timeoutId);
  }, [successMessage]);

  const handleOpen = () => {
    setOpen(true);
    setSuccessMessage("");
  };

  const handleClose = () => {
    setOpen(false);
    setErrors({});
    setSuccessMessage("");
    setSubmitError("");
  };

  const updateForm = (field: keyof WebsiteFormState, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
    setSuccessMessage("");
    setSubmitError("");
  };

  const validateForm = () => {
    const parsed = validateBuildingSubmission({
      buildingType: selectedOption?.id,
      companyName: form.companyName,
      domain: form.domain,
      logoUrl: form.logoUrl,
    });
    const nextErrors: WebsiteFormErrors = parsed.ok
      ? {}
      : {
          companyName: parsed.errors.companyName,
          domain: parsed.errors.domain,
          logoUrl: parsed.errors.logoUrl,
        };
    const domain = normalizeDomain(form.domain);
    setForm((current) => ({ ...current, domain }));
    setErrors(nextErrors);

    if (!parsed.ok) return null;
    return parsed.data satisfies BuildingPreviewData;
  };

  const handleAddBuilding = async () => {
    const previewData = validateForm();
    if (!previewData) return;

    setSaving(true);
    setSubmitError("");
    try {
      await onAddBuilding(previewData);
      setSuccessMessage("Building preview is ready.");
      setOpen(false);
    } catch (error) {
      setSubmitError(
        error instanceof Error ? error.message : "Could not add this building right now.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <button className="add-building-button" type="button" onClick={handleOpen}>
        <span aria-hidden="true">+</span>
        Add your building
      </button>

      {open && (
        <>
          <button
            className="add-building-overlay"
            type="button"
            aria-label="Close add building panel"
            onClick={handleClose}
          />
          <aside className="add-building-panel" aria-label="Add your building">
            <div className="building-panel-header">
              <div>
                <p>{step === "choose" ? "Building type" : "Website details"}</p>
                <h1>Add your building</h1>
              </div>
              <button
                className="building-panel-close"
                type="button"
                aria-label="Close"
                onClick={handleClose}
              >
                x
              </button>
            </div>

            {step === "choose" && (
              <div className="building-panel-view">
                <div className="building-panel-copy">
                  <h2>Choose your building</h2>
                  <p>Select a building type to promote your website on the island.</p>
                </div>

                <div className="building-type-list">
                  {BUILDING_OPTIONS.map((option) => (
                    <BuildingTypeCard
                      key={option.id}
                      option={option}
                      selected={selectedBuilding === option.id}
                      onSelect={(nextOption) => {
                        setSelectedBuilding(nextOption.id);
                        setSuccessMessage("");
                      }}
                    />
                  ))}
                </div>

                {selectedOption && (
                  <button
                    className="building-primary-action"
                    type="button"
                  onClick={() => {
                    setStep("details");
                    setSuccessMessage("");
                    setSubmitError("");
                  }}
                >
                  Continue
                  </button>
                )}
              </div>
            )}

            {step === "details" && selectedOption && (
              <WebsiteDetailsForm
                form={form}
                errors={errors}
                selectedOption={selectedOption}
                onChange={updateForm}
                onBack={() => {
                  setStep("choose");
                  setSuccessMessage("");
                  setSubmitError("");
                }}
                onSubmit={handleAddBuilding}
                saving={saving}
              />
            )}

            {submitError && (
              <p className="building-error-message" role="alert">
                {submitError}
              </p>
            )}

            {successMessage && (
              <p className="building-success-message" role="status">
                {successMessage}
              </p>
            )}
          </aside>
        </>
      )}
    </>
  );
}
