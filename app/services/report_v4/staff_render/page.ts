import { escapeHtml, styleAttr } from '#services/report_v4/staff_render/html'
import {
  STAFF_COLORS,
  STAFF_FONTS,
  STAFF_PAGE,
  STAFF_TYPE_SCALE_PX,
} from '#services/report_v4/staff_render/tokens'

export type StaffPageProps = {
  pageNumber: number
  pageTotal: number
  headerLeft?: string
  headerRight?: string
  contentHtml: string
}

export const staffPageChromeCss = (): string => `
.staff-page{
  width:${STAFF_PAGE.widthPx}px;height:${STAFF_PAGE.heightPx}px;
  box-sizing:border-box;background:${STAFF_COLORS.paper};color:${STAFF_COLORS.ink};
  font-family:${STAFF_FONTS.body},ui-sans-serif,sans-serif;font-size:${STAFF_TYPE_SCALE_PX.body}px;
  display:flex;flex-direction:column;overflow:hidden;page-break-after:always;break-after:page;
}
.staff-page-header{
  flex:0 0 auto;display:flex;justify-content:space-between;align-items:baseline;gap:12px;
  padding:20px ${STAFF_PAGE.marginXPx}px 10px;border-bottom:1px solid ${STAFF_COLORS.line};
  font-family:${STAFF_FONTS.display},ui-sans-serif,sans-serif;font-size:${STAFF_TYPE_SCALE_PX.caption}px;
  letter-spacing:.06em;text-transform:uppercase;color:${STAFF_COLORS.inkSoft};
}
.staff-page-header-right{color:${STAFF_COLORS.muted};text-transform:none;letter-spacing:0;}
.staff-page-body{
  flex:1 1 auto;padding:16px ${STAFF_PAGE.marginXPx}px 12px;overflow:hidden;
  display:flex;flex-direction:column;gap:14px;min-height:0;
}
.staff-page-footer{
  flex:0 0 auto;padding:8px ${STAFF_PAGE.marginXPx}px 16px;border-top:1px solid ${STAFF_COLORS.lineSoft};
  font-size:${STAFF_TYPE_SCALE_PX.footer}px;color:${STAFF_COLORS.muted};
  display:flex;justify-content:flex-end;
}
.staff-page-footer-num{font-variant-numeric:tabular-nums;}
`.trim()

export const renderStaffPage = (props: StaffPageProps): string => {
  const pageNumber = Math.max(1, Math.floor(props.pageNumber))
  const pageTotal = Math.max(pageNumber, Math.floor(props.pageTotal))
  const headerLeft = props.headerLeft?.trim() ?? ''
  const headerRight = props.headerRight?.trim() ?? ''
  return `<section class="staff-page"${styleAttr({
    width: `${STAFF_PAGE.widthPx}px`,
    height: `${STAFF_PAGE.heightPx}px`,
  })} data-staff-page="${pageNumber}" data-staff-page-total="${pageTotal}">
  <header class="staff-page-header">
    <div class="staff-page-header-left">${escapeHtml(headerLeft)}</div>
    <div class="staff-page-header-right">${escapeHtml(headerRight)}</div>
  </header>
  <div class="staff-page-body">${props.contentHtml}</div>
  <footer class="staff-page-footer"><span class="staff-page-footer-num">${pageNumber} / ${pageTotal}</span></footer>
</section>`
}
