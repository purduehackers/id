use leptos::prelude::*;
use leptos_router::{
    components::*,
    hooks::{use_params, use_query},
    params::Params,
};

use crate::{scan_post, ScanPost};

#[derive(Debug, Params, PartialEq, Eq)]
struct Query {
    id: String,
    secret: String,
}

#[component]
pub fn Scan() -> impl IntoView {
    let q = use_query::<Query>();

    let send = ServerAction::<ScanPost>::new();
    if let Ok(Query { id, secret }) = q.read().as_ref() && let Ok(id) = id.parse::<i32>() {
        send.dispatch(ScanPost {
            id,
            secret: secret.clone(),
        });
    }

    let css = move || {
        if *send.pending().read() {
            "from-amber-100 to-amber-200"
        } else if let Some(Ok(())) = *send.value().read() {
            "from-green-100 to-green-200"
        } else {
            "from-red-100 to-red-200"
        }
    };

    view! {
        <div class="min-h-screen flex flex-col justify-center items-center font-main">
            <div class=format!(
                "w-11/12 sm:w-5/12 p-4 sm:p-12 border-2 rounded border-black shadow-blocks-sm bg-gradient-to-tr {} flex flex-col gap-2 text-center",
                css(),
            )>

                {if *send.pending().read() {
                    view! { <h1 class="text-3xl font-bold">Authorizing...</h1> }.into_any()
                } else if let Some(Ok(())) = *send.value().read() {
                    view! {
                        <>
                            <h1 class="text-3xl font-bold ">Success!</h1>
                            <p>You can close this page now.</p>
                        </>
                    }
                        .into_any()
                } else {
                    view! {
                        <>
                            <h1 class="text-3xl font-bold">Error authorizing</h1>
                            <p>
                                Please try again from the beginning. If the issue persists, send a
                                message in #lounge.
                            </p>
                        </>
                    }
                        .into_any()
                }}

            </div>
        </div>
    }
}
