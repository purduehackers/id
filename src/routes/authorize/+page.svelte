<script lang="ts">
  import type { PageData } from "./$types.js";

  let { data }: { data: PageData } = $props();

  type AuthState = "enter_number" | "wait_scan" | "authorize" | "no_client";

  let passportNumber = $state<number | null>(null);
  let passportInput = $state("");
  let submitting = $state(false);
  let totpNeeded = $state<boolean | null>(null);
  let totpCode = $state("");
  let pollInterval = $state<ReturnType<typeof setInterval> | null>(null);
  let authorizing = $state(false);

  let isValidClient = $derived(
    data.clientNames.some((c) => c.id === data.clientId)
  );

  let clientName = $derived(
    data.clientNames.find((c) => c.id === data.clientId)?.name ?? data.clientId
  );

  let scopes = $derived(
    data.scope
      .split(/\s+/)
      .filter((s) => s.length > 0 && s !== "auth")
  );

  let authState = $derived.by<AuthState>(() => {
    if (!isValidClient) return "no_client";
    if (passportNumber !== null && totpNeeded === null && submitting)
      return "wait_scan";
    if (data.hasSession || totpNeeded !== null) return "authorize";
    return "enter_number";
  });

  function scopeExplanation(scope: string): string {
    switch (scope) {
      case "user:read":
        return "Read user data including passports.";
      case "user":
        return "Write user data including passports.";
      case "admin:read":
        return "Read ALL user data including passports.";
      case "admin":
        return "Write ALL user data including passports.";
      default:
        return "";
    }
  }

  async function handleSubmitPassport() {
    const id = parseInt(passportInput, 10);
    if (isNaN(id)) return;
    passportNumber = id;
    submitting = true;

    // Initiate scan via POST
    try {
      await fetch("/authorize/api", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, secret: "" }),
      });
    } catch {
      // ignore, scan was initiated
    }

    // Start polling for scan completion
    pollInterval = setInterval(async () => {
      try {
        const res = await fetch(`/authorize/api?id=${id}`);
        const json = await res.json();
        if (json.ready) {
          totpNeeded = json.totpNeeded;
          submitting = false;
          if (pollInterval) {
            clearInterval(pollInterval);
            pollInterval = null;
          }
        }
      } catch {
        // keep polling
      }
    }, 1500);
  }

  function makeSubmitUrl(allow: boolean): string {
    const params = new URLSearchParams({
      client_id: data.clientId,
      redirect_uri: data.redirectUri,
      scope: data.scope,
      response_type: data.responseType,
      allow: String(allow),
    });
    if (passportNumber !== null) {
      params.set("id", String(passportNumber));
    }
    if (totpNeeded && totpCode) {
      params.set("code", totpCode);
    }
    if (data.state) {
      params.set("state", data.state);
    }
    return `/api/authorize?${params.toString()}`;
  }

  $effect(() => {
    return () => {
      if (pollInterval) {
        clearInterval(pollInterval);
      }
    };
  });
</script>

<div class="min-h-screen flex flex-col justify-center items-center font-sans">
  {#if authState === "no_client"}
    <p class="font-bold text-2xl">Invalid client ID</p>
  {:else if authState === "enter_number"}
    <div class="flex flex-col items-center gap-2">
      <p class="font-bold text-2xl">Enter passport number</p>
      <form
        onsubmit={(e) => {
          e.preventDefault();
          handleSubmitPassport();
        }}
        class="flex items-center gap-2"
      >
        <input
          class="border-2 border-black w-24 p-1 rounded-sm font-mono text-xl"
          type="text"
          inputmode="numeric"
          bind:value={passportInput}
        />
        <button
          class="py-1 px-2 font-bold bg-amber-400 hover:bg-amber-500 transition duration-100 border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] disabled:bg-gray-300"
          disabled={!passportInput || submitting}
          type="submit"
        >
          {submitting ? "Submitting..." : "Submit"}
        </button>
      </form>
    </div>
  {:else if authState === "wait_scan"}
    <div
      class="w-11/12 sm:w-auto p-4 sm:p-12 border-2 rounded border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] bg-gradient-to-tr from-amber-100 to-amber-200 flex flex-col gap-2"
    >
      <p class="font-bold text-2xl sm:text-3xl text-center">
        SCAN YOUR PASSPORT NOW
      </p>
      <p class="text-center leading-5">
        Hold your phone near your passport and open the URL.
      </p>
    </div>
  {:else if authState === "authorize"}
    <div class="flex flex-col justify-center items-center gap-8 w-11/12 sm:w-auto">
      <div class="flex flex-col gap-2">
        <h1 class="text-4xl text-center font-bold">Authorize?</h1>
        <p>
          <span class="bg-gray-100 rounded px-2 inline-block">{clientName}</span>
          wants to authenticate with your passport and use the following scopes:
        </p>
        <ul class="list-disc">
          {#each scopes as scope (scope)}
            <li>
              <span class="bg-gray-100 rounded px-2 inline-block">{scope}</span>: {scopeExplanation(scope)}
            </li>
          {/each}
        </ul>
      </div>
      <div class="flex flex-col justify-center items-center gap-4">
        {#if totpNeeded}
          <div class="flex flex-col">
            <label for="totpInput">2FA code</label>
            <input
              class="border-[3px] border-black p-1 rounded-sm font-mono focus:outline-none text-6xl w-64"
              id="totpInput"
              type="text"
              pattern="[0-9]*"
              inputmode="numeric"
              oninput={(e) => {
                const val = e.currentTarget.value;
                if (/^\d*$/.test(val)) {
                  totpCode = val;
                } else {
                  totpCode = "";
                }
              }}
            />
          </div>
        {/if}
        <div class="flex flex-row gap-2">
          <form method="post" action={makeSubmitUrl(false)} onsubmit={() => { authorizing = true; }}>
            <button
              class="w-full px-3 py-2 text-xl font-bold bg-red-300 hover:bg-red-500 border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] disabled:shadow-none rounded-sm disabled:bg-gray-100 disabled:hover:bg-gray-100 transition"
              type="submit"
              disabled={authorizing || (totpNeeded === true && totpCode.length < 6)}
            >
              DENY
            </button>
          </form>
          <form method="post" action={makeSubmitUrl(true)} onsubmit={() => { authorizing = true; }}>
            <button
              class="w-full px-3 py-2 text-xl font-bold bg-green-300 hover:bg-green-500 border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] disabled:shadow-none rounded-sm disabled:bg-gray-100 disabled:hover:bg-gray-100 transition"
              type="submit"
              disabled={authorizing || (totpNeeded === true && totpCode.length < 6)}
            >
              ACCEPT
            </button>
          </form>
        </div>
      </div>
    </div>
  {/if}
</div>
