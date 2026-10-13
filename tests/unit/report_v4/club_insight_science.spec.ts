import { test } from '@japa/runner'
import {
  clubInsightScienceQueryMode,
  formatClubInsightScienceAnalystHint,
  renderClubInsightScienceStaffPanel,
  truncateInsightScience,
  type ClubInsightScience,
} from '#services/report_v4/club_insight_science'

const sample: ClubInsightScience[] = [
  {
    insightId: 'i1',
    variableName: 'acwr_ewma',
    name: 'ACWR',
    description: 'Acute:chronic workload ratio tracks recent load versus the chronic baseline.',
    meanAbsImportance: 0.42,
    sampleDays: 12,
  },
  {
    insightId: 'i2',
    variableName: 'sleep_quality',
    name: 'Sleep quality',
    description: '',
    meanAbsImportance: null,
    sampleDays: 0,
  },
]

test.group('club_insight_science', () => {
  test('analyst hint is English and hides empty science rows from staff panel only', ({
    assert,
  }) => {
    const hint = formatClubInsightScienceAnalystHint(sample)
    assert.isString(hint)
    assert.include(hint!, 'Club insight science')
    assert.include(hint!, 'ONE short drivers panel')
    assert.include(hint!, 'ACWR')
    assert.include(hint!, 'acwr_ewma')
    assert.include(hint!, 'mean_|importance|=0.420')
    assert.include(hint!, 'Sleep quality')
  })

  test('staff panel skips rows without description, truncates, and escapes html', ({ assert }) => {
    const long =
      'Indicator of accumulated training stress related to overall volume exposure over the past 7 days with extra physiological detail that should be cut for staff brevity and print density.'
    const html = renderClubInsightScienceStaffPanel(
      [
        ...sample,
        {
          insightId: 'i3',
          variableName: 'x',
          name: '<script>',
          description: 'Safe <b>text</b>',
          meanAbsImportance: 0.1,
          sampleDays: 2,
        },
        {
          insightId: 'i4',
          variableName: 'volume_strain',
          name: 'Volume strain',
          description: long,
          meanAbsImportance: 0.9,
          sampleDays: 4,
        },
      ],
      'en'
    )
    assert.include(html, 'Club drivers & science')
    assert.include(html, 'ACWR')
    assert.notInclude(html, 'Sleep quality')
    assert.include(html, '&lt;script&gt;')
    assert.include(html, 'Safe &lt;b&gt;text&lt;/b&gt;')
    assert.notInclude(html, 'acwr_ewma')
    assert.include(html, 'Volume strain')
    assert.notInclude(html, 'print density')
    assert.include(html, '…')
  })

  test('truncateInsightScience cuts on word boundary', ({ assert }) => {
    assert.equal(truncateInsightScience('short', 40), 'short')
    assert.match(truncateInsightScience('one two three four five six seven eight', 20), /…$/)
  })

  test('empty list yields no hint and empty panel', ({ assert }) => {
    assert.isUndefined(formatClubInsightScienceAnalystHint([]))
    assert.equal(renderClubInsightScienceStaffPanel([], 'fr'), '')
  })

  test('unlinked club does not scan global feature importances', ({ assert }) => {
    assert.equal(clubInsightScienceQueryMode([]), 'empty')
    assert.equal(clubInsightScienceQueryMode(['insight-a']), 'linked')
  })
})
