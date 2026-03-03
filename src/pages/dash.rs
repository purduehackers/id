use leptos::prelude::*;
use leptos_router::hooks::use_query_map;

use crate::{ClientCreatedResponse, ClientResponse, CreateClientRequest, UserInfo};

#[component]
pub fn Dash() -> impl IntoView {
    let query = use_query_map();

    // Use LocalResource to avoid SSR/hydration mismatch
    let user_resource = LocalResource::new(move || {
        let code = query.read().get("code").unwrap_or_default();
        async move {
            let _ = code; // Use code as dependency
            crate::get_current_user().await.ok().flatten()
        }
    });

    view! {
        <div class="p-4">
            {move || match user_resource.get() {
                None => view! { <div>"Loading..."</div> }.into_any(),
                Some(None) => view! { <LoginPrompt /> }.into_any(),
                Some(Some(user)) => view! { <DashboardContent user=user /> }.into_any(),
            }}
        </div>
    }
}

#[component]
fn LoginPrompt() -> impl IntoView {
    view! {
        <div class="min-h-screen flex flex-col justify-center items-center gap-4 p-4">
            <h1 class="text-3xl font-bold">"Client Dashboard"</h1>
            <p class="text-gray-600 max-w-md text-center">
                "You need to be logged in to manage OAuth clients. Please authenticate with your passport."
            </p>
            <a
                rel="external"
                href="/api/authorize?client_id=id-dash&redirect_uri=https://id.purduehackers.com/dash&scope=user:read%20auth&response_type=code"
                class="px-4 py-2 bg-amber-400 hover:bg-amber-500 border-2 border-black shadow-blocks-tiny rounded font-bold transition"
            >
                "Login with Passport"
            </a>
        </div>
    }
}

#[component]
fn DashboardContent(user: UserInfo) -> impl IntoView {
    let (refresh_trigger, set_refresh_trigger) = signal(0u32);

    // Use LocalResource to avoid SSR/hydration mismatch
    let clients_resource = LocalResource::new(move || {
        let _ = refresh_trigger(); // Dependency for refetch
        async move { crate::get_my_clients().await.unwrap_or_default() }
    });

    let (show_create_form, set_show_create_form) = signal(false);
    let (created_client, set_created_client) = signal(None::<ClientCreatedResponse>);

    let refetch_clients = move || {
        set_refresh_trigger.update(|n| *n = n.wrapping_add(1));
    };

    let is_admin = user.role == "Admin";
    let user_name = user.name.unwrap_or_else(|| format!("User #{}", user.id));
    let user_role = user.role;

    view! {
        <div class="min-h-screen p-4 max-w-4xl mx-auto">
            <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                <div>
                    <h1 class="text-3xl font-bold">"Client Dashboard"</h1>
                    <p class="text-gray-600">"Logged in as " {user_name} " (" {user_role} ")"</p>
                </div>
                <div class="flex gap-2">
                    <button
                        class="px-4 py-2 bg-green-400 hover:bg-green-500 border-2 border-black shadow-blocks-tiny rounded font-bold transition"
                        on:click=move |_| set_show_create_form(true)
                    >
                        "Create Client"
                    </button>
                    <a
                        href="/logout"
                        class="px-4 py-2 bg-gray-200 hover:bg-gray-300 border-2 border-black shadow-blocks-tiny rounded font-bold transition"
                    >
                        "Logout"
                    </a>
                </div>
            </div>

            <Show when=move || show_create_form()>
                <CreateClientForm
                    is_admin=is_admin
                    on_created=move |client| {
                        set_created_client(Some(client));
                        set_show_create_form(false);
                        refetch_clients();
                    }
                    on_cancel=move || set_show_create_form(false)
                />
            </Show>

            {move || {
                created_client()
                    .map(|client| {
                        view! {
                            <ClientCreatedModal
                                client=client
                                on_close=move || set_created_client(None)
                            />
                        }
                    })
            }}

            {move || match clients_resource.get() {
                None => view! { <div>"Loading clients..."</div> }.into_any(),
                Some(clients) => {
                    view! { <ClientList clients=clients refetch=refetch_clients /> }.into_any()
                }
            }}
        </div>
    }
}

