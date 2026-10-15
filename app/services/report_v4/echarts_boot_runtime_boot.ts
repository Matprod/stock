import { echartsBootSeriesMapSource } from '#services/report_v4/echarts_boot_runtime_prelude'

export const echartsBootBootSource = (): string => `  const paintChart = (chart) => {
    if (!seriesHasData(chart.option)) return false;
    const el = ensureHost(chart);
    if (!el) return false;
    if (el.dataset.ready === '1') return true;
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
    el.style.minWidth = '1px';
    el.style.minHeight = defaultH + 'px';
    if (el.clientWidth < 1) {
      el.style.width = '770px';
    }
    let instance;
    try {
      if (window.echarts.getInstanceByDom) {
        const prior = window.echarts.getInstanceByDom(el);
        if (prior) {
          try { prior.dispose(); } catch (_) {}
        }
      }
      instance = window.echarts.init(el, null, {
        renderer: 'canvas',
        width: el.clientWidth || 770,
        height: defaultH,
      });
    } catch (_) {
      return false;
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
${echartsBootSeriesMapSource()}
    try {
      instance.setOption(option, true);
    } catch (_) {
      try {
        instance.setOption({ ...chart.option, animation: !isPrint() }, true);
      } catch (_) {
        try {
          instance.dispose();
        } catch (_) {}
        return false;
      }
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
    return true;
  };

  const boot = () => {
    if (!window.echarts) return;
    for (const chart of charts) paintChart(chart);
    const retryPaint = () => {
      for (const chart of charts) paintChart(chart);
    };
    requestAnimationFrame(() => {
      retryPaint();
      requestAnimationFrame(retryPaint);
    });
    setTimeout(retryPaint, 50);
    setTimeout(retryPaint, 200);
    setTimeout(retryPaint, 600);
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
  }`
