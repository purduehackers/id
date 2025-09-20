use std::time::Duration;

use leptos::{prelude::*, task::spawn_local};
use leptos_router::{hooks::use_query, params::Params};

use crate::{LeptosRouteError, ScanPost};

#[server]
pub async fn scan_get(id: i32) -> Result<bool, LeptosRouteError> {
    Ok(crate::routes::scan::get_handler(id).await?)
}

#[derive(Debug, Clone, Copy)]
enum AuthState {
    EnterNumber,
    WaitForScan,
    Authorize,
    NoClient,
}

#[derive(Debug, Params, PartialEq, Eq, Clone)]
struct AuthQuery {
    client_id: String,
    scope: String,
    session: Option<String>,
}

#[server]
pub async fn valid_clients_list() -> Result<Vec<String>, LeptosRouteError> {
    Ok(crate::routes::client::handler().await?)
}

#[component]
pub fn Authorize() -> impl IntoView {
    let query = use_query::<AuthQuery>();
    let query = move || query.get().ok();
    let client_id = query().map(|q| q.client_id.clone()).unwrap_or_default();
    let scopes = query()
        .map(|q| {
            q.scope
                .split_whitespace()
                .map(|s| s.to_owned())
                .collect::<Vec<_>>()
        })
        .unwrap_or_default();
    let has_session = query().map(|q| q.session.is_some()).unwrap_or_default();
    let is_valid_client_id: Resource<bool> = Resource::new(query, |q| async move {
        valid_clients_list()
            .await
            .map(|vc| vc.contains(&q.map(|q| q.client_id).unwrap_or_default()))
            .unwrap_or_default()
    });

    view! {
        <Transition fallback=|| view! {"Loading..."}>
            <AuthInner is_valid_client_id=is_valid_client_id.get().unwrap_or_default() has_session=has_session client_id=client_id scopes=scopes />
        </Transition>
    }
}

#[component]
fn AuthInner(
    is_valid_client_id: bool,
    has_session: bool,
    client_id: String,
    scopes: Vec<String>,
) -> impl IntoView {
    let (passport_number, set_passport_number) = signal(None::<i32>);
    let (auth_state, set_auth_state) = signal(match (is_valid_client_id, has_session) {
        (true, true) => AuthState::Authorize,
        (true, false) => AuthState::EnterNumber,
        (false, _) => AuthState::NoClient,
    });
    let (totp_needed, set_totp_needed) = signal(false);
    let (totp_code, set_totp_code) = signal(String::new());
    let (checker_hnd, set_checker_hnd) = signal(None::<IntervalHandle>);

    Effect::new(move || {
        if !matches!(auth_state(), AuthState::WaitForScan) {
            return;
        }

        let id = passport_number().expect("passport number");

        let hnd = match set_interval_with_handle(
            move || {
                spawn_local(async move {
                    match scan_get(id).await {
                        Ok(totp_needed) => {
                            set_totp_needed(totp_needed);
                            set_auth_state(AuthState::Authorize);
                            if let Some(hnd) = checker_hnd() {
                                hnd.clear();
                                set_checker_hnd(None);
                            }
                        }
                        Err(e) => {
                            eprintln!("Failed to scan: {e:?}");
                        }
                    }
                });
            },
            Duration::from_millis(1500),
        ) {
            Ok(hnd) => hnd,
            Err(e) => {
                eprintln!("Failed to set interval: {e:?}");
                return;
            }
        };
        set_checker_hnd(Some(hnd));
    });

    view! {
        <div class="min-h-screen flex flex-col justify-center items-center font-main">
            {match auth_state() {
                AuthState::EnterNumber => {
                    view! {
                        <EnterNumber
                            is_error=false
                            passport_num=passport_number
                            set_passport_num=set_passport_number
                        />
                    }
                        .into_any()
                }
                AuthState::WaitForScan => {
                    view! {
                        <div class="w-11/12 sm:w-auto p-4 sm:p-12 border-2 rounded border-black shadow-blocks-sm bg-gradient-to-tr from-amber-100 to-amber-200 flex flex-col gap-2">
                            <p class="font-bold text-2xl sm:text-3xl text-center">
                                SCAN YOUR PASSPORT NOW
                            </p>
                            <p class="text-center leading-5">
                                Hold your phone near your passport and open the URL.
                            </p>
                        </div>
                    }
                        .into_any()
                }
                AuthState::Authorize => {
                    view! {
                        <Auth
                            client_id=client_id
                            scopes=scopes
                            totp_needed=totp_needed()
                            totp=totp_code
                            set_totp=set_totp_code
                        />
                    }
                        .into_any()
                }
                AuthState::NoClient => {
                    view! { <p class="font-bold text-2xl">No client found</p> }.into_any()
                }
            }}
        </div>
    }
}

