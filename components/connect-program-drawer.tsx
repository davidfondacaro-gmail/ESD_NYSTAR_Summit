"use client"

import { useEffect, useId, useRef, useState, type CSSProperties } from "react"
import { useRouter } from "next/navigation"
import { Info, Link, TriangleAlert } from "lucide-react"

import InnovationPartnerPicker, {
  type PartnerRegionGroup,
} from "@/components/innovation-partner-picker"
import NystarProgramTree, {
  type ProgramTreeGrouping,
} from "@/components/nystar-program-tree"
import OrganizationDetailsFields, {
  emptyOrganizationDetails,
  type OrganizationDetails,
} from "@/components/organization-details-fields"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
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
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
  FieldTitle,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Separator } from "@/components/ui/separator"
import { SIDEBAR_WIDTH } from "@/components/ui/sidebar"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "@/components/ui/toast"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { categoryColor } from "@/lib/nystar-category-colors"
import { normalizeOrganizationName } from "@/lib/organization-name"
import { existingConnectionTargets } from "@/lib/network-connections"
import { postalCodeError } from "@/lib/ny-zip-codes"
import type { RecentConnection } from "@/lib/recent-connection"
import type {
  NystarLocationGroup,
  NystarProgramConnection,
  NystarProgramGroup,
} from "@/lib/nystar-locations"

function ProgramType({ category }: { category: string }) {
  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      <span
        className="network-map-legend__star"
        style={{ "--marker-color": categoryColor(category) } as CSSProperties}
        aria-hidden="true"
      />
      <span>{category}</span>
    </div>
  )
}

type ProgramConnectionType = "Existing" | "Desired"

type FollowupDetails = {
  followupName: string
  followupEmail: string
  followupPhone: string
  followupComments: string
}

const emptyFollowup: FollowupDetails = {
  followupName: "",
  followupEmail: "",
  followupPhone: "",
  followupComments: "",
}

const followupEmailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const followupPhonePattern =
  /^(?:\+?1[\s.-]?)?(?:\([2-9]\d{2}\)|[2-9]\d{2})[\s.-]?[2-9]\d{2}[\s.-]?\d{4}$/

