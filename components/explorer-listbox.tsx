"use client"

import { Fragment, useEffect, useId, useRef, useState } from "react"

type ExplorerListboxOption = {
  value: string
  label: string
  group?: string
}

export default function ExplorerListbox({
  labelledBy,
  options,
  value,
  visibleRows,
  onValueChange,
}: {
  labelledBy: string
  options: ExplorerListboxOption[]
  value: string
  visibleRows: number
  onValueChange: (value: string) => void
}) {
  const listboxId = useId()
  const listboxRef = useRef<HTMLDivElement>(null)
  const optionRefs = useRef(new Map<string, HTMLDivElement>())
  const typeahead = useRef("")
  const typeaheadTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [activeValue, setActiveValue] = useState(
    value || options[0]?.value || ""
  )
  const activeIndex = options.findIndex(
    (option) => option.value === activeValue
  )
  const selectedIndex = options.findIndex((option) => option.value === value)
  const resolvedActiveIndex =
    activeIndex >= 0 ? activeIndex : Math.max(selectedIndex, 0)
  const activeOption = options[resolvedActiveIndex]
  const activeOptionValue = activeOption?.value
  const optionKey = options.map((option) => option.value).join("\0")
  const groupedOptions = options.reduce<
    { label?: string; options: ExplorerListboxOption[] }[]
  >((groups, option) => {
    const lastGroup = groups[groups.length - 1]
    if (lastGroup && lastGroup.label === option.group) {
      lastGroup.options.push(option)
    } else {
      groups.push({ label: option.group, options: [option] })
    }
    return groups
  }, [])

  useEffect(() => {
    if (activeOptionValue) {
      optionRefs.current
        .get(activeOptionValue)
        ?.scrollIntoView({ block: "nearest" })
    }
  }, [activeOptionValue, optionKey])

  function selectAt(index: number) {
    const nextOption = options[Math.max(0, Math.min(index, options.length - 1))]
    if (!nextOption) return
    setActiveValue(nextOption.value)
    onValueChange(nextOption.value)
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault()
      selectAt(resolvedActiveIndex + (event.key === "ArrowDown" ? 1 : -1))
      return
    }
    if (event.key === "Home" || event.key === "End") {
      event.preventDefault()
      selectAt(event.key === "Home" ? 0 : options.length - 1)
      return
    }
    if (event.key === "PageDown" || event.key === "PageUp") {
      event.preventDefault()
      const offset = event.key === "PageDown" ? visibleRows : -visibleRows
      selectAt(resolvedActiveIndex + offset)
      return
    }
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault()
      if (activeOption) onValueChange(activeOption.value)
      return
    }
    if (
      event.key.length !== 1 ||
      event.key === " " ||
      event.altKey ||
      event.ctrlKey ||
      event.metaKey
    ) {
      return
    }

    event.preventDefault()
    typeahead.current += event.key.toLocaleLowerCase()
    if (typeaheadTimeout.current) clearTimeout(typeaheadTimeout.current)
    typeaheadTimeout.current = setTimeout(() => {
      typeahead.current = ""
      typeaheadTimeout.current = null
    }, 700)

    const query = typeahead.current
    const searchOptions = [
      ...options.slice(resolvedActiveIndex + 1),
      ...options.slice(0, resolvedActiveIndex + 1),
    ]
    const match = searchOptions.find((option) =>
      option.label.toLocaleLowerCase().startsWith(query)
    )
    if (match) selectAt(options.indexOf(match))
  }

  function renderOption(option: ExplorerListboxOption) {
    const optionIndex = options.indexOf(option)
    return (
      <div
        key={option.value}
        id={`${listboxId}-option-${optionIndex}`}
        ref={(element) => {
          if (element) optionRefs.current.set(option.value, element)
          else optionRefs.current.delete(option.value)
        }}
        role="option"
        aria-selected={option.value === value}
        data-active={option.value === activeOptionValue}
        className="network-listbox-option flex min-h-6 cursor-pointer items-center rounded-sm px-2 py-0.5 leading-5"
        title={option.label}
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => {
          setActiveValue(option.value)
          onValueChange(option.value)
          listboxRef.current?.focus()
        }}
      >
        <span className="min-w-0 flex-1 truncate">{option.label}</span>
      </div>
    )
  }

  return (
    <div
      ref={listboxRef}
      id={listboxId}
      role="listbox"
      tabIndex={0}
      aria-labelledby={labelledBy}
      aria-activedescendant={
        activeOption ? `${listboxId}-option-${resolvedActiveIndex}` : undefined
      }
      className="network-listbox max-h-60 w-full overflow-y-auto rounded-md border border-input bg-background p-1 text-sm text-muted-foreground shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
      style={{ height: `${visibleRows * 24}px` }}
      onKeyDown={handleKeyDown}
    >
      {groupedOptions.map((group, index) => (
        <Fragment key={group.label ?? `ungrouped-${index}`}>
          {group.label ? (
            <div role="group" aria-label={group.label}>
              <div className="px-2 py-1 text-xs font-medium text-foreground">
                {group.label}
              </div>
              {group.options.map(renderOption)}
            </div>
          ) : (
            group.options.map(renderOption)
          )}
        </Fragment>
      ))}
    </div>
  )
}
