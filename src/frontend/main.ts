import App from "./App.svelte";

const target = document.getElementById("unraid-disklocation-next-app");

if (target) {
  new App({ target });
}
