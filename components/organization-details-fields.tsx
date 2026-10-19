import type { ChangeEvent } from "react"

import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"

export type OrganizationDetails = {
  organizationName: string
  addressLine1: string
  addressLine2: string
  city: string
  state: string
  postalCode: string
}

export const emptyOrganizationDetails: OrganizationDetails = {
  organizationName: "",
  addressLine1: "",
  addressLine2: "",
  city: "",
  state: "NY",
  postalCode: "",
}

export default function OrganizationDetailsFields({
  details,
  onChange,
  idPrefix = "",
  organizationNameError = "",
}: {
  details: OrganizationDetails
  onChange: (event: ChangeEvent<HTMLInputElement>) => void
  idPrefix?: string
  organizationNameError?: string
}) {
  const fieldId = (name: string) => `${idPrefix}${name}`

  return (
    <FieldGroup className="gap-4">
      <Field data-invalid={Boolean(organizationNameError)}>
        <FieldLabel
          className="drawer-field-label"
          htmlFor={fieldId("organization-name")}
        >
          Organization name
        </FieldLabel>
        <Input
          id={fieldId("organization-name")}
          name="organizationName"
          autoComplete="organization"
          value={details.organizationName}
          onChange={onChange}
          aria-invalid={Boolean(organizationNameError)}
          aria-describedby={
            organizationNameError
              ? fieldId("organization-name-error")
              : undefined
          }
          required
        />
        {organizationNameError && (
          <FieldError id={fieldId("organization-name-error")}>
            {organizationNameError}
          </FieldError>
        )}
      </Field>
      <FieldGroup className="gap-4">
        <Field>
          <FieldLabel
            className="drawer-field-label"
            htmlFor={fieldId("address-line-1")}
          >
            Address line 1
          </FieldLabel>
          <Input
            id={fieldId("address-line-1")}
            name="addressLine1"
            autoComplete="address-line1"
            value={details.addressLine1}
            onChange={onChange}
            required
          />
        </Field>
        <Field>
          <FieldLabel
            className="drawer-field-label"
            htmlFor={fieldId("address-line-2")}
          >
            Address line 2 (optional)
          </FieldLabel>
          <Input
            id={fieldId("address-line-2")}
            name="addressLine2"
            autoComplete="address-line2"
            value={details.addressLine2}
            onChange={onChange}
          />
        </Field>
        <Field>
          <FieldLabel className="drawer-field-label" htmlFor={fieldId("city")}>
            City
          </FieldLabel>
          <Input
            id={fieldId("city")}
            name="city"
            autoComplete="address-level2"
            value={details.city}
            onChange={onChange}
            required
          />
        </Field>
        <FieldGroup className="grid grid-cols-[minmax(0,1fr)_minmax(0,2fr)] gap-4">
          <Field>
            <FieldLabel
              className="drawer-field-label"
              htmlFor={fieldId("state")}
            >
              State
            </FieldLabel>
            <Input
              id={fieldId("state")}
              name="state"
              autoComplete="address-level1"
              value={details.state}
              maxLength={2}
              disabled
              required
            />
          </Field>
          <Field>
            <FieldLabel
              className="drawer-field-label"
              htmlFor={fieldId("postal-code")}
            >
              ZIP code
            </FieldLabel>
            <Input
              id={fieldId("postal-code")}
              name="postalCode"
              autoComplete="postal-code"
              inputMode="numeric"
              value={details.postalCode}
              onChange={onChange}
              required
            />
          </Field>
        </FieldGroup>
      </FieldGroup>
    </FieldGroup>
  )
}
