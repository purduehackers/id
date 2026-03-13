<script lang="ts">
  import type { PageData } from "./$types.js";

  let { data }: { data: PageData } = $props();

  let bgClass = $derived(
    data.status === "success"
      ? "from-green-100 to-green-200"
      : "from-red-100 to-red-200"
  );
</script>

<div class="min-h-screen flex flex-col justify-center items-center font-sans">
  <div
    class="w-11/12 sm:w-5/12 p-4 sm:p-12 border-2 rounded border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] bg-gradient-to-tr {bgClass} flex flex-col gap-2 text-center"
  >
    {#if data.status === "success"}
      <h1 class="text-3xl font-bold">Success!</h1>
      <p>You can close this page now.</p>
    {:else}
      <h1 class="text-3xl font-bold">Error authorizing</h1>
      <p>
        Please try again from the beginning. If the issue persists, send a
        message in #lounge.
      </p>
    {/if}
  </div>
</div>
