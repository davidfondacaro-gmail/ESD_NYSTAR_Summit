"use client"

import { useRouter } from "next/navigation"
import { useState, type ChangeEvent, type FormEvent } from "react"
import { ChevronRight, Plus, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer"
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldTitle,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import type { NystarProgramGroup } from "@/lib/nystar-locations"

type GroupingMode = "type" | "region"
type ConnectionType = "Existing" | "Desired"

type ConnectionDetails = {
  organizationName: string
  addressLine1: string
  addressLine2: string
  city: string
  state: string
  postalCode: string
}

type FollowupDetails = {
  followupName: string
  followupEmail: string
  followupPhone: string
  followupComments: string
}

type FollowupField = keyof FollowupDetails

const followupEmailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const followupPhonePattern =
  /^(?:\+?1[\s.-]?)?(?:\([2-9]\d{2}\)|[2-9]\d{2})[\s.-]?[2-9]\d{2}[\s.-]?\d{4}$/

export default function AddConnectionsDrawer({
  categories,
  regions,
}: {
  categories: NystarProgramGroup[]
  regions: NystarProgramGroup[]
}) {
  const router = useRouter()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [groupingMode, setGroupingMode] = useState<GroupingMode>("type")
  const [details, setDetails] = useState<ConnectionDetails>({
    organizationName: "",
    addressLine1: "",
    addressLine2: "",
    city: "",
    state: "NY",
    postalCode: "",
  })
  const [followupDetails, setFollowupDetails] = useState<FollowupDetails>({
    followupName: "",
    followupEmail: "",
    followupPhone: "",
    followupComments: "",
  })
  const [followupTouched, setFollowupTouched] = useState<
    Partial<Record<FollowupField, boolean>>
  >({})
  const [selectedPrograms, setSelectedPrograms] = useState<Set<string>>(
    () => new Set()
  )
  const [connectionTypes, setConnectionTypes] = useState<
    Map<string, ConnectionType>
  >(() => new Map())
  const [openCategories, setOpenCategories] = useState<Set<string>>(
    () => new Set()
  )
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [hasSubmitted, setHasSubmitted] = useState(false)
  const [formError, setFormError] = useState("")
  const [formMessage, setFormMessage] = useState("")

  function resetForm() {
    setStep(1)
    setGroupingMode("type")
    setDetails({
      organizationName: "",
      addressLine1: "",
      addressLine2: "",
      city: "",
      state: "NY",
      postalCode: "",
    })
    setFollowupDetails({
      followupName: "",
      followupEmail: "",
      followupPhone: "",
      followupComments: "",
    })
    setFollowupTouched({})
    setSelectedPrograms(new Set())
    setConnectionTypes(new Map())
    setOpenCategories(new Set())
    setIsSubmitting(false)
    setHasSubmitted(false)
    setFormError("")
    setFormMessage("")
  }

  function updateDetails(event: ChangeEvent<HTMLInputElement>) {
    const { name, value } = event.currentTarget
    setDetails((current) => ({ ...current, [name]: value }))
  }

  function updateFollowupDetail(field: keyof FollowupDetails, value: string) {
    setFollowupDetails((current) => ({ ...current, [field]: value }))
  }

  function touchFollowupField(field: FollowupField) {
    setFollowupTouched((current) => ({ ...current, [field]: true }))
  }

  function handleFormSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFormError("")
    if (step === 1) {
      setStep(2)
    } else if (step === 2) {
      setStep(3)
    } else {
      touchFollowupField("followupEmail")
      touchFollowupField("followupPhone")
      const email = followupDetails.followupEmail.trim()
      const phone = followupDetails.followupPhone.trim()
      if (
        (email && !followupEmailPattern.test(email)) ||
        (phone && !followupPhonePattern.test(phone))
      ) {
        return
      }
      void submitConnection()
    }
  }

  async function submitConnection() {
    setIsSubmitting(true)
    setFormError("")

    try {
      const response = await fetch("/api/customer-locations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...details,
          ...(hasDesiredConnection ? followupDetails : {}),
          connections: [...selectedPrograms].map((assetId) => ({
            assetId,
            connectionType: connectionTypes.get(assetId),
          })),
        }),
      })
      const result = (await response.json()) as { error?: string }

      if (!response.ok) {
        throw new Error(result.error ?? "Unable to save this connection.")
      }

      setHasSubmitted(true)
      setFormMessage(`${details.organizationName} was added to the network.`)
      router.refresh()
    } catch (error) {
      setFormError(
        error instanceof Error
          ? error.message
          : "Unable to save this connection."
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  function toggleProgram(
    programId: string,
    checked: boolean | "indeterminate"
  ) {
    setSelectedPrograms((current) => {
      const next = new Set(current)
      if (checked === true) {
        next.add(programId)
      } else {
        next.delete(programId)
      }
      return next
    })
    if (checked !== true) {
      setConnectionTypes((current) => {
        const next = new Map(current)
        next.delete(programId)
        return next
      })
    }
  }

  function setConnectionType(programId: string, value: string[]) {
    const connectionType = value[0]
    setConnectionTypes((current) => {
      const next = new Map(current)
      if (connectionType === "Existing" || connectionType === "Desired") {
        next.set(programId, connectionType)
      } else {
        next.delete(programId)
      }
      return next
    })
  }

  const canSubmit =
    selectedPrograms.size > 0 &&
    [...selectedPrograms].every((programId) => connectionTypes.has(programId))
  const hasDesiredConnection = [...selectedPrograms].some(
    (programId) => connectionTypes.get(programId) === "Desired"
  )
  const followupEmailError =
    followupTouched.followupEmail &&
    followupDetails.followupEmail.trim() &&
    !followupEmailPattern.test(followupDetails.followupEmail.trim())
      ? "Enter a valid email address."
      : ""
  const followupPhoneError =
    followupTouched.followupPhone &&
    followupDetails.followupPhone.trim() &&
    !followupPhonePattern.test(followupDetails.followupPhone.trim())
      ? "Enter a valid phone number, with an optional 1 or +1 country code."
      : ""
  const selectedProgramDetails = categories
    .flatMap((group) => group.programs)
    .filter((program) => selectedPrograms.has(program.id))

  function toggleCategory(categoryName: string, open: boolean) {
    setOpenCategories((current) => {
      const next = new Set(current)
      if (open) {
        next.add(categoryName)
      } else {
        next.delete(categoryName)
      }
      return next
    })
  }

  return (
    <Drawer
      open={drawerOpen}
      onOpenChange={(open) => {
        setDrawerOpen(open)
        if (!open) resetForm()
      }}
      swipeDirection="right"
    >
      <DrawerTrigger
        render={
          <Button
            variant="brand"
            size="lg"
            className="network-add-trigger w-full justify-between"
          />
        }
      >
        Add Your Connections
        <Plus aria-hidden="true" data-icon="inline-end" />
      </DrawerTrigger>
      <DrawerContent className="w-[min(30rem,92vw)]">
        <DrawerHeader className="relative px-6 pt-7 pb-5">
          <DrawerTitle className="text-lg">Add Your Connections</DrawerTitle>
          <DrawerDescription>
            {step === 1
              ? "Step 1 of 3 · Enter the organization and its address."
              : step === 2
                ? "Step 2 of 3 · Select NYSTAR locations."
                : "Step 3 of 3 · Review and add follow-up contact details."}
          </DrawerDescription>
          <DrawerClose
            render={
              <Button
                variant="ghost"
                size="icon"
                className="absolute top-3 right-4"
                aria-label="Close drawer"
              />
            }
          >
            <X aria-hidden="true" />
          </DrawerClose>
        </DrawerHeader>
        <form
          className="flex min-h-0 flex-1 flex-col"
          onSubmit={handleFormSubmit}
        >
          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
            {step === 1 ? (
              <FieldGroup className="gap-4">
                <Field>
                  <FieldLabel
                    className="drawer-field-label"
                    htmlFor="organization-name"
                  >
                    Organization name
                  </FieldLabel>
                  <Input
                    id="organization-name"
                    name="organizationName"
                    autoComplete="organization"
                    value={details.organizationName}
                    onChange={updateDetails}
                    required
                  />
                </Field>
                <FieldGroup className="gap-4">
                  <Field>
                    <FieldLabel
                      className="drawer-field-label"
                      htmlFor="address-line-1"
                    >
                      Address line 1
                    </FieldLabel>
                    <Input
                      id="address-line-1"
                      name="addressLine1"
                      autoComplete="address-line1"
                      value={details.addressLine1}
                      onChange={updateDetails}
                      required
                    />
                  </Field>
                  <Field>
                    <FieldLabel
                      className="drawer-field-label"
                      htmlFor="address-line-2"
                    >
                      Address line 2 (optional)
                    </FieldLabel>
                    <Input
                      id="address-line-2"
                      name="addressLine2"
                      autoComplete="address-line2"
                      value={details.addressLine2}
                      onChange={updateDetails}
                    />
                  </Field>
                  <Field>
                    <FieldLabel className="drawer-field-label" htmlFor="city">
                      City
                    </FieldLabel>
                    <Input
                      id="city"
                      name="city"
                      autoComplete="address-level2"
                      value={details.city}
                      onChange={updateDetails}
                      required
                    />
                  </Field>
                  <FieldGroup className="grid grid-cols-[minmax(0,1fr)_minmax(0,2fr)] gap-4">
                    <Field>
                      <FieldLabel
                        className="drawer-field-label"
                        htmlFor="state"
                      >
                        State
                      </FieldLabel>
                      <Input
                        id="state"
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
                        htmlFor="postal-code"
                      >
                        ZIP code
                      </FieldLabel>
                      <Input
                        id="postal-code"
                        name="postalCode"
                        autoComplete="postal-code"
                        inputMode="numeric"
                        value={details.postalCode}
                        onChange={updateDetails}
                        required
                      />
                    </Field>
                  </FieldGroup>
                </FieldGroup>
              </FieldGroup>
            ) : step === 2 ? (
              <FieldGroup className="gap-3">
                <div className="flex w-full items-center justify-between gap-3">
                  <ToggleGroup
                    aria-label="Organize by"
                    value={[groupingMode]}
                    onValueChange={(value) => {
                      const nextMode = value[0]
                      if (nextMode === "type" || nextMode === "region") {
                        setGroupingMode(nextMode)
                        setOpenCategories(new Set())
                      }
                    }}
                    variant="outline"
                    size="sm"
                    spacing={0}
                  >
                    <ToggleGroupItem
                      className="drawer-review-control"
                      value="type"
                    >
                      Program Type
                    </ToggleGroupItem>
                    <Tooltip>
                      <ToggleGroupItem
                        className="drawer-review-control"
                        value="region"
                        render={<TooltipTrigger />}
                      >
                        ESD Region
                      </ToggleGroupItem>
                      <TooltipContent>Empire State Development regions</TooltipContent>
                    </Tooltip>
                  </ToggleGroup>
                  <p className="shrink-0 text-right text-sm text-muted-foreground">
                    {selectedPrograms.size} selected
                  </p>
                </div>
                <ul className="flex flex-col gap-2">
                  {(groupingMode === "type" ? categories : regions).map(
                    (group) => {
                      const open = openCategories.has(group.name)
                      return (
                        <li key={`${groupingMode}-${group.name}`}>
                          <Collapsible
                            open={open}
                            onOpenChange={(nextOpen) =>
                              toggleCategory(group.name, nextOpen)
                            }
                            className="rounded-md border border-border"
                          >
                            <CollapsibleTrigger
                              render={
                                <Button
                                  type="button"
                                  variant="ghost"
                                  className="h-auto min-h-8 w-full justify-start gap-2 px-3 py-3 text-left whitespace-normal"
                                />
                              }
                            >
                              <ChevronRight
                                aria-hidden="true"
                                className={`shrink-0 transition-transform ${open ? "rotate-90" : ""}`}
                                data-icon="inline-start"
                              />
                              <span>{groupingMode === "region" ? `- ${group.name}` : group.name}</span>
                              <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                                {group.programs.length}
                              </span>
                            </CollapsibleTrigger>
                            <CollapsibleContent className="border-t border-border px-3 py-2">
                              <FieldGroup className="gap-1">
                                {group.programs.map((program) => (
                                  <Field
                                    key={program.id}
                                    orientation="horizontal"
                                    className="items-start gap-3 rounded-sm py-2"
                                  >
                                    <Checkbox
                                      id={program.id}
                                      checked={selectedPrograms.has(program.id)}
                                      onCheckedChange={(checked) =>
                                        toggleProgram(program.id, checked)
                                      }
                                    />
                                    <FieldContent>
                                      <FieldLabel
                                        htmlFor={program.id}
                                        className="cursor-pointer drawer-field-label"
                                      >
                                        {program.name}
                                      </FieldLabel>
                                      {program.details && (
                                        <FieldDescription className="text-xs">
                                          {groupingMode === "region"
                                            ? `${program.category} · ${program.details}`
                                            : program.details}
                                        </FieldDescription>
                                      )}
                                    </FieldContent>
                                  </Field>
                                ))}
                              </FieldGroup>
                            </CollapsibleContent>
                          </Collapsible>
                        </li>
                      )
                    }
                  )}
                </ul>
              </FieldGroup>
            ) : (
              <FieldGroup className="gap-5">
                <section className="flex flex-col gap-1 border-b border-border pb-4">
                  <FieldTitle className="drawer-review-heading">
                    Organization
                  </FieldTitle>
                  <p className="drawer-review-copy">
                    {details.organizationName}
                  </p>
                  <p className="drawer-review-copy">
                    {details.addressLine1}
                    {details.addressLine2 && `, ${details.addressLine2}`}
                    <br />
                    {details.city}, NY {details.postalCode}
                  </p>
                </section>

                <FieldGroup className="gap-2">
                  <div className="flex items-baseline gap-2">
                    <FieldTitle className="drawer-review-heading">
                      Selected connections
                    </FieldTitle>
                    <span className="drawer-review-copy">
                      ({selectedProgramDetails.length})
                    </span>
                  </div>
                  <ol className="list-decimal pl-6 marker:text-muted-foreground">
                    {selectedProgramDetails.map((program) => (
                      <li key={program.id} className="pl-1">
                        <Field className="flex-row flex-wrap items-center justify-between gap-3 border-b border-border py-3 last:border-b-0">
                          <FieldContent>
                            <FieldLabel className="drawer-field-label">
                              {program.name}
                            </FieldLabel>
                            {program.details && (
                              <FieldDescription className="drawer-review-copy">
                                {program.details}
                              </FieldDescription>
                            )}
                          </FieldContent>
                          <ToggleGroup
                            aria-label={`Connection type for ${program.name}`}
                            value={
                              connectionTypes.has(program.id)
                                ? [connectionTypes.get(program.id)!]
                                : []
                            }
                            onValueChange={(value) =>
                              setConnectionType(program.id, value)
                            }
                            variant="outline"
                            size="sm"
                            spacing={0}
                          >
                            <ToggleGroupItem
                              className="drawer-review-control"
                              value="Existing"
                            >
                              Existing
                            </ToggleGroupItem>
                            <ToggleGroupItem
                              className="drawer-review-control"
                              value="Desired"
                            >
                              Desired
                            </ToggleGroupItem>
                          </ToggleGroup>
                        </Field>
                      </li>
                    ))}
                  </ol>
                </FieldGroup>

                {hasDesiredConnection && (
                  <FieldGroup className="gap-4 border-t border-border pt-4">
                    <div>
                      <FieldTitle className="drawer-review-heading">
                        Follow-up contact
                      </FieldTitle>
                      <FieldDescription className="drawer-review-copy">
                        Shared for all connections marked Desired. All fields
                        are optional.
                      </FieldDescription>
                    </div>
                    <Field>
                      <FieldLabel
                        className="drawer-field-label"
                        htmlFor="followup-name"
                      >
                        Contact name
                      </FieldLabel>
                      <Input
                        id="followup-name"
                        name="followupName"
                        autoComplete="name"
                        value={followupDetails.followupName}
                        onChange={(event) =>
                          updateFollowupDetail(
                            "followupName",
                            event.currentTarget.value
                          )
                        }
                      />
                    </Field>
                    <Field>
                      <FieldLabel
                        className="drawer-field-label"
                        htmlFor="followup-email"
                      >
                        Email
                      </FieldLabel>
                      <Input
                        id="followup-email"
                        name="followupEmail"
                        type="email"
                        autoComplete="email"
                        value={followupDetails.followupEmail}
                        aria-invalid={Boolean(followupEmailError)}
                        aria-describedby={
                          followupEmailError
                            ? "followup-email-error"
                            : undefined
                        }
                        onBlur={() => touchFollowupField("followupEmail")}
                        onInvalid={() => touchFollowupField("followupEmail")}
                        onChange={(event) =>
                          updateFollowupDetail(
                            "followupEmail",
                            event.currentTarget.value
                          )
                        }
                      />
                      {followupEmailError && (
                        <FieldDescription
                          id="followup-email-error"
                          className="text-destructive"
                          role="alert"
                        >
                          {followupEmailError}
                        </FieldDescription>
                      )}
                    </Field>
                    <Field>
                      <FieldLabel
                        className="drawer-field-label"
                        htmlFor="followup-phone"
                      >
                        Phone
                      </FieldLabel>
                      <Input
                        id="followup-phone"
                        name="followupPhone"
                        type="tel"
                        autoComplete="tel"
                        value={followupDetails.followupPhone}
                        aria-invalid={Boolean(followupPhoneError)}
                        aria-describedby={
                          followupPhoneError
                            ? "followup-phone-error"
                            : undefined
                        }
                        onBlur={() => touchFollowupField("followupPhone")}
                        onChange={(event) =>
                          updateFollowupDetail(
                            "followupPhone",
                            event.currentTarget.value
                          )
                        }
                      />
                      {followupPhoneError && (
                        <FieldDescription
                          id="followup-phone-error"
                          className="text-destructive"
                          role="alert"
                        >
                          {followupPhoneError}
                        </FieldDescription>
                      )}
                    </Field>
                    <Field>
                      <FieldLabel
                        className="drawer-field-label"
                        htmlFor="followup-comments"
                      >
                        Comments
                      </FieldLabel>
                      <Textarea
                        id="followup-comments"
                        name="followupComments"
                        rows={4}
                        value={followupDetails.followupComments}
                        onChange={(event) =>
                          updateFollowupDetail(
                            "followupComments",
                            event.currentTarget.value
                          )
                        }
                      />
                    </Field>
                  </FieldGroup>
                )}
              </FieldGroup>
            )}
          </div>
          {formError && (
            <p className="px-6 pt-3 text-sm text-destructive" role="alert">
              {formError}
            </p>
          )}
          {formMessage && (
            <p className="px-6 pt-3 text-sm text-foreground" role="status">
              {formMessage}
            </p>
          )}
          <DrawerFooter className="flex-row justify-end gap-3 border-t px-6 py-4 pt-4">
            <DrawerClose
              render={
                <Button
                  type="button"
                  variant="secondary"
                  size="lg"
                  className="min-w-24"
                />
              }
            >
              Cancel
            </DrawerClose>
            {step === 1 ? (
              <Button
                type="submit"
                variant="brand"
                size="lg"
                className="min-w-24"
              >
                Next
              </Button>
            ) : step === 2 ? (
              <>
                <Button
                  type="button"
                  variant="secondary"
                  size="lg"
                  className="min-w-24"
                  onClick={() => setStep(1)}
                  disabled={isSubmitting || hasSubmitted}
                >
                  Back
                </Button>
                <Button
                  type="submit"
                  variant="brand"
                  size="lg"
                  className="min-w-24"
                  disabled={
                    selectedPrograms.size === 0 || isSubmitting || hasSubmitted
                  }
                >
                  Next
                </Button>
              </>
            ) : (
              <>
                <Button
                  type="button"
                  variant="secondary"
                  size="lg"
                  className="min-w-24"
                  onClick={() => setStep(2)}
                  disabled={isSubmitting || hasSubmitted}
                >
                  Back
                </Button>
                <Button
                  type="submit"
                  variant="brand"
                  size="lg"
                  className="min-w-24"
                  disabled={!canSubmit || isSubmitting || hasSubmitted}
                >
                  {isSubmitting ? "Saving…" : hasSubmitted ? "Added" : "Submit"}
                </Button>
              </>
            )}
          </DrawerFooter>
        </form>
      </DrawerContent>
    </Drawer>
  )
}