#[component]
fn Auth(
    client_id: String,
    scopes: Vec<String>,
    totp_needed: bool,
    totp: ReadSignal<String>,
    set_totp: WriteSignal<String>,
) -> impl IntoView {
    let act = ServerAction::<ScanPost>::new();
    view! {
        <div class="flex flex-col justify-center items-center gap-8 w-11/12 sm:w-auto">
            <div class="flex flex-col gap-2">
                <h1 class="text-4xl text-center font-bold">Authorize?</h1>
                <p>
                    <span class="bg-gray-100 rounded px-2 inline-block">{client_id}</span>
                    {" "}
                    wants to authenticate with your passport and use the following
                    scopes:
                </p>
                <ul class="list-disc">
                    <For
                        each=move || scopes.clone()
                        key=|s| s.clone()
                        children=move |s| {
                            view! {
                                <li>
                                    <span class="bg-gray-100 rounded px-2 inline-block">{s}</span>
                                </li>
                            }
                        }
                    />

                </ul>
            </div>
            <div class="flex flex-col justify-center items-center gap-4">
                <Show when=move || totp_needed>
                    <div class="flex flex-col">
                        <label htmlFor="totpInput">2FA code</label>
                        <input
                            class="autofocus border-[3px] border-black p-1 rounded-sm font-mono focus:outline-none text-6xl w-64"
                            id="totpInput"
                            type="string"
                            pattern="[0-9]*"
                            inputmode="numeric"
                            on:input:target=move |ev| {
                                let val = ev.target().value();
                                if val.len() < 7 || val.parse::<u64>().is_err() {
                                    return;
                                }
                                set_totp(val);
                            }
                        />
                    </div>
                </Show>
                <ActionForm action=act>
                    <div class="flex flex-row gap-2">
                        <button
                            class="w-full px-3 py-2 text-xl font-bold bg-red-300 hover:bg-red-500 border-2 border-black shadow-blocks-tiny disabled:shadow-none rounded-sm disabled:bg-gray-100 disabled:hover:bg-gray-100 transition"
                            type="submit"
                            name="allow"
                            value="false"
                            disabled=totp_needed && totp().len() < 6
                        >
                            DENY
                        </button>
                        <button
                            class="w-full px-3 py-2 text-xl font-bold bg-green-300 hover:bg-green-500 border-2 border-black shadow-blocks-tiny disabled:shadow-none rounded-sm disabled:bg-gray-100 disabled:hover:bg-gray-100 transition"
                            type="submit"
                            name="allow"
                            value="true"
                            disabled=totp_needed && totp().len() < 6
                        >
                            ACCEPT
                        </button>
                    </div>
                </ActionForm>
            </div>
        </div>
    }
}

#[component]
fn EnterNumber(
    is_error: bool,
    passport_num: ReadSignal<Option<i32>>,
    set_passport_num: WriteSignal<Option<i32>>,
) -> impl IntoView {
    let select_action = ServerAction::<ScanPost>::new();
    view! {
        <div class="flex flex-col items-center gap-2">
            <p class="font-bold text-2xl">Enter passport number</p>
            <ActionForm action=select_action>
                <input
                    class="border-2 border-black w-24 p-1 rounded-sm font-mono text-xl"
                    type="string"
                    inputmode="numeric"
                    on:input:target=move |ev| {
                        set_passport_num(ev.target().value().parse::<i32>().ok())
                    }
                />

                <button
                    class="py-1 px-2 font-bold bg-amber-400 hover:bg-amber-500 transition duration-100 border-2 border-black shadow-blocks-tiny disabled:bg-gray-300"
                    disabled=passport_num().is_none() || select_action.pending()()
                >
                    {if select_action.pending()() { "Submitting..." } else { "Submit" }}
                </button>
            </ActionForm>

            <Show when=move || is_error>
                <p class="text-red-400 max-w-md mt-2">
                    Can&#39;t find a passport by this number. Either it doesn&#39;t
                    exist, is not activated, or there&#39;s another active session. If
                    you&#39;re sure this passport number exists, try again in 90
                    seconds.
                </p>
            </Show>
        </div>
    }
}
