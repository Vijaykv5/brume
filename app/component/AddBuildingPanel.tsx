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
import { getWebsiteFaviconUrl } from "@/lib/favicon";
import { OfficeBuilding } from "./OfficeBuilding";
import { SignalTower } from "./SignalTower";
import { SmallOfficeBuilding } from "./SmallOfficeBuilding";
import { WebsiteBillboard } from "./WebsiteBillboard";

type Step = "choose" | "details";

type WebsiteFormState = {
  companyName: string;
  domain: string;
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
              price="$2"
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
              price="$5"
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
                price="$7"
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
                price="$10"
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
  const faviconUrl = domain ? getWebsiteFaviconUrl(domain, 64) : "";

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
        <strong>{companyName}</strong>
      </div>
      <div>
        <span>Website</span>
        <strong className="building-summary-website">
          {faviconUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={faviconUrl} alt="" aria-hidden="true" />
          )}
          {domain}
        </strong>
      </div>
    </section>
  );
}

function WebsiteFaviconPreview({ domain }: { domain: string }) {
  const normalizedDomain = normalizeDomain(domain);
  const faviconUrl = normalizedDomain ? getWebsiteFaviconUrl(normalizedDomain, 64) : "";

  if (!faviconUrl) return null;

  return (
    <span className="building-domain-favicon" aria-hidden="true">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={faviconUrl} alt="" />
    </span>
  );
}

function hasWebsiteFavicon(domain: string) {
  return Boolean(normalizeDomain(domain));
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
      <div className="building-form-fields">
        <label>
          <span>Company or product name</span>
          <input
            type="text"
            autoComplete="organization"
            value={form.companyName}
            onChange={(event) => onChange("companyName", event.target.value)}
          />
          {errors.companyName && <small>{errors.companyName}</small>}
        </label>

        <label>
          <span>Website</span>
          <div
            className={`building-domain-input-wrap${
              hasWebsiteFavicon(form.domain) ? " has-favicon" : ""
            }`}
          >
            <WebsiteFaviconPreview domain={form.domain} />
            <input
              type="text"
              inputMode="url"
              autoComplete="url"
              value={form.domain}
              onBlur={(event) => onChange("domain", normalizeDomain(event.target.value))}
              onChange={(event) => onChange("domain", event.target.value)}
            />
          </div>
          {errors.domain && <small>{errors.domain}</small>}
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
          {saving ? "Opening checkout..." : "Continue to payment"}
        </button>
      </div>
    </div>
  );
}

export function AddBuildingPanel({
  onAddBuilding,
  open,
  onOpenChange,
}: {
  onAddBuilding: (data: BuildingPreviewData) => Promise<void>;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [step, setStep] = useState<Step>("choose");
  const [selectedBuilding, setSelectedBuilding] = useState<BuildingType | null>(null);
  const [form, setForm] = useState<WebsiteFormState>({
    companyName: "",
    domain: "",
  });
  const [errors, setErrors] = useState<WebsiteFormErrors>({});
  const [successMessage, setSuccessMessage] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [saving, setSaving] = useState(false);
  const selectedOption = useMemo(() => getBuildingOption(selectedBuilding), [selectedBuilding]);

  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onOpenChange(false);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onOpenChange, open]);

  useEffect(() => {
    if (!successMessage) return;

    const timeoutId = window.setTimeout(() => setSuccessMessage(""), 2600);
    return () => window.clearTimeout(timeoutId);
  }, [successMessage]);

  const handleOpen = () => {
    onOpenChange(true);
    setSuccessMessage("");
  };

  const handleClose = () => {
    onOpenChange(false);
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
    });
    const nextErrors: WebsiteFormErrors = parsed.ok
      ? {}
      : {
          companyName: parsed.errors.companyName,
          domain: parsed.errors.domain,
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
      setSuccessMessage("Opening secure checkout...");
    } catch (error) {
      setSubmitError(
        error instanceof Error ? error.message : "Could not start checkout right now.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <button className="add-building-button" type="button" onClick={handleOpen}>
        <span aria-hidden="true">
          <svg viewBox="0 0 32 32" focusable="false">
            <path
              d="M9.6 6.4 24.7 18c.8.6.5 1.9-.5 2l-5.1.6 3.4 4.5-3.4 2.5-3.3-4.5-3 4.1c-.6.8-1.9.5-2-.5L7.8 7.8c-.1-1 .9-1.9 1.8-1.4Z"
            />
            <path d="M5.9 13.1a10 10 0 0 1 10-10" />
            <path d="M2.9 15.9a14 14 0 0 1 14-14" />
          </svg>
        </span>
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
                        setStep("details");
                        setSuccessMessage("");
                        setSubmitError("");
                      }}
                    />
                  ))}
                </div>
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
