import DashboardWidget from "./DashboardWidget.svelte";

const target = document.getElementById("unraid-disklocation-next-dashboard");

if (target) {
  new DashboardWidget({ target });
}
