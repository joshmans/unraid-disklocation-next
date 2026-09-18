<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import uPlot from "uplot";
  import "uplot/dist/uPlot.min.css";

  export let title: string;
  /** Unix ms, one per sample - shared x-axis across every series below. */
  export let timestamps: number[];
  export let series: { label: string; color: string; values: (number | null)[] }[];

  let container: HTMLDivElement;
  let chart: uPlot | undefined;
  let resizeObserver: ResizeObserver | undefined;

  // Canvas strokeStyle can't resolve `var(--x)` itself - this tab's panel is
  // hidden (display:none) until selected, so uPlot can't be constructed with
  // a real width at Svelte's normal onMount time either (see the
  // ResizeObserver below, which is what actually handles that).
  function resolveColor(value: string): string {
    const match = /^var\((--[\w-]+)\)$/.exec(value.trim());
    if (!match) return value;
    const resolved = getComputedStyle(container).getPropertyValue(match[1]).trim();
    return resolved || value;
  }

  function alignedData(): uPlot.AlignedData {
    return [timestamps.map((ts) => ts / 1000), ...series.map((s) => s.values)] as uPlot.AlignedData;
  }

  function buildOptions(width: number): uPlot.Options {
    const muted = resolveColor("var(--muted)");
    const border = resolveColor("var(--border)");
    return {
      width,
      height: 160,
      title,
      series: [{}, ...series.map((s) => ({ label: s.label, stroke: resolveColor(s.color), width: 2 }))],
      axes: [
        { stroke: muted, grid: { stroke: border } },
        { stroke: muted, grid: { stroke: border } },
      ],
      scales: { x: { time: true } },
    };
  }

  onMount(() => {
    // The tab this lives in can be hidden (display:none, width 0) the first
    // time this component mounts - a ResizeObserver naturally fires once it
    // actually gets laid out (tab switch) as well as on real window resizes,
    // so it's the one signal that covers both cases correctly.
    resizeObserver = new ResizeObserver((entries) => {
      const width = Math.floor(entries[0]?.contentRect.width ?? 0);
      if (width <= 0) return;
      if (!chart) {
        chart = new uPlot(buildOptions(width), alignedData(), container);
      } else {
        chart.setSize({ width, height: 160 });
      }
    });
    resizeObserver.observe(container);
  });

  onDestroy(() => {
    resizeObserver?.disconnect();
    chart?.destroy();
  });

  $: if (chart) chart.setData(alignedData());
</script>

<div bind:this={container} class="trend-chart"></div>

<style>
  .trend-chart {
    width: 100%;
    margin-bottom: 16px;
  }
</style>
