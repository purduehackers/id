use leptos::prelude::*;
use leptos_router::hooks::use_query_map;

use crate::{ClientCreatedResponse, ClientResponse, CreateClientRequest, UserInfo};

#[component]
pub fn Dash() -> impl IntoView {
    let query = use_query_map();
    let user_resource: Resource<Option<UserInfo>> = Resource::new(
        move || query.read().get("code").unwrap_or_default(),
        |_| async { crate::get_current_user().await.ok().flatten() },
    );

    view! {
        <Suspense fallback=|| view! { <div class="p-4">"Loading..."</div> }>
            {move || {
                user_resource
                    .get()
                    .map(|user| {
                        match user {
                            Some(user) => view! { <DashboardContent user=user/> }.into_any(),
                            None => view! { <LoginPrompt/> }.into_any(),
                        }
                    })
            }}
        </Suspense>
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
            <a rel="external"
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
    let clients_resource: Resource<Vec<ClientResponse>> = Resource::new(
        || (),
        |_| async { crate::get_my_clients().await.unwrap_or_default() },
    );

    let (show_create_form, set_show_create_form) = signal(false);
    let (created_client, set_created_client) = signal(None::<ClientCreatedResponse>);
    let (refresh_trigger, set_refresh_trigger) = signal(0u32);

    Effect::new(move |_| {
        let _ = refresh_trigger();
        clients_resource.refetch();
    });

    let refetch_clients = move || {
        set_refresh_trigger.update(|n| *n = n.wrapping_add(1));
    };

    let is_admin = user.role == "Admin";

    view! {
        <div class="min-h-screen p-4 max-w-4xl mx-auto">
            <DashboardHeader user_id=user.id user_role=user.role on_create=move || set_show_create_form(true)/>

            {move || {
                if show_create_form() {
                    view! {
                        <CreateClientForm
                            is_admin=is_admin
                            on_created=move |client| {
                                set_created_client(Some(client));
                                set_show_create_form(false);
                                refetch_clients();
                            }
                            on_cancel=move || set_show_create_form(false)
                        />
                    }.into_any()
                } else {
                    view! { <div></div> }.into_any()
                }
            }}

            {move || {
                created_client().map(|client| {
                    view! {
                        <ClientCreatedModal
                            client=client
                            on_close=move || set_created_client(None)
                        />
                    }
                })
            }}

            <Suspense fallback=|| view! { <div>"Loading clients..."</div> }>
                {move || {
                    clients_resource
                        .get()
                        .map(|clients| {
                            view! { <ClientList clients=clients refetch=refetch_clients/> }
                        })
                }}
            </Suspense>
        </div>
    }
}

#[component]
fn DashboardHeader(
    user_id: i32,
    user_role: String,
    on_create: impl Fn() + Copy + 'static,
) -> impl IntoView {
    view! {
        <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
            <div>
                <h1 class="text-3xl font-bold">"Client Dashboard"</h1>
                <p class="text-gray-600">
                    "Logged in as user #" {user_id} " (" {user_role} ")"
                </p>
            </div>
            <button
                class="px-4 py-2 bg-green-400 hover:bg-green-500 border-2 border-black shadow-blocks-tiny rounded font-bold transition"
                on:click=move |_| on_create()
            >
                "Create Client"
            </button>
        </div>
    }
}

#[component]
fn ClientList(clients: Vec<ClientResponse>, refetch: impl Fn() + Copy + 'static) -> impl IntoView {
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
                    .map(|client| {
                        view! { <ClientCard client=client refetch=refetch/> }.into_any()
                    })
                    .collect_view()}
            </div>
        </div>
    }
    .into_any()
}