#[component]
fn ClientList(
    clients: Vec<ClientResponse>,
    refetch: impl Fn() + Copy + Send + Sync + 'static,
) -> impl IntoView {
    if clients.is_empty() {
        return view! {
            <div class="text-center py-8 text-gray-500">
                <p>"No clients yet. Create one to get started!"</p>
            </div>
        }
        .into_any();
    }

    view! {
        <div class="space-y-4">
            <h2 class="text-xl font-bold">"Your Clients"</h2>
            <div class="grid gap-4">
                {clients
                    .into_iter()
                    .map(|client| view! { <ClientCard client=client refetch=refetch /> })
                    .collect_view()}
            </div>
        </div>
    }
    .into_any()
}

#[component]
fn ClientCard(
    client: ClientResponse,
    refetch: impl Fn() + Copy + Send + Sync + 'static,
) -> impl IntoView {
    let (deleting, set_deleting) = signal(false);
    let (confirm_delete, set_confirm_delete) = signal(false);
    let (editing_uris, set_editing_uris) = signal(false);
    let client_id_for_delete = client.id;
    let client_id_for_edit = client.id;
    let initial_uris = client.redirect_uris.clone();

    let handle_delete = move |_| {
        if !confirm_delete() {
            set_confirm_delete(true);
            return;
        }
        set_deleting(true);
        leptos::task::spawn_local(async move {
            match crate::delete_client(client_id_for_delete).await {
                Ok(()) => refetch(),
                Err(e) => leptos::logging::error!("Error deleting client: {e:?}"),
            }
            set_deleting(false);
            set_confirm_delete(false);
        });
    };

    let client_type = if client.is_confidential {
        "Confidential"
    } else {
        "Public"
    };
    let uris_display = client.redirect_uris.join(", ");

    view! {
        <div class="border-2 border-black rounded p-4 bg-white shadow-blocks-tiny">
            <div class="flex justify-between items-start gap-4">
                <div class="flex-1 min-w-0">
                    <h3 class="font-bold text-lg truncate">{client.name}</h3>
                    <div class="mt-2 space-y-1 text-sm">
                        <div>
                            <span class="text-gray-500">"Client ID: "</span>
                            <code class="bg-gray-100 px-1 rounded break-all">
                                {client.client_id}
                            </code>
                        </div>
                        <div>
                            <div class="flex items-center gap-2">
                                <span class="text-gray-500">"Redirect URIs: "</span>
                                <button
                                    class="text-xs px-2 py-0.5 bg-blue-100 hover:bg-blue-200 border border-blue-300 rounded transition"
                                    on:click=move |_| set_editing_uris(true)
                                >
                                    "Edit"
                                </button>
                            </div>
                            <Show
                                when=move || !editing_uris()
                                fallback=move || {
                                    view! {
                                        <EditRedirectUris
                                            client_id=client_id_for_edit
                                            initial_uris=initial_uris.clone()
                                            on_saved=move || {
                                                set_editing_uris(false);
                                                refetch();
                                            }
                                            on_cancel=move || set_editing_uris(false)
                                        />
                                    }
                                }
                            >
                                <div class="mt-1 space-y-0.5">
                                    {
                                        let uris = uris_display.clone();
                                        view! {
                                            <code class="bg-gray-100 px-1 rounded break-all">
                                                {uris}
                                            </code>
                                        }
                                    }
                                </div>
                            </Show>
                        </div>
                        <div>
                            <span class="text-gray-500">"Scopes: "</span>
                            <code class="bg-gray-100 px-1 rounded">{client.scopes}</code>
                        </div>
                        <div>
                            <span class="text-gray-500">"Type: "</span>
                            {client_type}
                        </div>
                    </div>
                </div>
                <button
                    class="px-3 py-1 bg-red-300 hover:bg-red-500 border-2 border-black rounded font-bold text-sm transition disabled:bg-gray-200"
                    disabled=deleting
                    on:click=handle_delete
                >
                    {move || {
                        if deleting() {
                            "Deleting..."
                        } else if confirm_delete() {
                            "Confirm?"
                        } else {
                            "Delete"
                        }
                    }}
                </button>
            </div>
        </div>
    }
}

