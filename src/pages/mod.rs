use leptos::prelude::*;
use leptos_router::components::*;

pub mod authorize;
pub mod dash;
pub mod scan;

#[component]
pub fn Index() -> impl IntoView {
    view! {
        <div class="p-4 max-w-lg">
            <h1 class="text-2xl font-bold font-mono">id.purduehackers.com</h1>
            <p>
                "This is purdue hackers' passport-based authentication service. You
                can't do very much here. Try using Sign In with Passport on a
                supported page,"{" "} <span class="underline">
                    <A href="https://id-auth.purduehackers.com">like this one</A>
                </span>.
            </p>
        </div>
    }
}
