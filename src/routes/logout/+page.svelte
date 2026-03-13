<script lang="ts">
  import type { PageData } from "./$types.js";

  let { data }: { data: PageData } = $props();
</script>

<div class="min-h-screen flex flex-col justify-center items-center gap-4 p-4">
  {#if data.loggedOut}
    <div class="text-center">
      <h1 class="text-2xl font-bold mb-4">Logged Out</h1>
      <p class="text-gray-600 mb-4">You have been successfully logged out.</p>
      <a
        href="/dash"
        class="px-4 py-2 bg-amber-400 hover:bg-amber-500 border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] rounded font-bold transition"
      >
        Back to Dashboard
      </a>
    </div>
  {:else}
    <div class="text-center">
      <p class="text-red-600 mb-4">Failed to log out</p>
      <a
        href="/dash"
        class="px-4 py-2 bg-amber-400 hover:bg-amber-500 border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] rounded font-bold transition"
      >
        Back to Dashboard
      </a>
    </div>
  {/if}
</div>
