import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState, useEffect } from "react";

enum AuthState {
  EnterNumber,
  WaitForScan,
  Authorize,
  NoClient,
}

const validClients = ["dashboard", "passports", "authority", "auth-test"];

export default function Authorize({
  isValidClientId,
}: {
  isValidClientId: boolean;
}) {
  const searchParams = useSearchParams();
  const clientId = searchParams.get("client_id");

  const [passport, setPassport] = useState("");
  const [state, setState] = useState(
    isValidClientId ? AuthState.EnterNumber : AuthState.NoClient
  );
  const [totpNeeded, setTotpNeeded] = useState(false);
  const [totpCode, setTotpCode] = useState("");
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
    if (totpNeeded) {
      urldata.set("code", totpCode);
    }

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
        <div className="flex flex-col justify-center items-center gap-8 w-11/12 sm:w-auto">
          <div className="flex flex-col gap-2">
            <h1 className="text-4xl text-center font-bold">Authorize?</h1>
            <p>
              <pre className="bg-gray-100 rounded px-2 inline-block">
                {clientId ?? "id"}
              </pre>{" "}
              wants to authenticate with your passport.
            </p>
          </div>
          <div className="flex flex-col justify-center items-center gap-4">
            {totpNeeded && (
              <div className="flex flex-col">
                <label htmlFor="totpInput">2FA code</label>
                <input
                  className="autofocus border-[3px] border-black p-1 rounded-sm font-mono focus:outline-none text-6xl w-64"
                  id="totpInput"
                  type="number"
                  value={totpCode}
                  onChange={(ev) => {
                    if (ev.target.value.length < 7) {
                      setTotpCode(ev.target.value);
                    }
                  }}
                />
              </div>
            )}
            <form method="post" className="w-64">
              <div className="flex flex-row gap-2">
                <button
                  className="w-full px-3 py-2 text-xl font-bold bg-red-300 hover:bg-red-500 border-2 border-black shadow-blocks-tiny disabled:shadow-none rounded-sm disabled:bg-gray-100 disabled:hover:bg-gray-100 transition"
                  type="submit"
                  formAction={formAction(false)}
                  disabled={totpNeeded && totpCode.length < 6}
                >
                  DENY
                </button>
                <button
                  className="w-full px-3 py-2 text-xl font-bold bg-green-300 hover:bg-green-500 border-2 border-black shadow-blocks-tiny disabled:shadow-none rounded-sm disabled:bg-gray-100 disabled:hover:bg-gray-100 transition"
                  type="submit"
                  formAction={formAction(true)}
                  disabled={totpNeeded && totpCode.length < 6}
                >
                  ACCEPT
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {state === AuthState.NoClient && (
        <div className="w-11/12 sm:w-auto sm:max-w-3xl p-4 sm:p-12 border-2 rounded border-black shadow-blocks-sm bg-orange-200 flex flex-col gap-2">
          <p className="font-bold text-2xl sm:text-3xl text-center">
            ‼️🐴 HOLD YOUR HORSES 🐴‼️
          </p>
          <p>
            We can&rsquo;t find a valid client ID. You shouldn&rsquo;t be on
            this page unless you came from an application that&rsquo;s
            authorized to authenticate with ID.
          </p>
          <p>
            If you&rsquo;re building an app and trying to authenticate with ID,
            you&rsquo;ll need to open a PR to add your client{" "}
            <span className="underline">
              <Link
                target="_blank"
                href="https://github.com/purduehackers/id/blob/main/src/lib.rs#L196-L231"
              >
                here
              </Link>
            </span>
            . Please reach out to Jack or Matthew, or post in{" "}
            <span className="font-mono">#⚡lounge</span>, if you need help.
          </p>
          <p>
            If you just want to try authenticating with your passport for fun,{" "}
            <span className="underline">
              <Link href="https://id-auth-example.purduehackers.com">
                click here
              </Link>
            </span>
            .
          </p>
        </div>
      )}
    </div>
  );
}

export async function getServerSideProps(context: {
  query: { client_id: string | null };
}) {
  const { query } = context;
  const clientId = query.client_id;

  const isValidClientId = clientId && validClients.includes(clientId);

  return {
    props: {
      isValidClientId: !!isValidClientId,
    },
  };
}
