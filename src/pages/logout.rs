use leptos::prelude::*;

#[component]
pub fn Logout() -> impl IntoView {
    let (logged_out, set_logged_out) = signal(false);
    let (logging_out, set_logging_out) = signal(true);

    // Trigger logout on mount
    Effect::new(move || {
        leptos::task::spawn_local(async move {
            match crate::logout().await {
                Ok(()) => {
                    set_logged_out(true);
                    set_logging_out(false);
                }
                Err(_) => {
                    set_logging_out(false);
                }
            }
        });
    });

    view! {
        <div class="min-h-screen flex flex-col justify-center items-center gap-4 p-4">
            {move || {
                if logging_out() {
                    view! { <p class="text-gray-600">"Logging out..."</p> }.into_any()
                } else if logged_out() {
                    view! {
                        <div class="text-center">
                            <h1 class="text-2xl font-bold mb-4">"Logged Out"</h1>
                            <p class="text-gray-600 mb-4">"You have been successfully logged out."</p>
                            <a
                                href="/dash"
                                class="px-4 py-2 bg-amber-400 hover:bg-amber-500 border-2 border-black shadow-blocks-tiny rounded font-bold transition"
                            >
                                "Back to Dashboard"
                            </a>
                        </div>
                    }.into_any()
                } else {
                    view! {
                        <div class="text-center">
                            <p class="text-red-600 mb-4">"Failed to log out"</p>
                            <a
                                href="/dash"
                                class="px-4 py-2 bg-amber-400 hover:bg-amber-500 border-2 border-black shadow-blocks-tiny rounded font-bold transition"
                            >
                                "Back to Dashboard"
                            </a>
                        </div>
                    }.into_any()
                }
            }}
        </div>
    }
}
