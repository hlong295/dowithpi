// Minimal HTML sanitization/normalization for user-provided rich text.
// Goal: allow basic formatting (bold/italic/lists/links/paragraphs) while
// blocking scripts/events/javascript: URLs.

const ALLOWED_TAGS = new Set([
  "p",
  "br",
  "b",
  "strong",
  "i",
  "em",
  "u",
  "s",
  "ul",
  "ol",
  "li",
  "blockquote",
  "h1",
  "h2",
  "h3",
  "div",
  "span",
  "a",
])

const ALLOWED_ATTRS_BY_TAG: Record<string, Set<string>> = {
  a: new Set(["href", "target", "rel"]),
  span: new Set([]),
  div: new Set([]),
}

function isProbablyPlainText(input: string) {
  // If it doesn't contain any tag-like sequence, treat as plain text.
  return !/[<][a-zA-Z/!]/.test(input)
}

function escapeHtml(text: string) {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;")
}

export function normalizeToHtml(input: string) {
  if (!input) return ""
  if (isProbablyPlainText(input)) {
    // Preserve line breaks for legacy/plain textarea content.
    return escapeHtml(input).replaceAll("\n", "<br/>")
  }
  return input
}

export function sanitizeHtml(input: string) {
  if (!input) return ""

  // Works in browser environments. (These pages/components are client-side.)
  if (typeof window === "undefined" || typeof DOMParser === "undefined") {
    // Fallback: return normalized plain text only.
    return normalizeToHtml(input)
  }

  const html = normalizeToHtml(input)
  const parser = new DOMParser()
  const doc = parser.parseFromString(html, "text/html")

  // Remove disallowed nodes and dangerous attributes.
  const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_ELEMENT)
  const toRemove: Element[] = []

  while (walker.nextNode()) {
    const el = walker.currentNode as Element
    const tag = el.tagName.toLowerCase()

    if (!ALLOWED_TAGS.has(tag)) {
      toRemove.push(el)
      continue
    }

    // Strip event handlers, styles, and non-allowed attrs.
    for (const attr of Array.from(el.attributes)) {
      const name = attr.name.toLowerCase()
      const value = attr.value

      if (name.startsWith("on")) {
        el.removeAttribute(attr.name)
        continue
      }

      // Disallow inline styles to avoid paste-in CSS and reduce XSS surface.
      if (name === "style") {
        el.removeAttribute(attr.name)
        continue
      }

      const allowed = ALLOWED_ATTRS_BY_TAG[tag]
      if (allowed && allowed.has(name)) {
        if (tag === "a" && name === "href") {
          const v = value.trim()
          if (/^javascript:/i.test(v)) {
            el.removeAttribute(attr.name)
          }
        }
        continue
      }

      // Global attributes we allow nowhere (id/class/data-*) to keep output stable.
      el.removeAttribute(attr.name)
    }

    if (tag === "a") {
      // Always force safe link behavior.
      el.setAttribute("rel", "noopener noreferrer")
      el.setAttribute("target", "_blank")
    }
  }

  // Remove disallowed nodes but keep their text content.
  for (const el of toRemove) {
    const text = doc.createTextNode(el.textContent || "")
    el.replaceWith(text)
  }

  // Also ensure script/style tags are gone.
  doc.querySelectorAll("script,style").forEach((n) => n.remove())

  return doc.body.innerHTML
}
