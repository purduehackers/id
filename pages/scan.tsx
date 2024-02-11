import { useRouter } from "next/router";
import { useEffect, useState } from "react";

type Status = "pending" | "complete" | "error";

export default function Scan() {
  const router = useRouter();
  const { id, secret } = router.query;

  const [status, setStatus] = useState<Status>("pending");

  useEffect(() => {
    if (id && secret) {
      console.log({ id, secret });
      fetch("/api/scan", {
        method: "POST",
        body: JSON.stringify({
          id: Number(id),
          secret,
        }),
      }).then((r) => {
        console.log({ r });
        if (r.ok) {
          setStatus("complete");
        } else {
          setStatus("error");
        }
      });
    }
  }, [id, secret]);

  return (
    <div className="min-h-screen flex flex-col justify-center items-center font-main">
      <div
        className={`w-11/12 sm:w-5/12 p-4 sm:p-12 border-2 rounded border-black shadow-blocks-sm bg-gradient-to-tr ${
          status === "pending"
            ? "from-amber-100 to-amber-200"
            : status === "complete"
            ? "from-green-100 to-green-200"
            : "from-red-100 to-red-200"
        } flex flex-col gap-2 text-center`}
      >
        {status === "pending" ? (
          <h1 className="text-3xl font-bold">Authorizing...</h1>
        ) : status === "complete" ? (
          <>
            <h1 className="text-3xl font-bold ">Success!</h1>
            <p>You can close this page now.</p>
          </>
        ) : (
          <>
            <h1 className="text-3xl font-bold">Error authorizing</h1>
            <p>
              Please try again from the beginning. If the issue persists, send a
              message in #lounge.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
