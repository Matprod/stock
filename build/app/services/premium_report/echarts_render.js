import * as echarts from 'echarts';
import { Resvg } from '@resvg/resvg-js';
import { PREMIUM_REPORT_CHART_HEIGHT, PREMIUM_REPORT_CHART_WIDTH, } from '#constants/premium_report.constants';
export const renderEchartsPng = async (option, width = PREMIUM_REPORT_CHART_WIDTH, height = PREMIUM_REPORT_CHART_HEIGHT) => {
    const chart = echarts.init(null, null, {
        renderer: 'svg',
        ssr: true,
        width,
        height,
    });
    try {
        chart.setOption({
            ...option,
            animation: false,
            backgroundColor: option.backgroundColor ?? '#ffffff',
            textStyle: {
                color: '#1A1A1A',
                fontFamily: 'sans-serif',
            },
        }, { notMerge: true });
        const svg = chart.renderToSVGString();
        return new Resvg(svg, {
            fitTo: { mode: 'width', value: width },
        })
            .render()
            .asPng();
    }
    finally {
        chart.dispose();
    }
};
//# sourceMappingURL=echarts_render.js.map