#[component]
fn EditRedirectUris(
    client_id: i32,
    initial_uris: Vec<String>,
    on_saved: impl Fn() + Copy + Send + Sync + 'static,
    on_cancel: impl Fn() + Copy + Send + Sync + 'static,
) -> impl IntoView {
    let (uris, set_uris) = signal(initial_uris);
    let (saving, set_saving) = signal(false);
    let (error, set_error) = signal(None::<String>);

    let add_uri = move |_| {
        set_uris.update(|u| u.push(String::new()));
    };

    let handle_save = move |_| {
        let current_uris: Vec<String> = uris().into_iter().filter(|u| !u.is_empty()).collect();
        if current_uris.is_empty() {
            set_error(Some("At least one redirect URI is required".to_string()));
            return;
        }
        set_saving(true);
        set_error(None);
        leptos::task::spawn_local(async move {
            match crate::update_client_redirect_uris(client_id, current_uris).await {
                Ok(()) => on_saved(),
                Err(e) => set_error(Some(format!("Error saving: {e:?}"))),
            }
            set_saving(false);
        });
    };

    view! {
        <div class="mt-2 space-y-2">
            <For
                each=move || { uris().into_iter().enumerate().collect::<Vec<_>>() }
                key=|&(i, _)| i
                children=move |(i, uri)| {
                    view! {
                        <div class="flex gap-2 items-center">
                            <input
                                type="text"
                                class="flex-1 border-2 border-black rounded p-1 text-sm"
                                placeholder="https://example.com/callback"
                                prop:value=uri
                                on:input:target=move |ev| {
                                    set_uris
                                        .update(|u| {
                                            if let Some(entry) = u.get_mut(i) {
                                                *entry = ev.target().value();
                                            }
                                        });
                                }
                            />
                            <button
                                type="button"
                                class="px-2 py-1 bg-red-100 hover:bg-red-200 border border-red-300 rounded text-xs transition"
                                on:click=move |_| {
                                    set_uris
                                        .update(|u| {
                                            u.remove(i);
                                        });
                                }
                                disabled=move || { uris().len() <= 1 }
                            >
                                "Remove"
                            </button>
                        </div>
                    }
                }
            />
            <div class="flex gap-2 flex-wrap">
                <button
                    type="button"
                    class="px-2 py-1 bg-gray-100 hover:bg-gray-200 border border-gray-300 rounded text-xs transition"
                    on:click=add_uri
                >
                    "+ Add URI"
                </button>
                <button
                    type="button"
                    class="px-2 py-1 bg-green-200 hover:bg-green-300 border border-green-400 rounded text-xs font-bold transition disabled:bg-gray-200"
                    disabled=saving
                    on:click=handle_save
                >
                    {move || if saving() { "Saving..." } else { "Save" }}
                </button>
                <button
                    type="button"
                    class="px-2 py-1 bg-gray-100 hover:bg-gray-200 border border-gray-300 rounded text-xs transition"
                    on:click=move |_| on_cancel()
                >
                    "Cancel"
                </button>
            </div>
            <Show when=move || error().is_some()>
                <div class="text-red-600 text-xs">{move || error()}</div>
            </Show>
        </div>
    }
}

