import { test } from '@japa/runner'
import { renderStaffPage, staffPageChromeCss } from '#services/report_v4/staff_render/page'
import { STAFF_PAGE } from '#services/report_v4/staff_render/tokens'

test.group('staff_render page', () => {
  test('renders fixed A4 frame with header body and n/total footer', ({ assert }) => {
    const html = renderStaffPage({
      pageNumber: 2,
      pageTotal: 6,
      headerLeft: 'Hambourg',
      headerRight: '1–7 mars 2026',
      contentHtml: '<p data-block="x">content</p>',
    })
    assert.include(html, 'data-staff-page="2"')
    assert.include(html, 'data-staff-page-total="6"')
    assert.include(html, '2 / 6')
    assert.include(html, 'Hambourg')
    assert.include(html, '1–7 mars 2026')
    assert.include(html, 'data-block="x"')
    assert.include(html, `width:${STAFF_PAGE.widthPx}px`)
    assert.include(html, `height:${STAFF_PAGE.heightPx}px`)
    assert.include(staffPageChromeCss(), '.staff-page{')
  })

  test('empty content still yields a valid page chrome', ({ assert }) => {
    const html = renderStaffPage({
      pageNumber: 1,
      pageTotal: 1,
      contentHtml: '',
    })
    assert.include(html, 'class="staff-page-body"></div>')
    assert.include(html, '1 / 1')
  })
})
