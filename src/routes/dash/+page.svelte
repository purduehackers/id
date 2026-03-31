<script lang="ts">
  import type { PageData } from "./$types.js";
  import { enhance } from "$app/forms";
  import { invalidateAll } from "$app/navigation";

  let { data }: { data: PageData } = $props();

  let showCreateForm = $state(false);
  let createdClient = $state<any>(null);

  // Create form state
  let newName = $state("");
  let newRedirectUris = $state([""]);
  let newIsConfidential = $state(false);
  let newSelectedScopes = $state(["user:read"]);
  let createError = $state<string | null>(null);

  // Delete confirmation
  let confirmDeleteId = $state<number | null>(null);

  // Edit URIs state
  let editingUrisId = $state<number | null>(null);
  let editUris = $state<string[]>([]);
  let editSaving = $state(false);
  let editError = $state<string | null>(null);

  let availableScopes = $derived(
    data.user?.role === "admin"
      ? ["user:read", "user", "admin:read", "admin"]
      : ["user:read", "user"]
  );

  let userName = $derived(
    data.user?.name ?? `User #${data.user?.id ?? "?"}`
  );

  function addRedirectUri() {
    newRedirectUris = [...newRedirectUris, ""];
  }

  function removeRedirectUri(index: number) {
    newRedirectUris = newRedirectUris.filter((_, i) => i !== index);
  }

  function updateRedirectUri(index: number, value: string) {
    newRedirectUris = newRedirectUris.map((uri, i) => (i === index ? value : uri));
  }

  function toggleScope(scope: string) {
    if (newSelectedScopes.includes(scope)) {
      newSelectedScopes = newSelectedScopes.filter((s) => s !== scope);
    } else {
      newSelectedScopes = [...newSelectedScopes, scope];
      if (scope === "user" && !newSelectedScopes.includes("user:read")) {
        newSelectedScopes = [...newSelectedScopes, "user:read"];
      }
      if (scope === "admin" && !newSelectedScopes.includes("admin:read")) {
        newSelectedScopes = [...newSelectedScopes, "admin:read"];
      }
    }
  }

  function startEditUris(client: typeof data.clients[0]) {
    editingUrisId = client.id;
    editUris = [...client.redirectUris];
    editError = null;
  }
</script>