#[component]
fn RedirectUriInputList(
    uris: ReadSignal<Vec<String>>,
    set_uris: WriteSignal<Vec<String>>,
) -> impl IntoView {
    let add_uri = move |_| {
        set_uris.update(|u| u.push(String::new()));
    };

    view! {
        <div class="space-y-2">
            <For
                each=move || { uris().into_iter().enumerate().collect::<Vec<_>>() }
                key=|&(i, _)| i
                children=move |(i, uri)| {
                    view! {
                        <div class="flex gap-2 items-center">
                            <input
                                type="text"
                                class="flex-1 border-2 border-black rounded p-2"
                                placeholder="https://example.com/callback"
                                prop:value=uri
                                on:input:target=move |ev| {
                                    set_uris
                                        .update(|u| {
                                            if let Some(entry) = u.get_mut(i) {
                                                *entry = ev.target().value();
                                            }
                                        });
                                }
                            />
                            <Show when=move || { uris().len() > 1 }>
                                <button
                                    type="button"
                                    class="px-2 py-2 bg-red-100 hover:bg-red-200 border-2 border-black rounded text-sm transition"
                                    on:click=move |_| {
                                        set_uris
                                            .update(|u| {
                                                u.remove(i);
                                            });
                                    }
                                >
                                    "Remove"
                                </button>
                            </Show>
                        </div>
                    }
                }
            />
            <button
                type="button"
                class="px-3 py-1 bg-gray-100 hover:bg-gray-200 border-2 border-black rounded text-sm transition"
                on:click=add_uri
            >
                "+ Add Redirect URI"
            </button>
        </div>
    }
}

#[component]
fn CreateClientForm(
    is_admin: bool,
    on_created: impl Fn(ClientCreatedResponse) + Copy + Send + Sync + 'static,
    on_cancel: impl Fn() + Copy + Send + Sync + 'static,
) -> impl IntoView {
    let (name, set_name) = signal(String::new());
    let (redirect_uris, set_redirect_uris) = signal(vec![String::new()]);
    let (is_confidential, set_is_confidential) = signal(false);
    let (selected_scopes, set_selected_scopes) = signal(vec!["user:read".to_string()]);
    let (submitting, set_submitting) = signal(false);
    let (error, set_error) = signal(None::<String>);

    let available_scopes: Vec<&'static str> = if is_admin {
        vec!["user:read", "user", "admin:read", "admin"]
    } else {
        vec!["user:read", "user"]
    };

    let handle_submit = move |ev: leptos::ev::SubmitEvent| {
        ev.prevent_default();
        let uris: Vec<String> = redirect_uris()
            .into_iter()
            .filter(|u| !u.is_empty())
            .collect();
        if name().is_empty() || uris.is_empty() || selected_scopes().is_empty() {
            set_error(Some("Please fill in all required fields".to_string()));
            return;
        }
        set_submitting(true);
        set_error(None);
        let req = CreateClientRequest {
            name: name(),
            redirect_uris: uris,
            scopes: selected_scopes(),
            is_confidential: is_confidential(),
        };
        leptos::task::spawn_local(async move {
            match crate::create_client(req).await {
                Ok(client) => on_created(client),
                Err(e) => set_error(Some(format!("Error creating client: {e:?}"))),
            }
            set_submitting(false);
        });
    };

    view! {
        <div class="border-2 border-black rounded p-4 bg-amber-50 shadow-blocks-tiny mb-6">
            <h2 class="text-xl font-bold mb-4">"Create New Client"</h2>
            <form on:submit=handle_submit class="space-y-4">
                <div>
                    <label class="block font-medium mb-1">"Name"</label>
                    <input
                        type="text"
                        class="w-full border-2 border-black rounded p-2"
                        placeholder="My Application"
                        on:input:target=move |ev| set_name(ev.target().value())
                        prop:value=name
                    />
                </div>
                <div>
                    <label class="block font-medium mb-1">"Redirect URIs"</label>
                    <RedirectUriInputList uris=redirect_uris set_uris=set_redirect_uris />
                </div>
                <div>
                    <label class="block font-medium mb-1">"Scopes"</label>
                    <div class="flex flex-wrap gap-2">
                        {available_scopes
                            .into_iter()
                            .map(|scope| {
                                let scope_str = scope.to_string();
                                let scope_check = scope_str.clone();
                                let scope_toggle = scope_str.clone();
                                view! {
                                    <label class="inline-flex items-center gap-1 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            class="w-4 h-4"
                                            checked=move || selected_scopes().contains(&scope_check)
                                            on:change=move |_| {
                                                let s = scope_toggle.clone();
                                                set_selected_scopes
                                                    .update(|scopes| {
                                                        if scopes.contains(&s) {
                                                            scopes.retain(|x| x != &s);
                                                        } else {
                                                            scopes.push(s.clone());
                                                            if s == "user" && !scopes.contains(&"user:read".to_string())
                                                            {
                                                                scopes.push("user:read".to_string());
                                                            }
                                                            if s == "admin"
                                                                && !scopes.contains(&"admin:read".to_string())
                                                            {
                                                                scopes.push("admin:read".to_string());
                                                            }
                                                        }
                                                    });
                                            }
                                        />
                                        <span class="bg-gray-100 px-2 py-1 rounded text-sm">
                                            {scope}
                                        </span>
                                    </label>
                                }
                            })
                            .collect_view()}
                    </div>
                </div>
                <div>
                    <label class="inline-flex items-center gap-2 cursor-pointer">
                        <input
                            type="checkbox"
                            class="w-4 h-4"
                            on:change:target=move |ev| set_is_confidential(ev.target().checked())
                            prop:checked=is_confidential
                        />
                        <span>"Confidential client (generates a client secret)"</span>
                    </label>
                </div>
                <Show when=move || error().is_some()>
                    <div class="text-red-600 text-sm">{move || error()}</div>
                </Show>
                <div class="flex gap-2">
                    <button
                        type="submit"
                        disabled=submitting
                        class="px-4 py-2 bg-green-400 hover:bg-green-500 border-2 border-black rounded font-bold transition disabled:bg-gray-200"
                    >
                        {move || if submitting() { "Creating..." } else { "Create" }}
                    </button>
                    <button
                        type="button"
                        on:click=move |_| on_cancel()
                        class="px-4 py-2 bg-gray-200 hover:bg-gray-300 border-2 border-black rounded font-bold transition"
                    >
                        "Cancel"
                    </button>
                </div>
            </form>
        </div>
    }
}

