"use client"

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { sanitizeHtml } from "@/lib/sanitize-html"
import {
  Bold,
  Italic,
  Underline,
  List,
  ListOrdered,
  Link as LinkIcon,
  Undo,
  Redo,
  Type,
  Table2,
} from "lucide-react"

type Props = {
  value: string
  onChange: (html: string) => void
  placeholder?: string
  className?: string
  minHeightClassName?: string
  debug?: boolean
}

// Lightweight WYSIWYG editor (contentEditable) to preserve formatting when copy/paste.
// No external deps to avoid breaking the existing baseline.
export function RichTextEditor({
  value,
  onChange,
  placeholder = "Nhập mô tả...",
  className = "",
  minHeightClassName = "min-h-[120px]",
  debug = false,
}: Props) {
  const ref = useRef<HTMLDivElement | null>(null)
  const [focused, setFocused] = useState(false)
  const [lastHtml, setLastHtml] = useState<string>("")
  const [debugLine, setDebugLine] = useState<string>("")

  const safeValue = useMemo(() => sanitizeHtml(value || ""), [value])

  // Keep editor DOM in sync when value changes from outside.
  useEffect(() => {
    const el = ref.current
    if (!el) return
    // Avoid cursor jump while editing.
    if (focused) return
    if (safeValue !== lastHtml) {
      el.innerHTML = safeValue || ""
      setLastHtml(safeValue || "")
    }
  }, [safeValue, lastHtml, focused])

  const exec = useCallback((command: string, commandValue?: string) => {
    try {
      // @ts-expect-error: execCommand is deprecated but still supported across browsers.
      document.execCommand(command, false, commandValue)
      // Trigger input update.
      const el = ref.current
      if (el) {
        const cleaned = sanitizeHtml(el.innerHTML)
        el.innerHTML = cleaned
        setLastHtml(cleaned)
        onChange(cleaned)
      }
    } catch (e: any) {
      if (debug) setDebugLine(String(e?.message || e))
    }
  }, [onChange, debug])

  const handleInput = useCallback(() => {
    const el = ref.current
    if (!el) return
    const cleaned = sanitizeHtml(el.innerHTML)
    if (cleaned !== el.innerHTML) {
      el.innerHTML = cleaned
    }
    setLastHtml(cleaned)
    onChange(cleaned)
  }, [onChange])

  const handlePaste = useCallback((e: React.ClipboardEvent<HTMLDivElement>) => {
    e.preventDefault()
    const html = e.clipboardData.getData("text/html")
    const text = e.clipboardData.getData("text/plain")
    const incoming = sanitizeHtml(html || (text ? text.replaceAll("\n", "<br/>") : ""))
    exec("insertHTML", incoming)
  }, [exec])

  const handleTable = useCallback(() => {
    if (!editorRef.current) return
    editorRef.current.focus()
    const rowsStr = window.prompt("Số hàng?", "3")
    const colsStr = window.prompt("Số cột?", "3")
    const rows = Math.max(1, Math.min(20, Number(rowsStr || 3)))
    const cols = Math.max(1, Math.min(10, Number(colsStr || 3)))
    if (!Number.isFinite(rows) || !Number.isFinite(cols)) return
    const tableHtml = `<table><tbody>${Array.from({ length: rows })
      .map(() => `<tr>${Array.from({ length: cols }).map(() => `<td>&nbsp;</td>`).join("")}</tr>`)
      .join("")}</tbody></table><p><br/></p>`
    insertHtmlAtCursor(tableHtml)
    scheduleEmitChange()
  }, [])

  const handleLink = useCallback(() => {
    const url = window.prompt("Nhập link (https://...)")
    if (!url) return
    const v = url.trim()
    if (!/^https?:\/\//i.test(v)) {
      window.alert("Link phải bắt đầu bằng http:// hoặc https://")
      return
    }
    exec("createLink", v)
  }, [exec])

  const showPlaceholder = !focused && (!safeValue || safeValue === "<br>" || safeValue === "<br/>")

  return (
    <div className={`rounded-xl border border-gray-200 ${className}`}>
      <div className="flex flex-wrap gap-1 p-2 border-b border-gray-100 bg-white rounded-t-xl">
        <Button type="button" variant="ghost" size="sm" className="h-8 px-2" onClick={() => exec("bold")}> <Bold className="w-4 h-4" /> </Button>
        <Button type="button" variant="ghost" size="sm" className="h-8 px-2" onClick={() => exec("italic")}> <Italic className="w-4 h-4" /> </Button>
        <Button type="button" variant="ghost" size="sm" className="h-8 px-2" onClick={() => exec("underline")}> <Underline className="w-4 h-4" /> </Button>
        <div className="w-px h-6 bg-gray-200 mx-1" />
        <Button type="button" variant="ghost" size="sm" className="h-8 px-2" onClick={() => exec("insertUnorderedList")}> <List className="w-4 h-4" /> </Button>
        <Button type="button" variant="ghost" size="sm" className="h-8 px-2" onClick={() => exec("insertOrderedList")}> <ListOrdered className="w-4 h-4" /> </Button>
        <div className="w-px h-6 bg-gray-200 mx-1" />
        <Button type="button" variant="ghost" size="sm" className="h-8 px-2" onClick={handleLink}> <LinkIcon className="w-4 h-4" /> </Button>
        <div className="w-px h-6 bg-gray-200 mx-1" />
        <Button type="button" variant="ghost" size="sm" className="h-8 px-2" onClick={() => exec("undo")}> <Undo className="w-4 h-4" /> </Button>
        <Button type="button" variant="ghost" size="sm" className="h-8 px-2" onClick={() => exec("redo")}> <Redo className="w-4 h-4" /> </Button>
        <div className="flex-1" />
        <div className="flex items-center gap-1 text-[11px] text-gray-500 pr-1">
          <Type className="w-3.5 h-3.5" /> WYSIWYG
        </div>
      </div>

      <div className="relative">
        {showPlaceholder && (
          <div className="pointer-events-none absolute top-3 left-3 text-sm text-gray-400">
            {placeholder}
          </div>
        )}
        <div
          ref={ref}
          className={`p-3 text-sm outline-none ${minHeightClassName}`}
          contentEditable
          suppressContentEditableWarning
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onInput={handleInput}
          onPaste={handlePaste}
        />
      </div>

      {debug && debugLine && (
        <div className="px-3 py-2 text-xs text-red-600 border-t border-gray-100">{debugLine}</div>
      )}
    </div>
  )
}