#[component]
fn ClientCard(client: ClientResponse, refetch: impl Fn() + Copy + 'static) -> impl IntoView {
    let (deleting, set_deleting) = signal(false);
    let (confirm_delete, set_confirm_delete) = signal(false);

    let client_id_for_delete = client.id;
    let handle_delete = move |_| {
        if !confirm_delete() {
            set_confirm_delete(true);
            return;
        }

        set_deleting(true);
        leptos::task::spawn_local(async move {
            match crate::delete_client(client_id_for_delete).await {
                Ok(()) => {
                    refetch();
                }
                Err(e) => {
                    leptos::logging::error!("Error deleting client: {e:?}");
                }
            }
            set_deleting(false);
            set_confirm_delete(false);
        });
    };

    let button_text = move || {
        if deleting() {
            "Deleting..."
        } else if confirm_delete() {
            "Confirm?"
        } else {
            "Delete"
        }
    };

    view! {
        <div class="border-2 border-black rounded p-4 bg-white shadow-blocks-tiny">
            <div class="flex justify-between items-start gap-4">
                <ClientCardInfo client=client/>
                <button
                    class="px-3 py-1 bg-red-300 hover:bg-red-500 border-2 border-black rounded font-bold text-sm transition disabled:bg-gray-200"
                    disabled=deleting
                    on:click=handle_delete
                >
                    {button_text}
                </button>
            </div>
        </div>
    }
}

#[component]
fn ClientCardInfo(client: ClientResponse) -> impl IntoView {
    let client_type = if client.is_confidential { "Confidential" } else { "Public" };

    view! {
        <div class="flex-1 min-w-0">
            <h3 class="font-bold text-lg truncate">{client.name}</h3>
            <div class="mt-2 space-y-1 text-sm">
                <div>
                    <span class="text-gray-500">"Client ID: "</span>
                    <code class="bg-gray-100 px-1 rounded break-all">{client.client_id}</code>
                </div>
                <div>
                    <span class="text-gray-500">"Redirect URI: "</span>
                    <code class="bg-gray-100 px-1 rounded break-all">{client.redirect_uri}</code>
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
    }
}

#[component]
fn CreateClientForm<FC, FX>(is_admin: bool, on_created: FC, on_cancel: FX) -> impl IntoView
where
    FC: Fn(ClientCreatedResponse) + Copy + 'static,
    FX: Fn() + Copy + 'static,
{
    let (name, set_name) = signal(String::new());
    let (redirect_uri, set_redirect_uri) = signal(String::new());
    let (is_confidential, set_is_confidential) = signal(false);
    let (selected_scopes, set_selected_scopes) = signal(vec!["user:read".to_string()]);
    let (submitting, set_submitting) = signal(false);
    let (error, set_error) = signal(None::<String>);

    let handle_submit = move |ev: leptos::ev::SubmitEvent| {
        ev.prevent_default();

        if name().is_empty() || redirect_uri().is_empty() || selected_scopes().is_empty() {
            set_error(Some("Please fill in all required fields".to_string()));
            return;
        }

        set_submitting(true);
        set_error(None);

        let req = CreateClientRequest {
            name: name(),
            redirect_uri: redirect_uri(),
            scopes: selected_scopes(),
            is_confidential: is_confidential(),
        };

        leptos::task::spawn_local(async move {
            match crate::create_client(req).await {
                Ok(client) => {
                    on_created(client);
                }
                Err(e) => {
                    set_error(Some(format!("Error creating client: {e:?}")));
                }
            }
            set_submitting(false);
        });
    };

    let submit_text = move || if submitting() { "Creating..." } else { "Create" };

    view! {
        <div class="border-2 border-black rounded p-4 bg-amber-50 shadow-blocks-tiny mb-6">
            <h2 class="text-xl font-bold mb-4">"Create New Client"</h2>
            <form on:submit=handle_submit class="space-y-4">
                <FormField label="Name">
                    <input
                        type="text"
                        class="w-full border-2 border-black rounded p-2"
                        placeholder="My Application"
                        on:input:target=move |ev| set_name(ev.target().value())
                        prop:value=name
                    />
                </FormField>

                <FormField label="Redirect URI">
                    <input
                        type="text"
                        class="w-full border-2 border-black rounded p-2"
                        placeholder="https://example.com/callback"
                        on:input:target=move |ev| set_redirect_uri(ev.target().value())
                        prop:value=redirect_uri
                    />
                </FormField>

                <ScopeSelector
                    is_admin=is_admin
                    selected_scopes=selected_scopes
                    set_selected_scopes=set_selected_scopes
                />

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

                {move || {
                    error().map(|e| view! { <div class="text-red-600 text-sm">{e}</div> })
                }}

                <div class="flex gap-2">
                    <button
                        type="submit"
                        class="px-4 py-2 bg-green-400 hover:bg-green-500 border-2 border-black rounded font-bold transition disabled:bg-gray-200"
                        disabled=submitting
                    >
                        {submit_text}
                    </button>
                    <button
                        type="button"
                        class="px-4 py-2 bg-gray-200 hover:bg-gray-300 border-2 border-black rounded font-bold transition"
                        on:click=move |_| on_cancel()
                    >
                        "Cancel"
                    </button>
                </div>
            </form>
        </div>
    }
}