#[component]
fn ClientCreatedModal(
    client: ClientCreatedResponse,
    on_close: impl Fn() + Copy + Send + Sync + 'static,
) -> impl IntoView {
    let uris_display = client.redirect_uris.join(", ");

    view! {
        <div class="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div class="bg-white border-2 border-black rounded p-6 max-w-lg w-full shadow-blocks-sm">
                <h2 class="text-xl font-bold mb-4">"Client Created!"</h2>
                <div class="space-y-3 mb-4">
                    <div>
                        <span class="text-gray-500">"Client ID:"</span>
                        <code class="block bg-gray-100 p-2 rounded mt-1 break-all select-all">
                            {client.client_id.clone()}
                        </code>
                    </div>
                    <div>
                        <span class="text-gray-500">"Redirect URIs:"</span>
                        <code class="block bg-gray-100 p-2 rounded mt-1 break-all select-all">
                            {uris_display}
                        </code>
                    </div>
                    {client
                        .client_secret
                        .clone()
                        .map(|secret| {
                            view! {
                                <div>
                                    <span class="text-gray-500">"Client Secret:"</span>
                                    <div class="bg-amber-100 border-2 border-amber-400 rounded p-2 mt-1">
                                        <p class="text-amber-800 text-sm mb-2 font-bold">
                                            "Save this secret now! It will not be shown again."
                                        </p>
                                        <code class="block bg-white p-2 rounded break-all select-all">
                                            {secret}
                                        </code>
                                    </div>
                                </div>
                            }
                        })}
                </div>
                <button
                    on:click=move |_| on_close()
                    class="w-full px-4 py-2 bg-gray-200 hover:bg-gray-300 border-2 border-black rounded font-bold transition"
                >
                    "Close"
                </button>
            </div>
        </div>
    }
}
