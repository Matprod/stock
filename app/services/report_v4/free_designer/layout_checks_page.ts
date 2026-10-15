export type LayoutWarningCode =
  | 'text_overflow'
  | 'outside_page'
  | 'under_footer'
  | 'page_underfilled'
  | 'font_too_small'
  | 'color_outside_theme'
  | 'svg_empty'
  | 'empty_box'

export type LayoutWarning = {
  pageIndex: number
  blockId: string | null
  selector: string
  code: LayoutWarningCode
  detail: string
}

export type LayoutChecksPageArgs = {
  pageBlockIds?: string[] | null
  themeRgbKeys: string[]
  minFontPx: number
  minFillRatio: number
}

export const collectLayoutWarningsInPage = (args: LayoutChecksPageArgs): LayoutWarning[] => {
  const allowedColorKeywords = new Set([
    'transparent',
    'currentcolor',
    'inherit',
    'initial',
    'unset',
    'none',
  ])
  const themeKeys = new Set(args.themeRgbKeys)
  const minFontPx = args.minFontPx
  const minFillRatio = args.minFillRatio
  const filterIds =
    args.pageBlockIds && args.pageBlockIds.length > 0 ? new Set(args.pageBlockIds) : null
  const warnings: LayoutWarning[] = []

  const normalizeCssColor = (raw: string): string | null => {
    const value = raw.trim().toLowerCase()
    if (!value) return null
    if (allowedColorKeywords.has(value)) return null
    const rgba = value.match(
      /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)(?:\s*,\s*([\d.]+))?\s*\)$/
    )
    if (rgba) {
      const alpha = rgba[4] === undefined ? 1 : Number(rgba[4])
      if (alpha < 0.01) return null
      return `${Math.round(Number(rgba[1]))},${Math.round(Number(rgba[2]))},${Math.round(Number(rgba[3]))}`
    }
    return value
  }

  const colorAllowed = (raw: string): boolean => {
    const key = normalizeCssColor(raw)
    if (key === null) return true
    return themeKeys.has(key)
  }

  const cssPath = (el: Element): string => {
    const blockId = el.getAttribute('data-block-id')
    if (blockId) return `[data-block-id="${blockId}"]`
    const id = el.id ? `#${el.id}` : ''
    const cls =
      typeof el.className === 'string' && el.className.trim()
        ? `.${el.className.trim().split(/\s+/).slice(0, 2).join('.')}`
        : ''
    return `${el.tagName.toLowerCase()}${id}${cls}`
  }

  const push = (
    pageIndex: number,
    el: Element | null,
    code: LayoutWarningCode,
    detail: string
  ): void => {
    warnings.push({
      pageIndex,
      blockId: el?.getAttribute('data-block-id') ?? null,
      selector: el ? cssPath(el) : `.page:nth-of-type(${pageIndex + 1})`,
      code,
      detail,
    })
  }

  const hasSubstantialSvg = (svg: SVGElement): boolean => {
    const shapes = svg.querySelectorAll(
      'path, rect, circle, ellipse, line, polyline, polygon, text, tspan'
    )
    for (const node of Array.from(shapes)) {
      if (node.tagName.toLowerCase() === 'text' || node.tagName.toLowerCase() === 'tspan') {
        if ((node.textContent ?? '').trim().length > 0) return true
        continue
      }
      try {
        const box = (node as SVGGraphicsElement).getBBox?.()
        if (box && (box.width > 1 || box.height > 1)) return true
      } catch {
        /* detached or empty geometry */
      }
      const d = node.getAttribute('d')
      if (d && d.trim().length > 8) return true
    }
    return false
  }

  const hasMeaningfulContent = (el: Element): boolean => {
    const text = (el.textContent ?? '').replace(/\s+/g, ' ').trim()
    if (text.length >= 2) return true
    const svg = el.querySelector('svg')
    if (svg && hasSubstantialSvg(svg as SVGElement)) return true
    const img = el.querySelector('img')
    if (img && (img.getAttribute('src') || '').trim()) return true
    return false
  }

  const pages = Array.from(document.querySelectorAll('.page'))
  pages.forEach((page, pageIndex) => {
    const pageEl = page as HTMLElement
    const blockId = pageEl.getAttribute('data-block-id')
    if (filterIds && (!blockId || !filterIds.has(blockId))) return

    const pageRect = pageEl.getBoundingClientRect()
    const footer = pageEl.querySelector('.runfoot') as HTMLElement | null
    const footerTop = footer ? footer.getBoundingClientRect().top : pageRect.bottom

    const style = getComputedStyle(pageEl)
    const padTop = Number.parseFloat(style.paddingTop) || 0
    const padBottom = Number.parseFloat(style.paddingBottom) || 0
    const contentBoxHeight = Math.max(1, pageRect.height - padTop - padBottom)

    let contentBottom = pageRect.top + padTop
    const children = Array.from(pageEl.children) as HTMLElement[]
    for (const child of children) {
      if (child.classList.contains('runfoot')) continue
      const rect = child.getBoundingClientRect()
      if (rect.height <= 0 && rect.width <= 0) continue
      contentBottom = Math.max(contentBottom, rect.bottom)
    }
    const filled = (contentBottom - (pageRect.top + padTop)) / contentBoxHeight
    if (filled < minFillRatio) {
      push(
        pageIndex,
        pageEl,
        'page_underfilled',
        `page filled ${Math.round(filled * 100)}% (< ${Math.round(minFillRatio * 100)}%)`
      )
    }

    const walk = (root: Element): void => {
      const nodes = [root, ...Array.from(root.querySelectorAll('*'))]
      for (const node of nodes) {
        if (!(node instanceof HTMLElement) && !(node instanceof SVGElement)) continue
        if (node === pageEl) continue
        const el = node as HTMLElement
        const rect = el.getBoundingClientRect()
        if (rect.width <= 0 && rect.height <= 0) continue

        if (el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1) {
          const text = (el.textContent ?? '').trim()
          if (text.length > 0) {
            push(
              pageIndex,
              el,
              'text_overflow',
              `scroll ${el.scrollWidth}x${el.scrollHeight} > client ${el.clientWidth}x${el.clientHeight}`
            )
          }
        }

        const spills =
          rect.right > pageRect.right + 1 ||
          rect.left < pageRect.left - 1 ||
          rect.bottom > pageRect.bottom + 1 ||
          rect.top < pageRect.top - 1
        if (spills) {
          push(
            pageIndex,
            el,
            'outside_page',
            `rect (${Math.round(rect.left)},${Math.round(rect.top)})-(${Math.round(rect.right)},${Math.round(rect.bottom)}) outside page`
          )
        } else if (footer && rect.bottom > footerTop + 1 && !footer.contains(el) && el !== footer) {
          push(pageIndex, el, 'under_footer', 'element intersects or sits below .runfoot')
        }

        const computed = getComputedStyle(el)
        const fontPx = Number.parseFloat(computed.fontSize)
        if (Number.isFinite(fontPx) && fontPx > 0 && fontPx < minFontPx) {
          const sample = (el.textContent ?? '').trim()
          if (sample.length > 0) {
            push(pageIndex, el, 'font_too_small', `font-size ${fontPx}px < ${minFontPx}px`)
          }
        }

        const colorProps: string[] = [computed.color, computed.backgroundColor]
        const borderWidths = [
          Number.parseFloat(computed.borderTopWidth) || 0,
          Number.parseFloat(computed.borderRightWidth) || 0,
          Number.parseFloat(computed.borderBottomWidth) || 0,
          Number.parseFloat(computed.borderLeftWidth) || 0,
        ]
        const borderColors = [
          computed.borderTopColor,
          computed.borderRightColor,
          computed.borderBottomColor,
          computed.borderLeftColor,
        ]
        borderWidths.forEach((width, i) => {
          if (width > 0) colorProps.push(borderColors[i]!)
        })
        if (el instanceof SVGElement) {
          colorProps.push(computed.fill, computed.stroke)
        }
        for (const prop of colorProps) {
          if (!prop || prop === 'none') continue
          if (!colorAllowed(prop)) {
            push(pageIndex, el, 'color_outside_theme', `computed color ${prop} not in theme.css`)
            break
          }
        }
      }
    }

    walk(pageEl)

    pageEl.querySelectorAll('svg').forEach((svg) => {
      const svgEl = svg as SVGElement
      if (hasSubstantialSvg(svgEl)) return
      push(pageIndex, svgEl, 'svg_empty', 'SVG has no substantial paths/texts')
    })

    pageEl.querySelectorAll('figure, .chart, .kpi').forEach((box) => {
      if (hasMeaningfulContent(box)) return
      push(pageIndex, box, 'empty_box', 'figure/chart/kpi has no meaningful content')
    })
  })

  return warnings
}