#[component]
fn FormField(label: &'static str, children: Children) -> impl IntoView {
    view! {
        <div>
            <label class="block font-medium mb-1">{label}</label>
            {children()}
        </div>
    }
}

#[component]
fn ScopeSelector(
    is_admin: bool,
    selected_scopes: ReadSignal<Vec<String>>,
    set_selected_scopes: WriteSignal<Vec<String>>,
) -> impl IntoView {
    let available_scopes: Vec<&'static str> = if is_admin {
        vec!["user:read", "user", "admin:read", "admin"]
    } else {
        vec!["user:read", "user"]
    };

    let toggle_scope = move |scope: String| {
        set_selected_scopes.update(|scopes| {
            if scopes.contains(&scope) {
                scopes.retain(|s| s != &scope);
            } else {
                scopes.push(scope);
            }
        });
    };

    view! {
        <div>
            <label class="block font-medium mb-1">"Scopes"</label>
            <div class="flex flex-wrap gap-2">
                {available_scopes
                    .into_iter()
                    .map(|scope| {
                        let scope_string = scope.to_string();
                        let scope_for_check = scope_string.clone();
                        let scope_for_toggle = scope_string.clone();
                        view! {
                            <label class="inline-flex items-center gap-1 cursor-pointer">
                                <input
                                    type="checkbox"
                                    class="w-4 h-4"
                                    checked=move || selected_scopes().contains(&scope_for_check)
                                    on:change=move |_| toggle_scope(scope_for_toggle.clone())
                                />
                                <span class="bg-gray-100 px-2 py-1 rounded text-sm">{scope}</span>
                            </label>
                        }.into_any()
                    })
                    .collect_view()}
            </div>
        </div>
    }
}

#[component]
fn ClientCreatedModal<F>(client: ClientCreatedResponse, on_close: F) -> impl IntoView
where
    F: Fn() + Copy + 'static,
{
    let secret_view = client.client_secret.clone().map(|secret| {
        view! {
            <div>
                <span class="text-gray-500">"Client Secret:"</span>
                <div class="bg-amber-100 border-2 border-amber-400 rounded p-2 mt-1">
                    <p class="text-amber-800 text-sm mb-2 font-bold">
                        "Save this secret now! It will not be shown again."
                    </p>
                    <code class="block bg-white p-2 rounded break-all select-all">{secret}</code>
                </div>
            </div>
        }
    });

    view! {
        <div class="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div class="bg-white border-2 border-black rounded p-6 max-w-lg w-full shadow-blocks-sm">
                <h2 class="text-xl font-bold mb-4">"Client Created!"</h2>

                <div class="space-y-3 mb-4">
                    <div>
                        <span class="text-gray-500">"Client ID:"</span>
                        <code class="block bg-gray-100 p-2 rounded mt-1 break-all select-all">
                            {client.client_id}
                        </code>
                    </div>
                    {secret_view}
                </div>

                <button
                    class="w-full px-4 py-2 bg-gray-200 hover:bg-gray-300 border-2 border-black rounded font-bold transition"
                    on:click=move |_| on_close()
                >
                    "Close"
                </button>
            </div>
        </div>
    }
}
