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
  const scopes = searchParams.get("scope").split(" ");
  console.log(scopes);

  const [passportNumber, setPassportNumber] = useState("");
  const [authState, setAuthState] = useState(
    isValidClientId ? AuthState.EnterNumber : AuthState.NoClient,
  );
  const [totpNeeded, setTotpNeeded] = useState(false);
  const [totpCode, setTotpCode] = useState("");
  const [numberFormPending, setNumberFormPending] = useState(false);
  const [numberFormError, setNumberFormError] = useState(false);

  const id = passportNumber.includes(".")
    ? parseInt(passportNumber.split(".")[1] ?? "0")
    : Number(passportNumber);

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

    if (!res.ok) {
      console.log(`Bad scan open: ${res.status} ${await res.text()}`);
      setNumberFormPending(false);
      setNumberFormError(true);
      return;
    }

    setAuthState(AuthState.WaitForScan);
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
    if (authState != AuthState.WaitForScan) {
      return;
    }

    const interval = setInterval(async () => {
      const resp = await fetch(`/api/scan?id=${id}`);
      switch (resp.status) {
        case 200:
          const { totp_needed } = await resp.json();
          setTotpNeeded(totp_needed);
          setAuthState(AuthState.Authorize);
          clearInterval(interval);
          break;
        case 201:
          break;
        default:
          console.log(`Error on request: ${await resp.text()}`);
      }
    }, 1500);

    return () => {
      clearInterval(interval);
    };
  }, [id, authState]);

  return (
    <div className="min-h-screen flex flex-col justify-center items-center font-main">
      {authState == AuthState.EnterNumber && (
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
              className="border-2 border-black w-24 p-1 rounded-sm font-mono text-xl"
              type="string"
              inputMode="numeric"
              value={passportNumber}
              onChange={(ev) => {
                if (!Number.isNaN(Number(ev.target.value))) {
                  setPassportNumber(ev.target.value);
                }
              }}
              disabled={authState != AuthState.EnterNumber}
            />
            <button
              className="py-1 px-2 font-bold bg-amber-400 hover:bg-amber-500 transition duration-100 border-2 border-black shadow-blocks-tiny disabled:bg-gray-300"
              disabled={
                passportNumber.length === 0 ||
                !/^(?:\d\.)?(\d{1,4})$/.test(passportNumber) ||
                numberFormPending
              }
            >
              {numberFormPending ? "Submitting..." : "Submit"}
            </button>
          </form>
          {numberFormError ? (
            <p className="text-red-400 max-w-md mt-2">
              Can&#39;t find a passport by this number. Either it doesn&#39;t
              exist, is not activated, or there&#39;s another active session. If
              you&#39;re sure this passport number exists, try again in 90
              seconds.
            </p>
          ) : null}
        </div>
      )}
      {authState == AuthState.WaitForScan && (
        <div className="w-11/12 sm:w-auto p-4 sm:p-12 border-2 rounded border-black shadow-blocks-sm bg-gradient-to-tr from-amber-100 to-amber-200 flex flex-col gap-2">
          <p className="font-bold text-2xl sm:text-3xl text-center">
            SCAN YOUR PASSPORT NOW
          </p>
          <p className="text-center leading-5">
            Hold your phone near your passport and open the URL.
          </p>
        </div>
      )}
      {authState == AuthState.Authorize && (
        <div className="flex flex-col justify-center items-center gap-8 w-11/12 sm:w-auto">
          <div className="flex flex-col gap-2">
            <h1 className="text-4xl text-center font-bold">Authorize?</h1>
            <p>
              <pre className="bg-gray-100 rounded px-2 inline-block">
                {clientId ?? "id"}
              </pre>{" "}
              wants to authenticate with your passport and use the following
              scopes:
              <ul>
                {scopes.map((scope: string, index: number) => {
                  return (
                    <li key={index}>
                      <pre className="bg-gray-100 rounded px-2 inline-block">
                        {scope}
                      </pre>
                    </li>
                  );
                })}
              </ul>
            </p>
          </div>
          <div className="flex flex-col justify-center items-center gap-4">
            {totpNeeded && (
              <div className="flex flex-col">
                <label htmlFor="totpInput">2FA code</label>
                <input
                  className="autofocus border-[3px] border-black p-1 rounded-sm font-mono focus:outline-none text-6xl w-64"
                  id="totpInput"
                  type="string"
                  pattern="[0-9]*"
                  inputMode="numeric"
                  value={totpCode}
                  onChange={(ev) => {
                    if (
                      ev.target.value.length < 7 &&
                      !Number.isNaN(Number(ev.target.value))
                    ) {
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
      {authState === AuthState.NoClient && (
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
