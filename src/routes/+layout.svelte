<script>
  import "../app.css";

  let { children } = $props();
</script>

<svelte:head>
  <title>ID</title>
</svelte:head>

{@render children()}