<div class="p-4">
  {#if !data.user}
    <div class="min-h-screen flex flex-col justify-center items-center gap-4 p-4">
      <h1 class="text-3xl font-bold">Client Dashboard</h1>
      <p class="text-gray-600 max-w-md text-center">
        You need to be logged in to manage OAuth clients. Please authenticate with your passport.
      </p>
      <a
        href="/api/authorize?client_id=id-dash&redirect_uri=https://id.purduehackers.com/dash&scope=user:read%20auth&response_type=code"
        class="px-4 py-2 bg-amber-400 hover:bg-amber-500 border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] rounded font-bold transition"
      >
        Login with Passport
      </a>
    </div>
  {:else}
    <div class="min-h-screen p-4 max-w-4xl mx-auto">
      <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h1 class="text-3xl font-bold">Client Dashboard</h1>
          <p class="text-gray-600">Logged in as {userName} ({data.user.role})</p>
          <form method="POST" action="?/toggleSession" use:enhance={() => {
            return async ({ result }) => {
              if (result.type === "success") await invalidateAll();
            };
          }}>
            <label class="inline-flex items-center gap-2 cursor-pointer text-sm mt-1">
              <input
                type="checkbox"
                class="w-4 h-4"
                checked={data.user.savesSession}
                onchange={(e) => e.currentTarget.form?.requestSubmit()}
              />
              <span>Save session cookie</span>
            </label>
          </form>
        </div>
        <div class="flex gap-2">
          <button
            class="px-4 py-2 bg-green-400 hover:bg-green-500 border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] rounded font-bold transition"
            onclick={() => (showCreateForm = true)}
          >
            Create Client
          </button>
          <a
            href="/logout"
            class="px-4 py-2 bg-gray-200 hover:bg-gray-300 border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] rounded font-bold transition"
          >
            Logout
          </a>
        </div>
      </div>

      {#if showCreateForm}
        <div class="border-2 border-black rounded p-4 bg-amber-50 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] mb-6">
          <h2 class="text-xl font-bold mb-4">Create New Client</h2>
          <form
            method="POST"
            action="?/create"
            use:enhance={() => {
              return async ({ result, update }) => {
                if (result.type === "success" && (result.data as any)?.created) {
                  createdClient = (result.data as any).created;
                  showCreateForm = false;
                  newName = "";
                  newRedirectUris = [""];
                  newSelectedScopes = ["user:read"];
                  newIsConfidential = false;
                  createError = null;
                  await invalidateAll();
                } else if (result.type === "failure") {
                  createError = (result.data as any)?.error ?? "Failed to create client";
                }
              };
            }}
            class="space-y-4"
          >
            <div>
              <label class="block font-medium mb-1" for="clientName">Name</label>
              <input
                id="clientName"
                type="text"
                name="name"
                class="w-full border-2 border-black rounded p-2"
                placeholder="My Application"
                bind:value={newName}
              />
            </div>
            <div>
              <span class="block font-medium mb-1">Redirect URIs</span>
              <div class="space-y-2">
                {#each newRedirectUris as uri, i (i)}
                  <div class="flex gap-2 items-center">
                    <input
                      type="text"
                      class="flex-1 border-2 border-black rounded p-2"
                      placeholder="https://example.com/callback"
                      value={uri}
                      oninput={(e) => updateRedirectUri(i, e.currentTarget.value)}
                    />
                    {#if newRedirectUris.length > 1}
                      <button
                        type="button"
                        class="px-2 py-2 bg-red-100 hover:bg-red-200 border-2 border-black rounded text-sm transition"
                        onclick={() => removeRedirectUri(i)}
                      >
                        Remove
                      </button>
                    {/if}
                  </div>
                {/each}
                <button
                  type="button"
                  class="px-3 py-1 bg-gray-100 hover:bg-gray-200 border-2 border-black rounded text-sm transition"
                  onclick={addRedirectUri}
                >
                  + Add Redirect URI
                </button>
              </div>
            </div>
            <div>
              <span class="block font-medium mb-1">Scopes</span>
              <div class="flex flex-wrap gap-2">
                {#each availableScopes as scope (scope)}
                  <label class="inline-flex items-center gap-1 cursor-pointer">
                    <input
                      type="checkbox"
                      class="w-4 h-4"
                      checked={newSelectedScopes.includes(scope)}
                      onchange={() => toggleScope(scope)}
                    />
                    <span class="bg-gray-100 px-2 py-1 rounded text-sm">{scope}</span>
                  </label>
                {/each}
              </div>
            </div>
            <div>
              <label class="inline-flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  class="w-4 h-4"
                  bind:checked={newIsConfidential}
                />
                <span>Confidential client (generates a client secret)</span>
              </label>
            </div>

            <input type="hidden" name="redirectUris" value={JSON.stringify(newRedirectUris.filter((u) => u.length > 0))} />
            <input type="hidden" name="scopes" value={JSON.stringify(newSelectedScopes)} />
            <input type="hidden" name="isConfidential" value={String(newIsConfidential)} />

            {#if createError}
              <div class="text-red-600 text-sm">{createError}</div>
            {/if}
            <div class="flex gap-2">
              <button
                type="submit"
                class="px-4 py-2 bg-green-400 hover:bg-green-500 border-2 border-black rounded font-bold transition disabled:bg-gray-200"
              >
                Create
              </button>
              <button
                type="button"
                onclick={() => (showCreateForm = false)}
                class="px-4 py-2 bg-gray-200 hover:bg-gray-300 border-2 border-black rounded font-bold transition"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      {/if}

      {#if createdClient}
        <div class="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div class="bg-white border-2 border-black rounded p-6 max-w-lg w-full shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
            <h2 class="text-xl font-bold mb-4">Client Created!</h2>
            <div class="space-y-3 mb-4">
              <div>
                <span class="text-gray-500">Client ID:</span>
                <code class="block bg-gray-100 p-2 rounded mt-1 break-all select-all">{createdClient.clientId}</code>
              </div>
              <div>
                <span class="text-gray-500">Redirect URIs:</span>
                <code class="block bg-gray-100 p-2 rounded mt-1 break-all select-all">{createdClient.redirectUris?.join(", ")}</code>
              </div>
              {#if createdClient.clientSecret}
                <div>
                  <span class="text-gray-500">Client Secret:</span>
                  <div class="bg-amber-100 border-2 border-amber-400 rounded p-2 mt-1">
                    <p class="text-amber-800 text-sm mb-2 font-bold">
                      Save this secret now! It will not be shown again.
                    </p>
                    <code class="block bg-white p-2 rounded break-all select-all">{createdClient.clientSecret}</code>
                  </div>
                </div>
              {/if}
            </div>
            <button
              onclick={() => (createdClient = null)}
              class="w-full px-4 py-2 bg-gray-200 hover:bg-gray-300 border-2 border-black rounded font-bold transition"
            >
              Close
            </button>
          </div>
        </div>
      {/if}

      {#if data.clients.length === 0}
        <div class="text-center py-8 text-gray-500">
          <p>No clients yet. Create one to get started!</p>
        </div>
      {:else}
        <div class="space-y-4">
          <h2 class="text-xl font-bold">Your Clients</h2>
          <div class="grid gap-4">
            {#each data.clients as client (client.id)}
              <div class="border-2 border-black rounded p-4 bg-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                <div class="flex justify-between items-start gap-4">
                  <div class="flex-1 min-w-0">
                    <h3 class="font-bold text-lg truncate">{client.name}</h3>
                    <div class="mt-2 space-y-1 text-sm">
                      <div>
                        <span class="text-gray-500">Client ID: </span>
                        <code class="bg-gray-100 px-1 rounded break-all">{client.clientId}</code>
                      </div>
                      <div>
                        <div class="flex items-center gap-2">
                          <span class="text-gray-500">Redirect URIs: </span>
                          <button
                            class="text-xs px-2 py-0.5 bg-blue-100 hover:bg-blue-200 border border-blue-300 rounded transition"
                            onclick={() => startEditUris(client)}
                          >
                            Edit
                          </button>
                        </div>
                        {#if editingUrisId === client.id}
                          <form
                            method="POST"
                            action="?/updateUris"
                            use:enhance={() => {
                              editSaving = true;
                              return async ({ result }) => {
                                editSaving = false;
                                if (result.type === "success") {
                                  editingUrisId = null;
                                  await invalidateAll();
                                } else if (result.type === "failure") {
                                  editError = (result.data as any)?.error ?? "Failed to update";
                                }
                              };
                            }}
                            class="mt-2 space-y-2"
                          >
                            <input type="hidden" name="id" value={client.id} />
                            <input type="hidden" name="redirectUris" value={JSON.stringify(editUris.filter((u) => u.length > 0))} />
                            {#each editUris as uri, i (i)}
                              <div class="flex gap-2 items-center">
                                <input
                                  type="text"
                                  class="flex-1 border-2 border-black rounded p-1 text-sm"
                                  placeholder="https://example.com/callback"
                                  value={uri}
                                  oninput={(e) => {
                                    editUris = editUris.map((u, idx) =>
                                      idx === i ? e.currentTarget.value : u
                                    );
                                  }}
                                />
                                <button
                                  type="button"
                                  class="px-2 py-1 bg-red-100 hover:bg-red-200 border border-red-300 rounded text-xs transition"
                                  onclick={() => {
                                    editUris = editUris.filter((_, idx) => idx !== i);
                                  }}
                                  disabled={editUris.length <= 1}
                                >
                                  Remove
                                </button>
                              </div>
                            {/each}
                            <div class="flex gap-2 flex-wrap">
                              <button
                                type="button"
                                class="px-2 py-1 bg-gray-100 hover:bg-gray-200 border border-gray-300 rounded text-xs transition"
                                onclick={() => {
                                  editUris = [...editUris, ""];
                                }}
                              >
                                + Add URI
                              </button>
                              <button
                                type="submit"
                                class="px-2 py-1 bg-green-200 hover:bg-green-300 border border-green-400 rounded text-xs font-bold transition disabled:bg-gray-200"
                                disabled={editSaving}
                              >
                                {editSaving ? "Saving..." : "Save"}
                              </button>
                              <button
                                type="button"
                                class="px-2 py-1 bg-gray-100 hover:bg-gray-200 border border-gray-300 rounded text-xs transition"
                                onclick={() => (editingUrisId = null)}
                              >
                                Cancel
                              </button>
                            </div>
                            {#if editError}
                              <div class="text-red-600 text-xs">{editError}</div>
                            {/if}
                          </form>
                        {:else}
                          <div class="mt-1 space-y-0.5">
                            <code class="bg-gray-100 px-1 rounded break-all">{client.redirectUris.join(", ")}</code>
                          </div>
                        {/if}
                      </div>
                      <div>
                        <span class="text-gray-500">Scopes: </span>
                        <code class="bg-gray-100 px-1 rounded">{client.scopes}</code>
                      </div>
                      <div>
                        <span class="text-gray-500">Type: </span>
                        {client.isConfidential ? "Confidential" : "Public"}
                      </div>
                    </div>
                  </div>
                  <form
                    method="POST"
                    action="?/delete"
                    use:enhance={() => {
                      return async ({ result }) => {
                        if (result.type === "success") {
                          confirmDeleteId = null;
                          await invalidateAll();
                        }
                      };
                    }}
                  >
                    <input type="hidden" name="id" value={client.id} />
                    {#if confirmDeleteId === client.id}
                      <button
                        type="submit"
                        class="px-3 py-1 bg-red-500 hover:bg-red-600 border-2 border-black rounded font-bold text-sm text-white transition"
                      >
                        Confirm?
                      </button>
                    {:else}
                      <button
                        type="button"
                        class="px-3 py-1 bg-red-300 hover:bg-red-500 border-2 border-black rounded font-bold text-sm transition"
                        onclick={() => (confirmDeleteId = client.id)}
                      >
                        Delete
                      </button>
                    {/if}
                  </form>
                </div>
              </div>
            {/each}
          </div>
        </div>
      {/if}
    </div>
  {/if}
</div>
