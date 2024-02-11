import { useState, useEffect } from "react";

enum AuthState {
  EnterNumber,
  WaitForScan,
  Authorize,
}

export default function Authorize() {
  const [passport, setPassport] = useState("");
  const [state, setState] = useState(AuthState.EnterNumber);
  const [totpNeeded, setTotpNeeded] = useState(false);
  const [numberFormPending, setNumberFormPending] = useState(false);
  const [numberFormError, setNumberFormError] = useState(false);

  const id = passport.includes(".")
    ? parseInt(passport.split(".")[1] ?? "0")
    : Number(passport);

  const selectPassport = async () => {
    setNumberFormPending(true);

    // Send a request to initiate lock
    const res = await fetch("/api/scan", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        id: id,
        secret: "",
      }),
    });

    if (res.status === 400) {
      setNumberFormPending(false);
      setNumberFormError(true);
    }

    if (!res.ok) {
      console.log(`Bad scan open: ${res.status} ${await res.text()}`);
      return;
    }

    setState(AuthState.WaitForScan);
  };

  const formAction = (allow: boolean) => {
    const urldata = new URLSearchParams(window.location.search);
    urldata.set("allow", allow.toString());
    urldata.set("id", id.toString());

    return `/api/authorize?${urldata.toString()}`;
  };

  useEffect(() => {
    if (state != AuthState.WaitForScan) {
      return;
    }

    const interval = setInterval(async () => {
      const resp = await fetch(`/api/scan?id=${id}`);
      switch (resp.status) {
        case 200:
          const { totp_needed } = await resp.json();
          setTotpNeeded(totp_needed);
          setState(AuthState.Authorize);
          clearInterval(interval);
          break;
        case 201:
          break;
        default:
          console.log(`Error on request: ${await resp.text()}`);
      }
    }, 3000);

    return () => {
      clearInterval(interval);
    };
  }, [id, state]);

  return (
    <div className="min-h-screen flex flex-col justify-center items-center font-main">
      {state == AuthState.EnterNumber && (
        <div className="flex flex-col items-center gap-2">
          <p className="font-bold text-2xl">Enter passport number</p>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              selectPassport();
            }}
            className="flex flex-row gap-2"
          >
            <input
              className="border-2 border-black w-24 p-1 rounded-sm font-mono"
              type="number"
              value={passport}
              onChange={(ev) => {
                setPassport(ev.target.value);
              }}
              disabled={state != AuthState.EnterNumber}
            />
            <button
              className="py-1 px-2 font-bold bg-amber-400 hover:bg-amber-500 transition duration-100 border-2 border-black shadow-blocks-tiny disabled:bg-gray-300"
              disabled={
                passport.length === 0 ||
                !/^(?:\d\.)?(\d{1,4})$/.test(passport) ||
                numberFormPending
              }
            >
              {numberFormPending ? "Submitting..." : "Submit"}
            </button>
          </form>
          {numberFormError ? (
            <p className="text-red-400 max-w-md mt-2">
              Scan failed. Either this passport doesn&#39;t exist or there&#39;s
              another active session. If you&#39;re sure this passport number
              exists, try again in 90 seconds.
            </p>
          ) : null}
        </div>
      )}
      {state == AuthState.WaitForScan && (
        <div className="w-11/12 sm:w-auto p-4 sm:p-12 border-2 rounded border-black shadow-blocks-sm bg-gradient-to-tr from-amber-100 to-amber-200 flex flex-col gap-2">
          <p className="font-bold text-2xl sm:text-3xl text-center">
            SCAN YOUR PASSPORT NOW
          </p>
          <p className="text-center">Polling every 3 seconds...</p>
        </div>
      )}
      {state == AuthState.Authorize && (
        <div className="flex flex-col justify-center items-center gap-2">
          <p className="text-3xl font-bold">Authorize?</p>
          <form method="post">
            <div className="flex flex-row gap-2">
              <button
                className="border-2 px-3 shadow-blocks-tiny border-red-600 shadow-red-500 hover:bg-red-100 transition"
                type="submit"
                formAction={formAction(false)}
              >
                DENY
              </button>
              <button
                className="border-2 border-green-600 px-3 shadow-blocks-tiny shadow-green-500 hover:bg-green-100 transition"
                type="submit"
                formAction={formAction(true)}
              >
                ACCEPT
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
