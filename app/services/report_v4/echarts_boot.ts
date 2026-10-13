import { echartsLocalScriptTag } from '#services/report_v4/report_v4_assets'

export type EchartsBootChart = {
  id: string
  title?: string
  option: Record<string, unknown>
}

export type EchartsBootTheme = {
  palette: string[]
  fontFamily: string
  ink: string
}

const escapeForScript = (json: string): string => json.replace(/</g, '\\u003c')

/** Local ECharts bundle (node_modules), no CDN. */
export const echartsCdnScriptTag = (): string => echartsLocalScriptTag()

/**
 * Shared ECharts mount for free artifacts and template HTML.
 * Contract for Playwright: documentElement.dataset.chartsReady === '1'
 * and each .chart-box gets dataset.ready === '1' once mounted.
 */
export const buildEchartsBootScript = (args: {
  charts: EchartsBootChart[]
  theme: EchartsBootTheme
  /** Append missing chart hosts by charts[].id (free artifact path). */
  injectMissingHosts?: boolean
  /** Hide line point symbols (template path). */
  stripLineSymbols?: boolean
  scriptId?: string
}): string => {
  const chartBoot = escapeForScript(JSON.stringify(args.charts))
  const scriptId = args.scriptId ?? 'mauna-artifact-boot'
  const injectMissingHosts = Boolean(args.injectMissingHosts)
  const stripLineSymbols = Boolean(args.stripLineSymbols)
  return `<script id="${scriptId}">
(function () {
  const charts = ${chartBoot};
  const palette = ${JSON.stringify(args.theme.palette)};
  const fontFamily = ${JSON.stringify(args.theme.fontFamily)};
  const ink = ${JSON.stringify(args.theme.ink)};
  const injectMissingHosts = ${injectMissingHosts ? 'true' : 'false'};
  const stripLineSymbols = ${stripLineSymbols ? 'true' : 'false'};
  const instances = [];
  const isPrint = () => window.matchMedia('print').matches;

  const whenEchartsReady = (cb) => {
    if (window.echarts) {
      cb();
      return;
    }
    let done = false;
    const finish = () => {
      if (done) return;
      if (!window.echarts) return;
      done = true;
      cb();
    };
    window.__maunaOnEchartsLoad = finish;
    const tag = document.querySelector('script[src*="echarts"]');
    if (tag) tag.addEventListener('load', finish);
    let n = 0;
    const t = setInterval(() => {
      n += 1;
      if (window.echarts) {
        clearInterval(t);
        finish();
        return;
      }
      if (n > 50) {
        clearInterval(t);
      }
    }, 100);
  };

  const ensureHost = (chart) => {
    let el = document.getElementById(chart.id);
    if (el || !injectMissingHosts) return el;
    const host = document.getElementById('mauna-charts-fallback') || (() => {
      const d = document.createElement('section');
      d.id = 'mauna-charts-fallback';
      d.setAttribute('data-injected', '1');
      document.body.appendChild(d);
      return d;
    })();
    const card = document.createElement('div');
    card.className = 'chart-card';
    card.innerHTML = '<h3></h3><div class="chart-box" id="' + chart.id + '"></div>';
    card.querySelector('h3').textContent = chart.title || chart.id;
    host.appendChild(card);
    return document.getElementById(chart.id);
  };

  const boot = () => {
    if (!window.echarts) return;
    for (const chart of charts) {
      const el = ensureHost(chart);
      if (!el) continue;
      el.classList.add('chart-box');
      const series = Array.isArray(chart.option && chart.option.series) ? chart.option.series : [];
      const isRadar = Boolean(chart.option && chart.option.radar);
      const isLine = !isRadar && series.some((s) => s && s.type === 'line');
      const isBar = !isRadar && series.some((s) => s && s.type === 'bar');
      el.classList.remove('line-chart', 'bar-rank', 'radar');
      if (isRadar) {
        el.classList.add('radar');
        el.dataset.chartKind = 'radar';
      } else if (isLine) {
        el.classList.add('line-chart');
        el.dataset.chartKind = 'line';
      } else if (isBar) {
        el.classList.add('bar-rank');
        el.dataset.chartKind = 'bar';
      } else {
        el.dataset.chartKind = '';
      }
      const defaultH = isRadar
        ? (isPrint() ? 280 : 300)
        : isLine
          ? (isPrint() ? 340 : 360)
          : (isPrint() ? 260 : 300);
      el.style.height = defaultH + 'px';
      el.style.width = '100%';
      let instance;
      try {
        instance = window.echarts.init(el, null, { renderer: 'canvas' });
      } catch (_) {
        continue;
      }
      const baseLegend =
        chart.option && chart.option.legend && typeof chart.option.legend === 'object'
          ? chart.option.legend
          : {};
      const hasVisualMap = Boolean(chart.option && chart.option.visualMap);
      let option = {
        animation: !isPrint(),
        backgroundColor: '#ffffff',
        textStyle: { fontFamily: fontFamily, color: ink },
        ...chart.option,
        color: palette,
        legend: hasVisualMap
          ? {
              show: false,
              ...(baseLegend && baseLegend.show === true ? baseLegend : {}),
            }
          : {
              icon: 'roundRect',
              itemWidth: 12,
              itemHeight: 8,
              itemGap: 10,
              textStyle: { fontSize: 10, color: '#475569', fontFamily: fontFamily },
              ...baseLegend,
              type: 'plain',
            },
      };
      if (option.maunaLayout != null) delete option.maunaLayout;
      if (hasVisualMap && option.visualMap && typeof option.visualMap === 'object' && !Array.isArray(option.visualMap)) {
        option.visualMap = {
          ...option.visualMap,
          show: option.visualMap.show !== false,
          top: option.visualMap.top != null ? option.visualMap.top : 2,
          left: option.visualMap.left != null ? option.visualMap.left : 'center',
          orient: option.visualMap.orient || 'horizontal',
          textStyle: {
            fontSize: 10,
            color: '#475569',
            fontFamily: fontFamily,
            ...(option.visualMap.textStyle && typeof option.visualMap.textStyle === 'object'
              ? option.visualMap.textStyle
              : {}),
          },
        };
      }
      const yCat =
        option.yAxis &&
        typeof option.yAxis === 'object' &&
        !Array.isArray(option.yAxis) &&
        option.yAxis.type === 'category';
      const xVal =
        option.xAxis &&
        typeof option.xAxis === 'object' &&
        !Array.isArray(option.xAxis) &&
        option.xAxis.type === 'value';
      if (isPrint() && yCat && xVal) {
        const prevGrid =
          option.grid && typeof option.grid === 'object' && !Array.isArray(option.grid)
            ? option.grid
            : {};
        const right = Math.max(72, Number(prevGrid.right) || 0);
        const top = Math.max(hasVisualMap ? 44 : 36, Number(prevGrid.top) || 0);
        option.grid = { containLabel: true, left: 8, bottom: 20, ...prevGrid, right, top };
      }
      if (Array.isArray(option.series)) {
        let paletteIndex = 0;
        option.series = option.series.map((s) => {
          if (!s || typeof s !== 'object') return s;
          const isHiddenBand = s.stack === 'squad-range';
          const lineStyle = s.lineStyle && typeof s.lineStyle === 'object' ? s.lineStyle : {};
          const itemStyle = s.itemStyle && typeof s.itemStyle === 'object' ? s.itemStyle : {};
          const explicit =
            (typeof lineStyle.color === 'string' && lineStyle.color) ||
            (typeof itemStyle.color === 'string' && itemStyle.color) ||
            '';
          let tint = explicit;
          if (!tint && !isHiddenBand) {
            tint = palette[paletteIndex++ % Math.max(palette.length, 1)];
          } else if (!tint) {
            tint = 'transparent';
          }
          if (s.type === 'line' || s.type == null) {
            return {
              ...s,
              smooth: s.smooth == null ? 0.18 : s.smooth,
              showSymbol: stripLineSymbols ? false : s.showSymbol,
              symbol: stripLineSymbols ? 'none' : s.symbol,
              symbolSize: stripLineSymbols ? 0 : s.symbolSize,
              itemStyle: { ...itemStyle, color: itemStyle.color || tint },
              lineStyle: { width: 2.35, ...lineStyle, color: lineStyle.color || tint },
              emphasis: { focus: 'series', ...(s.emphasis || {}), lineStyle: { width: 3.1 } },
            };
          }
          if (s.type === 'bar') {
            const barYCat =
              option.yAxis &&
              typeof option.yAxis === 'object' &&
              !Array.isArray(option.yAxis) &&
              option.yAxis.type === 'category';
            const nextItem = {
              borderRadius: barYCat ? [0, 4, 4, 0] : [4, 4, 0, 0],
              ...itemStyle,
            };
            if (!hasVisualMap) nextItem.color = itemStyle.color || tint;
            else if ('color' in nextItem) delete nextItem.color;
            return {
              ...s,
              barMaxWidth: s.barMaxWidth == null ? (barYCat ? 18 : 28) : s.barMaxWidth,
              itemStyle: nextItem,
            };
          }
          if (s.type === 'scatter') {
            return {
              ...s,
              symbolSize: Math.min(Number(s.symbolSize) || 7, 8),
              itemStyle: { opacity: 0.88, ...itemStyle, color: itemStyle.color || tint },
            };
          }
          if (s.type === 'radar') {
            const areaStyle = s.areaStyle && typeof s.areaStyle === 'object' ? s.areaStyle : {};
            const data = Array.isArray(s.data)
              ? s.data.map((item) => {
                  if (!item || typeof item !== 'object') return item;
                  const itemArea = item.areaStyle && typeof item.areaStyle === 'object' ? item.areaStyle : {};
                  return {
                    ...item,
                    areaStyle: { opacity: 0.22, ...itemArea, color: itemArea.color || tint },
                    lineStyle: { width: 2.2, ...(item.lineStyle || {}), color: (item.lineStyle && item.lineStyle.color) || tint },
                    itemStyle: { color: tint, ...(item.itemStyle || {}) },
                  };
                })
              : s.data;
            return {
              ...s,
              symbol: s.symbol || 'circle',
              symbolSize: s.symbolSize == null ? 5 : s.symbolSize,
              areaStyle: { opacity: 0.18, ...areaStyle, color: areaStyle.color || tint },
              lineStyle: { width: 2.2, ...lineStyle, color: lineStyle.color || tint },
              data,
            };
          }
          return s;
        });
      }
      try {
        instance.setOption(option, true);
      } catch (_) {
        try {
          instance.dispose();
        } catch (_) {}
        continue;
      }
      el.dataset.ready = '1';
      instances.push(instance);
      if (typeof ResizeObserver !== 'undefined') {
        const ro = new ResizeObserver(() => {
          const w = el.clientWidth;
          const h = el.clientHeight || defaultH;
          if (w > 0) instance.resize({ width: w, height: h });
        });
        ro.observe(el);
      }
    }
    document.documentElement.dataset.chartsReady = '1';
    const resizeAll = () => {
      instances.forEach((i) => {
        const dom = i.getDom && i.getDom();
        if (dom) {
          const w = dom.clientWidth;
          const h = dom.clientHeight || 220;
          if (w > 0) i.resize({ width: w, height: h });
          else i.resize();
        } else {
          i.resize();
        }
      });
    };
    window.__maunaResizeCharts = resizeAll;
    window.addEventListener('resize', resizeAll);
    window.addEventListener('beforeprint', () => {
      instances.forEach((i) => i.setOption({ animation: false }));
      resizeAll();
    });
    requestAnimationFrame(() => {
      resizeAll();
      requestAnimationFrame(resizeAll);
    });
    setTimeout(resizeAll, 120);
    setTimeout(resizeAll, 400);

    document.addEventListener('click', (event) => {
      const target = event.target;
      if (!target || typeof target.closest !== 'function') return;
      const link = target.closest('a[href^="#"]');
      if (!link) return;
      const href = link.getAttribute('href') || '';
      const id = href.slice(1);
      if (!id) return;
      const el = document.getElementById(id);
      if (!el) return;
      event.preventDefault();
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  };

  whenEchartsReady(boot);
})();
</script>`
}
