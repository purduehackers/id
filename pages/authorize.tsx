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

  const id = passport.includes(".")
    ? parseInt(passport.split(".")[1] ?? "0")
    : passport;

  const onChoosePassport = async () => {
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
    <div className="min-h-screen flex flex-col justify-center items-center">
      {state == AuthState.EnterNumber && (
        <div className="flex flex-col items-center gap-2">
          <p className="font-bold text-2xl">Enter passport number</p>
          <div className="flex flex-row gap-2">
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
              onClick={() => {
                onChoosePassport();
              }}
              disabled={
                passport.length === 0 || !/^(?:\d\.)?(\d{1,4})$/.test(passport)
              }
            >
              Submit
            </button>
          </div>
        </div>
      )}
      {state == AuthState.WaitForScan && (
        <div>
          <p>WAITING FOR SCAN...</p>
          <p>Polling once every approximately 3 seconds...</p>
        </div>
      )}
      {state == AuthState.Authorize && (
        <div>
          <p>Authorize?</p>
          <form method="post">
            <button type="submit" formAction={formAction(false)}>
              DENY
            </button>
            <button type="submit" formAction={formAction(true)}>
              ACCEPT
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