export default function ConnectProgramDrawer({
  programId,
  programName,
  categories,
  regions,
  partners,
  partnerRegionGroups,
  locations,
  programConnections,
  onStart,
  onSaved,
  open: openProp,
  onOpenChange,
}: {
  programId: string
  programName: string
  categories: NystarProgramGroup[]
  regions: NystarProgramGroup[]
  partners: string[]
  partnerRegionGroups: PartnerRegionGroup[]
  locations: NystarLocationGroup[]
  programConnections: NystarProgramConnection[]
  onStart?: () => void
  onSaved?: (connections: RecentConnection[]) => void
  open?: boolean
  onOpenChange?: (open: boolean) => void
}) {
  const id = useId()
  const router = useRouter()
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false)
  const open = openProp ?? uncontrolledOpen
  function setOpen(nextOpen: boolean) {
    setUncontrolledOpen(nextOpen)
    onOpenChange?.(nextOpen)
  }
  const [connectionType, setConnectionType] = useState("")
  const [targetProgramIds, setTargetProgramIds] = useState<Set<string>>(
    () => new Set()
  )
  const [programConnectionTypes, setProgramConnectionTypes] = useState<
    Map<string, ProgramConnectionType>
  >(() => new Map())
  const [treeGrouping, setTreeGrouping] = useState<ProgramTreeGrouping>("type")
  const [treeOpenGroups, setTreeOpenGroups] = useState<Set<string>>(
    () => new Set()
  )
  const [targetPartnerName, setTargetPartnerName] = useState("")
  const [connectionStatus, setConnectionStatus] = useState("")
  const [isReview, setIsReview] = useState(false)
  const [isAddingPartner, setIsAddingPartner] = useState(false)
  const [newPartner, setNewPartner] = useState<OrganizationDetails>(
    emptyOrganizationDetails
  )
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState("")
  const [followup, setFollowup] = useState<FollowupDetails>(emptyFollowup)
  const [followupTouched, setFollowupTouched] = useState({
    email: false,
    phone: false,
  })
  const isProgramConnection = connectionType === "nystar-to-nystar"
  const isDesired = isProgramConnection
    ? [...programConnectionTypes.values()].includes("Desired")
    : connectionStatus === "desired"
  const followupEmail = followup.followupEmail.trim()
  const followupPhone = followup.followupPhone.trim()
  const followupEmailInvalid =
    Boolean(followupEmail) && !followupEmailPattern.test(followupEmail)
  const followupPhoneInvalid =
    Boolean(followupPhone) && !followupPhonePattern.test(followupPhone)
  const followupEmailError =
    followupTouched.email && followupEmailInvalid
      ? "Enter a valid email address."
      : ""
  const followupPhoneError =
    followupTouched.phone && followupPhoneInvalid
      ? "Enter a valid phone number, with an optional 1 or +1 country code."
      : ""
  const titleRef = useRef<HTMLHeadingElement>(null)
  const allPrograms = categories.flatMap((group) => group.programs)
  const sourceProgram = allPrograms.find((program) => program.id === programId)
  const targetPrograms = allPrograms.filter((program) =>
    targetProgramIds.has(program.id)
  )
  const showConnectionStatus =
    connectionType === "nystar-to-partner" && Boolean(targetPartnerName)
  const hasConnectionStatus =
    connectionStatus === "existing" || connectionStatus === "desired"
  const newPartnerName = newPartner.organizationName.trim()
  const newPartnerNameTaken =
    Boolean(newPartnerName) &&
    partners.some(
      (partner) =>
        normalizeOrganizationName(partner) ===
        normalizeOrganizationName(newPartnerName)
    )
  const connectedTargets = existingConnectionTargets(
    programId,
    programConnections,
    locations
  )
  const duplicatePrograms = isProgramConnection
    ? targetPrograms.filter((program) =>
        connectedTargets.programIds.has(program.id)
      )
    : []
  const duplicatePartner =
    connectionType === "nystar-to-partner" &&
    !isAddingPartner &&
    connectedTargets.partnerNames.some(
      (name) =>
        normalizeOrganizationName(name) ===
        normalizeOrganizationName(targetPartnerName)
    )
  const duplicateWarning = duplicatePrograms.length > 0
    ? `Already connected: ${duplicatePrograms.map((program) => program.name).join("; ")}. Remove these selections to continue.`
    : duplicatePartner
    ? `A connection to ${targetPartnerName} already exists. Select a different organization.`
    : isAddingPartner && newPartnerNameTaken
      ? `An organization named "${newPartnerName}" already exists. Select it from the partner list instead.`
      : ""
  const newPartnerIsValid =
    Boolean(newPartnerName) &&
    !newPartnerNameTaken &&
    Boolean(newPartner.addressLine1.trim()) &&
    Boolean(newPartner.city.trim()) &&
    Boolean(newPartner.postalCode.trim()) &&
    !postalCodeError(newPartner.postalCode)
  const canReview = isProgramConnection
    ? targetPrograms.length > 0
    : hasConnectionStatus &&
      (isAddingPartner
        ? newPartnerIsValid
        : connectionType === "nystar-to-partner" && Boolean(targetPartnerName))
  const canSave =
    !isProgramConnection ||
    (targetPrograms.length > 0 &&
      targetPrograms.every((program) => programConnectionTypes.has(program.id)))

  useEffect(() => {
    titleRef.current?.focus()
  }, [isReview, isAddingPartner])

  function resetForm() {
    setConnectionType("")
    setTargetProgramIds(new Set())
    setProgramConnectionTypes(new Map())
    setTreeGrouping("type")
    setTreeOpenGroups(new Set())
    setTargetPartnerName("")
    setConnectionStatus("")
    setIsReview(false)
    setIsAddingPartner(false)
    setNewPartner(emptyOrganizationDetails)
    setSaveError("")
    setFollowup(emptyFollowup)
    setFollowupTouched({ email: false, phone: false })
  }

  function startAddingPartner() {
    setTargetPartnerName("")
    setConnectionStatus("")
    setIsAddingPartner(true)
  }

  function toggleTargetProgram(targetId: string, checked: boolean) {
    setTargetProgramIds((current) => {
      const next = new Set(current)
      if (checked) next.add(targetId)
      else next.delete(targetId)
      return next
    })
    if (!checked) {
      setProgramConnectionTypes((current) => {
        const next = new Map(current)
        next.delete(targetId)
        return next
      })
    }
  }

  function setProgramConnectionType(targetId: string, value: string[]) {
    const nextType = value[0]
    setProgramConnectionTypes((current) => {
      const next = new Map(current)
      if (nextType === "Existing" || nextType === "Desired") {
        next.set(targetId, nextType)
      } else {
        next.delete(targetId)
      }
      return next
    })
  }

  function updateFollowup(field: keyof FollowupDetails, value: string) {
    setFollowup((current) => ({ ...current, [field]: value }))
  }

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen && isSaving) return
    setOpen(nextOpen)
    if (nextOpen) onStart?.()
    if (!nextOpen) resetForm()
  }

  async function saveConnection() {
    if (duplicateWarning) {
      setSaveError(duplicateWarning)
      return
    }
    if (isDesired && (followupEmailInvalid || followupPhoneInvalid)) {
      setFollowupTouched({ email: true, phone: true })
      return
    }
    setIsSaving(true)
    setSaveError("")

    try {
      const status = isDesired ? "Desired" : "Existing"
      const isPartnerConnection = connectionType === "nystar-to-partner"
      const programTargets = targetPrograms.flatMap((program) => {
        const type = programConnectionTypes.get(program.id)
        return type ? [{ assetId: program.id, connectionType: type }] : []
      })
      const response = isPartnerConnection
        ? await fetch("/api/customer-locations", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              ...(isAddingPartner
                ? newPartner
                : { existingPartnerName: targetPartnerName }),
              ...(isDesired ? followup : {}),
              connections: [{ assetId: programId, connectionType: status }],
            }),
          })
        : await fetch("/api/nystar-connections", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              assetId1: programId,
              connections: programTargets,
              ...(isDesired ? followup : {}),
            }),
          })
      const result = (await response.json()) as {
        error?: string
        customerId?: string
      }
      if (!response.ok) {
        throw new Error(result.error ?? "Unable to save the connection.")
      }
      if (isPartnerConnection && result.customerId) {
        onSaved?.([
          {
            fromAssetId: programId,
            to: { kind: "partner", id: result.customerId },
            connectionType: status,
          },
        ])
      } else if (!isPartnerConnection) {
        onSaved?.(
          programTargets.map((target) => ({
            fromAssetId: programId,
            to: { kind: "asset", id: target.assetId },
            connectionType: target.connectionType,
          }))
        )
      }
      toast.add({
        title:
          !isPartnerConnection && programTargets.length > 1
            ? "Connections added, thanks!"
            : "Connection added, thanks!",
        type: "success",
      })
      setIsSaving(false)
      setOpen(false)
      resetForm()
      router.refresh()
    } catch (error) {
      setSaveError(
        error instanceof Error
          ? error.message
          : "Unable to save the connection."
      )
      setIsSaving(false)
    }
  }

  function connectionStatusFields(step: string) {
    return (
      <FieldSet className="min-w-0">
        <FieldLegend id={`${id}-connection-status`} variant="label">
          {step}. Connection status
        </FieldLegend>
        <RadioGroup
          aria-labelledby={`${id}-connection-status`}
          value={connectionStatus}
          onValueChange={setConnectionStatus}
        >
          <Field orientation="horizontal">
            <RadioGroupItem id={`${id}-existing`} value="existing" />
            <FieldLabel htmlFor={`${id}-existing`}>
              This is a past/existing connection
            </FieldLabel>
          </Field>
          <Field orientation="horizontal">
            <RadioGroupItem id={`${id}-desired`} value="desired" />
            <FieldLabel htmlFor={`${id}-desired`}>
              This is a new/desired connection
            </FieldLabel>
          </Field>
        </RadioGroup>
      </FieldSet>
    )
  }

  return (
    <Drawer swipeDirection="right" open={open} onOpenChange={handleOpenChange}>
      <DrawerTrigger
        render={
          <Button
            type="button"
            variant="brand-link"
            size="inline"
            className="gap-1.5 self-start"
          />
        }
      >
        <Link data-icon="inline-start" />
        Connect With This Program
      </DrawerTrigger>
      <DrawerContent style={{ width: SIDEBAR_WIDTH }}>
        <DrawerHeader className="relative px-6 pt-7 pb-5">
          <DrawerTitle ref={titleRef} tabIndex={-1}>
            {isReview
              ? isProgramConnection && targetPrograms.length > 1
                ? "Review Connections"
                : "Review Connection"
              : isAddingPartner
                ? "Add a Partner"
                : "Connect to NYSTAR Program"}
          </DrawerTitle>
          <DrawerDescription>
            {isReview
              ? isProgramConnection
                ? "Set the status of each connection before saving."
                : "Review the connection before saving."
              : programName}
          </DrawerDescription>
          {!isReview && !isAddingPartner && sourceProgram && (
            <ProgramType category={sourceProgram.category} />
          )}
        </DrawerHeader>
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          <FieldGroup
            className={isReview || isAddingPartner ? "hidden" : undefined}
          >
            <FieldSet className="min-w-0">
              <FieldLegend id={`${id}-connection-type`} variant="label">
                1. Connection type
              </FieldLegend>
              <RadioGroup
                aria-labelledby={`${id}-connection-type`}
                value={connectionType}
                onValueChange={(value) => {
                  setConnectionType(value)
                  if (value !== connectionType) setConnectionStatus("")
                }}
              >
                <Field orientation="horizontal">
                  <RadioGroupItem
                    id={`${id}-nystar`}
                    value="nystar-to-nystar"
                  />
                  <FieldLabel htmlFor={`${id}-nystar`}>
                    NYSTAR to NYSTAR Connection
                  </FieldLabel>
                </Field>
                <Field orientation="horizontal">
                  <RadioGroupItem
                    id={`${id}-partner`}
                    value="nystar-to-partner"
                  />
                  <FieldLabel htmlFor={`${id}-partner`}>
                    NYSTAR to Partner Connection
                  </FieldLabel>
                </Field>
              </RadioGroup>
            </FieldSet>
            {connectionType === "nystar-to-nystar" && (
              <FieldSet className="min-w-0">
                <FieldLegend id={`${id}-target-program`} variant="label">
                  2. Select NYSTAR Programs
                </FieldLegend>
                <NystarProgramTree
                  categories={categories}
                  regions={regions}
                  selectedIds={targetProgramIds}
                  onToggle={toggleTargetProgram}
                  groupingMode={treeGrouping}
                  onGroupingModeChange={setTreeGrouping}
                  openGroups={treeOpenGroups}
                  onOpenGroupsChange={setTreeOpenGroups}
                  connectedIds={connectedTargets.programIds}
                  disabledIds={new Set([programId])}
                  disabledNote="This is the program you're connecting from"
                  idPrefix={`${id}-target-`}
                />
              </FieldSet>
            )}
            {connectionType === "nystar-to-partner" && (
              <FieldSet className="min-w-0">
                <FieldLegend id={`${id}-target-partner`} variant="label">
                  2. Select or Add a Partner
                </FieldLegend>
                <InnovationPartnerPicker
                  partners={partners}
                  regionGroups={partnerRegionGroups}
                  labelledBy={`${id}-target-partner`}
                  value={targetPartnerName}
                  visibleRows={9}
                  onValueChange={(value) => {
                    setTargetPartnerName(value)
                    if (value !== targetPartnerName) setConnectionStatus("")
                  }}
                />
                <Alert>
                  <Info aria-hidden="true" />
                  <AlertDescription>
                    Partner organization not in the list?{" "}
                    <Button
                      type="button"
                      variant="brand-link"
                      size="inline"
                      onClick={startAddingPartner}
                    >
                      Add a new one
                    </Button>
                    .
                  </AlertDescription>
                </Alert>
              </FieldSet>
            )}
            {showConnectionStatus && connectionStatusFields("3")}
          </FieldGroup>
          {isAddingPartner && !isReview && (
            <FieldGroup>
              <FieldSet className="min-w-0">
                <FieldLegend variant="label">
                  3. Partner organization
                </FieldLegend>
                <OrganizationDetailsFields
                  details={newPartner}
                  idPrefix={`${id}-new-partner-`}
                  organizationNameError={
                    newPartnerNameTaken
                      ? `An organization named "${newPartnerName}" already exists. Select it from the partner list instead.`
                      : ""
                  }
                  onChange={(event) => {
                    const { name, value } = event.currentTarget
                    setNewPartner((current) => ({ ...current, [name]: value }))
                  }}
                />
              </FieldSet>
              {connectionStatusFields("4")}
            </FieldGroup>
          )}
          {isReview && (
            <div className="flex flex-col gap-5">
              <div className="flex flex-col gap-1 break-words">
                <div className="flex flex-col gap-1">
                  <p>{programName}</p>
                  {sourceProgram && (
                    <ProgramType category={sourceProgram.category} />
                  )}
                </div>
                <div className="my-3 flex items-center">
                  <div className="w-7 shrink-0">
                    <Separator />
                  </div>
                  <span className="rounded-sm bg-muted px-2 py-1 text-sm text-foreground">
                    and
                  </span>
                  <Separator className="min-w-0 flex-1" />
                </div>
                {isProgramConnection && (
                  <ol className="list-decimal pl-6 marker:text-muted-foreground">
                    {targetPrograms.map((program) => (
                      <li key={program.id} className="pl-1">
                        <Field className="flex-row flex-wrap items-center justify-between gap-3 border-b border-border py-3 last:border-b-0">
                          <div className="flex min-w-0 flex-col gap-1">
                            <p>{program.name}</p>
                            <ProgramType category={program.category} />
                          </div>
                          <ToggleGroup
                            aria-label={`Connection status for ${program.name}`}
                            value={
                              programConnectionTypes.has(program.id)
                                ? [programConnectionTypes.get(program.id)!]
                                : []
                            }
                            onValueChange={(value) =>
                              setProgramConnectionType(program.id, value)
                            }
                            disabled={isSaving}
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
                )}
                {connectionType === "nystar-to-partner" && (
                  <div className="flex flex-col gap-1">
                    <p>
                      {isAddingPartner
                        ? newPartner.organizationName.trim()
                        : targetPartnerName}
                    </p>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <span
                        className="network-map-legend__dot shrink-0"
                        aria-hidden="true"
                      />
                      <span>Innovation Partner</span>
                    </div>
                    {isAddingPartner && (
                      <p className="text-sm text-muted-foreground">
                        {newPartner.addressLine1.trim()}
                        {newPartner.addressLine2.trim() &&
                          `, ${newPartner.addressLine2.trim()}`}
                        <br />
                        {newPartner.city.trim()}, NY{" "}
                        {newPartner.postalCode.trim()}
                      </p>
                    )}
                  </div>
                )}
              </div>
              {!isProgramConnection && (
                <>
                  <Separator />
                  <p>
                    {connectionStatus === "existing"
                      ? "This is a past/existing connection."
                      : "This is a new/desired connection."}
                  </p>
                </>
              )}
              {isDesired && (
                <FieldGroup className="gap-4 border-t border-border pt-4">
                  <div>
                    <FieldTitle className="drawer-review-heading">
                      Follow-up contact
                    </FieldTitle>
                    <FieldDescription className="drawer-review-copy">
                      All fields are optional.
                    </FieldDescription>
                  </div>
                  <Field>
                    <FieldLabel
                      className="drawer-field-label"
                      htmlFor={`${id}-followup-name`}
                    >
                      Contact name
                    </FieldLabel>
                    <Input
                      id={`${id}-followup-name`}
                      name="followupName"
                      autoComplete="name"
                      value={followup.followupName}
                      disabled={isSaving}
                      onChange={(event) =>
                        updateFollowup(
                          "followupName",
                          event.currentTarget.value
                        )
                      }
                    />
                  </Field>
                  <Field data-invalid={Boolean(followupEmailError)}>
                    <FieldLabel
                      className="drawer-field-label"
                      htmlFor={`${id}-followup-email`}
                    >
                      Email
                    </FieldLabel>
                    <Input
                      id={`${id}-followup-email`}
                      name="followupEmail"
                      type="email"
                      autoComplete="email"
                      value={followup.followupEmail}
                      disabled={isSaving}
                      aria-invalid={Boolean(followupEmailError)}
                      aria-describedby={
                        followupEmailError
                          ? `${id}-followup-email-error`
                          : undefined
                      }
                      onBlur={() =>
                        setFollowupTouched((current) => ({
                          ...current,
                          email: true,
                        }))
                      }
                      onChange={(event) =>
                        updateFollowup(
                          "followupEmail",
                          event.currentTarget.value
                        )
                      }
                    />
                    {followupEmailError && (
                      <FieldDescription
                        id={`${id}-followup-email-error`}
                        className="text-destructive"
                        role="alert"
                      >
                        {followupEmailError}
                      </FieldDescription>
                    )}
                  </Field>
                  <Field data-invalid={Boolean(followupPhoneError)}>
                    <FieldLabel
                      className="drawer-field-label"
                      htmlFor={`${id}-followup-phone`}
                    >
                      Phone
                    </FieldLabel>
                    <Input
                      id={`${id}-followup-phone`}
                      name="followupPhone"
                      type="tel"
                      autoComplete="tel"
                      value={followup.followupPhone}
                      disabled={isSaving}
                      aria-invalid={Boolean(followupPhoneError)}
                      aria-describedby={
                        followupPhoneError
                          ? `${id}-followup-phone-error`
                          : undefined
                      }
                      onBlur={() =>
                        setFollowupTouched((current) => ({
                          ...current,
                          phone: true,
                        }))
                      }
                      onChange={(event) =>
                        updateFollowup(
                          "followupPhone",
                          event.currentTarget.value
                        )
                      }
                    />
                    {followupPhoneError && (
                      <FieldDescription
                        id={`${id}-followup-phone-error`}
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
                      htmlFor={`${id}-followup-comments`}
                    >
                      Comments
                    </FieldLabel>
                    <Textarea
                      id={`${id}-followup-comments`}
                      name="followupComments"
                      rows={4}
                      value={followup.followupComments}
                      disabled={isSaving}
                      onChange={(event) =>
                        updateFollowup(
                          "followupComments",
                          event.currentTarget.value
                        )
                      }
                    />
                  </Field>
                </FieldGroup>
              )}
              {saveError && (
                <p className="text-sm text-destructive" role="alert">
                  {saveError}
                </p>
              )}
            </div>
          )}
        </div>
        <DrawerFooter className="px-6 pt-4 pb-6">
          {duplicateWarning && (
            <Alert variant="warning">
              <TriangleAlert aria-hidden="true" />
              <AlertDescription>{duplicateWarning}</AlertDescription>
            </Alert>
          )}
          <div className="flex flex-wrap items-center justify-end gap-2">
            <DrawerClose
              render={
                <Button type="button" variant="outline" disabled={isSaving} />
              }
            >
              Cancel
            </DrawerClose>
            {isReview ? (
              <>
                <Button
                  type="button"
                  variant="outline"
                  disabled={isSaving}
                  onClick={() => setIsReview(false)}
                >
                  Back
                </Button>
                <Button
                  type="button"
                  variant="brand"
                  disabled={isSaving || !canSave || Boolean(duplicateWarning)}
                  onClick={() => void saveConnection()}
                >
                  {isSaving
                    ? "Saving…"
                    : isProgramConnection && targetPrograms.length > 1
                      ? "Save Connections"
                      : "Save Connection"}
                </Button>
              </>
            ) : (
              <>
                {isAddingPartner && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setConnectionStatus("")
                      setIsAddingPartner(false)
                    }}
                  >
                    Back
                  </Button>
                )}
                <Button
                  type="button"
                  variant="brand"
                  disabled={!canReview || Boolean(duplicateWarning)}
                  onClick={() => setIsReview(true)}
                >
                  Next
                </Button>
              </>
            )}
          </div>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  )
}
