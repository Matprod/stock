import * as echarts from 'echarts'
import { Resvg } from '@resvg/resvg-js'
import {
  PREMIUM_REPORT_CHART_HEIGHT,
  PREMIUM_REPORT_CHART_WIDTH,
} from '#constants/premium_report.constants'

type SvgChart = {
  renderToSVGString: () => string
  setOption: (option: unknown, opts?: { notMerge?: boolean }) => void
  dispose: () => void
}

export const renderEchartsPng = async (
  option: Record<string, unknown>,
  width = PREMIUM_REPORT_CHART_WIDTH,
  height = PREMIUM_REPORT_CHART_HEIGHT
): Promise<Buffer> => {
  const chart = echarts.init(null, null, {
    renderer: 'svg',
    ssr: true,
    width,
    height,
  }) as unknown as SvgChart

  try {
    chart.setOption(
      {
        ...option,
        animation: false,
        backgroundColor: option.backgroundColor ?? '#ffffff',
        textStyle: {
          color: '#1A1A1A',
          fontFamily: 'sans-serif',
        },
      },
      { notMerge: true }
    )
    const svg = chart.renderToSVGString()
    return new Resvg(svg, {
      fitTo: { mode: 'width', value: width },
    })
      .render()
      .asPng()
  } finally {
    chart.dispose()
  }
}
