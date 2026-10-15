export const echartsBootPreludeSource = (args: {
  chartBoot: string
  paletteJson: string
  fontFamilyJson: string
  inkJson: string
  injectMissingHosts: boolean
  stripLineSymbols: boolean
}): string => `  const charts = ${args.chartBoot};
  const palette = ${args.paletteJson};
  const fontFamily = ${args.fontFamilyJson};
  const ink = ${args.inkJson};
  const injectMissingHosts = ${args.injectMissingHosts ? 'true' : 'false'};
  const stripLineSymbols = ${args.stripLineSymbols ? 'true' : 'false'};
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

  const seriesHasData = (option) => {
    if (!option || typeof option !== 'object') return false;
    const series = Array.isArray(option.series) ? option.series : option.series ? [option.series] : [];
    for (const s of series) {
      if (!s || typeof s !== 'object') continue;
      const data = s.data;
      if (!Array.isArray(data) || data.length === 0) continue;
      if (data.some((p) => typeof p === 'number' && Number.isFinite(p))) return true;
      if (data.some((p) => Array.isArray(p) && p.some((v) => typeof v === 'number' && Number.isFinite(v)))) return true;
      if (data.some((p) => p && typeof p === 'object' && typeof p.value === 'number' && Number.isFinite(p.value))) return true;
    }
    const source = option.dataset && option.dataset.source;
    return Array.isArray(source) && source.length > 1;
  };

  const ensureHost = (chart) => {
    let el = document.getElementById(chart.id);
    if (el) return el;
    if (!injectMissingHosts || !seriesHasData(chart.option)) return null;
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
  };`

export const echartsBootSeriesMapSource = (): string => `      if (Array.isArray(option.series)) {
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
      }`

export const echartsBootTailSource = (): string => `
  whenEchartsReady(boot);`
